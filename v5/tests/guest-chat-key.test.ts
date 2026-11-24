import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { loadGuestChat, saveGuestChat } from "../src/lib/guest-chat-storage.ts";

test("two first writers keep one IndexedDB key; earlier ciphertext remains readable", async (t) => {
    const values = new Map<string, string>();
    const substitute = (name: string, value: unknown) => {
        const previous = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { value, configurable: true });
        t.after(() => {
            if (previous) Object.defineProperty(globalThis, name, previous);
            else Reflect.deleteProperty(globalThis, name);
        });
    };
    substitute("indexedDB", new IDBFactory());
    substitute("localStorage", {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
    });
    const generateKey = crypto.subtle.generateKey.bind(crypto.subtle);
    let starts = 0;
    let releaseGeneration!: () => void;
    const bothGenerating = new Promise<void>((resolve) => { releaseGeneration = resolve; });
    t.mock.method(crypto.subtle, "generateKey", async () => {
        starts += 1;
        if (starts === 2) releaseGeneration();
        await bothGenerating;
        return generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
    const inputs = [
        [{ role: "user", content: "first tab" }],
        [{ role: "user", content: "second tab" }],
    ] as const;
    const written: [string, string][] = [];
    t.mock.method(localStorage, "setItem", (key: string, value: string) => {
        written.push([key, value]);
        values.set(key, value);
    });
    await Promise.all(inputs.map((history) => saveGuestChat([...history])));
    assert.equal(written.length, 2);
    const decrypted = [];
    for (const [key, ciphertext] of written) {
        values.set(key, ciphertext);
        decrypted.push((await loadGuestChat())[0]?.content);
    }
    assert.deepEqual(decrypted.sort(), ["first tab", "second tab"]);
});
