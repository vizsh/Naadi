import puppeteer from 'puppeteer-core';
// Every setup the bar offers, in a real browser: a shared link loads its fault, switching updates the
// address, the floor keeps the setup and "Back to the demo" clears it. Needs the dev server on :3001.
const B = 'http://localhost:3001';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'], defaultViewport: { width: 1440, height: 900 }, protocolTimeout: 60000 });
const page = await browser.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 180)); });
page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 180)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const read = () => page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, top: document.querySelector('.posterior .post-name')?.textContent + ' ' + document.querySelector('.posterior .post-p')?.textContent, url: location.search, fault: document.querySelector('.setup-bar select')?.value }));
await page.goto(B + '/machine/L03?fault=unb&wear=fast', { waitUntil: 'networkidle2' }); await wait(2500);
console.log('shared link:', JSON.stringify(await read()));
await page.select('.setup-bar select', 'lsn'); await wait(2000);
console.log('switched:', JSON.stringify(await read()));
await page.evaluate(() => [...document.querySelectorAll('.setup-bar button')].find((b) => b.textContent.includes('Speeding up'))?.click()); await wait(1500);
console.log('wear:', JSON.stringify(await read()));
await page.goto(B + '/floor', { waitUntil: 'networkidle2' }); await wait(5000);
console.log('floor keeps setup:', JSON.stringify(await page.evaluate(() => ({ url: location.search, status: document.querySelector('.decision .status-line')?.textContent, best: document.querySelector('.decision-text')?.textContent }))));
await page.screenshot({ path: process.argv[2] });
await page.evaluate(() => [...document.querySelectorAll('.setup-bar button')].find((b) => b.textContent.includes('Back to the demo'))?.click()); await wait(3000);
console.log('back:', JSON.stringify(await page.evaluate(() => ({ url: location.search, status: document.querySelector('.decision .status-line')?.textContent }))));
await page.goto(B + '/', { waitUntil: 'networkidle2' }); await wait(2000);
await page.goto(B + '/agents', { waitUntil: 'networkidle2' }); await wait(2000);
console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors');
await browser.close();
