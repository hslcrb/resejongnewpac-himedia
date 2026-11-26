import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assertCatalogSnapshot, createCatalogRepository } from "../../src/catalog/repository.ts";
import { writeCatalogSnapshot } from "./snapshot-file.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const target = fileURLToPath(new URL("../../src/generated/catalog-snapshot.json", import.meta.url));
if (!url && !key) {
    // An unconfigured public static build can use the versioned catalog, not invented data.
    const snapshot: unknown = JSON.parse(await readFile(target, "utf8"));
    assertCatalogSnapshot(snapshot);
    console.log(`Pinned catalog: ${snapshot.programs.length} programs, ${snapshot.pages.length} pages.`);
} else {
    // A configured refresh still fails closed on missing credentials or a failed request.
    const snapshot = await createCatalogRepository(url, key).loadPublishedCatalog();
    const changed = await writeCatalogSnapshot(target, snapshot);
    console.log(`Published catalog: ${snapshot.programs.length} programs, ${snapshot.pages.length} pages (${changed ? "updated" : "unchanged"}).`);
}
