import type { CmsPageTreeNode } from "./page-tree.ts";

export type StudioLayer = { selector: string; label: string; depth: number; tag: string; role: string; children: number; added: boolean };

// 검색 중에는 접힘 상태를 바꾸지 않고 경로를 보여준다. / Reveal matching paths without changing collapsed state.
export function flattenStudioLayers(nodes: readonly CmsPageTreeNode[], collapsed: ReadonlySet<string>, search = ""): StudioLayer[] {
    const query = search.normalize("NFC").trim().toLocaleLowerCase("ko");
    const out: StudioLayer[] = [];

    function visit(node: CmsPageTreeNode, depth: number): boolean {
        const index = out.length;
        const match = !query || [node.label, node.tag, node.role].some(value =>
            value.normalize("NFC").toLocaleLowerCase("ko").includes(query));
        out.push({ selector: node.selector, label: node.label, depth, tag: node.tag, role: node.role,
            children: node.children.length, added: Boolean(node.added) });
        if (query || !collapsed.has(node.selector)) {
            for (const child of node.children) visit(child, depth + 1);
        }
        if (!match && out.length === index + 1) {
            out.pop();
            return false;
        }
        return true;
    }

    for (const node of nodes) visit(node, 0);
    return out;
}
