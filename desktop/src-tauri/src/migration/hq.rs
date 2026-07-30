use std::collections::HashMap;
use std::path::{Path, PathBuf};

use tauri::Manager;

use super::copy_dir_all;

const BUZZ_RELEASE_IDENTIFIER: &str = "xyz.block.buzz.app";
const BUZZ_HQ_RELEASE_IDENTIFIER: &str = "xyz.block.buzz.hq";
const KEYRING_MIGRATION_MARKER: &str = "_hq_migration_v1";
const DATA_MIGRATION_MARKER: &str = ".buzz-hq-data-import-v1";
const RESET_MARKER: &str = ".buzz-hq-reset-v1";

fn source_app_data_dir(current: &Path) -> Option<PathBuf> {
    (current.file_name()?.to_str()? == BUZZ_HQ_RELEASE_IDENTIFIER)
        .then(|| {
            current
                .parent()
                .map(|parent| parent.join(BUZZ_RELEASE_IDENTIFIER))
        })
        .flatten()
}

pub(super) fn migrate(app: &tauri::AppHandle, reset_completed: bool) {
    migrate_app_data(app, reset_completed);
    migrate_keyring(app, reset_completed);
}

/// Copy official Buzz state once. The apps never share mutable state, and a
/// reset marker prevents a later boot from resurrecting imported data.
fn migrate_app_data(app: &tauri::AppHandle, reset_completed: bool) {
    if !crate::app_state::is_hq_build() {
        return;
    }
    let Ok(current_dir) = app.path().app_data_dir() else {
        return;
    };
    if reset_completed {
        if let Err(error) = std::fs::create_dir_all(&current_dir)
            .and_then(|()| std::fs::write(current_dir.join(RESET_MARKER), b"1"))
        {
            eprintln!("buzz-desktop: hq-reset-marker: write failed: {error}");
        }
        return;
    }
    if current_dir.join(RESET_MARKER).exists() || current_dir.join(DATA_MIGRATION_MARKER).exists() {
        return;
    }
    let Some(source_dir) = source_app_data_dir(&current_dir) else {
        return;
    };
    if !source_dir.exists() {
        return;
    }
    match copy_dir_all(&source_dir, &current_dir) {
        Ok(()) => {
            if let Err(error) = std::fs::write(current_dir.join(DATA_MIGRATION_MARKER), b"1") {
                eprintln!("buzz-desktop: hq-app-data-migration: marker write failed: {error}");
            }
        }
        Err(error) => eprintln!(
            "buzz-desktop: hq-app-data-migration: failed to copy {} to {}: {error}",
            source_dir.display(),
            current_dir.display()
        ),
    }
}

/// Copy the official secret blob into Buzz HQ's isolated keyring. Existing HQ
/// values win, the official store remains untouched, and a marker makes later
/// boots independent of the official keyring.
fn migrate_keyring(app: &tauri::AppHandle, reset_completed: bool) {
    if reset_completed || !cfg!(feature = "system-keyring") || !crate::app_state::is_hq_build() {
        return;
    }
    if app
        .path()
        .app_data_dir()
        .is_ok_and(|dir| dir.join(RESET_MARKER).exists())
    {
        return;
    }
    let source = crate::secret_store::SecretStore::keyring("buzz-desktop");
    let target = crate::secret_store::SecretStore::shared("buzz-desktop-hq");
    let target_entries = match target.load_all_readonly() {
        Ok(Some(entries)) if entries.contains_key(KEYRING_MIGRATION_MARKER) => return,
        Ok(Some(entries)) => entries,
        Ok(None) => HashMap::new(),
        Err(error) => {
            eprintln!("buzz-desktop: hq-keyring-migration: target unavailable: {error}");
            return;
        }
    };
    let source_entries = match source.load_all_readonly() {
        Ok(Some(entries)) => entries,
        Ok(None) => HashMap::new(),
        Err(error) => {
            eprintln!("buzz-desktop: hq-keyring-migration: source unavailable: {error}");
            return;
        }
    };
    let mut additions = source_entries
        .into_iter()
        .filter(|(key, _)| !target_entries.contains_key(key))
        .collect::<HashMap<_, _>>();
    additions.insert(KEYRING_MIGRATION_MARKER.to_string(), "done".to_string());
    if let Err(error) = target.store_all(&additions) {
        eprintln!("buzz-desktop: hq-keyring-migration: write failed: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hq_data_reads_official_buzz_without_sharing_its_directory() {
        let current = PathBuf::from("/Users/me/Library/Application Support/xyz.block.buzz.hq");
        let source = source_app_data_dir(&current).unwrap();
        assert_eq!(
            source,
            PathBuf::from("/Users/me/Library/Application Support/xyz.block.buzz.app")
        );
        assert_ne!(source, current);
    }
}
