// goattech.us and www.goattech.us serve the /goattech folder as their root.
// every other host gets the repo root exactly as before.
const COMPANY_HOSTS = new Set(["goattech.us", "www.goattech.us"]);
const PREFIX = "/goattech";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Never expose the isolated campaign project through the public site.
    let safePath;
    try { safePath = decodeURIComponent(url.pathname).replace(/\\/g, "/").replace(/\/+/g, "/"); }
    catch { return new Response("not found", { status: 404 }); }
    if (safePath === "/brainrotrpg" || safePath.startsWith("/brainrotrpg/")) {
      return new Response("not found", { status: 404 });
    }

    if (COMPANY_HOSTS.has(url.hostname)) {
      const inner = new URL(url);
      inner.pathname = PREFIX + url.pathname; // pathname is already dot-segment normalized by URL
      const res = await env.ASSETS.fetch(new Request(inner, request));
      // asset redirects (e.g. /index.html -> /) must not leak the folder name
      const loc = res.headers.get("Location");
      if (res.status >= 300 && res.status < 400 && loc) {
        const target = new URL(loc, inner);
        if (target.origin === inner.origin && target.pathname.startsWith(PREFIX + "/")) {
          target.pathname = target.pathname.slice(PREFIX.length);
          const headers = new Headers(res.headers);
          headers.set("Location", target.pathname + target.search);
          return new Response(null, { status: res.status, headers });
        }
      }
      return res;
    }

    // keep the company folder off every other host
    if (url.pathname === PREFIX || url.pathname.startsWith(PREFIX + "/")) {
      return new Response("not found", { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};
