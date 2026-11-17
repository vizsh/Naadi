// Offline and persistence check against a production server: npm run build && npx next start -p 3002, then node scripts/check-offline.mjs
// Loads once online (the service worker caches every page), approves a repair and reloads (the
// decision and its log entry persist), then cuts the network and opens six routes from the cache.
import puppeteer from 'puppeteer-core';
const B = 'http://localhost:3002';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'], protocolTimeout: 60000 });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const status = () => page.evaluate(() => document.querySelector('.sync')?.textContent);
await page.goto(B + '/', { waitUntil: 'networkidle2' });
await page.evaluate(() => navigator.serviceWorker.ready);
await wait(6000);
console.log('online status:', await status());
console.log('cached entries:', await page.evaluate(async () => (await (await caches.open('naadi-v1')).keys()).length));
// approve on the agents page, then reload: the decision and its log entry persist
await page.goto(B + '/agents', { waitUntil: 'networkidle2' });
await wait(1500);
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Approve repair')?.click());
await wait(500);
await page.reload({ waitUntil: 'networkidle2' });
await wait(1500);
console.log('after reload:', await page.evaluate(() => [...document.querySelectorAll('.done')].map((d) => d.textContent).join('|')), '· log rows', await page.evaluate(() => document.querySelectorAll('.dlog li').length));
// offline: every route still loads from the device
await page.setOfflineMode(true);
for (const p of ['/floor', '/machine/L03', '/model', '/lab', '/', '/machine/P02']) {
  const res = await page.goto(B + p, { waitUntil: 'domcontentloaded' }).catch((e) => ({ status: () => 'ERR ' + e.message.slice(0, 60) }));
  await wait(2500);
  const h = await page.evaluate(() => (document.querySelector('h1, h2')?.textContent ?? '').slice(0, 50)).catch(() => 'n/a');
  console.log('offline', p.padEnd(13), res.status(), '·', h, '·', await status().catch(() => ''));
}
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors');
await browser.close();
