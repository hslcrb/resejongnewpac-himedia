type WhitespaceChange = {
    path: number[];
    childIndex: number;
    original: string | null;
    formatted: string;
};

/** Restore only formatter-recorded text nodes, before the first React hydrate. */
export function restoreReadableDocument(document: Document): void {
    const helper = document.getElementById("__readable_whitespace__");
    if (!helper) return;
    const manifest = JSON.parse(helper.textContent || "{}") as {
        schemaVersion: number;
        changes: WhitespaceChange[];
    };
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.changes))
        throw new Error("Unsupported readable HTML manifest");
    // 파서는 html의 직접 자식 요소로 head/body만 만든다. 브라우저 확장이 넣는 형제는
    // 문서 포매터의 인덱스에 포함하지도, 복원 과정에서 제거하지도 않는다.
    // The HTML parser supplies head/body; extension overlays are not formatter-owned nodes.
    const root = document.documentElement;
    const sections = [document.head, document.body];
    const rootChildren = Array.from(root.childNodes).filter(node =>
        node.nodeType !== 1 || sections.some(section => node === section));
    // Resolve all addresses before removing a node shifts any child index.
    const targets = manifest.changes.map((change) => {
        let parent: Document | Element = document;
        for (const index of change.path) {
            if (parent === document) parent = root;
            else if (parent === root) parent = sections[index];
            else parent = parent.children[index];
            if (!parent) throw new Error("Readable HTML manifest refers to an unavailable element");
        }
        const node = (parent === root ? rootChildren : parent.childNodes)[change.childIndex];
        if (!node || node.nodeType !== 3 || node.textContent !== change.formatted)
            throw new Error(
                "Readable HTML whitespace differs from its build manifest: " +
                    JSON.stringify({
                        path: change.path,
                        childIndex: change.childIndex,
                        actual: node?.nodeType === 3 ? node.textContent : node?.nodeName,
                        expected: change.formatted,
                    }),
            );
        return { node, original: change.original };
    });
    for (const { node, original } of targets) {
        if (original === null) node.parentNode!.removeChild(node);
        else node.textContent = original;
    }
    helper.remove();
}
