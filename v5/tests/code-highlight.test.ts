import assert from "node:assert/strict";
import test from "node:test";
import { highlightCode } from "../app/design-rules/_documentation/code-highlight.ts";

// [강조 후에도 복사하는 원문과 들여쓰기를 보존 / Preserve copyable source and indentation]
test("highlighting preserves every character in Korean TSX and downloadable CSS", () => {
    for (const source of [
        'import LiquidGlass from "@/components/LiquidGlass";\n\n<LiquidGlass variant="black">\n    <p>세종문화회관</p>\n</LiquidGlass>',
        ':root {\n    --text-body: 1rem;\n    color: var(--text-primary);\n}\n',
        '<script>alert("<img onerror=alert(1)>")</script>',
        "", "\t \r\n",
    ]) assert.equal(highlightCode(source).map(token => token.text).join(""), source);
});

test("strings keep URL slashes and comment markers without becoming comments", () => {
    const tokens = highlightCode('import x from "https://example.com/a//b"; // 안내');
    assert.deepEqual(tokens.filter(token => token.kind === "string").map(token => token.text), ['"https://example.com/a//b"']);
    assert.deepEqual(tokens.filter(token => token.kind === "comment").map(token => token.text), ["// 안내"]);
    assert.ok(tokens.some(token => token.kind === "keyword" && token.text === "import"));
});

test("multiline CSS comments stay intact and CSS properties are highlighted", () => {
    const tokens = highlightCode('/* color: red;\n세종 */\n:root { --text-body: 16px; }', "css");
    assert.deepEqual(tokens.filter(token => token.kind === "comment").map(token => token.text), ["/* color: red;\n세종 */"]);
    assert.ok(tokens.some(token => token.kind === "property" && token.text === "--text-body"));
    assert.ok(tokens.some(token => token.kind === "number" && token.text === "16px"));
});

test("CSS paths are never treated as JavaScript line comments", () => {
    const source = 'background: url(https://example.com/image.svg);';
    assert.equal(highlightCode(source, "css").filter(token => token.kind === "comment").length, 0);
});
