import assert from "node:assert/strict";
import test from "node:test";
import { trackScrollFragments } from "../src/lib/scroll-fragments.ts";

function keyboardNavigation(
    key: string,
    opts: { control?: string; editable?: boolean; cancelled?: boolean; alt?: boolean } = {},
) {
    const listener = new EventTarget();
    let frame = 0;
    let hashReplacements = 0;
    const location = new URL("https://www.example.test/#old");
    const document = Object.assign(new EventTarget(), {
        documentElement: { scrollHeight: 2_000 },
        getElementById: () => null,
    });
    const window = Object.assign(listener, {
        innerHeight: 600,
        scrollY: 1_400,
        location,
        history: { state: null, replaceState: () => hashReplacements++ },
    });
    const globals = {
        window, document,
        requestAnimationFrame: (fn: () => void) => (++frame, fn(), frame),
        cancelAnimationFrame: () => {},
    };
    const previous = Object.fromEntries(
        Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
    );
    for (const [key, value] of Object.entries(globals))
        Object.defineProperty(globalThis, key, { value, configurable: true });
    try {
        const element = {
            closest: () => null,
            getClientRects: () => [ {} ],
            getBoundingClientRect: () => ({ top: 0 }),
        } as unknown as HTMLElement;
        const stop = trackScrollFragments(() => [{ element, fragment: "new" }]);
        try {
            const target = {
                isContentEditable: opts.editable ?? false,
                closest: (selector: string) => opts.control && selector.includes(opts.control)
                    ? {} : null,
            };
            const event = Object.assign(new Event("keydown", { cancelable: true }), { key, altKey: !!opts.alt });
            Object.defineProperty(event, "target", { value: target });
            if (opts.cancelled) event.preventDefault();
            window.dispatchEvent(event);
            window.dispatchEvent(new Event("scroll"));
            return hashReplacements;
        } finally { stop(); }
    } finally {
        for (const [key, descriptor] of Object.entries(previous)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
}

test("normal page navigation still updates the shareable section fragment", () => {
    for (const key of ["Home", "End", "PageUp", "PageDown", "ArrowDown", " "])
        assert.equal(keyboardNavigation(key), 1, key);
});

test("keys owned by text editors and controls do not update the page fragment", () => {
    for (const key of ["Home", "End", "PageUp", "PageDown"]) {
        assert.equal(keyboardNavigation(key, { control: "textarea" }), 0, key);
        assert.equal(keyboardNavigation(key, { editable: true }), 0, key);
    }
    assert.equal(keyboardNavigation("ArrowDown", { control: '[role="combobox"]' }), 0);
});

test("handled or Alt-modified keystrokes leave the fragment alone", () => {
    assert.equal(keyboardNavigation("PageDown", { cancelled: true }), 0);
    assert.equal(keyboardNavigation("ArrowDown", { alt: true }), 0);
});
