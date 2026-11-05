import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePolicy, runGuardedBuild, runCommand } from "../scripts/cloudflare-build.ts";

const current = "a".repeat(40);
const newer = "b".repeat(40);
const policy = { projectName: "renewsejongpac", productionBranch: "main", productionDeploymentsEnabled: true, previewDeploymentSetting: "none", latestCommitOnly: true, pollIntervalMs: 20, remoteCheckTimeoutMs: 10000 };

// [실제 배포의 최신성·중단 계약 / Freshness and interruption of a real deployment]
test("only the current production commit may run every build stage", async () => {
    const steps: number[] = [];
    await runGuardedBuild({ policy, branch: "main", commit: current, readRemoteHead: async () => current, steps: [async () => { steps.push(1); }, async () => { steps.push(2); }] });
    assert.deepEqual(steps, [1, 2]);
});

test("non-main and stale builds stop before dependency installation", async () => {
    for (const [branch, remote] of [["feature/x", current], ["main", newer]]) {
        let started = false;
        await assert.rejects(runGuardedBuild({ policy, branch, commit: current, readRemoteHead: async () => remote, steps: [async () => { started = true; }] }));
        assert.equal(started, false);
    }
});

test("new push aborts the running process and prevents the publish stage", async () => {
    let remote = current;
    let publish = false;
    let interrupted = false;
    await assert.rejects(runGuardedBuild({ policy, branch: "main", commit: current, readRemoteHead: async () => remote, steps: [async signal => {
        remote = newer;
        try { await runCommand(process.execPath, ["-e", "setInterval(()=>{},1000)"], { cwd: process.cwd(), signal }); }
        catch (error) { interrupted = signal.aborted; throw error; }
    }, async () => { publish = true; }] }), /superseded/i);
    assert.equal(interrupted, true);
    assert.equal(publish, false);
});

test("a push during staging is caught by the final remote check", async () => {
    let remote = current;
    await assert.rejects(runGuardedBuild({ policy, branch: "main", commit: current, readRemoteHead: async () => remote, steps: [async () => { remote = newer; }] }), /superseded/i);
});

test("superseding a build also terminates its grandchild process", async () => {
    const directory = mkdtempSync(join(tmpdir(), "sejong-deploy-test-"));
    const file = join(directory, "pid.txt");
    let pid: number | undefined;
    const source = "const fs=require('node:fs');const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(child.pid));setInterval(()=>{},1000);";
    try {
        await assert.rejects(runGuardedBuild({ policy, branch: "main", commit: current, readRemoteHead: async () => existsSync(file) ? newer : current, steps: [signal => runCommand(process.execPath, ["-e", source, file], { cwd: process.cwd(), signal })] }), /superseded/i);
        pid = Number(readFileSync(file, "utf8"));
        let alive = true;
        for (let attempt = 0; attempt < 100; attempt++) {
            try { process.kill(pid, 0); } catch { alive = false; break; }
            await new Promise(done => setTimeout(done, 20));
        }
        assert.equal(alive, false, "Superseded build left a running descendant");
    } finally {
        if (pid) { try { process.kill(pid, "SIGKILL"); } catch {} }
        if (existsSync(file)) unlinkSync(file);
        rmdirSync(directory);
    }
});

test("remote lookup failure aborts the build instead of publishing unchecked files", async () => {
    let probes = 0, started = false;
    await assert.rejects(runGuardedBuild({ policy, branch: "main", commit: current, readRemoteHead: async () => { if (++probes > 1) throw new Error("remote unavailable"); return current; }, steps: [async () => { started = true; }] }), /remote unavailable/);
    assert.equal(started, false);
});

test("latest-only can be explicitly changed while the production branch gate stays enforced", async () => {
    const changed = { ...policy, latestCommitOnly: false };
    let ran = false;
    await runGuardedBuild({ policy: changed, branch: "main", commit: current, readRemoteHead: async () => { throw new Error("must not probe"); }, steps: [async () => { ran = true; }] });
    assert.equal(ran, true);
    await assert.rejects(runGuardedBuild({ policy: changed, branch: "feature/x", commit: current, readRemoteHead: async () => current, steps: [] }));
});

test("invalid policy values are rejected before running commands", () => {
    assert.throws(() => parsePolicy({ ...policy, pollIntervalMs: 0 }));
    assert.throws(() => parsePolicy({ ...policy, latestCommitOnly: "false" }));
    assert.throws(() => parsePolicy({ ...policy, productionBranch: "-bad" }));
    assert.throws(() => parsePolicy({ ...policy, projectName: 123 }));
    assert.equal(parsePolicy(policy).productionBranch, "main");
});
