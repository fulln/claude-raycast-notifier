import test from "node:test";
import assert from "node:assert/strict";
import { getCodexBashRisk } from "../lib/codex-bash-risk.mjs";

test("getCodexBashRisk detects destructive shell patterns", () => {
  assert.equal(getCodexBashRisk("rm -rf build"), "recursive deletion");
  assert.equal(getCodexBashRisk("git reset --hard HEAD~1"), "hard git reset");
  assert.equal(getCodexBashRisk("git clean -fdx"), "forced git clean");
});

test("getCodexBashRisk ignores ordinary shell commands", () => {
  assert.equal(getCodexBashRisk("npm test"), null);
  assert.equal(getCodexBashRisk("git status"), null);
});
