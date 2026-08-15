# Project Agent Contract

## Startup

1. Read the repository `AGENTS.md` before editing.
2. Load `agent/skills/i-have-adhd/SKILL.md` for every user-facing turn in this project.
3. State the current step, the smallest next action, and one concrete handoff action.
4. After each substantive stage, report the concrete result first, then name the single most valuable next action and offer three mutually exclusive directions (A/B/C) when a decision is needed.

## Product Boundary

- This project owns the `dh.cauai.fun` browser frontend and the local Node proxy.
- The upstream API remains the owner of authentication, projects, jobs, media, billing, and provider execution.
- The browser owns presentation and request orchestration only; it must not invent durable project or job state.

## Frontend/Backend Contract

- `agent/contracts/workspace-api.json` is the shared route and transport contract.
- `public/workspace-v206.js` must use same-origin credentials and the declared CSRF header for mutating API requests.
- `server.mjs` must forward `/api/` requests to `REMOTE_ORIGIN` through `proxyHeaders`, preserving the authenticated response contract.
- Every public `做同款` template ID must resolve to its own V206 template context (cover, motion, and prompt). When a private project asset is temporarily unreadable, keep the project state authoritative but show that template's static preview and mark the affected input unavailable; do not retain another template's context or report the input ready.
- Run `npm run verify` after changing either side of the contract.

## Image2 Execution

- This project uses Yunwu as its only selected Image2 channel. A generic `gpt-image-2` request must not route to Yunfei, Krill, or any other provider.
- Treat Yunwu provider `429` and `503` as a bounded, visible recovery path. Fix retry budget, request ownership, and user feedback before considering an additional channel or credential.
- Do not open credential-entry work, request a key, or create a provider fallback unless the user has selected that provider for this project.

## Delivery

- Verify the signed-in `/workspace?projectId=...` path in a real browser for media or task changes.
- Production deployment remains explicitly authorized only; never place credentials in this directory.
- The user has explicitly authorized direct production deployment for this site because it currently has no customers; after each verified iteration, deploy the runtime source to the online server instead of stopping at local preview.
