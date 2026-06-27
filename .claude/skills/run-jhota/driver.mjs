#!/usr/bin/env node
/**
 * JHOTA Construcciones smoke / screenshot driver.
 * Usage:  node .claude/skills/run-jhota/driver.mjs [command]
 *
 * Commands
 *   smoke          – full smoke test (login → dashboard → suppliers → expenses → projects)
 *   screenshot <path> <url>  – take a single screenshot after logging in
 *   login-test     – verify credentials only, print result
 *
 * Requires:
 *   - Backend running on :3001
 *   - Frontend dev server running on :5173
 *   - Chromium at /opt/pw-browsers/chromium-1194/chrome-linux/chrome
 *
 * The Playwright package lives in /tmp/pw-test/node_modules (installed during
 * skill setup). If that directory is gone, run:
 *   mkdir -p /tmp/pw-test && cd /tmp/pw-test
 *   echo '{"name":"pw-test","type":"module","dependencies":{"playwright":"^1.52.0"}}' > package.json
 *   npm install --silent
 */

import { chromium } from '/tmp/pw-test/node_modules/playwright/index.mjs';
import { writeFileSync } from 'fs';

const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE     = 'http://localhost:5173';
const EMAIL    = 'admin@gastos.local';
const PASS     = 'Admin@2026!';
const SS_DIR   = '/tmp/jhota-ss';

const [,, cmd = 'smoke', ...args] = process.argv;

async function launch() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  return { browser, page };
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  const url = page.url();
  if (url.includes('login')) throw new Error(`Login failed — stayed at ${url}`);
  return url;
}

async function ss(page, name, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(2000);
  const file = `${SS_DIR}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  ✓ ${name} → ${file}`);
  return file;
}

// ── commands ──────────────────────────────────────────────────

if (cmd === 'login-test') {
  const { browser, page } = await launch();
  try {
    const url = await login(page);
    console.log('LOGIN OK →', url);
  } catch (e) {
    console.error('LOGIN FAIL:', e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

if (cmd === 'screenshot') {
  const [outPath, urlPath] = args;
  if (!outPath || !urlPath) { console.error('Usage: screenshot <file.png> <url-path>'); process.exit(1); }
  const { browser, page } = await launch();
  await login(page);
  await page.goto(`${BASE}${urlPath}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log('screenshot →', outPath);
  await browser.close();
}

if (cmd === 'smoke') {
  import('fs').then(({ mkdirSync }) => mkdirSync(SS_DIR, { recursive: true }));

  const { browser, page } = await launch();
  const results = [];

  try {
    // 1. Login page (unauthenticated)
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: `${SS_DIR}/00-login.png`, fullPage: true });
    console.log('01 login page — title:', await page.title());

    // 2. Authenticate
    await login(page);
    await page.screenshot({ path: `${SS_DIR}/01-dashboard.png`, fullPage: true });
    const h1 = await page.locator('h1').first().textContent().catch(() => '?');
    console.log('02 dashboard — h1:', h1.trim());

    // 3. Module pages
    for (const [name, path] of [
      ['suppliers',  '/suppliers'],
      ['expenses',   '/expenses'],
      ['projects',   '/projects'],
      ['payroll',    '/payrolls'],
      ['reports',    '/reports'],
    ]) {
      const file = await ss(page, name, path);
      results.push({ name, file, url: `${BASE}${path}` });
    }

    // 4. Quick API health check
    const health = await page.evaluate(() =>
      fetch('http://localhost:3001/health').then((r) => r.json())
    );
    console.log('\nAPI health:', health.status);

    console.log('\n✅ smoke PASS — screenshots in', SS_DIR);
  } catch (err) {
    await page.screenshot({ path: `${SS_DIR}/error.png`, fullPage: true });
    console.error('❌ smoke FAIL:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}
