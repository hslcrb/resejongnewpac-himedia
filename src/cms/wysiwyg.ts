import type { PageContent, PageContentBlock } from "../catalog/types.ts";
import { isRemovedOfficialLink } from "../lib/link-policy.ts";
import type { CmsDocumentAst, CmsInlineMark, CmsTextSpan, CmsWysiwygNode } from "./contracts.ts";

// [브라우저·서버 공통 결정론적 SHA-256 해시 / Deterministic SHA-256 for browser and Node]
const SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
    return (value >>> bits) | (value << (32 - bits));
}

export function sha256Hex(input: string): string {
    const bytes = new TextEncoder().encode(input);
    const bitLen = bytes.length * 8;
    const totalLen = (((bytes.length + 8) >> 6) + 1) << 6;
    const padded = new Uint8Array(totalLen);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
    view.setUint32(totalLen - 4, bitLen >>> 0, false);

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;
    const w = new Uint32Array(64);

    for (let offset = 0; offset < totalLen; offset += 64) {
        for (let i = 0; i < 16; i++) {
            w[i] = view.getUint32(offset + i * 4, false);
        }
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }
        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;
        let f = h5;
        let g = h6;
        let h = h7;
        for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) >>> 0;
            h = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
        }
        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
        h5 = (h5 + f) >>> 0;
        h6 = (h6 + g) >>> 0;
        h7 = (h7 + h) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7]
        .map((word) => word.toString(16).padStart(8, "0"))
        .join("");
}

// [위험 태그·속성·스크립트 URL 정화 / Strip dangerous markup, events, and prohibited URLs]
export function sanitizePlainText(value: string): string {
    if (typeof value !== "string") return "";
    return value
        .replace(/<script\b[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[\s\S]*?<\/style>/gi, "")
        .replace(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/<\/?[a-z][^>]*>/gi, "")
        .replace(/javascript\s*:/gi, "")
        .replace(/vbscript\s*:/gi, "")
        .replace(/data\s*:\s*text\/html/gi, "")
        .replace(/\u0000/g, "")
        .trim();
}

export function sanitizeHref(rawHref: string): string {
    if (typeof rawHref !== "string") return "#";
    const trimmed = rawHref.trim();
    if (!trimmed) return "#";
    if (/^(?:javascript|vbscript|data):/i.test(trimmed)) return "#";
    if (isRemovedOfficialLink(trimmed)) return "/visit";
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === "https:" || parsed.protocol === "mailto:" || parsed.protocol === "tel:") {
            return parsed.toString();
        }
        return "#";
    } catch {
        return "#";
    }
}

export function sanitizeRichSpans(spans: readonly CmsTextSpan[] | undefined): CmsTextSpan[] {
    if (!Array.isArray(spans)) return [];
    return spans
        .map((span) => {
            const text = sanitizePlainText(span?.text || "");
            const marks: CmsInlineMark[] = [];
            for (const mark of span?.marks || []) {
                if (!mark) continue;
                if (mark.type === "bold" || mark.type === "italic" || mark.type === "code") {
                    marks.push({ type: mark.type });
                } else if (mark.type === "link") {
                    const safeHref = sanitizeHref(mark.href);
                    if (safeHref !== "#") marks.push({ type: "link", href: safeHref });
                }
            }
            return marks.length ? { text, marks } : { text };
        })
        .filter((span) => span.text.length > 0);
}

export function sanitizeWysiwygNode(node: CmsWysiwygNode, index = 0): CmsWysiwygNode {
    const id = sanitizePlainText(node.id || "") || `node-${index + 1}`;
    switch (node.type) {
        case "prose": {
            const paragraphs = (node.paragraphs || [])
                .map((p) => sanitizePlainText(p))
                .filter(Boolean);
            const richParagraphs = node.richParagraphs
                ? node.richParagraphs.map((row) => sanitizeRichSpans(row)).filter((row) => row.length > 0)
                : undefined;
            return {
                id,
                type: "prose",
                heading: sanitizePlainText(node.heading || ""),
                paragraphs: paragraphs.length
                    ? paragraphs
                    : richParagraphs?.map((row) => row.map((s) => s.text).join(" ")).filter(Boolean) || [
                          "내용을 입력해 주세요.",
                      ],
                ...(richParagraphs?.length ? { richParagraphs } : {}),
            };
        }
        case "facts":
            return {
                id,
                type: "facts",
                title: sanitizePlainText(node.title || "핵심 안내"),
                items: (node.items || [])
                    .map((item) => ({
                        label: sanitizePlainText(item.label),
                        value: sanitizePlainText(item.value),
                    }))
                    .filter((item) => item.label && item.value),
            };
        case "faq":
            return {
                id,
                type: "faq",
                title: sanitizePlainText(node.title || "자주 묻는 질문"),
                items: (node.items || [])
                    .map((item) => ({
                        question: sanitizePlainText(item.question),
                        answer: sanitizePlainText(item.answer),
                    }))
                    .filter((item) => item.question && item.answer),
            };
        case "timeline":
            return {
                id,
                type: "timeline",
                title: sanitizePlainText(node.title || "일정 및 연혁"),
                items: (node.items || [])
                    .map((item) => ({
                        date: sanitizePlainText(item.date),
                        title: sanitizePlainText(item.title),
                        ...(item.body ? { body: sanitizePlainText(item.body) } : {}),
                    }))
                    .filter((item) => item.date && item.title),
            };
        case "map":
            return {
                id,
                type: "map",
                address: sanitizePlainText(node.address || "서울특별시 종로구 세종대로 175"),
                href: sanitizeHref(node.href || "/visit/directions"),
                label: sanitizePlainText(node.label || "지도 및 위치 보기"),
            };
        case "downloads":
            return {
                id,
                type: "downloads",
                title: sanitizePlainText(node.title || "관련 자료"),
                items: (node.items || [])
                    .map((item) => ({
                        label: sanitizePlainText(item.label),
                        href: sanitizeHref(item.href),
                    }))
                    .filter((item) => item.label && item.href !== "#"),
            };
        case "actions":
            return {
                id,
                type: "actions",
                items: (node.items || [])
                    .map((item) => {
                        const href = sanitizeHref(item.href);
                        return {
                            label: sanitizePlainText(item.label),
                            href,
                            external: /^https:/i.test(href),
                        };
                    })
                    .filter((item) => item.label && item.href !== "#"),
            };
        case "image": {
            const src = sanitizeHref(node.src || "/assets/images/sejong-grand-facade.png");
            const alt = sanitizePlainText(node.alt || "세종문화회관 시각 자료");
            return {
                id,
                type: "image",
                mediaId: sanitizePlainText(node.mediaId || `media-${index + 1}`),
                src: src === "#" ? "/assets/images/sejong-grand-facade.png" : src,
                alt: alt || "세종문화회관 시각 자료",
                caption: sanitizePlainText(node.caption || ""),
                sha256: /^[0-9a-f]{64}$/i.test(node.sha256 || "")
                    ? node.sha256.toLowerCase()
                    : sha256Hex(`${src}:${alt}`),
            };
        }
        case "table": {
            const headers = (node.headers || []).map((cell) => sanitizePlainText(cell)).filter(Boolean);
            const safeHeaders = headers.length ? headers : ["항목", "내용"];
            const rows = (node.rows || [])
                .map((row) => safeHeaders.map((_, colIdx) => sanitizePlainText(row[colIdx] || "")))
                .filter((row) => row.some(Boolean));
            return {
                id,
                type: "table",
                caption: sanitizePlainText(node.caption || "안내 표"),
                headers: safeHeaders,
                rows,
            };
        }
    }
}

export function sanitizeWysiwygAst(ast: CmsDocumentAst): CmsDocumentAst {
    const rawPath = sanitizePlainText(ast.path || "/visit");
    const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    return {
        schemaVersion: 1,
        path,
        title: sanitizePlainText(ast.title || "제목 없는 페이지"),
        description: sanitizePlainText(ast.description || ""),
        ...(ast.sourceUrl ? { sourceUrl: sanitizeHref(ast.sourceUrl) } : {}),
        nodes: (ast.nodes || []).map((node, index) => sanitizeWysiwygNode(node, index)),
    };
}

export function validateWysiwygAst(ast: CmsDocumentAst): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (ast.schemaVersion !== 1) issues.push("AST 스키마 버전은 1이어야 합니다.");
    if (!ast.path || !ast.path.startsWith("/")) issues.push("페이지 경로는 '/'로 시작해야 합니다.");
    if (!ast.title || !ast.title.trim()) issues.push("페이지 제목을 입력해 주세요.");
    if (!Array.isArray(ast.nodes) || ast.nodes.length === 0) {
        issues.push("최소 1개 이상의 콘텐츠 블록이 필요합니다.");
    }
    const seenIds = new Set<string>();
    for (const node of ast.nodes || []) {
        if (!node.id) issues.push("블록 식별자(id)가 누락되었습니다.");
        if (seenIds.has(node.id)) issues.push(`중복된 블록 식별자입니다: ${node.id}`);
        seenIds.add(node.id);
        if (node.type === "image" && !node.alt.trim()) {
            issues.push(`이미지 블록(${node.id})에는 대체 텍스트(alt)가 필수입니다.`);
        }
        if (node.type === "actions") {
            for (const item of node.items) {
                if (isRemovedOfficialLink(item.href) || item.href === "#") {
                    issues.push(`행동 링크(${item.label})의 목적지 주소가 유효하지 않습니다.`);
                }
            }
        }
    }
    return { valid: issues.length === 0, issues };
}

// [PageContent와 WYSIWYG AST 양방향 무손실 변환 / Bidirectional conversion between PageContent and WYSIWYG AST]
export function pageContentToWysiwygAst(page: PageContent): CmsDocumentAst {
    const nodes: CmsWysiwygNode[] = (page.blocks || []).map((block, index) => {
        const id = `block-${index + 1}`;
        switch (block.type) {
            case "prose":
                return {
                    id,
                    type: "prose",
                    heading: block.heading || "",
                    paragraphs: [...block.paragraphs],
                };
            case "facts":
                return {
                    id,
                    type: "facts",
                    title: block.title || "핵심 안내",
                    items: block.items.map((item) => ({ ...item })),
                };
            case "faq":
                return {
                    id,
                    type: "faq",
                    title: block.title || "자주 묻는 질문",
                    items: block.items.map((item) => ({ ...item })),
                };
            case "timeline":
                return {
                    id,
                    type: "timeline",
                    title: block.title || "일정 및 연혁",
                    items: block.items.map((item) => ({ ...item })),
                };
            case "map":
                return {
                    id,
                    type: "map",
                    address: block.address,
                    href: block.href,
                    label: block.label,
                };
            case "downloads":
                return {
                    id,
                    type: "downloads",
                    title: block.title || "관련 자료",
                    items: block.items.map((item) => ({ ...item })),
                };
            case "actions":
                return {
                    id,
                    type: "actions",
                    items: block.items.map((item) => ({ ...item })),
                };
        }
    });
    return sanitizeWysiwygAst({
        schemaVersion: 1,
        path: page.path,
        title: page.title,
        description: page.description,
        ...(page.sourceUrl ? { sourceUrl: page.sourceUrl } : {}),
        nodes: nodes.length
            ? nodes
            : [
                  {
                      id: "block-1",
                      type: "prose",
                      heading: page.title,
                      paragraphs: [page.description || "내용을 입력해 주세요."],
                  },
              ],
    });
}

export function wysiwygAstToPageContent(
    ast: CmsDocumentAst,
    options: { revision?: number; status?: "published" | "draft"; verifiedAt?: string } = {},
): PageContent {
    const clean = sanitizeWysiwygAst(ast);
    const blocks: PageContentBlock[] = clean.nodes.map((node): PageContentBlock => {
        switch (node.type) {
            case "prose":
                return {
                    type: "prose",
                    ...(node.heading ? { heading: node.heading } : {}),
                    paragraphs: [...node.paragraphs],
                };
            case "facts":
                return {
                    type: "facts",
                    ...(node.title ? { title: node.title } : {}),
                    items: node.items.map((item) => ({ ...item })),
                };
            case "faq":
                return {
                    type: "faq",
                    ...(node.title ? { title: node.title } : {}),
                    items: node.items.map((item) => ({ ...item })),
                };
            case "timeline":
                return {
                    type: "timeline",
                    ...(node.title ? { title: node.title } : {}),
                    items: node.items.map((item) => ({ ...item })),
                };
            case "map":
                return {
                    type: "map",
                    address: node.address,
                    href: node.href,
                    label: node.label,
                };
            case "downloads":
                return {
                    type: "downloads",
                    ...(node.title ? { title: node.title } : {}),
                    items: node.items.map((item) => ({ ...item })),
                };
            case "actions":
                return {
                    type: "actions",
                    items: node.items.map((item) => ({ ...item })),
                };
            case "image":
                return {
                    type: "facts",
                    title: node.caption || "시각 자료",
                    items: [
                        { label: "대체 텍스트", value: node.alt },
                        { label: "자산 경로", value: node.src },
                    ],
                };
            case "table":
                return {
                    type: "facts",
                    title: node.caption || "안내 표",
                    items: node.rows.map((row, rowIndex) => ({
                        label: row[0] || `${node.headers[0] || "항목"} ${rowIndex + 1}`,
                        value: row.slice(1).join(" · ") || "-",
                    })),
                };
        }
    });

    return {
        path: clean.path,
        title: clean.title,
        description: clean.description,
        blocks,
        status: options.status || "draft",
        revision: options.revision ?? 1,
        ...(clean.sourceUrl ? { sourceUrl: clean.sourceUrl } : {}),
        ...(options.verifiedAt ? { verifiedAt: options.verifiedAt } : {}),
    };
}

export function computeCmsPayloadHash(ast: CmsDocumentAst): string {
    const clean = sanitizeWysiwygAst(ast);
    return sha256Hex(JSON.stringify(clean));
}

// [블록 순서 이동·편집·붙여넣기 정리·Undo/Redo / Block reordering, editing, paste cleaning, and Undo/Redo]
export function moveWysiwygBlock(
    ast: CmsDocumentAst,
    nodeId: string,
    direction: "up" | "down",
): CmsDocumentAst {
    const index = ast.nodes.findIndex((node) => node.id === nodeId);
    if (index === -1) return ast;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ast.nodes.length) return ast;
    const nextNodes = [...ast.nodes];
    const [moved] = nextNodes.splice(index, 1);
    nextNodes.splice(targetIndex, 0, moved);
    return { ...ast, nodes: nextNodes };
}

export function cleanPastedContentToNode(rawPaste: string, idPrefix = "pasted"): CmsWysiwygNode {
    const withoutScripts = (rawPaste || "")
        .replace(/<script\b[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[\s\S]*?<\/style>/gi, "");
    const lines = withoutScripts
        .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .split(/\r?\n/)
        .map((line) => sanitizePlainText(line))
        .filter(Boolean);

    const heading = lines.length > 1 && lines[0].length <= 60 ? lines[0] : "붙여넣은 본문";
    const paragraphs = lines.length > 1 ? lines.slice(1) : lines.length === 1 ? lines : ["내용을 입력해 주세요."];
    return {
        id: `${idPrefix}-${Date.now().toString(36)}`,
        type: "prose",
        heading,
        paragraphs,
    };
}

export interface WysiwygHistoryState {
    past: CmsDocumentAst[];
    present: CmsDocumentAst;
    future: CmsDocumentAst[];
}

export function createWysiwygHistory(initial: CmsDocumentAst): WysiwygHistoryState {
    return { past: [], present: sanitizeWysiwygAst(initial), future: [] };
}

export function pushWysiwygHistory(
    history: WysiwygHistoryState,
    next: CmsDocumentAst,
    maxDepth = 30,
): WysiwygHistoryState {
    const sanitized = sanitizeWysiwygAst(next);
    if (computeCmsPayloadHash(history.present) === computeCmsPayloadHash(sanitized)) {
        return history;
    }
    return {
        past: [...history.past.slice(-(maxDepth - 1)), history.present],
        present: sanitized,
        future: [],
    };
}

export function undoWysiwygHistory(history: WysiwygHistoryState): WysiwygHistoryState {
    if (history.past.length === 0) return history;
    const previous = history.past[history.past.length - 1];
    return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
    };
}

export function redoWysiwygHistory(history: WysiwygHistoryState): WysiwygHistoryState {
    if (history.future.length === 0) return history;
    const [next, ...restFuture] = history.future;
    return {
        past: [...history.past, history.present],
        present: next,
        future: restFuture,
    };
}

// [낙관적 잠금 리비전 충돌 감지 및 복구 병합 / Optimistic locking revision conflict detection and recovery merge]
export interface RevisionConflictCheck {
    hasConflict: boolean;
    expectedBaseRevision: number;
    actualServerRevision: number;
    message: string;
}

export function detectRevisionConflict(
    expectedBaseRevision: number,
    actualServerRevision: number,
): RevisionConflictCheck {
    if (expectedBaseRevision !== actualServerRevision) {
        return {
            hasConflict: true,
            expectedBaseRevision,
            actualServerRevision,
            message: `원본 리비전 충돌이 감지되었습니다(편집 기준 r${expectedBaseRevision} ≠ 서버 최신 r${actualServerRevision}). 마지막 저장으로 덮어쓰지 않고 병합 초안으로 복구할 수 있습니다.`,
        };
    }
    return {
        hasConflict: false,
        expectedBaseRevision,
        actualServerRevision,
        message: `리비전 r${actualServerRevision} 기준 정합성이 확인되었습니다.`,
    };
}

export function mergeConflictingDraftAst(
    serverAst: CmsDocumentAst,
    localAst: CmsDocumentAst,
): CmsDocumentAst {
    const serverIds = new Set(serverAst.nodes.map((node) => node.id));
    const localAdditional = localAst.nodes
        .filter((node) => !serverIds.has(node.id))
        .map((node, idx) => ({ ...node, id: `${node.id}-merged-${idx + 1}` }));
    return sanitizeWysiwygAst({
        schemaVersion: 1,
        path: localAst.path || serverAst.path,
        title: localAst.title || serverAst.title,
        description: localAst.description || serverAst.description,
        ...(localAst.sourceUrl || serverAst.sourceUrl
            ? { sourceUrl: localAst.sourceUrl || serverAst.sourceUrl }
            : {}),
        nodes: [...serverAst.nodes, ...localAdditional],
    });
}
