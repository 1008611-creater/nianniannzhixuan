# Project Agent Contract

## Startup

1. Read the repository `AGENTS.md` before editing.
2. Load `agent/skills/i-have-adhd/SKILL.md` for every user-facing turn in this project.
3. State the current step, the smallest next action, and one concrete handoff action.

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

## Delivery

- Verify the signed-in `/workspace?projectId=...` path in a real browser for media or task changes.
- Production deployment remains explicitly authorized only; never place credentials in this directory.
