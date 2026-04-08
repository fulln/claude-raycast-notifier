import test from "node:test";
import assert from "node:assert/strict";
import { shouldSpeak } from "../lib/voice.mjs";

test("shouldSpeak blocks duplicate messages inside the cooldown", () => {
  const first = shouldSpeak(
    { lastSpokenAt: null, lastSpokenText: null },
    "Claude needs your input",
    15_000,
    1_000,
  );
  const second = shouldSpeak(
    { lastSpokenAt: 1_000, lastSpokenText: "Claude needs your input" },
    "Claude needs your input",
    15_000,
    10_000,
  );

  assert.equal(first, true);
  assert.equal(second, false);
});
