const path = require('path');
const fs = require('fs');

const globalModules = 'C:\\Users\\ITASH\\AppData\\Roaming\\npm\\node_modules';
const playwright = require(path.join(globalModules, 'playwright'));

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const res = await fetch('https://ai-gamma-drab.vercel.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@dialix.ai', password: 'MyAdmin2026!Secure' })
  });
  const data = await res.json();
  console.log('Logged in successfully:', data.client?.email);

  await context.addInitScript(({ token, client }) => {
    localStorage.setItem('dialix_token', token);
    localStorage.setItem('dialix_client', JSON.stringify(client));
  }, { token: data.token, client: data.client });

  const dir = path.join(__dirname, 'live_audit');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const routes = [
    { name: 'dashboard', url: 'https://ai-gamma-drab.vercel.app/dashboard' },
    { name: 'billing', url: 'https://ai-gamma-drab.vercel.app/dashboard/billing' },
    { name: 'contacts', url: 'https://ai-gamma-drab.vercel.app/dashboard/contacts' },
    { name: 'campaigns', url: 'https://ai-gamma-drab.vercel.app/dashboard/campaigns' },
    { name: 'agents', url: 'https://ai-gamma-drab.vercel.app/dashboard/agents' },
    { name: 'settings', url: 'https://ai-gamma-drab.vercel.app/dashboard/settings' }
  ];

  for (const r of routes) {
    try {
      await page.goto(r.url, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(2000);
      const outPath = path.join(dir, r.name + '.png');
      await page.screenshot({ path: outPath });
      console.log('Saved ' + outPath);
    } catch (e) {
      console.error('Error on ' + r.name + ':', e.message);
    }
  }

  await browser.close();
  console.log('All live audit screenshots taken.');
})();
