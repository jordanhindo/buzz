import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveShellRoute,
  shouldBounceForChannelNotification,
} from "./AppShell.helpers.ts";

test("deriveShellRoute_mapsWorkRouteToWorkView", () => {
  assert.deepEqual(deriveShellRoute("/work"), {
    selectedChannelId: null,
    selectedView: "work",
  });
});

test("deriveShellRoute_mapsWorkViewMapParamToMapView", () => {
  assert.deepEqual(deriveShellRoute("/work", "map"), {
    selectedChannelId: null,
    selectedView: "map",
  });
});

test("deriveShellRoute_workRouteWithNonMapViewStaysWork", () => {
  // Only view=map promotes to the Map sidebar highlight; every other lens
  // (e.g. the Projects widget's view=projects) is still the Work destination.
  assert.equal(deriveShellRoute("/work", "projects").selectedView, "work");
  assert.equal(deriveShellRoute("/work", undefined).selectedView, "work");
});

test("deriveShellRoute_unknownRouteFallsBackToHome", () => {
  assert.equal(deriveShellRoute("/").selectedView, "home");
});

test("shouldBounceForChannelNotification_allowsTopLevelChannelMessages", () => {
  assert.equal(shouldBounceForChannelNotification([["h", "channel"]]), true);
});

test("shouldBounceForChannelNotification_suppressesThreadReplies", () => {
  assert.equal(
    shouldBounceForChannelNotification([
      ["h", "channel"],
      ["e", "root", "", "reply"],
    ]),
    false,
  );
});

test("shouldBounceForChannelNotification_allowsBroadcastReplies", () => {
  assert.equal(
    shouldBounceForChannelNotification([
      ["h", "channel"],
      ["e", "root", "", "reply"],
      ["broadcast", "1"],
    ]),
    true,
  );
});
