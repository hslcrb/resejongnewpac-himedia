import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CatalogSnapshot } from '../../src/catalog/types.ts';

function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, ordered(item)]));
    return value;
}

/** 공개 내용의 날짜 범위 표기를 통일한다. (예: 2026.10.20 U+2014 10.25 -> 2026.10.20 ~ 10.25) */
function normalizedText(value: unknown): unknown {
    if (typeof value === 'string') return value.replace(/\s*\u2014\s*/g, ' ~ ').replace(/ ~ $/, ' ~');
    if (Array.isArray(value)) return value.map(normalizedText);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizedText(item)]));
    return value;
}

function publishedContent(snapshot: CatalogSnapshot): string {
    const { generatedAt, ...content } = snapshot;
    return JSON.stringify(ordered(content));
}

/** A fresh query is not a new publication when the published content is equal. */
export async function writeCatalogSnapshot(target: string, next: CatalogSnapshot): Promise<boolean> {
    next = normalizedText(next) as CatalogSnapshot;
    let previous: CatalogSnapshot | undefined;
    try {
        previous = JSON.parse(await readFile(target, 'utf8'));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (previous && typeof previous.generatedAt === 'string' && publishedContent(previous) === publishedContent(next)) return false;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(next, null, 4) + '\n', 'utf8');
    return true;
}
