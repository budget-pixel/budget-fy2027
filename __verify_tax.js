const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8934/index.html?cb='+Date.now(), { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('#personalTaxBreakdown').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  const initial = await page.locator('#personalTaxBreakdown').innerText();
  console.log('--- INITIAL (expect %) ---');
  console.log(initial.slice(0, 400));

  await page.fill('#taxCalcValue', '');
  await page.evaluate(() => {
    const el = document.querySelector('#taxCalcValue');
    el.value = '300000';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(1000);
  const afterValue = await page.locator('#personalTaxBreakdown').innerText();
  console.log('--- AFTER VALUE (expect $) ---');
  console.log(afterValue.slice(0, 400));

  await page.check('#showBreakdownPercentages');
  await page.waitForTimeout(1000);
  const afterCheck = await page.locator('#personalTaxBreakdown').innerText();
  console.log('--- AFTER MANUAL CHECK (expect % again) ---');
  console.log(afterCheck.slice(0, 400));

  await browser.close();
})();
