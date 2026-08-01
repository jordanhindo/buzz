//! Protected native-session bindings consumed by the resident Buzz harness.
//!
//! `buzz-acp attach-session` validates an ACP session and writes one binding.
//! The normal event path reads the binding and loads it only when the owner
//! message is dispatched for that channel. Registration itself never prompts.

use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const STORE_VERSION: u32 = 1;
const MAX_STORE_BYTES: u64 = 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(crate) struct SessionBinding {
    pub(crate) revision: Uuid,
    pub(crate) channel_id: Uuid,
    pub(crate) session_id: String,
    pub(crate) cwd: String,
}

#[derive(Default, Deserialize, Serialize)]
struct SessionBindingFile {
    version: u32,
    bindings: HashMap<Uuid, SessionBinding>,
}

/// Per-agent persistent binding store. A disabled store is useful in tests and
/// leaves the established static `--existing-session-id` path untouched.
#[derive(Clone, Debug)]
pub(crate) struct SessionBindingStore {
    path: Option<PathBuf>,
}

impl SessionBindingStore {
    pub(crate) fn for_agent_home(agent_home: &Path, agent_pubkey: &str) -> Self {
        Self {
            path: Some(
                agent_home
                    .join(".buzz-acp")
                    .join("session-bindings")
                    .join(format!("{agent_pubkey}.json")),
            ),
        }
    }

    #[cfg(test)]
    pub(crate) fn disabled() -> Self {
        Self { path: None }
    }

    pub(crate) fn register(
        &self,
        channel_id: Uuid,
        session_id: String,
        cwd: String,
    ) -> Result<SessionBinding> {
        let path = self
            .path
            .as_ref()
            .context("session binding store is disabled")?;
        let mut file = self.read_file()?;
        let binding = SessionBinding {
            revision: Uuid::new_v4(),
            channel_id,
            session_id,
            cwd,
        };
        file.version = STORE_VERSION;
        file.bindings.insert(channel_id, binding.clone());
        self.write_file(path, &file)?;
        Ok(binding)
    }

    pub(crate) fn binding_for_channel(&self, channel_id: Uuid) -> Result<Option<SessionBinding>> {
        Ok(self.read_file()?.bindings.remove(&channel_id))
    }

    fn read_file(&self) -> Result<SessionBindingFile> {
        let Some(path) = self.path.as_ref() else {
            return Ok(SessionBindingFile::default());
        };
        if !path.exists() {
            return Ok(SessionBindingFile::default());
        }

        let metadata = fs::symlink_metadata(path)
            .with_context(|| format!("read session binding metadata at {}", path.display()))?;
        anyhow::ensure!(
            !metadata.file_type().is_symlink(),
            "session binding store must not be a symlink"
        );
        anyhow::ensure!(
            metadata.len() <= MAX_STORE_BYTES,
            "session binding store exceeds {MAX_STORE_BYTES} bytes"
        );
        ensure_private_file(&metadata)?;

        let bytes = fs::read(path)
            .with_context(|| format!("read session binding store at {}", path.display()))?;
        let file: SessionBindingFile = serde_json::from_slice(&bytes)
            .with_context(|| format!("parse session binding store at {}", path.display()))?;
        anyhow::ensure!(
            file.version == STORE_VERSION,
            "unsupported session binding store version {}",
            file.version
        );
        Ok(file)
    }

    fn write_file(&self, path: &Path, file: &SessionBindingFile) -> Result<()> {
        let parent = path
            .parent()
            .context("session binding store has no parent")?;
        create_private_dir(parent)?;

        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .context("session binding store has an invalid file name")?;
        let temp_path = parent.join(format!(".{file_name}.{}.tmp", Uuid::new_v4()));
        let bytes = serde_json::to_vec(file).context("serialize session binding store")?;
        anyhow::ensure!(
            bytes.len() as u64 <= MAX_STORE_BYTES,
            "session binding store exceeds {MAX_STORE_BYTES} bytes"
        );

        let write_result = (|| -> Result<()> {
            let mut options = OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut temp = options
                .open(&temp_path)
                .with_context(|| format!("create {}", temp_path.display()))?;
            temp.write_all(&bytes)
                .with_context(|| format!("write {}", temp_path.display()))?;
            temp.sync_all()
                .with_context(|| format!("sync {}", temp_path.display()))?;
            fs::rename(&temp_path, path)
                .with_context(|| format!("replace session binding store at {}", path.display()))?;
            Ok(())
        })();

        if write_result.is_err() {
            let _ = fs::remove_file(&temp_path);
        }
        write_result
    }
}

fn create_private_dir(path: &Path) -> Result<()> {
    fs::create_dir_all(path).with_context(|| format!("create {}", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .with_context(|| format!("protect {}", path.display()))?;
    }
    Ok(())
}

fn ensure_private_file(metadata: &fs::Metadata) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        anyhow::ensure!(
            metadata.permissions().mode() & 0o077 == 0,
            "session binding store permissions must not allow group or world access"
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protected_store_round_trips_and_replaces_one_channel_binding() {
        let root = std::env::temp_dir().join(format!("buzz-acp-bindings-{}", Uuid::new_v4()));
        let store = SessionBindingStore::for_agent_home(&root, "agent-pubkey");
        let channel = Uuid::new_v4();

        let first = store
            .register(channel, "native-one".into(), "/tmp/one".into())
            .expect("register first binding");
        let second = store
            .register(channel, "native-two".into(), "/tmp/two".into())
            .expect("replace binding");

        assert_ne!(first.revision, second.revision);
        let loaded = store
            .binding_for_channel(channel)
            .expect("read binding")
            .expect("binding exists");
        assert_eq!(loaded.session_id, "native-two");
        assert_eq!(loaded.cwd, "/tmp/two");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = fs::metadata(store.path.as_ref().unwrap()).expect("binding metadata");
            assert_eq!(metadata.permissions().mode() & 0o077, 0);
        }

        fs::remove_dir_all(root).expect("remove test binding store");
    }

    #[test]
    fn disabled_store_never_has_a_binding() {
        assert!(SessionBindingStore::disabled()
            .binding_for_channel(Uuid::new_v4())
            .expect("disabled store is readable")
            .is_none());
    }
}
