import { invokeTauri } from "@/shared/api/tauri";

export type DesktopDistribution = {
  variant: "official" | "hq";
  installsOfficialUpdates: boolean;
};

export type UpstreamBuzzRelease = {
  version: string;
  releaseUrl: string;
  name: string;
};

export function getDesktopDistribution(): Promise<DesktopDistribution> {
  return invokeTauri<DesktopDistribution>("get_desktop_distribution");
}

export function checkUpstreamBuzzRelease(): Promise<UpstreamBuzzRelease | null> {
  return invokeTauri<UpstreamBuzzRelease | null>("check_upstream_buzz_release");
}
