import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../scripts/cloudflare-bridge.ts";

test("bridge preserves paths, queries and methods while keeping redirects on the visitor's domain", async () => {
    let target = "";
    let method = "";
    const upstream: typeof fetch = async input => {
        const request = input as Request;
        target = request.url; method = request.method;
        return new Response(null, { status: 301, headers: { location: "https://renewsejongpac.pages.dev/v5/programs/?view=calendar" } });
    };
    const response = await handleRequest(new Request("https://renewsejongpac.rhee.life/v5/programs?view=calendar", { method: "HEAD" }), upstream);
    assert.equal(target, "https://renewsejongpac.pages.dev/v5/programs?view=calendar");
    assert.equal(method, "HEAD");
    assert.equal(response.headers.get("location"), "https://renewsejongpac.rhee.life/v5/programs/?view=calendar");
});

test("bridge leaves other origins and response bodies untouched", async () => {
    const upstream: typeof fetch = async () => new Response("missing", { status: 404, headers: { location: "https://example.org/", "content-type": "text/plain" } });
    const response = await handleRequest(new Request("https://renewsejongpac.rhee.life/missing"), upstream);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("location"), "https://example.org/");
    assert.equal(await response.text(), "missing");
});
