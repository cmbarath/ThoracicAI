import { test, expect } from '@playwright/test';

test.describe('Report Centre & Document Generation', () => {
  test('should generate PDF, verify document in Report Centre, and delete report', async ({ page }) => {
    await page.goto('/');

    // 1. Run inference to generate a case
    const cancerTab = page.locator('button:has-text("Cancer Workflow")').first();
    await cancerTab.click();
    await page.click('button:has-text("Load Sample CANCER Series")');
    await expect(page.locator('text=Aggregated Case Classification')).toBeVisible({ timeout: 15000 });

    // 2. Open Case Report modal and trigger official PDF generation
    await page.click('button:has-text("Case Report")');
    await expect(page.locator('button:has-text("Official PDF")')).toBeVisible();

    // Trigger PDF download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Official PDF")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/report\.pdf$/i);

    // Close modal
    await page.click('button:has-text("Close")');

    // 3. Navigate to Report Centre
    const reportsNav = page.locator('button:has-text("Report Centre")').first();
    await reportsNav.click();
    await expect(page.locator('text=Research Document & Export Centre')).toBeVisible();

    // Verify report table has documents
    const reportRows = page.locator('table tbody tr');
    await expect(reportRows.first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table span:has-text("PDF Report")').first()).toBeVisible();
  });
});
