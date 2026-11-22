import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const external = process.env.CMS_TEST_PGLITE_ENTRY;
if (!external) throw new Error("Set CMS_TEST_PGLITE_ENTRY to the local PGlite dist/index.js path.");
const { PGlite } = await import(pathToFileURL(resolve(external)).href);
const db = new PGlite();
const read = name => readFile(new URL("../../supabase/migrations/" + name, import.meta.url), "utf8");
const result = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const admin = "10000000-0000-4000-8000-000000000001";
const guest = "10000000-0000-4000-8000-000000000002";
const path = "/visit";
const hash = "a".repeat(64);
const document = JSON.stringify({ schemaVersion: 2, path, patches: [], additions: [] });

try {
    // Local Auth fixture only. / This does not emulate Supabase Auth HTTP or OAuth.
    await db.exec(`
        create role anon noinherit;
        create role authenticated noinherit;
        create schema auth;
        create table auth.users (id uuid primary key);
        create table auth.identities (user_id uuid, provider text, provider_id text, identity_data jsonb);
        create function auth.uid() returns uuid language sql stable
            as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema auth to authenticated, anon;
    `);
    const members = await read("20261106070000_cms_agent_workspace.sql");
    const allowedHandle = members.match(/account_handle\s*=\s*'([^']+)'/)?.[1];
    assert.ok(allowedHandle, "fixture must follow the migration's explicit account policy");
    await db.exec(members);
    await db.exec(await read("20261111_cms_visual_wysiwyg_mcp.sql"));
    const email = allowedHandle + "@gmail.com";
    await db.query("insert into auth.users values ($1), ($2)", [admin, guest]);
    await db.query("insert into auth.identities values ($1, 'google', 'test-subject', $2::jsonb)",
        [admin, JSON.stringify({ email, email_verified: true })]);
    await db.query("insert into public.sejong_cms_memberships (user_id, google_subject, account_handle, verified_email) values ($1, 'test-subject', $2, $3)",
        [admin, allowedHandle, email]);

    const as = async uid => {
        await db.exec("reset role; set role authenticated;");
        await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
    };
    const publish = revision => result("select public.sejong_cms_publish_visual_draft($1, $2, 'test') as receipt", [path, revision]);

    await db.exec("set role anon");
    await assert.rejects(publish(1), error => error.code === "42501");
    await as(guest);
    await assert.rejects(publish(1), error => error.code === "42501");
    await assert.rejects(db.query("insert into public.sejong_cms_visual_documents (target_path, revision, document, checksum) values ($1, 1, $2, $3)", [path, document, hash]), error => error.code === "42501");
    console.log("PASS: anonymous publication and non-admin writes are blocked");

    await as(admin);
    await db.query("insert into public.sejong_cms_visual_documents (target_path, revision, document, checksum) values ($1, 1, $2, $3)", [path, document, hash]);
    const updated = await db.query("update public.sejong_cms_visual_documents set revision=2 where target_path=$1 and revision=1 returning revision", [path]);
    const stale = await db.query("update public.sejong_cms_visual_documents set revision=3 where target_path=$1 and revision=1 returning revision", [path]);
    assert.deepEqual(updated.rows, [{ revision: 2 }]);
    assert.deepEqual(stale.rows, []);
    await assert.rejects(publish(1), error => error.code === "40001");
    const { receipt } = await publish(2);
    assert.equal(receipt.published_revision, 1);
    assert.equal(receipt.published_by, admin);
    assert.deepEqual(await result("select revision, status, published_revision from public.sejong_cms_visual_documents where target_path=$1", [path]),
        { revision: 2, status: "published", published_revision: 1 });
    assert.deepEqual(await result("select revision, published_revision from public.sejong_cms_visual_revisions where target_path=$1", [path]),
        { revision: 2, published_revision: 1 });
    console.log("PASS: stale draft is rejected; valid publish creates one matching immutable revision");

    await db.exec("reset role");
    await db.query("insert into public.sejong_cms_visual_revisions (target_path, revision, published_revision, document, checksum) values ($1, 2, 2, $2, $3)", [path, document, hash]);
    await as(admin);
    await db.query("update public.sejong_cms_visual_documents set status='draft', revision=3 where target_path=$1 and revision=2", [path]);
    await assert.rejects(publish(3), error => error.code === "23505");
    assert.deepEqual(await result("select revision, status, published_revision from public.sejong_cms_visual_documents where target_path=$1", [path]),
        { revision: 3, status: "draft", published_revision: 1 });
    console.log("PASS: a history write failure rolls back the draft publication");
} finally {
    await db.close();
}
