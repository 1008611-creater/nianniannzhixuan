# Project Operating Rules

## Goal And Authority

- This repository is the authority for the browser frontend and local Node proxy for `dh.cauai.fun`.
- `main` on `https://github.com/1008611-creater/nianniannzhixuan` is the shared source authority.
- The original upstream API, database, and private media storage are external and must not be described as migrated until their source and data are actually delivered.

## Run And Verify

- Run locally with `npm start`; the default local URL is `http://127.0.0.1:18893`.
- Run `npm run verify` after application, proxy, or deployment changes.
- Verify the signed-in template and workspace routes in a real browser for media changes.
- For template videos, previews may stay lightweight, but playback must resolve the original or an HD derivative; verify the browser's loaded `videoWidth` and `videoHeight` on the affected route.
- After every substantive iteration, verify the affected signed-in user path in the in-app browser and compare the observed result with the intended behavior; build success, HTTP 200, or static tests alone are not completion evidence. Record any failed real-page expectation and do not claim the iteration complete until it is retested successfully.
- When a frontend JS or CSS behavior change is deployed, give the changed resource a new versioned URL and verify in a fresh signed-in browser page that the intended control is present and actionable; a reused cached asset is not completion evidence.
- The peer routes `/templates`, `/workspace`, `/pricing`, and `/billing` must use the same `index.html` shell. `/workspace` may lazy-load its editor module and stylesheet, but route changes must use history navigation without a document reload.
- Project-management covers must have a terminal visual state: use the selected private medium when readable, then another bound project medium as a fallback; the card must settle within a bounded total deadline and must never remain indefinitely in a generating state. Verify this on a fresh signed-in `/projects` page after changing cover behavior.
- Initial workspace entry must use one atomic first render: keep the loading state while the requested project, bound media, task state, and assistant conversation are read, then commit the complete view once. Background refreshes and event recovery may patch stable state only and must not replay the loading skeleton or replace the whole workspace. Verify a fresh signed-in refresh shows one loading phase followed by one settled project view, without placeholder-media flashes or repeated full-page remounts.

## Domestic CDN Default

- For this China-facing production site, default public delivery to the Tencent CDN domain configured for `dh.cauai.fun`; verify the provider is active, the DNS record points to the provider CNAME, and a real static asset returns the provider edge/cache headers before claiming acceleration.
- Keep page/API responses and session- or token-authorized private media dynamic and authenticated. Do not make them publicly cacheable just to improve a speed measurement.
- After any DNS or CDN change, verify a fresh signed-in `/templates` and `/workspace` page, a real image, and a playable video. A provider dashboard toggle or DNS record alone is not completion evidence.

## Protected Boundaries

- Preserve same-origin authenticated API and private-media proxy behavior.
- Preserve `Content-Length`, byte ranges, and soft-delete filtering across all media consumers.
- Do not make private media public or cache session/token-authorized responses before authentication.
- Keep the authority original for downloads; authenticated playback derivatives are implemented in the local proxy. A private-media CDN remains a separate pending capability.
- `dh-origin.cauai.fun` is the legacy authenticated backend on port `8791`; `dh.cauai.fun` is the local frontend/proxy on `18893`. Never point `REMOTE_ORIGIN` at the public frontend domain, which creates a proxy loop.
- Legacy web and worker media readers must accept Node streams, Web Streams, and async iterables returned by the S3 SDK. Verify an actual signed-in private image after either container is rebuilt.
- The legacy Next 16 media-route overlay must use the installed Turbo runtime module names and must not eagerly import image-rendition code into the GET path when the production image lacks the optional `sharp` runtime.

## Image2 Channel Policy

- The authorized production Image2 channel is Yunwu. Do not select Yunfei, Krill, RunningHub, or any other provider from a generic model name, a local Skill default, or a missing-key diagnosis.
- For Yunwu `429` or `503`, keep the failure user-visible, apply the bounded retry policy, and record the sanitized category. Do not ask for another credential or offer a provider switch unless the user explicitly requests that provider.
- Before changing a provider, credential, model, or paid routing policy, verify the selected channel in the deployed configuration and obtain the required explicit authorization. A missing credential for an unselected provider is not a current blocker.

## Image2 Worker Execution And Acceptance

- Start an Image2 worker through the official `agent-vault vault run -- npm run worker` path. Do not construct or inject a Vault proxy URL manually.
- Before a paid Image2 request, verify that every selected private input can be fully read by the worker through its intended authenticated route; a successful response header alone is insufficient.
- Accept a real Image2 generation only after the task reaches a terminal success state, its private output is linked back to the project, and the signed-in workspace renders that output. Provider model-list probes and queued-task states are diagnostic evidence, not completion.

## Collaboration And Delivery

- Use a `codex/` branch and Pull Request for shared source changes.
- Upload only runtime source and deployment manifests. Exclude Git history, screenshots, temporary files, local logs, tests, and caches from production artifacts.
- The production target is the Haikayun Ubuntu server at `38.76.193.254`, using Docker and the existing `haika-niannian-primary` Cloudflare Tunnel.
- Persist playback derivatives and future media staging under `/srv/kidswear-data/niannian-web`; keep `/opt/niannian-web` for release source and Compose files only.
- Run this site on host-loopback port `18893`; do not replace existing containers or public listeners on ports `80` and `443`.

## Production Authorization

- Production deploys, Cloudflare route changes, account or permission changes, credential rotation, paid services, and data deletion require explicit user authorization.
- Never store passwords, tokens, cookies, API keys, tunnel credentials, or private keys in this repository or its documentation.
