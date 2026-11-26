import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalizeReadableExport } from "./readable-finalize.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "out");
if (!fs.existsSync(path.join(out, "index.html"))) throw new Error("Missing statically exported home page");
const staticDir = path.join(out, "_next", "static");
if (["development", "webpack"].some(name => fs.existsSync(path.join(staticDir, name)))) {
    throw new Error("Development assets found in the production export");
}
finalizeReadableExport(root);
