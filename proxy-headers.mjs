const LOCAL_PROXY_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function localUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return LOCAL_PROXY_HOSTS.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

export function proxyHeaders(headers, upstreamOrigin, csrfOrigin = upstreamOrigin) {
  const result = new Headers(headers);
  result.delete("host");
  result.delete("connection");

  const csrf = new URL(csrfOrigin);
  if (localUrl(result.get("origin"))) result.set("origin", csrf.origin);

  const referer = localUrl(result.get("referer"));
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
