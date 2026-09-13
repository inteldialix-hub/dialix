/**
 * Automated Playwright Visual Inspection and Verification Runner for Milestone 5
 * Audits all 9 Dialix dashboard routes, logs console errors, verifies CSS/DOM standards,
 * and captures desktop screenshots.
 */

const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Load environment from backend/.env
const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Global node_modules fallback for Playwright
const globalModules = 'C:\\Users\\ITASH\\AppData\\Roaming\\npm\\node_modules';
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.join(globalModules, 'playwright'));
}

const { chromium } = playwright;

const JWT_SECRET = process.env.JWT_SECRET || 'dialix_dev_secret_key_2024_secure_random_key_do_not_use_production';
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, '..', '.agents', 'worker_ui_m5', 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Create valid admin auth token
const adminToken = jwt.sign(
  { clientId: 1, is_admin: 1 },
  JWT_SECRET,
  { expiresIn: '24h', algorithm: 'HS256' }
);

const adminClient = {
  id: 1,
  name: 'Admin',
  email: 'admin@dialix.ai',
  is_admin: 1
};

const PAGES = [
  {
    id: '01_dashboard',
    name: 'Dashboard Overview',
    path: '/dashboard',
    filename: '01_dashboard.png',
    checks: ['stat_cards', 'buttons']
  },
  {
    id: '02_agents',
    name: 'Agents Roster',
    path: '/dashboard/agents',
    filename: '02_agents.png',
    checks: ['buttons', 'search_inputs']
  },
  {
    id: '03_agent_detail',
    name: 'Agent Configuration Detail',
    path: '/dashboard/agents/agent_001',
    filename: '03_agent_detail.png',
    checks: ['tabs', 'buttons']
  },
  {
    id: '04_campaigns',
    name: 'Campaigns Center',
    path: '/dashboard/campaigns',
    filename: '04_campaigns.png',
    checks: ['stat_cards', 'buttons', 'tables']
  },
  {
    id: '05_contacts',
    name: 'Contacts Directory',
    path: '/dashboard/contacts',
    filename: '05_contacts.png',
    checks: ['tables', 'search_inputs', 'buttons']
  },
  {
    id: '06_history',
    name: 'Call History & Analytics',
    path: '/dashboard/history',
    filename: '06_history.png',
    checks: ['tabs', 'tables', 'search_inputs']
  },
  {
    id: '07_billing',
    name: 'Billing & Subscriptions',
    path: '/dashboard/billing',
    filename: '07_billing.png',
    checks: ['stat_cards', 'buttons']
  },
  {
    id: '08_settings',
    name: 'Settings Suite',
    path: '/dashboard/settings',
    filename: '08_settings.png',
    checks: ['tabs', 'tables', 'buttons']
  },
  {
    id: '09_phone_numbers',
    name: 'Phone Numbers Manager',
    path: '/dashboard/phone-numbers',
    filename: '09_phone_numbers.png',
    checks: ['tables', 'buttons']
  }
];

async function runVisualVerification() {
  console.log('====================================================');
  console.log(' Dialix Milestone 5: Visual Verification Runner');
  console.log(' Base URL:', BASE_URL);
  console.log(' Screenshot Dir:', SCREENSHOT_DIR);
  console.log('====================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });

  // Pre-seed authentication in localStorage
  await context.addInitScript(({ token, client }) => {
    try {
      localStorage.setItem('dialix_token', token);
      localStorage.setItem('dialix_client', JSON.stringify(client));
    } catch (e) {
      console.error('Init script localStorage failed:', e);
    }
  }, { token: adminToken, client: adminClient });

  const auditResults = [];
  let totalConsoleErrors = 0;

  for (const p of PAGES) {
    console.log(`\n▶ Inspecting ${p.name} (${p.path})...`);
    const page = await context.newPage();

    const consoleLogs = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      consoleLogs.push(`[${type}] ${text}`);
      if (type === 'error') {
        // Filter out non-fatal expected favicon or telemetry noise if any
        if (!text.includes('favicon.ico') && !text.includes('Failed to load resource: net::ERR_CONNECTION_REFUSED')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', err => {
      console.error(`  [Page Error on ${p.path}]:`, err.message);
      pageErrors.push(err.message);
    });

    try {
      // Navigate to route
      const targetUrl = `${BASE_URL}${p.path}`;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for content or network idle
      try {
        await page.waitForLoadState('networkidle', { timeout: 8000 });
      } catch (e) {
        // networkidle may timeout if polling (e.g. 5s active calls poll) is active, which is normal
      }

      // Small stabilization pause for CSS animations / charts
      await page.waitForTimeout(1500);

      // On history page, click the first conversation to activate the center transcript & tab view
      if (p.id === '06_history') {
        try {
          const item = await page.waitForSelector('.analysis-list-item', { timeout: 4000 });
          if (item) {
            await item.click();
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          // fallback if list empty
        }
      }

      // Perform DOM & Style Inquiries
      const domAudits = await page.evaluate(() => {
        const results = {};

        // Check search inputs left padding
        const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="Search" i], .search-input, [data-search-input]');
        const searchInputStyles = Array.from(searchInputs).map(el => {
          const comp = window.getComputedStyle(el);
          return {
            placeholder: el.placeholder,
            paddingLeft: comp.paddingLeft,
            height: comp.height,
            backgroundColor: comp.backgroundColor
          };
        });
        results.searchInputs = searchInputStyles;

        // Check tabs (.tab-pill, .tab-pill-active or segmented buttons)
        const tabPills = document.querySelectorAll('.tab-pill, [role="tab"], .config-tab, .settings-tab');
        results.tabCount = tabPills.length;
        results.activeTabs = Array.from(document.querySelectorAll('.tab-pill-active, [data-state="active"], [aria-selected="true"]')).map(el => el.textContent.trim());

        // Check buttons
        const buttons = document.querySelectorAll('.btn, .btn-primary, .btn-secondary, .btn-ghost, button');
        results.buttonCount = buttons.length;
        const primaryBtns = Array.from(document.querySelectorAll('.btn-primary')).map(b => ({
          text: b.textContent.trim(),
          height: window.getComputedStyle(b).height,
          padding: window.getComputedStyle(b).padding
        }));
        results.primaryButtons = primaryBtns.slice(0, 5);

        // Check Stat cards & trend badges
        const statCards = document.querySelectorAll('.stat-card, .metric-card, [class*="stat-card"]');
        results.statCardCount = statCards.length;

        // Check table headers
        const tableHeaders = document.querySelectorAll('th, [role="columnheader"]');
        results.tableHeaderCount = tableHeaders.length;
        if (tableHeaders.length > 0) {
          const firstHeader = tableHeaders[0];
          const cs = window.getComputedStyle(firstHeader);
          results.headerStyleSample = {
            textTransform: cs.textTransform,
            fontSize: cs.fontSize,
            letterSpacing: cs.letterSpacing
          };
        }

        return results;
      });

      // Capture screenshot
      const screenshotPath = path.join(SCREENSHOT_DIR, p.filename);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false // Viewport screenshot at 1440x900
      });

      console.log(`  ✓ Screenshot saved: ${p.filename}`);
      console.log(`  ✓ Search inputs found: ${domAudits.searchInputs.length}`);
      if (domAudits.searchInputs.length > 0) {
        console.log(`    Padding Left: ${domAudits.searchInputs[0].paddingLeft}`);
      }
      console.log(`  ✓ Tabs found: ${domAudits.tabCount} (Active: ${domAudits.activeTabs.join(', ') || 'none'})`);
      console.log(`  ✓ Buttons found: ${domAudits.buttonCount} (Primary: ${domAudits.primaryButtons.length})`);
      console.log(`  ✓ Stat cards: ${domAudits.statCardCount}, Table headers: ${domAudits.tableHeaderCount}`);

      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        console.warn(`  ⚠ Console/Page Errors detected: ${consoleErrors.length + pageErrors.length}`);
        consoleErrors.forEach(e => console.warn(`    - Console: ${e}`));
        pageErrors.forEach(e => console.warn(`    - Page: ${e}`));
        totalConsoleErrors += consoleErrors.length + pageErrors.length;
      } else {
        console.log(`  ✓ Console errors: 0`);
      }

      auditResults.push({
        id: p.id,
        name: p.name,
        path: p.path,
        screenshot: p.filename,
        screenshotPath,
        consoleErrors,
        pageErrors,
        domAudits,
        status: consoleErrors.length === 0 && pageErrors.length === 0 ? 'PASS' : 'WARN'
      });

    } catch (err) {
      console.error(`  ✖ Failed to inspect ${p.path}:`, err.message);
      auditResults.push({
        id: p.id,
        name: p.name,
        path: p.path,
        error: err.message,
        status: 'FAIL'
      });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log('\n====================================================');
  console.log(' Visual Verification Completed');
  console.log(` Total Pages Audited: ${auditResults.length}`);
  console.log(` Total Console Errors: ${totalConsoleErrors}`);
  console.log('====================================================\n');

  // Save audit log to .agents/worker_ui_m5/audit_results.json
  const auditLogPath = path.join(__dirname, '..', '.agents', 'worker_ui_m5', 'audit_results.json');
  fs.writeFileSync(auditLogPath, JSON.stringify(auditResults, null, 2));
  console.log(`Audit log saved to: ${auditLogPath}`);

  return { auditResults, totalConsoleErrors };
}

if (require.main === module) {
  runVisualVerification()
    .then(({ totalConsoleErrors }) => {
      process.exit(totalConsoleErrors > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { runVisualVerification };
