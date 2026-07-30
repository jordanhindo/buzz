use serde::{Deserialize, Serialize};

const OFFICIAL_BUZZ_LATEST_RELEASE_API: &str =
    "https://api.github.com/repos/block/buzz/releases/latest";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopDistribution {
    variant: &'static str,
    installs_official_updates: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamBuzzRelease {
    version: String,
    release_url: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    name: String,
}

#[tauri::command]
pub fn get_desktop_distribution() -> DesktopDistribution {
    let variant = crate::app_state::desktop_variant();
    DesktopDistribution {
        variant,
        installs_official_updates: variant == "official",
    }
}

#[tauri::command]
pub async fn check_upstream_buzz_release(
    app: tauri::AppHandle,
) -> Result<Option<UpstreamBuzzRelease>, String> {
    if !crate::app_state::is_hq_build() {
        return Ok(None);
    }
    let release = reqwest::Client::new()
        .get(OFFICIAL_BUZZ_LATEST_RELEASE_API)
        .header(reqwest::header::USER_AGENT, "Buzz-HQ-upstream-monitor")
        .header(reqwest::header::CACHE_CONTROL, "no-cache")
        .send()
        .await
        .map_err(|error| format!("upstream release request failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("upstream release request failed: {error}"))?
        .json::<GitHubRelease>()
        .await
        .map_err(|error| format!("invalid upstream release response: {error}"))?;
    upstream_release_if_newer(app.package_info().version.to_string().as_str(), release)
}

fn upstream_release_if_newer(
    current_version: &str,
    release: GitHubRelease,
) -> Result<Option<UpstreamBuzzRelease>, String> {
    let current = semver::Version::parse(current_version)
        .map_err(|error| format!("invalid current version {current_version}: {error}"))?;
    let upstream_text = release.tag_name.trim_start_matches('v');
    let upstream = semver::Version::parse(upstream_text)
        .map_err(|error| format!("invalid upstream version {}: {error}", release.tag_name))?;
    if upstream <= current {
        return Ok(None);
    }
    Ok(Some(UpstreamBuzzRelease {
        version: upstream.to_string(),
        release_url: release.html_url,
        name: release.name,
    }))
}

/// Returns `true` when the running install supports Tauri's auto-updater.
///
/// On Linux, Tauri's updater only works for AppImage bundles.  The AppImage
/// runtime sets the `APPIMAGE` environment variable when the binary is
/// executed from an AppImage.  When that variable is absent (e.g. a `.deb`
/// install), the updater plugin will find an update but cannot swap the
/// binary, producing an "invalid binary format" error at install time.
///
/// On macOS and Windows every supported install format is auto-updatable,
/// so this always returns `true` on those platforms.
#[tauri::command]
pub fn is_auto_update_supported() -> bool {
    #[cfg(target_os = "linux")]
    {
        // The AppImage runtime always sets APPIMAGE to the path of the mounted
        // image file.  Its absence means we are running from a .deb, .rpm, or
        // other non-AppImage package that lacks an AppImage update target.
        std::env::var("APPIMAGE").is_ok()
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::{upstream_release_if_newer, GitHubRelease};

    fn release(tag: &str) -> GitHubRelease {
        GitHubRelease {
            tag_name: tag.to_string(),
            html_url: format!("https://github.com/block/buzz/releases/tag/{tag}"),
            name: format!("Buzz {tag}"),
        }
    }

    #[test]
    fn hq_monitor_returns_only_newer_official_releases() {
        assert!(upstream_release_if_newer("0.5.2", release("v0.5.2"))
            .unwrap()
            .is_none());
        assert!(upstream_release_if_newer("0.5.2", release("v0.5.3"))
            .unwrap()
            .is_some());
    }

    #[test]
    fn hq_monitor_rejects_malformed_release_tags() {
        assert!(upstream_release_if_newer("0.5.2", release("nightly")).is_err());
    }
}
