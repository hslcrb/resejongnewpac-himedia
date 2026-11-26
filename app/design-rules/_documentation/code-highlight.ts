export type CodeToken = {
    kind: "text" | "comment" | "string" | "tag" | "property" | "keyword" | "number";
    text: string;
};

// [구문 색상만 더하고 원문은 그대로 유지 / Lightweight highlighting, never HTML parsing]
export function highlightCode(source: string, language: "tsx" | "css" = "tsx"): CodeToken[] {
    const comment =
        language === "css" ? String.raw`/\*[\s\S]*?\*/` : String.raw`/\*[\s\S]*?\*/|//[^\r\n]*`;
    const pattern = new RegExp(
        [
            `(?<comment>${comment})`,
            String.raw`(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\x60(?:\\.|[^\x60\\])*\x60)`,
            String.raw`(?<tag></?[A-Za-z][\w.-]*)`,
            String.raw`(?<property>(?:--)?[A-Za-z_][\w-]*(?=\s*[=:]))`,
            String.raw`(?<keyword>\b(?:import|from|export|default|const|let|return|true|false|null|function|if|else)\b)`,
            String.raw`(?<number>\b\d+(?:\.\d+)?(?:px|rem|em|ms|s|%)?)`,
        ].join("|"),
        "g",
    );
    const tokens: CodeToken[] = [];
    let end = 0;
    for (const match of source.matchAll(pattern)) {
        if (match.index > end) tokens.push({ kind: "text", text: source.slice(end, match.index) });
        const kind = Object.keys(match.groups!).find(
            (key) => match.groups![key] !== undefined,
        ) as CodeToken["kind"];
        tokens.push({ kind, text: match[0] });
        end = match.index + match[0].length;
    }
    if (end < source.length) tokens.push({ kind: "text", text: source.slice(end) });
    return tokens;
}
