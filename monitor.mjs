import { chromium } from 'playwright';
import { appendFile } from 'node:fs/promises';

const targetDate = '2026-12-17';
const cinemaUrl = 'https://www.district.in/movies/hdfc-millennia-pvr-icon-oberoi-mall-goregaon-e-CD1018530';
const targetUrl = `${cinemaUrl}?fromdate=${targetDate}`;
const repository = process.env.GITHUB_REPOSITORY;
const stateUrl = `https://api.github.com/repos/${repository}/contents/monitor-state.json`;
const headers = { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' };

async function notify(title, body, urgent = false, url = targetUrl) {
  if (process.env.DRY_RUN === 'true') return;
  if (!process.env.BARK_KEY) throw new Error('BARK_KEY is missing');
  const response = await fetch('https://api.day.app/push', {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device_key: process.env.BARK_KEY.trim(), title, body, url,
      group: 'doomsday-pxl', level: urgent ? 'critical' : 'active',
      sound: urgent ? 'alarm' : 'bell', ...(urgent ? { call: '1' } : {}) }),
  });
  if (!response.ok || (await response.json()).code !== 200) throw new Error('Bark delivery request failed');
}

async function readState() {
  const response = await fetch(stateUrl, { headers, signal: AbortSignal.timeout(20000) });
  if (response.status === 404) return { state: { seen: {}, failures: 0 }, sha: undefined };
  if (!response.ok) throw new Error('Cannot read persistent alert state');
  const result = await response.json();
  return { state: JSON.parse(Buffer.from(result.content, 'base64').toString()), sha: result.sha };
}

async function saveState(state, sha) {
  if (process.env.DRY_RUN === 'true') return;
  const response = await fetch(stateUrl, {
    method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ message: 'Update ticket monitor state', sha,
      content: Buffer.from(JSON.stringify(state, null, 2)).toString('base64') }),
  });
  if (!response.ok) throw new Error('Cannot save alert state; notifications may repeat');
}

async function inspect(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(8000);
  const text = await page.locator('body').innerText();
  if (!response?.ok() || /verify you are human|access denied|just a moment|you have been blocked/i.test(text)) throw new Error('District access blocked');
  if (!/Oberoi Mall, Goregaon/i.test(text)) throw new Error('Expected cinema missing');
  const data = await page.evaluate(() => {
    const events = [];
    function walk(value) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        if (value['@type'] === 'ScreeningEvent') events.push(value);
        if (value['@graph']) walk(value['@graph']);
      }
    }
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { walk(JSON.parse(script.textContent)); } catch {}
    }
    const cards = [];
    for (const anchor of document.querySelectorAll('a[href*="-MV"]')) {
      const header = anchor.innerText;
      if (!header.trim()) continue;
      let parent = anchor.parentElement;
      while (parent && parent !== document.body) {
        const times = parent.innerText.match(/\b\d{1,2}:\d{2}\s*[AP]M\b/g) || [];
        const movies = new Set([...parent.querySelectorAll('a[href*="-MV"]')].map(item => item.getAttribute('href')));
        if (movies.size > 1) break;
        if (times.length) {
          const shows = [];
          for (const element of parent.querySelectorAll('*')) {
            if (!/^\d{1,2}:\d{2}\s*[AP]M$/.test(element.innerText?.trim() || '')) continue;
            if ([...element.children].some(child => /^\d{1,2}:\d{2}\s*[AP]M$/.test(child.innerText?.trim() || ''))) continue;
            let tile = element;
            let pxl = false;
            while (tile && tile !== parent) {
              const tileTimes = tile.innerText.match(/\b\d{1,2}:\d{2}\s*[AP]M\b/g) || [];
              if (tileTimes.length !== 1) break;
              if (/(?:\bPXL\b|P\[XL\])/i.test(tile.innerText)) pxl = true;
              tile = tile.parentElement;
            }
            shows.push({ time: element.innerText.trim(), pxl });
          }
          cards.push({ header, shows });
          break;
        }
        parent = parent.parentElement;
      }
    }
    return { events, cards };
  });
  return { ...data, empty: text.includes('No shows playing at the moment') };
}

function matches(data) {
  const card = data.cards.find(item => /^Avengers\s*:\s*Doomsday\s*\n/i.test(item.header) && /\|\s*English\b/i.test(item.header));
  if (!card) {
    if (data.events.some(event => /Avengers.*Doomsday/i.test(event.workPresented?.name || ''))) throw new Error('Doomsday found but language/show cards could not be verified');
    return [];
  }
  return data.events.filter(event => {
    if (!/^Avengers\s*:\s*Doomsday$/i.test(event.workPresented?.name || '')) return false;
    if (!event.startDate?.startsWith(targetDate) || !event.startDate.endsWith('+05:30')) return false;
    if (!event.location?.url?.includes('CD1018530')) return false;
    const time = new Date(event.startDate).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    return card.shows.some(show => show.pxl && show.time.replace(/\s/g, '') === time.replace(/\s/g, ''));
  }).map(event => ({
    start: event.startDate,
    url: event.offers?.url,
    status: /\/(InStock|LimitedAvailability)$/.test(event.offers?.availability || '') ? 'bookable' : 'listed',
  })).filter(show => {
    try { const url = new URL(show.url); return url.hostname === 'www.district.in' && url.pathname.startsWith('/movies/seat-layout/'); } catch { return false; }
  }).sort((left, right) => left.start.localeCompare(right.start));
}

const { state, sha } = await readState();
const before = JSON.stringify(state);
let browser;
let summary;
try {
  if (Date.now() >= Date.parse('2026-12-18T00:00:00+05:30')) {
    summary = 'Target date passed. Monitoring retired; no website requests made.';
  } else {
    browser = await chromium.launch();
    const context = await browser.newContext({ locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
    const page = await context.newPage();
    const current = await inspect(page, cinemaUrl);
    if (!current.events.length || !current.cards.some(card => card.shows.some(show => show.pxl))) throw new Error('Current-show control failed: cannot validate PXL extraction');
    const target = await inspect(page, targetUrl);
    if (!target.events.length && !target.empty) throw new Error('Target page has neither shows nor explicit empty state');
    if (target.events.some(event => !event.startDate?.startsWith(targetDate))) throw new Error('District returned a different date');
    const shows = matches(target);
    const fresh = shows.filter(show => state.seen[show.url] !== show.status);
    if (fresh.length) {
      const first = shows[0];
      await notify('Doomsday English PXL on District', fresh.map(show => `${show.start.slice(11, 16)} IST: ${show.status}`).join('\n') + '\nOberoi Mall, Goregaon — December 17. Earliest listed matching show: ' + first.start.slice(11, 16) + ' IST. Two adjacent seats not verified.', true, fresh[0].url);
      for (const show of fresh) state.seen[show.url] = show.status;
    }
    state.failures = 0;
    if (state.broken) {
      await notify('PXL monitor recovered', 'District checks are working again. BookMyShow remains unsupported.');
      state.broken = false;
    }
    if (!state.started) {
      await notify('PXL monitoring enabled', 'District-only checks are now scheduled every 10 minutes, subject to GitHub delays. No matching tickets found unless a separate ticket alert arrives.');
      state.started = true;
    }
    summary = `District current-show control passed. Target: ${targetDate}, English Avengers: Doomsday, Oberoi PXL. Matching shows: ${shows.length}; new/changed alerts: ${fresh.length}. BookMyShow not monitored.`;
  }
} catch (error) {
  state.failures = (state.failures || 0) + 1;
  summary = `Check failed: ${error.message}. This is NOT a no-tickets result.`;
  if (!state.broken) {
    await notify('PXL monitor needs attention', summary).then(() => { state.broken = true; }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (before !== JSON.stringify(state)) await saveState(state, sha);
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}

