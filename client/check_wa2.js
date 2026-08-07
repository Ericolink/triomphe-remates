const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173/propiedades', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'wa_debug.png' });
  await browser.close();
})();
