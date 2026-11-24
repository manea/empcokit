import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const dims = await page.evaluate(() => {
    const main = document.querySelector('main');
    const header = document.querySelector('header');
    const mainRect = main?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      mainWidth: mainRect ? Math.ceil(mainRect.width) : 0,
      headerWidth: headerRect ? Math.ceil(headerRect.width) : 0,
    };
  });
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.mainWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.headerWidth).toBeLessThanOrEqual(dims.innerWidth);
}

function buildCompliantCsv(): string {
  return [
    'sku,product_name,marketing_copy,label_kind,legal_notice_displayed,durability_years,garan_label_displayed',
    'SKU-201,EuroRunner Pro,"EU Ecolabel (NL/019/042) recycled knit sneaker tested for 5,000 flex cycles",eu_ecolabel_public,true,3,true',
    'SKU-202,CleanCotton Pack,"GOTS organic cotton dust bag in FSC mix sleeve",third_party_certified,true,2,false',
  ].join('\n');
}

test.describe('EmpCoKit — EU EmpCo 2024/825 & 2025/1960 Studio E2E', () => {
  test('defaults to EN LTR Nordic Linen, toggles AR RTL Charcoal Ledger, and persists across reload', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.locator('header')).toContainText('SQLite WAL');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nordic-linen');
    await expect(
      page.getByRole('img', {
        name: 'Regulation (EU) 2025/1960 Legal Guarantee Notice and GARAN Label Preview',
      }),
    ).toBeVisible();
    await expect(page.locator('main')).toContainText('100/100');
    await expect(page.locator('main')).toContainText('NOT affiliated');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/01-workspace-en-nordic-linen.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByRole('button', { name: 'Switch language to Arabic' }).click();
    await page.getByRole('button', { name: 'تبديل المظهر الفاتح والداكن' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'charcoal-ledger');
    await expect(page.locator('main')).toContainText('ليست تابعة');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/02-workspace-ar-charcoal-ledger.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'charcoal-ledger');

    expect(errors).toEqual([]);
  });

  test('evaluates pre-cutoff apparel conditional & remediates greenwashed carbon-neutral store into sealed EMP-YYYY-0001 with BOM CSV & /r/:code', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const year = new Date().getUTCFullYear();
    const expectedCode = `EMP-${year}-0001`;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('main')).toContainText('100/100');

    // Preset 2: Pre-Cutoff Apparel Brand (Conditional)
    await page
      .getByRole('button', { name: /Pre-Cutoff EU Apparel Brand/i })
      .click();
    await expect(page.locator('main')).toContainText('Conditional / Pre-Cutoff');
    await expect(page.locator('main')).toContainText('EUR 0');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/03-pre-cutoff-conditional-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // Preset 3: Greenwashed & Carbon Neutral Store (Blocked — EUR 1,000,000 exposure)
    await page
      .getByRole('button', { name: /Greenwashed & Offset Claims Store/i })
      .click();
    await expect(page.locator('main')).toContainText('Blocked Violation');
    await expect(page.locator('main')).toContainText('1,000,000');

    // Remediate copy, badge, 2y notice, GARAN display, future proof checkboxes, catalog CSV & 5 missing controls
    await page
      .getByLabel('Marketing Copy & Product Claims')
      .fill('EU Ecolabel (NL/019/042) recycled knit sneaker tested for 5,000 flex cycles.');
    await page.getByLabel('Displayed Sustainability Label Type').selectOption('eu_ecolabel_public');
    await page.getByLabel('Label Scheme Name').fill('EU Ecolabel');

    for (const labelText of [
      'Holds Recognized Environmental Excellence Proof',
      'Published objective implementation plan',
      'Regular verification by independent third-party expert',
      'Mandatory 2-Year Legal Guarantee Notice prominently displayed',
      'Harmonised GARAN Commercial Durability Label displayed',
    ]) {
      await page.locator(`label:has-text("${labelText}") input[type="checkbox"]`).check();
    }

    await page.locator('textarea[dir="ltr"]').fill(buildCompliantCsv());
    for (const id of ['EMP-CTRL-01', 'EMP-CTRL-02', 'EMP-CTRL-03', 'EMP-CTRL-04', 'EMP-CTRL-05']) {
      await page.getByRole('button', { name: new RegExp(id) }).click();
    }

    await expect(page.locator('main')).toContainText('EmpCo Compliant');
    await expect(page.locator('main')).toContainText('100/100');
    await expect(page.locator('main')).toContainText('EUR 0');

    // Save draft then atomically seal -> EMP-YYYY-0001
    await page.getByRole('button', { name: 'Save New Draft' }).click();
    await expect(page.getByRole('button', { name: 'Finalize & Stamp Code' })).toBeVisible();
    await page.getByRole('button', { name: 'Finalize & Stamp Code' }).click();
    await expect(page.locator('main')).toContainText(expectedCode);
    await expect(page.getByRole('button', { name: 'Finalize & Stamp Code' })).toHaveCount(0);

    // Download UTF-8 BOM CSV & check EF BB BF prefix
    const dlPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Safe CSV' }).click();
    const dl = await dlPromise;
    expect(dl.suggestedFilename()).toContain('.csv');
    const dlPath = await dl.path();
    expect(dlPath).toBeTruthy();
    if (dlPath) {
      const bytes = fs.readFileSync(dlPath);
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    }

    await page.screenshot({
      path: 'test-results/qa-screenshots/04-sealed-dossier-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // Public share route /r/:code
    await page.goto(`/r/${expectedCode}`);
    await expect(page.locator('body')).toContainText(`EmpCoKit`);
    await expect(page.locator('body')).toContainText(expectedCode);
    await page.reload();
    await expect(page.locator('body')).toContainText(expectedCode);

    expect(errors).toEqual([]);
  });

  test('verifies mobile 390x844 responsiveness in EN Nordic Linen and AR Charcoal Ledger with zero overflow', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(
      page.getByRole('img', {
        name: 'Regulation (EU) 2025/1960 Legal Guarantee Notice and GARAN Label Preview',
      }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/05-mobile-en-nordic-linen.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByRole('button', { name: 'Switch language to Arabic' }).click();
    await page.getByRole('button', { name: 'تبديل المظهر الفاتح والداكن' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'charcoal-ledger');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/06-mobile-ar-charcoal-ledger.png',
      fullPage: true,
      animations: 'disabled',
    });

    expect(errors).toEqual([]);
  });
});
