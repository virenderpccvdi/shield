/**
 * Shield Platform — Playwright UI Test Suite
 * Tests the React 19 dashboard across all three roles.
 *
 * Usage:
 *   node shield_ui_tests.mjs [--url https://shield.rstglobal.in/app/] [--config ../config.json]
 *
 * Output: JSON array of test results written to stdout.
 * On failure: saves screenshot to ../screenshots/<test-name>.png
 *
 * Install: npx playwright install chromium
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const configPath = args.includes('--config')
  ? args[args.indexOf('--config') + 1]
  : resolve(__dir, '../config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const BASE_URL     = config.playwright?.dashboard_url ?? 'https://shield.rstglobal.in/app/';
const HEADLESS     = config.playwright?.headless !== false;
const TIMEOUT_MS   = config.playwright?.timeout_ms ?? 15000;
const SCREENSHOT_DIR = resolve(__dir, '../screenshots');
const GA_CREDS     = config.roles?.global_admin ?? {};
const ISP_CREDS    = config.roles?.isp_admin ?? {};
const CUST_CREDS   = config.roles?.customer ?? {};

// ── Helpers ─────────────────────────────────────────────────────────────────
const results = [];

async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, latency_ms: Date.now() - t0, message: 'OK', steps: [] });
  } catch (err) {
    results.push({
      name,
      passed: false,
      latency_ms: Date.now() - t0,
      message: err.message?.slice(0, 300) ?? 'Unknown error',
      steps: err.steps ?? [],
    });
  }
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}login`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for navigation away from /login
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: TIMEOUT_MS });
}

async function screenshot(page, name) {
  try {
    const safe = name.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${safe}.png`, fullPage: false });
  } catch (_) { /* ignore screenshot failures */ }
}

// ── Tests ────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: HEADLESS, args: ['--no-sandbox'] });

try {

  // ── 1. Login page renders ────────────────────────────────────────────────
  await test('Login page renders', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}login`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: TIMEOUT_MS });
    const title = await page.title();
    if (!title) throw new Error('Page has no title');
    await page.close();
  });

  // ── 2. Invalid login shows error ─────────────────────────────────────────
  await test('Invalid login shows error message', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}login`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await page.fill('input[type="email"], input[name="email"]', 'wrong@test.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    // Should stay on login page or show error — NOT navigate to dashboard
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasError = await page.$('[role="alert"], .MuiAlert-root, [data-testid="error"]')
      .then(el => !!el).catch(() => false);
    const stillOnLogin = url.includes('/login');
    if (!stillOnLogin && !hasError) {
      await screenshot(page, 'invalid_login_no_error');
      throw new Error(`Invalid login navigated away to ${url} without showing error`);
    }
    await page.close();
  });

  // ── 3. GLOBAL_ADMIN login and dashboard ──────────────────────────────────
  if (GA_CREDS.email && GA_CREDS.password) {
    await test('GLOBAL_ADMIN: login and reach dashboard', async () => {
      const page = await browser.newPage();
      const consoleErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      await login(page, GA_CREDS.email, GA_CREDS.password);
      // Should land on admin or platform dashboard
      await page.waitForSelector('[data-testid="dashboard"], .MuiCard-root, main', { timeout: TIMEOUT_MS });
      const url = page.url();
      if (url.includes('/login')) {
        await screenshot(page, 'ga_login_stuck');
        throw new Error('Still on login after successful auth');
      }
      const criticalErrors = consoleErrors.filter(e =>
        !e.includes('favicon') && !e.includes('sourceMap') && !e.includes('Warning'));
      if (criticalErrors.length > 3) {
        throw new Error(`${criticalErrors.length} JS console errors: ${criticalErrors[0]}`);
      }
      await page.close();
    });

    await test('GLOBAL_ADMIN: /admin/tenants page renders', async () => {
      const page = await browser.newPage();
      await login(page, GA_CREDS.email, GA_CREDS.password);
      await page.goto(`${BASE_URL}admin/tenants`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
      await page.waitForSelector('table, [data-testid="tenant-list"], .MuiDataGrid-root', { timeout: TIMEOUT_MS });
      const rowCount = await page.$$eval('tbody tr', rows => rows.length).catch(() => 0);
      if (rowCount < 1) throw new Error('Tenants table is empty');
      await page.close();
    });

    await test('GLOBAL_ADMIN: /admin/analytics page renders', async () => {
      const page = await browser.newPage();
      await login(page, GA_CREDS.email, GA_CREDS.password);
      await page.goto(`${BASE_URL}admin/analytics`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
      // Wait for any chart or card to appear
      await page.waitForSelector('canvas, .recharts-wrapper, .MuiCard-root', { timeout: TIMEOUT_MS });
      await page.close();
    });

    await test('GLOBAL_ADMIN: system health page renders all services', async () => {
      const page = await browser.newPage();
      await login(page, GA_CREDS.email, GA_CREDS.password);
      await page.goto(`${BASE_URL}admin/health`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
      await page.waitForSelector('.MuiCard-root, [data-testid="health-card"]', { timeout: TIMEOUT_MS });
      const cards = await page.$$('.MuiCard-root').then(els => els.length).catch(() => 0);
      if (cards < 3) throw new Error(`Only ${cards} health cards — expected ≥3`);
      await page.close();
    });

    await test('GLOBAL_ADMIN: page load time ≤ 5s for dashboard', async () => {
      const page = await browser.newPage();
      await login(page, GA_CREDS.email, GA_CREDS.password);
      const t0 = Date.now();
      await page.goto(`${BASE_URL}admin/dashboard`, { waitUntil: 'networkidle', timeout: 10000 });
      const loadMs = Date.now() - t0;
      if (loadMs > 5000) throw new Error(`Dashboard load took ${loadMs}ms (> 5000ms)`);
      await page.close();
    });
  }

  // ── 4. ISP_ADMIN login ───────────────────────────────────────────────────
  if (ISP_CREDS.email && ISP_CREDS.password) {
    await test('ISP_ADMIN: login and reach dashboard', async () => {
      const page = await browser.newPage();
      await login(page, ISP_CREDS.email, ISP_CREDS.password);
      await page.waitForSelector('.MuiCard-root, main, [data-testid="dashboard"]', { timeout: TIMEOUT_MS });
      const url = page.url();
      if (url.includes('/login')) throw new Error('ISP admin stuck on login page');
      await page.close();
    });

    await test('ISP_ADMIN: /isp/customers page renders', async () => {
      const page = await browser.newPage();
      await login(page, ISP_CREDS.email, ISP_CREDS.password);
      await page.goto(`${BASE_URL}isp/customers`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
      await page.waitForSelector('table, .MuiDataGrid-root, [data-testid="customer-list"]',
        { timeout: TIMEOUT_MS });
      await page.close();
    });
  }

  // ── 5. CUSTOMER login ────────────────────────────────────────────────────
  if (CUST_CREDS.email && CUST_CREDS.password) {
    await test('CUSTOMER: login and reach dashboard', async () => {
      const page = await browser.newPage();
      await login(page, CUST_CREDS.email, CUST_CREDS.password);
      await page.waitForSelector('.MuiCard-root, main', { timeout: TIMEOUT_MS });
      const url = page.url();
      if (url.includes('/login')) throw new Error('Customer stuck on login');
      await page.close();
    });

    await test('CUSTOMER: DNS history page renders', async () => {
      const page = await browser.newPage();
      await login(page, CUST_CREDS.email, CUST_CREDS.password);
      await page.goto(`${BASE_URL}dns/history`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
      await page.waitForSelector('table, [data-testid="dns-history"], .MuiCircularProgress-root',
        { timeout: TIMEOUT_MS });
      await page.close();
    });
  }

  // ── 6. 404 / Not Found handling ──────────────────────────────────────────
  await test('404 page renders for unknown route', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}this-page-does-not-exist-xyz`, { waitUntil: 'networkidle', timeout: TIMEOUT_MS });
    // Wait up to 5s for the NotFoundPage to hydrate (lazy Suspense)
    await page.waitForFunction(
      () => /not found|404|page.*not.*exist|go.*back/i.test(document.body.innerText),
      { timeout: 8000 }
    ).catch(() => {});
    const bodyText = await page.textContent('body').catch(() => '');
    const has404 = /not found|404|page.*not.*exist|go.*back/i.test(bodyText);
    if (!has404) {
      await screenshot(page, '404_blank_screen');
      throw new Error('Unknown route shows blank/empty page instead of 404');
    }
    await page.close();
  });

  // ── 7. Unauthenticated access to protected route ─────────────────────────
  await test('Protected route redirects to login when unauthenticated', async () => {
    const page = await browser.newPage();
    // Clear any stored auth before navigating
    await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch(_) {} });
    await page.goto(`${BASE_URL}admin/tenants`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await page.waitForTimeout(2000);
    const url = page.url();
    if (!url.includes('/login') && !url.includes('/auth')) {
      await screenshot(page, 'unauth_access_bypass');
      throw new Error(`Protected route accessible without auth: ${url}`);
    }
    await page.close();
  });

} finally {
  await browser.close();
}

// ── Output JSON ───────────────────────────────────────────────────────────
process.stdout.write(JSON.stringify(results, null, 2));
