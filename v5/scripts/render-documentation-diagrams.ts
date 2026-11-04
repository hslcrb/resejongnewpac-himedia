import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

// Markdown is the canonical source. Commit the extracted sources and rendered SVGs together.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = join(root, 'docs/readme/diagrams');
const documents = ['README.md', 'docs/architecture/overview.md', 'docs/architecture/data-model.md', 'docs/operations/deployment-runbook.md'];
const check = process.argv.includes('--check');
const diagrams: Array<{ id: string; source: string; markdown: string }> = [];
for (const markdown of documents) {
  const content = readFileSync(join(root, markdown), 'utf8').replace(/\r\n/g, '\n');
  for (const match of content.matchAll(/^```mermaid\r?\n([\s\S]*?)^```/gm)) {
    const source = match[1].trimEnd() + '\n';
    const id = /^%% diagram: ([a-z][a-z0-9-]*)$/m.exec(source)?.[1];
    if (!id || diagrams.some((diagram) => diagram.id === id)) throw new Error(`Missing or duplicate diagram id in ${markdown}`);
    if (!/^\s*accTitle:/m.test(source) || !/^\s*accDescr:/m.test(source)) throw new Error(`Accessibility description missing: ${id}`);
    diagrams.push({ id, source, markdown });
  }
}
if (diagrams.length !== 8) throw new Error(`Expected 8 documented diagrams, found ${diagrams.length}`);

mkdirSync(output, { recursive: true });
const work = check ? '' : process.env.DOCS_RENDER_WORKDIR || mkdtempSync(join(tmpdir(), 'sejong-diagrams-'));
if (work) mkdirSync(work, { recursive: true });
const puppeteerConfig = join(work, 'puppeteer.json');
if (!check) {
  // Set PUPPETEER_EXECUTABLE_PATH to use a locally managed browser instead of a download.
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  writeFileSync(puppeteerConfig, JSON.stringify({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] }));
}

// Local HTTP also works in managed browsers where file:// navigation is disabled.
// Optional renderer packages stay outside the application dependencies.
let browser: any;
let server: ReturnType<typeof createServer> | undefined;
let rendererURL = '';
try {
if (!check && process.env.MERMAID_RENDERER_DIR) {
  const requireRenderer = createRequire(join(resolve(process.env.MERMAID_RENDERER_DIR), 'package.json'));
  const mermaidRoot = dirname(requireRenderer.resolve('mermaid/package.json'));
  const version = JSON.parse(readFileSync(join(mermaidRoot, 'package.json'), 'utf8')).version;
  if (version !== '12.3.0') throw new Error(`Expected Mermaid 12.3.0, found ${version}`);
  server = createServer((request, response) => {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="container"></div></body></html>');
      return;
    }
    const path = resolve(mermaidRoot, '.' + new URL(request.url || '/', 'http://localhost').pathname);
    if (!path.startsWith(join(mermaidRoot, 'dist') + '/') || !existsSync(path)) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', path.endsWith('.js') || path.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream');
    response.end(readFileSync(path));
  });
  await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Renderer server unavailable');
  rendererURL = `http://127.0.0.1:${address.port}`;
  browser = await requireRenderer('puppeteer').launch(JSON.parse(readFileSync(puppeteerConfig, 'utf8')));
}

for (const { id, source, markdown } of diagrams) {
  const mmd = join(output, `${id}.mmd`);
  const svg = join(output, `${id}.svg`);
  if (check) {
    if (!existsSync(mmd) || readFileSync(mmd, 'utf8').replace(/\r\n/g, '\n') !== source) throw new Error(`Stale source: ${id} (${markdown})`);
  } else {
    writeFileSync(mmd, source);
    const config = join(work, `${id}.json`);
    writeFileSync(config, JSON.stringify({
      theme: 'base', securityLevel: 'strict', htmlLabels: false,
      fontFamily: 'Arial, Noto Sans CJK KR, Malgun Gothic, sans-serif',
      deterministicIds: true, deterministicIDSeed: id,
      themeVariables: {
        fontFamily: 'Arial, Noto Sans CJK KR, Malgun Gothic, sans-serif', fontSize: '20px',
        primaryColor: '#FFFEFA', primaryTextColor: '#211F1C', primaryBorderColor: '#DFDED7',
        secondaryColor: '#DDF3FA', tertiaryColor: '#FCF7DF', lineColor: '#626262',
        textColor: '#211F1C', mainBkg: '#FFFEFA', nodeBorder: '#DFDED7',
        actorBkg: '#FFFEFA', actorBorder: '#DFDED7', actorTextColor: '#211F1C',
        signalColor: '#626262', signalTextColor: '#211F1C', noteBkgColor: '#FCF7DF', noteTextColor: '#211F1C',
        attributeBackgroundColorOdd: '#FFFEFA', attributeBackgroundColorEven: '#F7F7F5',
      },
      flowchart: { htmlLabels: false, nodeSpacing: 24, rankSpacing: 32, diagramPadding: 24 },
      sequence: { useMaxWidth: true, actorFontSize: 20, messageFontSize: 20, noteFontSize: 20, wrap: true },
      er: { useMaxWidth: true, fontSize: 20, minEntityWidth: 230, diagramPadding: 24 },
    }));
    if (browser) {
      const page = await browser.newPage();
      try {
        await page.goto(rendererURL);
        const rendered = await page.evaluate(async ({ id, source, config, rendererURL }: any) => {
          const { default: mermaid } = await import(`${rendererURL}/dist/mermaid.esm.min.mjs`);
          mermaid.initialize({ startOnLoad: false, ...config });
          const { svg } = await mermaid.render(id, source, document.querySelector('#container'));
          return svg;
        }, { id, source, config: JSON.parse(readFileSync(config, 'utf8')), rendererURL });
        writeFileSync(svg, rendered);
      } finally { await page.close(); }
    } else {
    const args = ['-i', mmd, '-o', svg, '-c', config, '-p', puppeteerConfig, '-I', id, '-b', '#FFFEFA', '--no-font-embed', '-q'];
    const binary = process.env.MERMAID_CLI_BIN;
    const result = binary
      ? spawnSync(binary, args, { stdio: 'inherit' })
      : spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', '--package=@mermaid-js/mermaid-cli@12.2.0', 'mmdc', ...args], { stdio: 'inherit' });
    if (result.error || result.status !== 0) throw result.error || new Error(`Mermaid rendering failed: ${id}`);
    }
    const digest = createHash('sha256').update(source).digest('hex');
    writeFileSync(svg, readFileSync(svg, 'utf8') + `\n<!-- Documentation source SHA256: ${digest} -->\n`);
  }
  if (!existsSync(svg)) throw new Error(`Missing SVG: ${id}`);
  const rendered = readFileSync(svg, 'utf8');
  const expectedDigest = createHash('sha256').update(source).digest('hex');
  if (!rendered.includes(`Documentation source SHA256: ${expectedDigest}`)) throw new Error(`SVG source mismatch: ${id}`);
  if (!/<svg\b/.test(rendered) || !/viewBox=/.test(rendered) || !/<title\b/.test(rendered) || !/<desc\b/.test(rendered)
      || /Syntax error in text|fill="undefined"|stroke="undefined"/.test(rendered)) throw new Error(`Invalid rendered SVG: ${id}`);
  console.log(`${check ? 'Checked' : 'Rendered'} ${id}`);
}
} finally {
  if (browser) await browser.close();
  if (server) await new Promise<void>((done) => server!.close(() => done()));
}
