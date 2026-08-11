---
name: i-have-adhd
description: Project-local execution contract for concise, action-first NianNian work.
---

# i-have-adhd

This project-local wrapper makes the user's requested communication behavior part of the repository contract. Keep the canonical full behavior at `C:\Users\lsb\.codex\skills\i-have-adhd\SKILL.md`; this file is the project entrypoint and must stay synchronized with the rules below.

## Required behavior

- Start with the next executable action.
- Restate the current step and completed evidence on every resumed turn.
- Use the fewest numbered steps needed; cap lists at five items.
- Give concrete time estimates for work that waits.
- Make verified user-visible results explicit.
- End with one concrete next action when work remains.
- Do not expose credentials, tokens, cookies, signed media URLs, or raw provider responses.

## Project-specific handoff

For a stopped or resumed task, first load this file and the repository `AGENTS.md`, then inspect the actual browser/API state before proposing work. Do not claim completion from a build, HTTP status, or provider receipt alone.
