# dh.cauai.fun local copy

This folder contains the browser-visible frontend resources served by `dh.cauai.fun`.
The original server-side application is not publicly exposed, so API calls are proxied to
the original service by default.

## Run

```powershell
npm start
```

Open `http://127.0.0.1:18893`.

After starting the server, run `npm run verify` to check the homepage, local assets,
health endpoint, and the upstream API proxy.

Use another port when needed:

```powershell
$env:PORT = 3000
npm start
```

`public` contains the downloaded resource archive. Missing static assets are fetched from
the original site on first request. Run `npm run download` to attempt a fuller archive; the
largest template videos may take longer than a normal command window timeout.

## Authoritative implementation status

### Pending: playback derivative and private-media CDN

Status: **not implemented**. The local proxy now preserves byte ranges and streams with
backpressure, but long private videos can still start slowly because the browser consumes
the upstream authority original. This repository contains the browser frontend and local
proxy only; completing this item requires the upstream media backend, storage, and deploy
configuration.

Implementation contract:

1. Keep each uploaded/provider original immutable for audit and download. After the source
   is complete, create one idempotent MP4 playback derivative keyed by media ID and source
   version. Use H.264, `yuv420p`, AAC, measured CRF/bitrate, the original dimensions, and
   `-movflags +faststart`.
2. Return separate playback and download routes. The page prefers the derivative for inline
   playback, falls back to the prior playable source when derivative generation fails, and
   always downloads the authority original.
3. Preserve `Content-Length`, `Accept-Ranges`, and `206` responses. If a CDN is introduced,
   authenticate before cache lookup and cache only the immutable media/version/variant key;
   never place session cookies, user tokens, or signed query values in the cache key.

Completion evidence:

- The signed-in page's `video.currentSrc` uses the playback derivative and starts, advances,
  and seeks successfully on the normal user route.
- Playback returns the expected MP4 content type and valid byte ranges; download returns the
  unchanged original.
- Unsigned, altered, and expired private-media requests still return `401` or `403` after the
  cache is warm.
- Derivative creation does not duplicate provider jobs, billing events, or media records.
