import { test, expect } from '@playwright/test';

test.describe('Authentication & User Governance Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER_PAGE_ERROR:', err));
  });

  test('should load landing page and display academic research disclaimer and sign in button', async ({ page }) => {
    // Clear any residual session
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page).toHaveTitle(/ThoracicAI/);

    // Verify research disclaimer banner
    const disclaimer = page.locator('text=Academic Research Platform');
    await expect(disclaimer.first()).toBeVisible();

    // Verify Sign In button is visible for unauthenticated visitors
    const signInBtn = page.locator('button:has-text("Sign In")').first();
    await expect(signInBtn).toBeVisible();
  });

  test('should authenticate via Sign In modal, open Account Settings, and edit profile', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Open Sign In modal
    const signInBtn = page.locator('button:has-text("Sign In")').first();
    await signInBtn.click();

    // Verify modal elements
    await expect(page.locator('text=Sign In to ThoracicAI')).toBeVisible();

    // Fill in institutional email and submit
    await page.fill('input[type="email"]', 'researcher@thoracicai.org');
    await page.fill('input[type="password"]', 'ResearchPass123!');
    await page.click('button[type="submit"]:has-text("Sign In")');

    // Wait for auth session to establish and account button to appear
    const userBadge = page.locator('button[title*="Account Settings"]').first();
    await expect(userBadge).toBeVisible({ timeout: 10000 });
    await userBadge.click();

    // Verify Account Settings page is visible
    await expect(page.locator('text=Researcher Account & Preferences')).toBeVisible();

    // Verify RBAC enforcement badge is read-only
    await expect(page.locator('text=Assigned Institutional Role:')).toBeVisible();
    await expect(page.locator('text=RBAC Enforced')).toBeVisible();

    // Update display name
    const nameInput = page.locator('input[placeholder*="Alex Mercer"]');
    await nameInput.fill('Dr. E2E Test Researcher');
    await page.click('button:has-text("Save Changes")');
    await expect(page.locator('text=updated successfully')).toBeVisible();
  });

  test('should allow authenticated administrator to access Governance Center', async ({ page, request }) => {
    // Request admin token from backend
    const res = await request.post('http://localhost:8000/api/auth/dev-token', {
      data: {
        email: 'admin@thoracicai.org',
        display_name: 'Dr. System Administrator',
        role: 'ADMIN',
      },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const adminToken = data.access_token;

    // Pre-seed localStorage before navigation using addInitScript
    await page.addInitScript((token) => {
      localStorage.setItem('thoracicai_token', token);
    }, adminToken);

    await page.goto('/');

    // Verify Administration tab is visible in Navbar
    const adminNav = page.locator('button:has-text("Administration")').first();
    await expect(adminNav).toBeVisible({ timeout: 10000 });
    await adminNav.click();

    // Verify Administration page elements
    await expect(page.locator('text=Administration & Governance Center')).toBeVisible();
    await expect(page.locator('text=User Governance')).toBeVisible();
  });
});
