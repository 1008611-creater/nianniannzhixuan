"use strict";
(() => {
  var a = {};
  ((a.id = 4228),
    (a.ids = [4228]),
    (a.modules = {
      261: (a) => {
        a.exports = require("next/dist/shared/lib/router/utils/app-paths");
      },
      3295: (a) => {
        a.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");
      },
      10846: (a) => {
        a.exports = require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js");
      },
      12412: (a) => {
        a.exports = require("assert");
      },
      14985: (a) => {
        a.exports = require("dns");
      },
      27428: (a, b, c) => {
        c.d(b, { H: () => i, e: () => h });
        var d = c(77598),
          e = c(44046);
        let f = e.Ik({
          userId: e.Yj().uuid(),
          mediaId: e.Yj().uuid(),
          disposition: e.k5(["inline", "attachment"]),
          expiresAt: e.ai().int().positive(),
        });
        function g(a) {
          return (0, d.createHmac)(
            "sha256",
            (function () {
              let a = process.env.SESSION_SECRET || "";
              if (a.length < 32) throw Error("SESSION_SECRET_TOO_SHORT");
              return a;
            })(),
          )
            .update(`media-access:${a}`)
            .digest("base64url");
        }
        function h(a) {
          let b = Math.min(Math.max(Math.floor(a.expiresInSeconds), 60), 3600),
            c = f.parse({
              userId: a.userId,
              mediaId: a.mediaId,
              disposition: a.disposition,
              expiresAt: Math.floor(Date.now() / 1e3) + b,
            }),
            d = Buffer.from(JSON.stringify(c)).toString("base64url");
          return `${d}.${g(d)}`;
        }
        function i(a) {
          let b,
            [c, e, h] = a.split(".");
          if (!c || !e || h) throw Error("MEDIA_ACCESS_TOKEN_INVALID");
          let i = g(c),
            j = Buffer.from(e),
            k = Buffer.from(i);
          if (j.length !== k.length || !(0, d.timingSafeEqual)(j, k))
            throw Error("MEDIA_ACCESS_TOKEN_INVALID");
          try {
            b = JSON.parse(Buffer.from(c, "base64url").toString("utf8"));
          } catch {
            throw Error("MEDIA_ACCESS_TOKEN_INVALID");
          }
          let l = f.parse(b);
          if (l.expiresAt <= Math.floor(Date.now() / 1e3))
            throw Error("MEDIA_ACCESS_TOKEN_EXPIRED");
          return l;
        }
      },
      27910: (a) => {
        a.exports = require("stream");
      },
      28354: (a) => {
        a.exports = require("util");
      },
      29021: (a) => {
        a.exports = require("fs");
      },
      29294: (a) => {
        a.exports = require("next/dist/server/app-render/work-async-storage.external.js");
      },
      31421: (a) => {
        a.exports = require("node:child_process");
      },
      33873: (a) => {
        a.exports = require("path");
      },
      34631: (a) => {
        a.exports = require("tls");
      },
      41204: (a) => {
        a.exports = require("string_decoder");
      },
      42482: (a) => {
        a.exports = import("sharp");
      },
      44870: (a) => {
      a.exports = require("next/dist/compiled/next-server/app-route-turbo.runtime.prod.js");
      },
      46466: (a) => {
        a.exports = require("node:stream/promises");
      },
      48161: (a) => {
        a.exports = require("node:os");
      },
      51455: (a) => {
        a.exports = require("node:fs/promises");
      },
      53053: (a) => {
        a.exports = require("node:diagnostics_channel");
      },
      55511: (a) => {
        a.exports = require("crypto");
      },
      57075: (a) => {
        a.exports = require("node:stream");
      },
      57975: (a) => {
        a.exports = require("node:util");
      },
      59534: (a, b, c) => {
        c.a(a, async (a, d) => {
          try {
            (c.r(b),
              c.d(b, {
                GET: () => r,
                POST: () => s,
                PUT: () => s,
                runtime: () => t,
              }));
            var e = c(57075),
              f = c(23211),
              g = c(83939),
              h = c(6487),
              i = c(27428),
              j = c(89109),
              k = c(74306),
              l = c(17681),
              m = c(86139),
              n = c(42521),
              o = c(89109);
            let t = "nodejs";
            async function q(a) {
              let b = [];
              for await (let c of a)
                b.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
              return Buffer.concat(b);
            }
            async function r(a, b) {
              try {
                var c, d, h, j, p, r;
                let m,
                  s,
                  t,
                  u,
                  v,
                  w,
                  x,
                  y =
                    ((s =
                      a.headers.get("x-media-trace") ||
                      new URL(a.url).searchParams.get("trace") ||
                      ""),
                    (t = process.env.MEDIA_TRACE_ID || ""),
                    /^[a-f0-9]{16}$/i.test(s) && s === t ? s : null),
                  z = await (0, n.OC)(a),
                  A = (0, g.a)((await b.params).id),
                  B = new URL(a.url).searchParams.get("token"),
                  C =
                    null == B || "" === B
                      ? { userId: z.userId, mediaId: A, disposition: "inline" }
                      : (0, i.H)(B);
                if (C.userId !== z.userId || C.mediaId !== A)
                  throw Error("MEDIA_ACCESS_TOKEN_INVALID");
                let D = await l.prisma.mediaAsset.findFirst({
                  where: {
                    id: A,
                    userId: z.userId,
                    status: "READY",
                    deletedAt: null,
                  },
                  select: {
                    id: !0,
                    storageKey: !0,
                    originalName: !0,
                    mimeType: !0,
                    kind: !0,
                    jobOutputs: {
                      where: { kind: "ACTION_TRANSFER", status: "COMPLETED" },
                      select: { id: !0, projectId: !0 },
                      take: 1,
                    },
                  },
                });
                if (!D)
                  return f.NextResponse.json(
                    { error: "MEDIA_NOT_FOUND" },
                    { status: 404 },
                  );
                let E = (0, k.rv)(a.headers.get("range"));
                if ("inline" === C.disposition && "IMAGE" === D.kind) {
                  let a = (0, k.dS)(D.storageKey),
                    b = (await (0, k.kr)(a)) || (await (0, k.kr)(D.storageKey));
                  if (b) {
                    let a = f.NextResponse.redirect(b, 302);
                    return (
                      a.headers.set(
                        "Cache-Control",
                        "private, max-age=300, must-revalidate",
                      ),
                      a.headers.set("X-Content-Type-Options", "nosniff"),
                      a
                    );
                  }
                }
                let F =
                  "attachment" === C.disposition && "VIDEO" === D.kind
                    ? D.jobOutputs[0]
                    : null;
                for (let a of (F &&
                  (await (0, o.YL)(l.prisma, {
                    userId: z.userId,
                    projectId: F.projectId,
                    eventType: "FINAL_VIDEO_DOWNLOADED",
                    jobId: F.id,
                    mediaId: D.id,
                  })),
                "inline" !== C.disposition
                  ? []
                  : "IMAGE" === D.kind
                    ? [(0, k.dS)(D.storageKey)]
                    : "VIDEO" === D.kind
                      ? [(0, k.qx)(D.storageKey), (0, k.vl)(D.storageKey)]
                      : []))
                  try {
                    m = await (0, k.TI)(a, E);
                    break;
                  } catch (a) {
                    if (!(0, k.y2)(a)) throw a;
                  }
                try {
                  m ||= await (0, k.RN)(D.storageKey, E);
                } catch (a) {
                  if ((0, k.y2)(a))
                    return f.NextResponse.json(
                      { error: "MEDIA_OBJECT_MISSING", recoverable: !0 },
                      { status: 404, headers: { "Cache-Control": "no-store" } },
                    );
                  throw a;
                }
                let G = m.body,
                  H = m.bytes,
                  I = m.contentRange;
                if (E && !I) {
                  let a = (0, k.IE)(E, m.bytes);
                  ((c = m.body),
                    (d = a.start),
                    (h = a.end),
                    (G = e.Readable.from(
                      (async function* () {
                        let a = 0;
                        for await (let b of c) {
                          let c = Buffer.isBuffer(b) ? b : Buffer.from(b),
                            e = a,
                            f = a + c.length - 1;
                          if (((a += c.length), f < d)) continue;
                          if (e > h) break;
                          let g = Math.max(d - e, 0),
                            i = Math.min(h - e + 1, c.length);
                          if ((i > g && (yield c.subarray(g, i)), f >= h))
                            break;
                        }
                      })(),
                    )),
                    (H = a.bytes),
                    (I = a.contentRange));
                }
                let J = new Headers({
                  "Accept-Ranges": m.acceptRanges,
                  "Cache-Control":
                    "inline" === C.disposition
                      ? "IMAGE" === D.kind
                        ? "private, max-age=300, must-revalidate"
                        : "private, max-age=31536000, immutable"
                      : "private, no-store",
                  "Content-Disposition":
                    ((j = C.disposition),
                    (p = D.originalName),
                    (r = m.contentType),
                    (u =
                      "video/mp4" === r
                        ? ".mp4"
                        : "image/png" === r
                          ? ".png"
                          : "image/webp" === r
                            ? ".webp"
                            : ".jpg"),
                    (w =
                      (v = (p || `media${u}`).replace(/[\r\n]/g, ""))
                        .replace(/[^a-zA-Z0-9._-]/g, "_")
                        .slice(0, 120) || `media${u}`),
                    (x = encodeURIComponent(v).replace(
                      /[!'()*]/g,
                      (a) => `%${a.charCodeAt(0).toString(16).toUpperCase()}`,
                    )),
                    `${j}; filename="${w}"; filename*=UTF-8''${x}`),
                  "Content-Length": String(H),
                  "Content-Type": m.contentType,
                  "X-Content-Type-Options": "nosniff",
                });
                (I && J.set("Content-Range", I),
                  m.etag && J.set("ETag", m.etag),
                  m.lastModified &&
                    J.set("Last-Modified", m.lastModified.toUTCString()));
                let K = "IMAGE" === D.kind ? await q(G) : e.Readable.toWeb(G),
                  L = new Response(K, { status: I ? 206 : 200, headers: J });
                return (
                  y &&
                    console.info(
                      JSON.stringify({
                        event: "private_media_trace",
                        traceId: y,
                        status: L.status,
                        contentRange: L.headers.get("Content-Range"),
                        contentLength: L.headers.get("Content-Length"),
                        acceptRanges: L.headers.get("Accept-Ranges"),
                        cacheControl: L.headers.get("Cache-Control"),
                      }),
                    ),
                  L
                );
              } catch (b) {
                let a = (0, m.u)(b, "MEDIA_DOWNLOAD_UNAVAILABLE");
                return f.NextResponse.json(
                  { error: a },
                  {
                    status:
                      "AUTH_REQUIRED" === a
                        ? 401
                        : "MEDIA_RANGE_INVALID" === a ||
                            "MEDIA_RANGE_NOT_SATISFIABLE" === a
                          ? 416
                          : 403,
                    headers: { "Cache-Control": "no-store" },
                  },
                );
              }
            }
            async function s(a, b) {
              let c,
                d,
                e = a.headers.has("x-upload-offset");
              try {
                (0, h.d)(a);
                let i = await (0, n.OC)(a);
                if (((c = i.userId), (0, h.I)(a, i.csrfTokenHash), !a.body))
                  throw Error("MEDIA_UPLOAD_EMPTY_BODY");
                let k = (0, g.a)((await b.params).id);
                d = k;
                let m = (a.headers.get("content-type") || "")
                  .split(";", 1)[0]
                  .trim()
                  .toLowerCase();
                if (e) {
                  let b = (0, j.jn)({
                      contentLength: a.headers.get("content-length"),
                      declaredChunkLength: a.headers.get(
                        "x-upload-chunk-length",
                      ),
                      declaredTotalLength: a.headers.get(
                        "x-upload-content-length",
                      ),
                      offset: a.headers.get("x-upload-offset"),
                    }),
                    c = await (0, j.Sh)({
                      userId: i.userId,
                      mediaId: k,
                      body: a.body,
                      contentType: m,
                      ...b,
                    });
                  return (
                    c.complete &&
                      (await l.prisma.auditEvent
                        .create({
                          data: {
                            actorUserId: i.userId,
                            action: "media.upload_content_received",
                            targetType: "MediaAsset",
                            targetId: c.media.id,
                            metadata: {
                              bytes: c.totalBytes,
                              transport: "chunked",
                            },
                          },
                        })
                        .catch(() => void 0)),
                    f.NextResponse.json({
                      media: { id: c.media.id, status: c.media.status },
                      upload: {
                        receivedBytes: c.receivedBytes,
                        totalBytes: c.totalBytes,
                        complete: c.complete,
                      },
                    })
                  );
                }
                let o = (0, j.u)({
                    contentLength: a.headers.get("content-length"),
                    declaredLength: a.headers.get("x-upload-content-length"),
                  }),
                  p = await (0, j.dA)({
                    userId: i.userId,
                    mediaId: k,
                    body: a.body,
                    contentType: m,
                    contentLength: o,
                  });
                return (
                  await l.prisma.auditEvent
                    .create({
                      data: {
                        actorUserId: i.userId,
                        action: "media.upload_content_received",
                        targetType: "MediaAsset",
                        targetId: p.id,
                        metadata: { bytes: o },
                      },
                    })
                    .catch(() => void 0),
                  f.NextResponse.json({ media: { id: p.id, status: p.status } })
                );
              } catch (b) {
                let a = (0, m.u)(b, "MEDIA_UPLOAD_FAILED");
                return (
                  c &&
                    d &&
                    (e ||
                      (await (0, j.l_)({ userId: c, mediaId: d }).catch(
                        () => void 0,
                      )),
                    await l.prisma.auditEvent
                      .create({
                        data: {
                          actorUserId: c,
                          action: "media.upload_content_failed",
                          targetType: "MediaAsset",
                          targetId: d,
                          metadata: { code: a },
                        },
                      })
                      .catch(() => void 0)),
                  f.NextResponse.json({ error: a }, { status: 400 })
                );
              }
            }
            d();
          } catch (a) {
            d(a);
          }
        });
      },
      63033: (a) => {
        a.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");
      },
      73024: (a) => {
        a.exports = require("node:fs");
      },
      76760: (a) => {
        a.exports = require("node:path");
      },
      77385: (a, b, c) => {
        c.a(a, async (a, d) => {
          try {
            (c.r(b),
              c.d(b, {
                handler: () => y,
                patchFetch: () => x,
                routeModule: () => z,
                serverHooks: () => C,
                workAsyncStorage: () => A,
                workUnitAsyncStorage: () => B,
              }));
            var e = c(19225),
              f = c(84006),
              g = c(8317),
              h = c(99373),
              i = c(34775),
              j = c(24235),
              k = c(261),
              l = c(54365),
              m = c(90771),
              n = c(73461),
              o = c(67798),
              p = c(92280),
              q = c(62018),
              r = c(45696),
              s = c(47929),
              t = c(86439),
              u = c(37527),
              v = c(59534),
              w = a([v]);
            v = (w.then ? (await w)() : w)[0];
            let z = new e.AppRouteRouteModule({
                definition: {
                  kind: f.RouteKind.APP_ROUTE,
                  page: "/api/v1/media/[id]/content/route",
                  pathname: "/api/v1/media/[id]/content",
                  filename: "route",
                  bundlePath: "app/api/v1/media/[id]/content/route",
                },
                distDir: ".next",
                relativeProjectDir: "",
                resolvedPagePath:
                  "D:\\codex-work\\aaa\\kidswear-source\\src\\app\\api\\v1\\media\\[id]\\content\\route.ts",
                nextConfigOutput: "standalone",
                userland: v,
                ...{},
              }),
              {
                workAsyncStorage: A,
                workUnitAsyncStorage: B,
                serverHooks: C,
              } = z;
            function x() {
              return (0, g.patchFetch)({
                workAsyncStorage: A,
                workUnitAsyncStorage: B,
              });
            }
            async function y(a, b, c) {
              (c.requestMeta && (0, h.setRequestMeta)(a, c.requestMeta),
                z.isDev &&
                  (0, h.addRequestMeta)(
                    a,
                    "devRequestTimingInternalsEnd",
                    process.hrtime.bigint(),
                  ));
              let d = "/api/v1/media/[id]/content/route";
              "/index" === d && (d = "/");
              let e = await z.prepare(a, b, {
                srcPage: d,
                multiZoneDraftMode: !1,
              });
              if (!e)
                return (
                  (b.statusCode = 400),
                  b.end("Bad Request"),
                  null == c.waitUntil || c.waitUntil.call(c, Promise.resolve()),
                  null
                );
              let {
                  buildId: g,
                  deploymentId: v,
                  params: w,
                  nextConfig: x,
                  parsedUrl: y,
                  isDraftMode: A,
                  prerenderManifest: B,
                  routerServerContext: C,
                  isOnDemandRevalidate: D,
                  revalidateOnlyGenerated: E,
                  resolvedPathname: F,
                  clientReferenceManifest: G,
                  serverActionsManifest: H,
                } = e,
                I = (0, k.normalizeAppPath)(d),
                J = !!(B.dynamicRoutes[I] || B.routes[F]),
                K = async () => (
                  (null == C ? void 0 : C.render404)
                    ? await C.render404(a, b, y, !1)
                    : b.end("This page could not be found"),
                  null
                );
              if (J && !A) {
                let a = !!B.routes[F],
                  b = B.dynamicRoutes[I];
                if (b && !1 === b.fallback && !a) {
                  if (x.adapterPath) return await K();
                  throw new t.NoFallbackError();
                }
              }
              let L = null;
              !J || z.isDev || A || ((L = F), (L = "/index" === L ? "/" : L));
              let M = !0 === z.isDev || !J,
                N = J && !M;
              H &&
                G &&
                (0, j.setManifestsSingleton)({
                  page: d,
                  clientReferenceManifest: G,
                  serverActionsManifest: H,
                });
              let O = a.method || "GET",
                P = (0, i.getTracer)(),
                Q = P.getActiveScopeSpan(),
                R = !!(null == C ? void 0 : C.isWrappedByNextServer),
                S = !!(0, h.getRequestMeta)(a, "minimalMode"),
                T =
                  (0, h.getRequestMeta)(a, "incrementalCache") ||
                  (await z.getIncrementalCache(a, x, B, S));
              (null == T || T.resetRequestCache(),
                (globalThis.__incrementalCache = T));
              let U = {
                  params: w,
                  previewProps: B.preview,
                  renderOpts: {
                    experimental: {
                      authInterrupts: !!x.experimental.authInterrupts,
                    },
                    cacheComponents: !!x.cacheComponents,
                    supportsDynamicResponse: M,
                    incrementalCache: T,
                    cacheLifeProfiles: x.cacheLife,
                    waitUntil: c.waitUntil,
                    onClose: (a) => {
                      b.on("close", a);
                    },
                    onAfterTaskError: void 0,
                    onInstrumentationRequestError: (b, c, d, e) =>
                      z.onRequestError(a, b, d, e, C),
                  },
                  sharedContext: { buildId: g, deploymentId: v },
                },
                V = new l.NodeNextRequest(a),
                W = new l.NodeNextResponse(b),
                X = m.NextRequestAdapter.fromNodeNextRequest(
                  V,
                  (0, m.signalFromNodeResponse)(b),
                );
              try {
                let e,
                  g = async (a) =>
                    z.handle(X, U).finally(() => {
                      if (!a) return;
                      a.setAttributes({
                        "http.status_code": b.statusCode,
                        "next.rsc": !1,
                      });
                      let c = P.getRootSpanAttributes();
                      if (!c) return;
                      if (
                        c.get("next.span_type") !==
                        n.BaseServerSpan.handleRequest
                      )
                        return void console.warn(
                          `Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`,
                        );
                      let f = c.get("next.route");
                      if (f) {
                        let b = `${O} ${f}`;
                        (a.setAttributes({
                          "next.route": f,
                          "http.route": f,
                          "next.span_name": b,
                        }),
                          a.updateName(b),
                          e &&
                            e !== a &&
                            (e.setAttribute("http.route", f), e.updateName(b)));
                      } else a.updateName(`${O} ${d}`);
                    }),
                  h = async (e) => {
                    var h, i;
                    let j = async ({ previousCacheEntry: f }) => {
                        try {
                          if (!S && D && E && !f)
                            return (
                              (b.statusCode = 404),
                              b.setHeader("x-nextjs-cache", "REVALIDATED"),
                              b.end("This page could not be found"),
                              null
                            );
                          let d = await g(e);
                          a.fetchMetrics = U.renderOpts.fetchMetrics;
                          let h = U.renderOpts.pendingWaitUntil;
                          h && c.waitUntil && (c.waitUntil(h), (h = void 0));
                          let i = U.renderOpts.collectedTags;
                          if (!J)
                            return (
                              await (0, p.I)(
                                V,
                                W,
                                d,
                                U.renderOpts.pendingWaitUntil,
                              ),
                              null
                            );
                          {
                            let a = await d.blob(),
                              b = (0, q.toNodeOutgoingHttpHeaders)(d.headers);
                            (i && (b[s.NEXT_CACHE_TAGS_HEADER] = i),
                              !b["content-type"] &&
                                a.type &&
                                (b["content-type"] = a.type));
                            let c =
                                void 0 !== U.renderOpts.collectedRevalidate &&
                                !(
                                  U.renderOpts.collectedRevalidate >=
                                  s.INFINITE_CACHE
                                ) &&
                                U.renderOpts.collectedRevalidate,
                              e =
                                void 0 === U.renderOpts.collectedExpire ||
                                U.renderOpts.collectedExpire >= s.INFINITE_CACHE
                                  ? void 0
                                  : U.renderOpts.collectedExpire;
                            return {
                              value: {
                                kind: u.CachedRouteKind.APP_ROUTE,
                                status: d.status,
                                body: Buffer.from(await a.arrayBuffer()),
                                headers: b,
                              },
                              cacheControl: { revalidate: c, expire: e },
                            };
                          }
                        } catch (b) {
                          throw (
                            (null == f ? void 0 : f.isStale) &&
                              (await z.onRequestError(
                                a,
                                b,
                                {
                                  routerKind: "App Router",
                                  routePath: d,
                                  routeType: "route",
                                  revalidateReason: (0, o.c)({
                                    isStaticGeneration: N,
                                    isOnDemandRevalidate: D,
                                  }),
                                },
                                !1,
                                C,
                              )),
                            b
                          );
                        }
                      },
                      k = await z.handleResponse({
                        req: a,
                        nextConfig: x,
                        cacheKey: L,
                        routeKind: f.RouteKind.APP_ROUTE,
                        isFallback: !1,
                        prerenderManifest: B,
                        isRoutePPREnabled: !1,
                        isOnDemandRevalidate: D,
                        revalidateOnlyGenerated: E,
                        responseGenerator: j,
                        waitUntil: c.waitUntil,
                        isMinimalMode: S,
                      });
                    if (!J) return null;
                    if (
                      (null == k || null == (h = k.value) ? void 0 : h.kind) !==
                      u.CachedRouteKind.APP_ROUTE
                    )
                      throw Object.defineProperty(
                        Error(
                          `Invariant: app-route received invalid cache entry ${null == k || null == (i = k.value) ? void 0 : i.kind}`,
                        ),
                        "__NEXT_ERROR_CODE",
                        { value: "E701", enumerable: !1, configurable: !0 },
                      );
                    (S ||
                      b.setHeader(
                        "x-nextjs-cache",
                        D
                          ? "REVALIDATED"
                          : k.isMiss
                            ? "MISS"
                            : k.isStale
                              ? "STALE"
                              : "HIT",
                      ),
                      A &&
                        b.setHeader(
                          "Cache-Control",
                          "private, no-cache, no-store, max-age=0, must-revalidate",
                        ));
                    let l = (0, q.fromNodeOutgoingHttpHeaders)(k.value.headers);
                    return (
                      (S && J) || l.delete(s.NEXT_CACHE_TAGS_HEADER),
                      !k.cacheControl ||
                        b.getHeader("Cache-Control") ||
                        l.get("Cache-Control") ||
                        l.set(
                          "Cache-Control",
                          (0, r.getCacheControlHeader)(k.cacheControl),
                        ),
                      await (0, p.I)(
                        V,
                        W,
                        new Response(k.value.body, {
                          headers: l,
                          status: k.value.status || 200,
                        }),
                      ),
                      null
                    );
                  };
                R && Q
                  ? await h(Q)
                  : ((e = P.getActiveScopeSpan()),
                    await P.withPropagatedContext(
                      a.headers,
                      () =>
                        P.trace(
                          n.BaseServerSpan.handleRequest,
                          {
                            spanName: `${O} ${d}`,
                            kind: i.SpanKind.SERVER,
                            attributes: {
                              "http.method": O,
                              "http.target": a.url,
                            },
                          },
                          h,
                        ),
                      void 0,
                      !R,
                    ));
              } catch (b) {
                if (
                  (b instanceof t.NoFallbackError ||
                    (await z.onRequestError(
                      a,
                      b,
                      {
                        routerKind: "App Router",
                        routePath: I,
                        routeType: "route",
                        revalidateReason: (0, o.c)({
                          isStaticGeneration: N,
                          isOnDemandRevalidate: D,
                        }),
                      },
                      !1,
                      C,
                    )),
                  J)
                )
                  throw b;
                return (
                  await (0, p.I)(V, W, new Response(null, { status: 500 })),
                  null
                );
              }
            }
            d();
          } catch (a) {
            d(a);
          }
        });
      },
      77598: (a) => {
        a.exports = require("node:crypto");
      },
      79428: (a) => {
        a.exports = require("buffer");
      },
      83939: (a, b, c) => {
        c.d(b, { a: () => e });
        let d = c(44046).Yj().uuid();
        function e(a) {
          let b = d.safeParse(a);
          if (!b.success) throw Error("INVALID_RESOURCE_ID");
          return b.data;
        }
      },
      83997: (a) => {
        a.exports = require("tty");
      },
      86439: (a) => {
        a.exports = require("next/dist/shared/lib/no-fallback-error.external");
      },
      89109: (a, b, c) => {
        c.d(b, { ls: () => i, qM: () => g, YL: () => h, Bi: () => j });
        var d = c(17681);
        function e(a) {
          return {
            currentNode: a.currentNode,
            blocker: a.blocker ?? null,
            stale: !!a.stale,
            safeNextAction: a.safeNextAction,
          };
        }
        let f = ["PERSON", "CLOTHES", "MOTION"];
        function g(a) {
          return "string" == typeof a && a.startsWith("workspace_template:");
        }
        async function h(a, b) {
          await a.productFunnelEvent.upsert({
            where: {
              userId_projectId_eventType: {
                userId: b.userId,
                projectId: b.projectId,
                eventType: b.eventType,
              },
            },
            create: b,
            update: {},
          });
        }
        async function i(a, b) {
          let c = await d.prisma.workspaceOnboarding.findUnique({
            where: { userId: a },
          });
          if (c) return c;
          let e = b
            ? await d.prisma.project.findFirst({
                where: { id: b, userId: a, deletedAt: null, archivedAt: null },
                select: { id: !0 },
              })
            : await d.prisma.project.findFirst({
                where: { userId: a, deletedAt: null, archivedAt: null },
                orderBy: { createdAt: "asc" },
                select: { id: !0 },
              });
          try {
            return await d.prisma.workspaceOnboarding.upsert({
              where: { userId: a },
              create: { userId: a, firstProjectId: e?.id || null },
              update: {},
            });
          } catch (b) {
            if (
              b &&
              "object" == typeof b &&
              "code" in b &&
              "P2002" === b.code
            ) {
              let b = await d.prisma.workspaceOnboarding.findUnique({
                where: { userId: a },
              });
              if (b) return b;
            }
            throw b;
          }
        }
        async function j(a) {
          let b,
            c = a.onboarding || (await i(a.userId, a.projectId)),
            d = new Map(
              a.nodes
                .filter(
                  (a) =>
                    a.mediaId &&
                    a.media?.status === "READY" &&
                    !a.media.deletedAt,
                )
                .map((a) => [a.role, a]),
            ),
            h = f.every((a) => d.has(a)),
            j = d.has("FIRST_FRAME"),
            k = d.has("FINAL_VIDEO");
          return {
            stages: {
              materials: h ? "completed" : "current",
              firstFrame: j ? "completed" : h ? "current" : "pending",
              finalVideo: k ? "completed" : j ? "current" : "pending",
            },
            recommendedNextStep: h
              ? j
                ? k
                  ? "review_or_download"
                  : "create_final_video"
                : "generate_first_frame"
              : "prepare_materials",
            sampleRoles: a.nodes
              .filter((a) => a.media && g(a.media.source))
              .map((a) => a.role),
            hasFinalVideo: k,
            harness: (b = new Set(
              a.nodes
                .map((a) => ({ role: a.role, ready: !!d.has(a.role) }))
                .filter((a) => a.ready)
                .map((a) => a.role),
            )).has("PERSON")
              ? b.has("CLOTHES")
                ? b.has("SCENE")
                  ? b.has("MOTION")
                    ? b.has("FIRST_FRAME")
                      ? b.has("FINAL_VIDEO")
                        ? e({
                            currentNode: "K18",
                            safeNextAction: "review_or_download",
                          })
                        : e({
                            currentNode: "K10",
                            safeNextAction: "lock_action_transfer",
                          })
                      : e({
                          currentNode: "K06",
                          safeNextAction: "prepare_first_frame",
                        })
                    : e({
                        currentNode: "K06",
                        blocker: "请先绑定动作参考素材",
                        safeNextAction: "prepare_motion_reference",
                      })
                  : e({
                      currentNode: "K05",
                      blocker: "请先绑定场景素材",
                      safeNextAction: "prepare_scene",
                    })
                : e({
                    currentNode: "K04",
                    blocker: "请先绑定商品素材",
                    safeNextAction: "prepare_clothes",
                  })
              : e({
                  currentNode: "K03",
                  blocker: "请先绑定人物素材",
                  safeNextAction: "prepare_character",
                }),
            onboarding: {
              status: c.status.toLowerCase(),
              firstProjectId: c.firstProjectId,
              isFirstProject: c.firstProjectId === a.projectId,
              shouldShow:
                c.firstProjectId === a.projectId && "ACTIVE" === c.status && !k,
            },
          };
        }
      },
      91043: (a) => {
        a.exports = require("@aws-sdk/client-s3");
      },
      91645: (a) => {
        a.exports = require("net");
      },
      94735: (a) => {
        a.exports = require("events");
      },
      96330: (a) => {
        a.exports = require("@prisma/client");
      },
    }));
  var b = require("../../../../../../webpack-runtime.js");
  b.C(a);
  var c = b.X(0, [4741, 1813, 4046, 9275, 133, 9298, 1462, 2402], () =>
    b((b.s = 77385)),
  );
  module.exports = c;
})();
