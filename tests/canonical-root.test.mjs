import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "parse5";

const root = new URL("../", import.meta.url);
const read = file => readFileSync(new URL("out/" + file, root), "utf8");
const obsolete = /^\/(?:v[2-5](?:\/|$)|legacy\.html(?:[?#]|$))/i;
const nodes = function* (node) {
    yield node;
    for (const child of node.childNodes ?? []) yield* nodes(child);
};

test("the canonical app and build output are rooted directly in the repository", () => {
    for (const source of ["app/page.tsx", "components/SiteShell.tsx", "public/assets/favicon.svg", "supabase/migrations"]) {
        assert.ok(existsSync(new URL(source, root)), source);
    }
    for (const legacy of ["v2/", "v3/", "v4/", "v5/", "legacy.html", "index.html", "out/v5/"]) {
        assert.ok(!existsSync(new URL(legacy, root)), legacy);
    }
});

test("static entry and deep routes render real pages with root-based assets", () => {
    for (const route of ["", "programs/", "visit/", "account/", "account/callback/", "admin/", "design-rules/"]) {
        const html = read(route + "index.html");
        const source = [...nodes(parse(html))];
        if (route === "admin/") assert.match(html, /CMS|스튜디오/);
        else assert.ok(source.some(n => n.tagName === "main"), route || "/");
        assert.ok(!source.some(n => n.tagName === "meta" && n.attrs?.some(a => a.name === "http-equiv" && a.value.toLowerCase() === "refresh")), route);
        assert.ok(source.some(n => n.tagName === "script" && n.attrs?.some(a => a.name === "src" && a.value.startsWith("/_next/"))), route);
        for (const node of source) {
            for (const { name, value } of node.attrs ?? []) {
                if (["href", "src", "action"].includes(name)) assert.doesNotMatch(value, obsolete, route);
            }
        }
    }
    assert.match(read("index.html"), /세종문화회관/);
});
