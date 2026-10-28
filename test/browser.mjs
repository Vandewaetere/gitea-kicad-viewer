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
if (process.env.DEBUG) page.on('console', (m) => console.log('console:', m.type(), m.text().slice(0, 300)));
if (process.env.DEBUG) page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });

await page.goto(`${BASE}/user/login`);
await page.fill('#user_name', 'tester');
await page.fill('#password', 'Test-12345!');
await page.click('form.ui.form button.ui.primary.button');
await page.waitForURL(`${BASE}/`);

// Open a file and wait until the viewer inside Gitea's render iframe reports "loaded"; returns the viewer's tabs.
async function open(file) {
  await page.goto(`${BASE}/tester/demo/src/branch/main/${file}`);
  const iframe = await page.waitForSelector('iframe', { timeout: 20000 }).catch(async (e) => {
    await page.screenshot({ path: `/out/${MODE}-${file.split('/').pop()}-FAILED.png` });
    throw e;
  });
  const frame = await iframe.contentFrame();
  await frame.waitForSelector('ecad-viewer[loaded]', { timeout: 60000 });
  await page.waitForTimeout(2000);  // let the canvas paint before the screenshot
  await page.screenshot({ path: `/out/${MODE}-${file.split('/').pop()}.png` });
  const versioned = await frame.evaluate(() => [...document.scripts].some((x) => /loader\.js\?v=\w+/.test(x.src)));
  check(versioned, `${file}: assets loaded with a version (cache-busting)`);
  const logo = await frame.evaluate(() => {
    const l = document.querySelector('ecad-viewer').shadowRoot.querySelector('.bottom-left-icon');
    return !!l && getComputedStyle(l).display !== 'none';
  });
  check(!logo, `${file}: no ecad-viewer logo in the corner`);
  return frame.evaluate(() => [...document.querySelector('ecad-viewer').shadowRoot.querySelectorAll('*')]
    .map((e) => e.shadowRoot ? [...e.shadowRoot.querySelectorAll('*')] : []).flat()
    .filter((e) => e.offsetParent !== null || e.tagName !== 'TAB-BUTTON')
    .map((e) => e.textContent.trim()).filter((t) => ['SCH', 'PCB', '3D', 'BOM'].includes(t)));
}

const sheet = await open('muxdata.kicad_sch');
check(sheet.includes('SCH'), `a single schematic opens (tabs: ${[...new Set(sheet)].join(' ')})`);

const RP = 'examples/rp2350-minimal/RPI-RP2350A-MINIMAL_R4-S1';
const rpSheet = await open(`${RP}.kicad_sch`);
check(rpSheet.includes('SCH'), `example project: schematic opens (tabs: ${[...new Set(rpSheet)].join(' ')})`);
const rpBoard = await open(`${RP}.kicad_pcb`);
if (MODE === 'default') check(!rpBoard.includes('3D'), 'example project: no 3D tab without access to the .glb');
check(rpBoard.includes('PCB'), `example project: board opens (tabs: ${[...new Set(rpBoard)].join(' ')})`);

if (MODE === 'same-origin') {
  const rp = await open(`${RP}.kicad_pro`);
  check(rp.includes('SCH') && rp.includes('PCB'), `example project: whole project opens (tabs: ${[...new Set(rp)].join(' ')})`);
  // 3D: the example has a .glb next to it; open the 3D tab and wait for the model.
  const frame = page.frames().find((f) => f.url().includes('/render/'));
  const loaded3d = new Promise((res) => page.on('console', (m) => { if (m.text().includes('Online3dViewerLoaded')) res(true); }));
  await frame.locator('tab-button.tab', { hasText: '3D' }).first().click();
  const ok3d = await Promise.race([loaded3d, new Promise((res) => setTimeout(() => res(false), 60000))]);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `/out/${MODE}-3d.png` });
  check(ok3d, 'example project: 3D model loads in the 3D tab');

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
