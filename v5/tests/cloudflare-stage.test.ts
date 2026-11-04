import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { stageCloudflare } from "../scripts/cloudflare-stage.ts";

test("Cloudflare staging preserves public routes without publishing private files", () => {
    const root = mkdtempSync(join(tmpdir(), "sejong-cloudflare-"));
    const put = (name: string, content = name) => {
        const path = join(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content);
    };
    try {
        for (const path of ["index.html", "legacy.html", "sejong-color-guide.html", "design-qa.md", "assets/icons/rounded/a.svg", "css/site.css", "js/app.js", "v2/index.html", "v2/src/app.js", "v3/index.html", "v3/assets/icons/rounded/a.svg", "v4/index.html", "v4/assets/icons/rounded/a.svg", "v5/out/index.html", "v5/out/programs/index.html", "v5/styles/tokens.css"]) put(path, path.endsWith("a.svg") ? "icon" : path);
        put("docs/readme/system-overview.svg");
        put("v5/out/404.html", "404 page");
        put("v5/.env.local", "secret");
        stageCloudflare(root);
        const out = join(root, "v5/.cloudflare-output");
        assert.equal(readFileSync(join(out, "v5/programs/index.html"), "utf8"), "v5/out/programs/index.html");
        assert.equal(readFileSync(join(out, "v5/styles/tokens.css"), "utf8"), "v5/styles/tokens.css");
        assert.equal(existsSync(join(out, "docs/readme/system-overview.svg")), true);
        assert.equal(readFileSync(join(out, "404.html"), "utf8"), "404 page");
        assert.equal(existsSync(join(out, "v5/.env.local")), false);
        assert.equal(existsSync(join(out, "v3/assets/icons/rounded/a.svg")), false);
        assert.match(readFileSync(join(out, "_redirects"), "utf8"), /\/v3\/assets\/icons\/rounded\/\* \/assets\/icons\/rounded\/:splat 301/);
        const redirects = readFileSync(join(out, "_redirects"), "utf8");
        assert.match(redirects, /^\/visit\/area \/v5\/visit\/area\/ 301$/m);
        assert.match(redirects, /^\/visit\/area\/ \/v5\/visit\/area\/ 301$/m);
        put("v4/assets/icons/rounded/a.svg", "different");
        assert.throws(() => stageCloudflare(root), /icon.*differ/i);
        put("v4/assets/icons/rounded/a.svg", "icon");
        rmSync(join(root, "v5/out/index.html"));
        assert.throws(() => stageCloudflare(root), /missing/i);
    } finally { rmSync(root, { recursive: true, force: true }); }
});
