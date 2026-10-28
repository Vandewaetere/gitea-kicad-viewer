// gitea-kicad-viewer — browser part of the end-to-end test (started by test/test.sh, see there).
// BASE = address of the test Gitea, MODE = "default" (Gitea's default sandbox) or "same-origin".
import { chromium } from 'playwright';

const BASE = process.env.BASE, MODE = process.env.MODE;
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} [${MODE}] ${what}`); if (!ok) failed++; };

// SwiftShader gives headless Chromium WebGL, which the PCB view needs.
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const outside = [], errors = [];
page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !/^(blob|data):/.test(u)) outside.push(u); });
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${BASE}/user/login`);
await page.fill('#user_name', 'tester');
await page.fill('#password', 'Test-12345!');
await page.click('form.ui.form button.ui.primary.button');
await page.waitForURL(`${BASE}/`);

// Open a file and wait until the viewer inside Gitea's render iframe reports "loaded"; returns the viewer's tabs.
async function open(file) {
  await page.goto(`${BASE}/tester/demo/src/branch/main/${file}`);
  const iframe = await page.waitForSelector('iframe', { timeout: 20000 }).catch(async (e) => {
    await page.screenshot({ path: `/out/${MODE}-${file}-FAILED.png` });
    throw e;
  });
  const frame = await iframe.contentFrame();
  await frame.waitForSelector('ecad-viewer[loaded]', { timeout: 60000 });
  await page.waitForTimeout(2000);  // let the canvas paint before the screenshot
  await page.screenshot({ path: `/out/${MODE}-${file}.png` });
  return frame.evaluate(() => [...document.querySelector('ecad-viewer').shadowRoot.querySelectorAll('*')]
    .map((e) => e.shadowRoot ? [...e.shadowRoot.querySelectorAll('*')] : []).flat()
    .map((e) => e.textContent.trim()).filter((t) => ['SCH', 'PCB', 'BOM'].includes(t)));
}

const sheet = await open('muxdata.kicad_sch');
check(sheet.includes('SCH'), `a single schematic opens (tabs: ${[...new Set(sheet)].join(' ')})`);

if (MODE === 'same-origin') {
  const project = await open('video.kicad_pro');
  check(project.includes('SCH') && project.includes('PCB'), `the whole project opens (tabs: ${[...new Set(project)].join(' ')})`);
}

// gitea-board-badges keeps working next to the viewer.
await page.goto(`${BASE}/tester/demo/issues`);
const badge = await page.waitForSelector('.board-column-badge', { timeout: 15000 })
  .then((b) => b.textContent()).then((t) => t.trim()).catch(() => null);
if (badge === null) await page.screenshot({ path: `/out/${MODE}-issues-FAILED.png` });
check(badge !== null, `gitea-board-badges badge in the issue list (${badge})`);

check(outside.length === 0, `no requests outside Gitea${outside.length ? ': ' + outside.join(', ') : ''}`);
check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join(' | ') : ''}`);

await browser.close();
process.exit(failed ? 1 : 0);
