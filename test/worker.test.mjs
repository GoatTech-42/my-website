import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

function makeEnv(handler) {
  const calls = [];
  return {
    calls,
    ASSETS: {
      async fetch(req) {
        calls.push(new URL(req.url).pathname);
        return handler(req);
      },
    },
  };
}
const ok = () => new Response("asset", { status: 200 });

test("company host serves /goattech folder as root", async () => {
  const env = makeEnv(ok);
  const res = await worker.fetch(new Request("https://goattech.us/"), env);
  assert.equal(res.status, 200);
  assert.deepEqual(env.calls, ["/goattech/"]);
});

test("www company host maps nested paths", async () => {
  const env = makeEnv(ok);
  await worker.fetch(new Request("https://www.goattech.us/a/b.css"), env);
  assert.deepEqual(env.calls, ["/goattech/a/b.css"]);
});

test("dot segments cannot escape the company folder", async () => {
  const env = makeEnv(ok);
  await worker.fetch(new Request("https://goattech.us/../style.css"), env);
  assert.deepEqual(env.calls, ["/goattech/style.css"]);
});

test("redirect from company folder hides the folder name", async () => {
  const env = makeEnv(() => new Response(null, { status: 307, headers: { Location: "/goattech/" } }));
  const res = await worker.fetch(new Request("https://goattech.us/index.html?x=1"), env);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get("Location"), "/");
});

test("redirect keeps query string", async () => {
  const env = makeEnv(() => new Response(null, { status: 301, headers: { Location: "/goattech/page?y=2" } }));
  const res = await worker.fetch(new Request("https://goattech.us/page.html"), env);
  assert.equal(res.headers.get("Location"), "/page?y=2");
});

test("other hosts get repo root unchanged", async () => {
  const env = makeEnv(ok);
  await worker.fetch(new Request("https://example.workers.dev/style.css"), env);
  assert.deepEqual(env.calls, ["/style.css"]);
});

test("company folder is hidden on other hosts", async () => {
  for (const p of ["/goattech", "/goattech/", "/goattech/index.html"]) {
    const env = makeEnv(ok);
    const res = await worker.fetch(new Request("https://example.workers.dev" + p), env);
    assert.equal(res.status, 404, p);
    assert.equal(env.calls.length, 0);
  }
});

test("paths merely starting with goattech are not blocked", async () => {
  const env = makeEnv(ok);
  const res = await worker.fetch(new Request("https://example.workers.dev/goattech-logo.png"), env);
  assert.equal(res.status, 200);
});
