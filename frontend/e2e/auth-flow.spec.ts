import { test, expect } from '@playwright/test';

test.describe('Authentication & User Governance Flow', () => {
  test('should load landing page and display academic research disclaimer', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ThoracicAI/);

    // Verify research disclaimer banner
    const disclaimer = page.locator('text=Academic Research Platform');
    await expect(disclaimer.first()).toBeVisible();
  });

  test('should view account settings, edit profile, and toggle role to admin', async ({ page }) => {
    await page.goto('/');

    // Wait for auth initialization
    const userBadge = page.locator('button[title*="Account Settings"]').first();
    await expect(userBadge).toBeVisible({ timeout: 10000 });
    await userBadge.click();

    // Verify Account Settings page is visible
    await expect(page.locator('text=Researcher Account & Preferences')).toBeVisible();

    // Verify current role
    await expect(page.locator('text=Current Assigned Role:')).toBeVisible();

    // Update display name
    const nameInput = page.locator('input[placeholder*="Alex Mercer"]');
    await nameInput.fill('Dr. E2E Test Researcher');
    await page.click('button:has-text("Save Changes")');
    await expect(page.locator('text=updated successfully')).toBeVisible();

    // Toggle role to ADMIN for evaluation testing if currently RESEARCHER
    const toggleRoleBtn = page.locator('button:has-text("Switch to")').first();
    await toggleRoleBtn.click();
    await expect(page.locator('text=Switched session role')).toBeVisible();

    // Verify Administration tab is now visible in Navbar
    const adminNav = page.locator('button:has-text("Administration")').first();
    await expect(adminNav).toBeVisible();
    await adminNav.click();

    // Verify Administration page elements
    await expect(page.locator('text=Administration & Governance Center')).toBeVisible();
    await expect(page.locator('text=User Governance')).toBeVisible();
  });
});
