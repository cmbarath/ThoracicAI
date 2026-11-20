import { test, expect } from '@playwright/test';

test.describe('End-to-End CT Inference & Reporting Workflow', () => {
  test('should run cancer sample inference, view results, and inspect in registry', async ({ page }) => {
    await page.goto('/');

    // Navigate to Cancer Workflow
    const cancerTab = page.locator('button:has-text("Cancer Workflow")').first();
    await cancerTab.click();
    await expect(page.locator('text=Workflow A: Thoracic Cancer Classification')).toBeVisible();

    // Trigger demo inference
    const demoBtn = page.locator('button:has-text("Load Sample CANCER Series")');
    await expect(demoBtn).toBeVisible();
    await demoBtn.click();

    // Wait for prediction result card
    await expect(page.locator('text=Aggregated Case Classification')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Arithmetic Mean Softmax Distribution')).toBeVisible();

    // Open Case Report modal
    const reportBtn = page.locator('button:has-text("Case Report")');
    await expect(reportBtn).toBeVisible();
    await reportBtn.click();

    // Verify modal elements
    await expect(page.locator('text=ThoracicAI Case Examination Summary')).toBeVisible();
    await expect(page.locator('button:has-text("Official PDF")')).toBeVisible();

    // Close modal
    await page.click('button:has-text("Close")');

    // Navigate to Case Registry
    const casesNav = page.locator('button:has-text("Case Registry")').first();
    await casesNav.click();
    await expect(page.locator('text=Research Case History')).toBeVisible();

    // Verify cases table contains at least one record
    const caseRows = page.locator('table tbody tr');
    await expect(caseRows.first()).toBeVisible({ timeout: 10000 });
  });

  test('should run COVID / pulmonary inference and verify aspect-ratio padding note', async ({ page }) => {
    await page.goto('/');

    // Navigate to COVID workflow
    const covidTab = page.locator('button:has-text("COVID / Pulmonary")').first();
    await covidTab.click();
    await expect(page.locator('text=Workflow B: COVID & Pulmonary Disease Classification')).toBeVisible();

    // Verify COVID-specific methodology note
    await expect(
      page.locator('text=COVID-19 model preserves natural lung aspect ratio')
    ).toBeVisible();

    // Trigger demo scan
    const demoBtn = page.locator('button:has-text("Load Sample COVID Series")');
    await expect(demoBtn).toBeVisible();
    await demoBtn.click();

    // Verify prediction
    await expect(page.locator('text=Aggregated Case Classification')).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to Benchmarks and verify exact evaluation metrics', async ({ page }) => {
    await page.goto('/');

    const perfTab = page.locator('button:has-text("Benchmarks")').first();
    await perfTab.click();

    // Cancer benchmark metrics
    await expect(page.locator('text=0.7212').first()).toBeVisible({ timeout: 10000 }); // Nested CV Macro F1
    await expect(page.locator('text=0.7091').first()).toBeVisible(); // Independent Test Macro F1
    await expect(page.locator('text=76.92%').first()).toBeVisible(); // Group accuracy

    // Switch to COVID / Pulmonary Model
    await page.click('button:has-text("COVID / Pulmonary Model")');

    // COVID benchmark metrics
    await expect(page.locator('text=0.8242').first()).toBeVisible(); // Nested CV Macro F1
    await expect(page.locator('text=0.7775').first()).toBeVisible(); // Independent Test Macro F1
    await expect(page.locator('text=78.13%').first()).toBeVisible(); // Group accuracy
  });
});
