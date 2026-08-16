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

## NianNian workflow behavior

- Treat the project, bound media nodes, jobs, and billing state as facts from the authenticated API; never infer business state from whether a preview image or video loaded.
- After an asset action, refresh/recovery event, job transition, or failure, produce one current conclusion and at most three executable choices: continue, modify an image, or inspect/recover.
- Keep the full useful conversation history. Put the plan, evidence, cost, confirmation, and result inside the conversation; do not add a duplicate standalone advice panel.
- Ask before every paid image or video action. Show the inputs, target output, estimated cost, post-success binding location, and the no-charge-on-failure rule before confirmation.
- Use an idempotency key for paid task creation. Repeated clicks, refreshes, reconnects, and retries must reuse or recover the existing task instead of creating another chargeable task.
- On completion, verify the private output is bound to the current project and rendered or playable before claiming success. On failure, show a sanitized reason and offer retry, modify, or inspect.
- When state is restored after a refresh or disconnect, resume from the authoritative project/task state and send one restoration message; do not replay duplicate event messages.

## Project-specific handoff

For a stopped or resumed task, first load this file and the repository `AGENTS.md`, then inspect the actual browser/API state before proposing work. Do not claim completion from a build, HTTP status, or provider receipt alone.
