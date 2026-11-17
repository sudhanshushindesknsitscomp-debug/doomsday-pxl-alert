import { chromium } from 'playwright';
import { appendFile } from 'node:fs/promises';

const browser = await chromium.launch();
const sources = [
  ['BookMyShow', 'https://in.bookmyshow.com/cinemas/mumbai/hdfc-millennia-pvr-icon-oberoi-mall-goregaon-e/buytickets/POVI/20261217'],
  ['District', 'https://www.district.in/movies/hdfc-millennia-pvr-icon-oberoi-mall-goregaon-e-CD1018530?fromdate=2026-12-17'],
];
const results = [];
try {
  for (const [name, url] of sources) {
    const context = await browser.newContext({ locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
    const page = await context.newPage();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(8000);
      const body = await page.locator('body').innerText({ timeout: 10000 });
      const blocked = response?.status() === 403 || /verify you are human|access denied|just a moment|unusual traffic|captcha/i.test(body);
      const venue = /oberoi/i.test(body) && /goregaon/i.test(body);
      const result = {
        name,
        status: response?.status(),
        title: await page.title(),
        blocked,
        venue,
        pxlVisible: /\bP(?:XL|\[XL\])\b/i.test(body),
        outcome: blocked ? 'BLOCKED' : venue ? 'VENUE_READABLE_NEEDS_SHOW_VALIDATION' : 'UNVERIFIED',
        visibleText: body.slice(0, 10000),
      };
      results.push(result);
      console.log(JSON.stringify(result));
    } catch (error) {
      results.push({ name, outcome: 'ERROR', reason: error.name });
      console.log(JSON.stringify(results.at(-1)));
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, '# Normal browser access test\n\n' + results.map(result => `- ${result.name}: ${result.outcome}`).join('\n') + '\n\nNo phone messages sent. No ticket availability inferred. No CAPTCHA solving, proxies or login used.\n');
}
if (results.some(result => result.outcome !== 'VENUE_READABLE_NEEDS_SHOW_VALIDATION')) process.exitCode = 1;

