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

### Playback derivative (implemented); private-media CDN pending

Status: **implemented in the local proxy**. After a private video is completed or first
played, the proxy generates a persistent H.264/AAC MP4 playback copy with `faststart` under
the server playback volume. The signed-in page uses the playback route while the upstream
authority original remains the source for downloads and downstream processing. A dedicated
private-media CDN is still pending and must preserve authentication before cache lookup.

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

### Delivery evidence baseline

Before changing Cloudflare or the media host, collect a redacted public-route baseline:

```powershell
./scripts/collect-http-evidence.ps1 -EntryPoint https://dh.cauai.fun/workspace
```

To prove that an unauthenticated private-media route remains protected after a cache change,
pass an unsigned same-origin media path or URL. The script strips queries and fragments before
recording output, disables cookies, requests only headers, and uses a one-byte Range request
for the range result. Do not pass a signed URL, session cookie, or token to the script.

```powershell
./scripts/collect-http-evidence.ps1 `
  -EntryPoint https://dh.cauai.fun/workspace `
  -MediaPath https://dh.cauai.fun/api/v1/media/00000000-0000-0000-0000-000000000000/playback `
  -OutputFile evidence/media-baseline.json
```

The produced record is only a transport baseline. Browser acceptance still has to verify the
ordinary signed-in page's image dimensions, `video.currentSrc`, playback, seeking, and download.

### Production storage

The container keeps playback derivatives at `/app/playback`, backed by
`/srv/kidswear-data/niannian-web/playback` on Haikayun. Keep release source under
`/opt/niannian-web`; do not put growing media data on the root filesystem.

### Agent image editing

Confirmed Agent image edits reuse the authoritative first-frame draft and persistent generation
job flow. The browser never sends private media to the retired legacy Image2 route and never
re-uploads provider output. After the one explicit billing confirmation, the server prepares its
owned inputs, creates the persistent job, privately ingests a successful result, and replaces the
project `FIRST_FRAME` node. A production iteration is complete only when a real signed-in test
proves the job is created, the provider consumes the server-owned inputs, the result is privately
stored, and the replacement survives a full reload.
