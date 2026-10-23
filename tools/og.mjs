// build.mjs가 고른 공유 카드(1200×630)를 og-card.html 스크린샷으로 만든다.
// 사용: 저장소 루트를 http://localhost:8080 으로 띄운 뒤 node tools/og.mjs
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = process.env.OG_ORIGIN || 'http://localhost:8080';
const todoFile = join(ROOT, 'tools/.og-todo.json');
const todo = JSON.parse(await readFile(todoFile, 'utf8').catch(() => '[]'));
const manifestFile = join(ROOT, 'og/manifest.json');
const manifest = JSON.parse(await readFile(manifestFile, 'utf8').catch(() => '{}'));
if (!todo.length) { console.log('og: nothing to render'); process.exit(0); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
let done = 0;
for (const c of todo) {
  try {
    await page.goto(`${ORIGIN}/tools/og-card.html?id=${encodeURIComponent(c.id)}&lang=${c.lang}`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-ready]', { timeout: 30000 });
    const out = join(ROOT, c.path);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, await page.screenshot({ type: 'jpeg', quality: 82 }));
    manifest[c.path] = c.sig;
    done++;
  } catch (e) { console.warn('og fail', c.path, e.message); }
}
await browser.close();
await writeFile(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
await rm(todoFile, { force: true });
console.log(`og: rendered ${done}/${todo.length}`);
