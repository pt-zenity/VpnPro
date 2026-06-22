import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

test.describe('Premium UI Screenshots', () => {
  test('Login page screenshot', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'test-screenshots-premium/01-login.png',
      fullPage: true
    });
  });

  test('Dashboard screenshot', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-screenshots-premium/02-dashboard.png',
      fullPage: true
    });
  });

  test('Nodes page screenshot', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/dashboard/nodes`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-screenshots-premium/03-nodes.png',
      fullPage: true
    });
  });

  test('New node form screenshot', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/dashboard/nodes/new`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-screenshots-premium/04-node-create.png',
      fullPage: true
    });
  });

  test('Audit logs screenshot', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/dashboard/audit`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-screenshots-premium/05-audit.png',
      fullPage: true
    });
  });

  test('Jobs page screenshot', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/dashboard/jobs`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-screenshots-premium/06-jobs.png',
      fullPage: true
    });
  });
});
