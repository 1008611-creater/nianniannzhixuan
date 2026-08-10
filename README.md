# dh.cauai.fun local copy

This folder contains the browser-visible frontend resources served by `dh.cauai.fun`.
The original server-side application is not publicly exposed, so API calls are proxied to
the original service by default.

## Run

```powershell
npm start
```

Open `http://127.0.0.1:18890`.

Use another port when needed:

```powershell
$env:PORT = 3000
npm start
```

`public` contains the downloaded resource archive. Missing static assets are fetched from
the original site on first request. Run `npm run download` to attempt a fuller archive; the
largest template videos may take longer than a normal command window timeout.
