// Captures README screenshots from a running NAADI (default http://localhost:3001) with the
// locally installed Chrome or Edge via puppeteer-core. Software WebGL keeps the 3D twin
// renderable in headless mode.
//   node scripts/screenshots.mjs [baseUrl]
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] || 'http://localhost:3001';
const out = fileURLToPath(new URL('../docs/assets/screens/', import.meta.url));
mkdirSync(out, { recursive: true });
const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome or Edge found; set CHROME_PATH');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (page, sel, text) =>
  page.evaluate((s, t) => { const b = [...document.querySelectorAll(s)].find((x) => x.textContent.includes(t)); if (b) b.click(); return !!b; }, sel, text);

const shots = [
  { name: 'floor', path: '/floor', settle: 7000 },
  { name: 'floor-inspect', path: '/floor', settle: 7000, act: async (p) => { await clickText(p, '.shed-ui button', 'Inspect'); await wait(1200); await clickText(p, '.shed-ui button', 'Explode'); await wait(1500); } },
  { name: 'case-file', path: '/machine/L03', settle: 3500 },
  { name: 'case-file-lower', path: '/machine/L03', settle: 3500, act: async (p) => { await p.evaluate(() => document.querySelector('.chain')?.scrollIntoView({ block: 'start' })); await wait(800); } },
  { name: 'agents', path: '/agents', settle: 2500, act: async (p) => { await clickText(p, 'button', 'Run the agents'); await wait(6200); } },
  { name: 'agents-whatif', path: '/agents', settle: 2500, act: async (p) => { await clickText(p, 'button', 'Run the agents'); await wait(6200); await clickText(p, '.switch', "power cut"); await wait(6200); } },
  {
    name: 'lab', path: '/lab', settle: 2000,
    act: async (p) => {
      await clickText(p, 'button', 'synthesised fan'); await wait(1500);
      await clickText(p, 'button', 'Learn normal'); await wait(21500);
      await clickText(p, 'button', 'Add a bearing fault'); await wait(9000);
    },
  },
  { name: 'overview', path: '/', settle: 3500, reduced: true },
  { name: 'rulebook', path: '/rulebook', settle: 2000, act: async (p) => { await p.evaluate(() => [...document.querySelectorAll('.rules-family button')].find((b) => b.textContent.includes('Looseness'))?.click()); await wait(600); } },
];
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
});
try {
  for (const s of shots) {
    if (only && !only.includes(s.name)) continue;
    const page = await browser.newPage();
    // reduced motion shows finished states (the overview's chain fully punched) deterministically
    if (s.reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const res = await page.goto(base + s.path, { waitUntil: 'networkidle2', timeout: 90000 }).catch((e) => ({ status: () => 0, e }));
    if (!res || res.status() >= 400) {
      console.log(`skip ${s.name}: ${res && res.status ? res.status() : 'no response'}`);
      await page.close();
      continue;
    }
    await wait(s.settle);
    if (s.act) await s.act(page);
    await page.screenshot({ path: `${out}${s.name}.png` });
    console.log(`saved ${s.name}.png`);
    await page.close();
  }
} finally {
  await browser.close();
}
