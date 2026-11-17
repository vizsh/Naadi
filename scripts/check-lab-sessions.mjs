// Live Lab sessions on the device, against a running dev or production server on :3001:
// learn a synthesised fan, add a fault, reload (the session and its cards persist), resume it
// without learning (new cards append to the same session). node scripts/check-lab-sessions.mjs
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--autoplay-policy=no-user-gesture-required'], protocolTimeout: 60000 });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (t) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t)); b?.click(); return !!b; }, t);
const saved = () => page.evaluate(() => [...document.querySelectorAll('.sessions li')].map((li) => li.querySelector('.sess-top').textContent).join(' || ') || document.querySelector('.lab-saved .sub:last-child')?.textContent);
await page.goto('http://localhost:3001/lab', { waitUntil: 'networkidle2' });
await wait(2000);
await click('synthesised fan'); await wait(1500);
await click('Learn normal'); await wait(22000);
await click('Add a bearing fault'); await wait(9000);
console.log('while recording:', await saved());
await page.reload({ waitUntil: 'networkidle2' }); await wait(2500);
console.log('after reload:', await saved());
console.log('resume clicked:', await click('Resume')); await wait(9000);
console.log('status:', await page.evaluate(() => document.querySelector('.lab-status')?.textContent.slice(0, 60)));
console.log('after resume:', await saved());
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
await browser.close();
