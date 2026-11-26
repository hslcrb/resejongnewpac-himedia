import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Dev and production share .next. Discard only generated output before building.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const directory of [".next", "out"]) {
    fs.rmSync(path.join(projectRoot, directory), { recursive: true, force: true });
}
