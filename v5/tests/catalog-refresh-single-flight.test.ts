import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogRepository } from "../src/catalog/repository.ts";

const snapshot = {
    version: 1,
    generatedAt: "2026-11-22T00:00:00Z",
    programs: [], venues: [], companies: [], notices: [], homeFeatures: [],
    ticketOpenings: [], media: [], sessions: [], pages: [],
};
const create = (request: typeof fetch) =>
    createCatalogRepository("https://catalog.example.test", "test-key", request);

test("concurrent refreshes share one snapshot request; later refreshes are fresh", async () => {
    let requests = 0;
    const repository = create(async () => {
        requests += 1;
        return Response.json(snapshot);
    });
    const values = await Promise.all([
        repository.loadPublishedCatalog(), repository.loadPublishedCatalog(),
        repository.loadPublishedCatalog(),
    ]);
    assert.deepEqual(values, [snapshot, snapshot, snapshot]);
    assert.equal(requests, 1);
    await repository.loadPublishedCatalog();
    assert.equal(requests, 2);
});

test("a shared failure does not prevent a successful later retry", async () => {
    let requests = 0;
    const repository = create(async () =>
        ++requests === 1 ? new Response("", { status: 503 }) : Response.json(snapshot),
    );
    const outcomes = await Promise.allSettled([
        repository.loadPublishedCatalog(), repository.loadPublishedCatalog(),
    ]);
    assert.deepEqual(outcomes.map(({ status }) => status), ["rejected", "rejected"]);
    assert.equal(requests, 1);
    assert.deepEqual(await repository.loadPublishedCatalog(), snapshot);
    assert.equal(requests, 2);
});

test("repositories with different configuration do not share a request", async () => {
    const requested: string[] = [];
    const fetchSnapshot: typeof fetch = async (input) => {
        requested.push(String(input));
        return Response.json(snapshot);
    };
    await Promise.all([
        create(fetchSnapshot).loadPublishedCatalog(),
        createCatalogRepository("https://second.example.test", "second-key", fetchSnapshot)
            .loadPublishedCatalog(),
    ]);
    assert.deepEqual(requested, [
        "https://catalog.example.test/rest/v1/rpc/sejong_catalog_snapshot",
        "https://second.example.test/rest/v1/rpc/sejong_catalog_snapshot",
    ]);
});
