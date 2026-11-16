import { appendFile } from 'node:fs/promises';

const sources = [
  {
    name: 'BookMyShow',
    url: 'https://in.bookmyshow.com/cinemas/mumbai/hdfc-millennia-pvr-icon-oberoi-mall-goregaon-e/buytickets/POVI/20261217',
  },
  {
    name: 'District',
    url: 'https://www.district.in/movies/hdfc-millennia-pvr-icon-oberoi-mall-goregaon-e-CD1018530?fromdate=2026-12-17',
  },
];

async function probe(source) {
  try {
    const response = await fetch(source.url, {
      signal: AbortSignal.timeout(25000),
      headers: { accept: 'text/html' },
    });
    const body = await response.text();
    const challenged = /captcha|verify you are human|just a moment|access denied|cf-chl-/i.test(body);
    const venueFound = /oberoi/i.test(body) && /goregaon/i.test(body);
    let result = 'Response received; usable show data has not been verified';
    if (!response.ok || challenged) {
      result = 'Blocked or unavailable; automatic monitoring is NOT verified';
    } else if (venueFound) {
      result = 'Cinema text detected; exact show data still needs verification';
    }
    return `| ${source.name} | ${response.status} | ${result} |`;
  } catch {
    return `| ${source.name} | Network error | Access NOT verified |`;
  }
}

async function testPhone() {
  if (process.env.SEND_PHONE_TEST !== 'true') {
    return 'Phone test not requested.';
  }
  const deviceKey = process.env.BARK_KEY?.trim();
  if (!deviceKey || !/^[a-zA-Z0-9_-]+$/.test(deviceKey)) {
    process.exitCode = 1;
    return 'Phone test failed: add BARK_KEY as a repository Actions secret. Use only the key, not the full URL.';
  }
  try {
    const response = await fetch('https://api.day.app/push', {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        device_key: deviceKey,
        title: 'TEST ONLY: PXL ticket alert',
        body: 'This tests your iPhone sound. No tickets have been found and monitoring is not active.',
        level: 'critical',
        sound: 'alarm',
        call: '1',
        group: 'pxl-setup-test',
      }),
    });
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      process.exitCode = 1;
      return 'Phone test rejected by notification service. Check your Bark app and secret.';
    }
    return 'Bark accepted the test. You must confirm that your locked iPhone actually received it and played sound; acceptance is not proof of delivery.';
  } catch {
    process.exitCode = 1;
    return 'Phone test failed or timed out. Delivery is unknown; check the phone before retrying.';
  }
}

const results = await Promise.all(sources.map(probe));
const phoneResult = await testPhone();
const summary = [
  '# PXL alert setup check',
  '',
  `Checked at ${new Date().toISOString()}.`,
  '',
  '| Source | HTTP status | Observation |',
  '| --- | --- | --- |',
  ...results,
  '',
  phoneResult,
  '',
  '**This is a manual setup test, not an active ticket monitor.**',
  'A successful response does not prove December 17 is selected or that tickets exist. JavaScript pages may require browser rendering. A blocked response does not mean tickets are unavailable.',
  'Next: verify real movie, English language, date, venue and show-specific PXL fields, distinguish listed from bookable, then add persistent deduplication, failure alerts and scheduling.',
  '',
].join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}
