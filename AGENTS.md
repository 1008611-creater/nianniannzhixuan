# Project Operating Rules

## Goal And Authority

- This repository is the authority for the browser frontend and local Node proxy for `dh.cauai.fun`.
- `main` on `https://github.com/1008611-creater/nianniannzhixuan` is the shared source authority.
- The original upstream API, database, and private media storage are external and must not be described as migrated until their source and data are actually delivered.

## Run And Verify

- Run locally with `npm start`; the default local URL is `http://127.0.0.1:18893`.
- Run `npm run verify` after application, proxy, or deployment changes.
- Verify the signed-in template and workspace routes in a real browser for media changes.

## Protected Boundaries

- Preserve same-origin authenticated API and private-media proxy behavior.
- Preserve `Content-Length`, byte ranges, and soft-delete filtering across all media consumers.
- Do not make private media public or cache session/token-authorized responses before authentication.
- Keep the authority original for downloads; playback derivatives are a separate pending backend capability.

## Collaboration And Delivery

- Use a `codex/` branch and Pull Request for shared source changes.
- Upload only runtime source and deployment manifests. Exclude Git history, screenshots, temporary files, local logs, tests, and caches from production artifacts.
- The production target is the Haikayun Ubuntu server at `38.76.193.254`, using Docker and the existing `kidswear-production` Cloudflare Tunnel.
- Run this site on host-loopback port `18893`; do not replace existing containers or public listeners on ports `80` and `443`.

## Production Authorization

- Production deploys, Cloudflare route changes, account or permission changes, credential rotation, paid services, and data deletion require explicit user authorization.
- Never store passwords, tokens, cookies, API keys, tunnel credentials, or private keys in this repository or its documentation.
