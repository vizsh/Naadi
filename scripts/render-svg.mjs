// Renders docs diagrams (SVG) to PNG with the local Chrome, for checking them before commit.
//   node scripts/render-svg.mjs <outDir> docs/assets/a.svg docs/assets/b.svg ...
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const [outDir, ...files] = process.argv.slice(2);
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((p) => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath, headless: true });
for (const f of files) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 400, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(f).href);
  const out = `${outDir}/${basename(f, '.svg')}.png`;
  await page.screenshot({ path: out, fullPage: true });
  console.log('rendered', out);
}
await browser.close().catch(() => {});
