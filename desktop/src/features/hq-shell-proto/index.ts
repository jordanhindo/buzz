// Barrel export for the HQ shell surface (#/hq-proto). Backed by the
// HqTransport contract — swapping the fixture transport for live HQ is one
// adapter. HqShellPrototype renders the Bridge (Home) directly.

export * from "./contract/types";
export { FixtureTransport } from "./contract/FixtureTransport";
export type {
  FixtureScenario,
  FixtureTransportOptions,
} from "./contract/FixtureTransport";
export * from "./primitives";
export { HqShellPrototype } from "./HqShellPrototype";
