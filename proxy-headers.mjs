const LOCAL_PROXY_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function localUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return LOCAL_PROXY_HOSTS.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

function sameHostUrl(value, host) {
  try {
    const url = new URL(String(value || ""));
    return host && url.host.toLowerCase() === String(host).toLowerCase() ? url : null;
  } catch {
    return null;
  }
}

export function proxyHeaders(headers, upstreamOrigin, csrfOrigin = upstreamOrigin, requestHost = "") {
  const result = new Headers(headers);
  result.delete("host");
  result.delete("connection");
  // The origin may select Zstandard for JSON. Node's fetch does not decode it,
  // so request identity and keep the browser-facing response parseable.
  result.set("accept-encoding", "identity");

  const csrf = new URL(csrfOrigin);
  const forwardedPublicHost = result.get("x-forwarded-public-host");
  const effectiveHost = forwardedPublicHost || requestHost;
  result.delete("x-forwarded-public-host");
  const origin = localUrl(result.get("origin")) || sameHostUrl(result.get("origin"), effectiveHost);
  if (origin) result.set("origin", csrf.origin);

  const referer = localUrl(result.get("referer")) || sameHostUrl(result.get("referer"), effectiveHost);
  if (referer) {
    const upstreamReferer = new URL(csrf.origin);
    upstreamReferer.pathname = referer.pathname;
    upstreamReferer.search = referer.search;
    result.set("referer", upstreamReferer.href);
  }
  return result;
}

export function proxyResponseHeaders(headers) {
  const result = new Headers(headers);
  result.delete("connection");
  result.delete("transfer-encoding");
  if (result.has("content-encoding")) {
    result.delete("content-encoding");
    result.delete("content-length");
  }
  return result;
}
