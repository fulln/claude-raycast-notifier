# Claude Code Raycast Input Feasibility

## Summary

This document records the feasibility review for routing Claude Code user
questions into Raycast, collecting the response there, and sending the answer
back into Claude Code through hooks.

Current conclusion:

- Claude Code supports this for `AskUserQuestion`
- interactive `claude` sessions are the best first target
- `claude -p` and SDK wrappers are also supported through `defer` and `--resume`
- Gemini CLI and GitHub Copilot should still be treated as notification-only in
  this repository unless their hook docs expose equivalent answer injection
- Raycast already exposes the two primitives this flow needs: deeplinks with
  command arguments and submit-capable forms

## Why It Is Feasible

Claude Code's hooks reference explicitly documents the pieces needed for this
flow:

- `PreToolUse` can match the `AskUserQuestion` tool
- `AskUserQuestion` input includes a `questions` array
- hooks can return `hookSpecificOutput.updatedInput`
- `AskUserQuestion` can be answered programmatically by echoing back the
  original `questions` and adding an `answers` object
- in non-interactive mode, `permissionDecision: "defer"` plus `claude -p --resume`
  provides an official pause-and-resume round trip

That means the hook can read the pending question payload from stdin, send it
to Raycast, wait for a response, and then return:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": {
      "questions": [],
      "answers": {}
    }
  }
}
```

Claude Code then executes the tool without opening its own prompt UI.

## Officially Verified Behavior

The following points are directly documented by the official sources rather
than inferred:

- Claude Code `PreToolUse` supports matching `AskUserQuestion`
- `AskUserQuestion` carries one to four multiple-choice questions
- `answers` is optional input and must be supplied by the hook through
  `updatedInput`
- `updatedInput` replaces the entire tool input, so unchanged fields must also
  be echoed back
- hooks block Claude by default unless `async: true` is set
- async hooks are not usable for this feature because async hooks cannot return
  effective decisions
- `defer` is only honored in non-interactive `claude -p` flows
- Raycast deeplinks can launch a specific extension command and pass a
  URL-encoded JSON `arguments` object
- Raycast commands receive those values through the `arguments` prop
- Raycast forms support `Action.SubmitForm`
- Raycast provides `Form.Dropdown` for single-select and `Form.TagPicker` for
  multi-select UI

These points matter because they remove the core feasibility risk:

- Claude can be synchronously paused while the hook waits
- Raycast can render the question payload with a first-class UI
- the answer can be returned through a documented Claude hook field instead of
  an unsupported transcript hack

## Current Repo Relevance

The repository already has part of the plumbing:

- `hooks/lib/raycast-deeplink.mjs` already launches a Raycast command with a
  base64 payload argument
- `raycast-extension/package.json` already declares an argument-driven internal
  command
- `raycast-extension/src/notify-event.tsx` already decodes a payload and shows
  either a list of options or a text input form

What is still missing is the actual answer round trip:

- today the Raycast UI copies the selected value to the clipboard and opens the
  source app
- no hook currently waits on a response file or returns `updatedInput.answers`
- the existing command is notification-oriented and should not become the only
  entrypoint for interactive question handling

## Recommended Runtime Contract

For the interactive `claude` path, the cleanest contract is:

1. Claude fires `PreToolUse` for `AskUserQuestion`
2. The hook reads `session_id`, `tool_use_id`, and `tool_input.questions`
3. The hook opens a dedicated Raycast command with one encoded `payload`
   argument
4. Raycast renders:
   - `Form.Dropdown` for single-select questions
   - `Form.TagPicker` for `multiSelect: true`
   - `Action.SubmitForm` to finalize the response
5. Raycast writes a response record keyed by `session_id + tool_use_id`
6. The hook polls that record and returns `permissionDecision: "allow"` with
   `updatedInput`
7. If the user cancels or times out, the hook returns `deny` with a clear
   reason

Why this contract fits the current repo:

- the extension already uses a single base64 `payload` argument, which stays
  within Raycast's documented argument limits
- the existing notifier state directory under `~/.claude-raycast-notifier`
  already gives this project a natural place to store transient response files
- the hook remains the only writer back into Claude, which keeps the Claude
  protocol boundary narrow

## Interactive vs Non-Interactive

Interactive `claude`:

- best first target
- simplest user experience
- no outer orchestrator needed
- the hook can synchronously wait because hooks block by default

Non-interactive `claude -p` or SDK wrappers:

- officially supported, but it is a different control model
- use `permissionDecision: "defer"` first
- surface the question in Raycast or another UI
- then resume with `claude -p --resume <session-id>`

This means one repository can support both modes later, but they should not
share the exact same control flow implementation.

## Recommended Scope

The first implementation should stay narrow:

- target `AskUserQuestion` only
- target interactive `claude` sessions first
- use Raycast only as the UI surface
- use a local state file for answer handoff between the hook process and the
  Raycast command

This keeps the implementation aligned with the repository's current bridge
design and avoids mixing two different protocols (`AskUserQuestion` and MCP
`Elicitation`) in the same first pass.

## Boundaries And Risks

- This does not mean "all Claude Code prompts" can be intercepted. The safe
  target is the documented `AskUserQuestion` tool.
- Raycast has to be available and responsive. The hook needs a timeout and
  cancellation path.
- Concurrent sessions need stable correlation keys such as `session_id` and
  `tool_use_id`.
- The repository should not imply that Gemini or Copilot can accept answers
  back through the same mechanism without separate documentation review.
- Native Windows is not a supported Raycast target. Any future interactive
  bridge remains macOS-first even if hook-only installation is allowed on Linux.
- Raycast deeplinks also support `launchType=background`, but that should not
  be used for this feature because the user needs a visible form.

## Suggested Runtime Shape

- Add a dedicated Claude `PreToolUse` hook for `AskUserQuestion`
- Parse the tool payload from stdin
- Open a dedicated Raycast command through the existing deeplink mechanism
- Render the questions as a dynamic form or choice list
- Persist the selected answer to a local response file
- Poll that file from the hook process
- Return `updatedInput.answers` on success
- Return a clear denial reason on timeout or cancellation

## Follow-up Work

- add a dedicated Raycast command for interactive Claude questions
- add a dedicated hook bridge instead of reusing the notification bridge
- define the response file schema and lifecycle
- add concurrency and timeout tests for the hook-side answer handoff

## Sources

- Claude Code Hooks Reference: https://code.claude.com/docs/en/hooks
- Raycast Deeplinks: https://developers.raycast.com/information/lifecycle/deeplinks
- Raycast Arguments: https://developers.raycast.com/information/lifecycle/arguments
- Raycast Form API: https://developers.raycast.com/api-reference/user-interface/form
