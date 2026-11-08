import { test, expect } from '@playwright/test';

test.describe('CRYPTEX 2026 Authoritative Competition Flow', () => {
  test('public user can view home page and leaderboard without login', async ({ page }) => {
    await page.goto('/');

    // Verify Official Event Details
    await expect(page.locator('text=CRYPTEX 2026').first()).toBeVisible();
    await expect(page.locator('text=11 November 2026').first()).toBeVisible();
    await expect(page.locator('text=DFL04').first()).toBeVisible();
    await expect(page.locator('text=Dr. Vijay Kumar AV').first()).toBeVisible();
    await expect(page.locator('text=Prajwal B U').first()).toBeVisible();

    // Verify 8 official rounds in curriculum
    await expect(page.locator('text=The Secret Code')).toBeVisible();
    await expect(page.locator('text=Master Cryptanalyst')).toBeVisible();

    // Navigate to live leaderboard
    await Promise.all([
      page.waitForURL(/.*leaderboard/),
      page.locator('a[href="/leaderboard"]').first().click(),
    ]);
    await expect(page.getByRole('heading', { name: /OFFICIAL LEADERBOARD/i })).toBeVisible();
  });

  test('big screen display projector mode loads safe read-only channel', async ({ page }) => {
    await page.goto('/display');
    await expect(page.locator('text=PROJECTOR STREAM')).toBeVisible();
    await expect(page.locator('text=PROJECTOR SAFE READ-ONLY CHANNEL')).toBeVisible();
  });
});
