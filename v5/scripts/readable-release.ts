import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const inputDirectories = ['app', 'components', 'src', 'styles', 'types', 'scripts', 'public'];
const inputFiles = ['package.json', 'package-lock.json', 'next.config.mjs', 'tsconfig.json', 'postcss.config.js', 'postcss.config.mjs', 'tailwind.config.ts'];

/** Hash only ordered runtime inputs; previous exports and reports cannot feed back. */
export function calculateReleaseId(root: string, environment: NodeJS.ProcessEnv = process.env): string {
    const files: string[] = [];
    function walk(relative: string): void {
        const absolute = path.join(root, relative);
        if (!fs.existsSync(absolute)) return;
        if (fs.statSync(absolute).isDirectory()) {
            for (const name of fs.readdirSync(absolute).sort()) {
                if (name === 'reports' || name === '.next' || name === 'out' || name === '_next') continue;
                walk(path.posix.join(relative, name));
            }
        } else files.push(relative);
    }
    [...inputDirectories, ...inputFiles].forEach(walk);
    const hash = createHash('sha256');
    hash.update('readable-build-v1\0' + process.versions.node + '\0');
    // 자산 크기와 무관한 입력 버퍼 / Reuse one bounded buffer for all assets.
    const buffer = Buffer.allocUnsafe(256 * 1024);
    for (const file of files.sort()) {
        hash.update(file + '\0');
        const descriptor = fs.openSync(path.join(root, file), 'r');
        try {
            let count: number;
            while ((count = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
                hash.update(buffer.subarray(0, count));
            }
        } finally {
            fs.closeSync(descriptor);
        }
        hash.update('\0');
    }
    for (const key of Object.keys(environment).filter(key => key.startsWith('NEXT_PUBLIC_')).sort()) hash.update(key + '=' + environment[key] + '\0');
    return 'r-' + hash.digest('hex').slice(0, 16);
}
