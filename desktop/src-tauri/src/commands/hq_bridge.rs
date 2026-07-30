//! Native bridge to the local HQ control plane.
//!
//! The HQ daemon is a *locked* local control plane: every `/v1` read needs an
//! OS-local capability token **and** a matching project-binding header, and it
//! sends no CORS. So the webview cannot fetch it directly. The `hq` CLI already
//! holds that capability, so the app reaches HQ by shelling the CLI from the
//! native side and handing the parsed JSON back to the webview.
//!
//! Only a fixed allowlist of **read** verbs is reachable — the webview can never
//! drive arbitrary CLI execution through this bridge, and `std::process::Command`
//! is invoked with an explicit argv (no shell), so there is no interpolation
//! surface.

use serde_json::Value;

/// Resolve a webview-supplied verb key + optional id into the exact `hq` argv.
/// Anything outside this table is refused before a process is ever spawned.
fn resolve_argv(verb: &str, arg: Option<&str>) -> Result<Vec<String>, String> {
    let mut argv: Vec<String> = match verb {
        "next" => vec!["next".into()],
        "workstream-list" => vec!["workstream".into(), "list".into()],
        "workstream-show" => vec!["workstream".into(), "show".into()],
        // The conversation-binding read (`hq workstream binding <subject-id>`) —
        // the live source LiveHqTransport's `/v1/conversation-bindings/:id`
        // resolves to. Serves the live agent session + bound-conversation state.
        "workstream-binding" => vec!["workstream".into(), "binding".into()],
        "outcome-show" => vec!["outcome".into(), "show".into()],
        "run-show" => vec!["run".into(), "show".into()],
        "run-list" => vec!["run".into(), "list".into()],
        "founder-attention" => vec!["founder".into(), "attention".into()],
        // The currently-open release's report — the verb LiveHqTransport's
        // `/v1/releases` read resolves to (`tauriHqClient`). Must match, or the
        // Releases surface silently degrades to empty on live HQ.
        "release-report" => vec!["release".into(), "report".into()],
        other => {
            return Err(format!(
                "hq_read: verb '{other}' is not in the read allowlist"
            ))
        }
    };

    // Verbs that take a single positional id (e.g. `hq workstream show <id>`).
    let needs_id = matches!(
        verb,
        "workstream-show" | "workstream-binding" | "outcome-show" | "run-show"
    );
    if needs_id {
        let id = arg.ok_or_else(|| format!("hq_read: verb '{verb}' requires an id"))?;
        let trimmed = id.trim();
        // An id starting with '-' would be parsed as a flag; reject rather than
        // let the webview reach unlisted CLI options.
        if trimmed.is_empty() || trimmed.starts_with('-') {
            return Err(format!("hq_read: invalid id '{id}' for verb '{verb}'"));
        }
        argv.push(trimmed.to_string());
    }

    // `run-list` takes an optional workstream filter: `hq run list --workstream <id>`.
    // Passed as a flag (not a positional), so it lives outside the needs_id path.
    if verb == "run-list" {
        if let Some(id) = arg {
            let trimmed = id.trim();
            if trimmed.is_empty() || trimmed.starts_with('-') {
                return Err(format!(
                    "hq_read: invalid workstream id '{id}' for run-list"
                ));
            }
            argv.push("--workstream".into());
            argv.push(trimmed.to_string());
        }
    }

    argv.push("--json".into());
    Ok(argv)
}

/// Resolve the `hq` executable to spawn.
///
/// A Finder-launched macOS app inherits a minimal PATH (typically
/// `/usr/bin:/bin:/usr/sbin:/sbin`) that excludes `~/.local/bin` and the Homebrew
/// prefixes where `hq` is installed, so a bare `Command::new("hq")` can fail with
/// NotFound even when the CLI works in a terminal. Honour an explicit `HQ_BIN`
/// override first, then fall back to the well-known install locations. Returns a
/// bare `"hq"` when none resolve, so ordinary PATH lookup still gets a chance and
/// the spawn error stays honest.
fn resolve_hq_bin() -> std::ffi::OsString {
    if let Some(explicit) = std::env::var_os("HQ_BIN") {
        if !explicit.is_empty() {
            return explicit;
        }
    }

    let mut candidates: Vec<std::path::PathBuf> = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        candidates.push(std::path::Path::new(&home).join(".local/bin/hq"));
    }
    candidates.push(std::path::PathBuf::from("/opt/homebrew/bin/hq"));
    candidates.push(std::path::PathBuf::from("/usr/local/bin/hq"));

    for candidate in candidates {
        if candidate.is_file() {
            return candidate.into_os_string();
        }
    }

    std::ffi::OsString::from("hq")
}

/// Run one allowlisted read verb against the local `hq` CLI and return its
/// parsed JSON. Failures surface honestly (spawn error, non-zero exit with the
/// CLI's own stderr, or non-JSON stdout) rather than degrading to empty data —
/// so a broken project binding shows as an error the UI can report, not as a
/// silently empty portfolio.
#[tauri::command]
pub async fn hq_read(verb: String, arg: Option<String>) -> Result<Value, String> {
    let argv = resolve_argv(&verb, arg.as_deref())?;
    let display = argv.join(" ");

    let output = tokio::task::spawn_blocking(move || {
        std::process::Command::new(resolve_hq_bin())
            .args(&argv)
            .output()
    })
    .await
    .map_err(|error| format!("hq_read: task join error: {error}"))?
    .map_err(|error| {
        format!("hq_read: failed to spawn `hq` ({error}); is the HQ CLI installed and on PATH?")
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("hq_read: `hq {display}` failed: {}", stderr.trim()));
    }

    // Node prints its SQLite ExperimentalWarning to stderr, so stdout is the
    // clean JSON document.
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str::<Value>(stdout.trim())
        .map_err(|error| format!("hq_read: `hq {display}` did not return JSON: {error}"))
}

#[cfg(test)]
mod tests {
    use super::resolve_argv;

    #[test]
    fn maps_bare_verbs() {
        assert_eq!(resolve_argv("next", None).unwrap(), vec!["next", "--json"]);
        assert_eq!(
            resolve_argv("workstream-list", None).unwrap(),
            vec!["workstream", "list", "--json"]
        );
        assert_eq!(
            resolve_argv("founder-attention", None).unwrap(),
            vec!["founder", "attention", "--json"]
        );
        // Must match tauriHqClient's `/v1/releases` → "release-report" mapping.
        assert_eq!(
            resolve_argv("release-report", None).unwrap(),
            vec!["release", "report", "--json"]
        );
    }

    #[test]
    fn appends_id_for_show_verbs() {
        assert_eq!(
            resolve_argv("workstream-show", Some("ws-42")).unwrap(),
            vec!["workstream", "show", "ws-42", "--json"]
        );
    }

    #[test]
    fn maps_workstream_binding_with_id() {
        // Must match tauriHqClient's `/v1/conversation-bindings/:id` mapping.
        assert_eq!(
            resolve_argv("workstream-binding", Some("launch-site")).unwrap(),
            vec!["workstream", "binding", "launch-site", "--json"]
        );
        // Id is required and flag-like ids are rejected (no CLI option smuggling).
        assert!(resolve_argv("workstream-binding", None).is_err());
        assert!(resolve_argv("workstream-binding", Some("--oops")).is_err());
    }

    #[test]
    fn rejects_unlisted_verb() {
        assert!(resolve_argv("delete-everything", None).is_err());
    }

    #[test]
    fn rejects_missing_id() {
        assert!(resolve_argv("workstream-show", None).is_err());
    }

    #[test]
    fn rejects_flag_shaped_id() {
        assert!(resolve_argv("run-show", Some("--force")).is_err());
    }

    #[test]
    fn run_list_appends_optional_workstream_filter() {
        assert_eq!(
            resolve_argv("run-list", None).unwrap(),
            vec!["run", "list", "--json"]
        );
        assert_eq!(
            resolve_argv("run-list", Some("demand-loop")).unwrap(),
            vec!["run", "list", "--workstream", "demand-loop", "--json"]
        );
        assert!(resolve_argv("run-list", Some("--sneaky")).is_err());
    }

    #[test]
    fn hq_bin_env_override_wins() {
        let previous = std::env::var_os("HQ_BIN");
        std::env::set_var("HQ_BIN", "/custom/path/hq");
        assert_eq!(
            super::resolve_hq_bin(),
            std::ffi::OsString::from("/custom/path/hq")
        );
        match previous {
            Some(value) => std::env::set_var("HQ_BIN", value),
            None => std::env::remove_var("HQ_BIN"),
        }
    }
}
