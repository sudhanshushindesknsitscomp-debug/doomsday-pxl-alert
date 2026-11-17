import { appendFile } from 'node:fs/promises';
import { ticketnewSessions, ticketnewUrl } from './ticketnew.mjs';

const endpoint = 'https://mcp-server.district.in/v2/mcp';
const tokenEndpoint = 'https://mcp-server.district.in/v2/token';
const clientId = 'mcpc_YnX45e1pT1csWstvJIinLFog'; // public guest OAuth client ID
const movieId = '207332';
const cinemaId = '1038682';
const showDate = '2026-12-18';
const bookingUrl = 'https://www.district.in/movies/dune-part-three-movie-tickets-in-mumbai-MV207332?fromdate=2026-12-18';
const dryRun = process.env.DRY_RUN === 'true';
const repository = process.env.GITHUB_REPOSITORY;

function rpcBody(body) {
  const lines = body.split(/\r?\n/).filter(line => line.startsWith('data:'));
  return JSON.parse(lines.length ? lines.map(line => line.slice(5).trim()).join('\n') : body);
}

async function districtCall(token, id, name, args) {
  const response = await fetch(endpoint, {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json',
      accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`District ${name}: HTTP ${response.status}`);
  const result = rpcBody(raw);
  if (result.error || result.result?.isError) throw new Error(`District ${name} failed: ${JSON.stringify(result.error || result.result?.content).slice(0, 200)}`);
  const text = result.result?.content?.find(item => item.type === 'text')?.text;
  if (!text) throw new Error(`District ${name} returned no data`);
  return JSON.parse(text);
}

async function guestToken() {
  const response = await fetch(tokenEndpoint, {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:district:params:oauth:grant-type:guest',
      client_id: clientId, scope: 'district', resource: endpoint }),
  });
  if (!response.ok) throw new Error(`District guest login: HTTP ${response.status}`);
  const token = (await response.json()).access_token;
  if (!token) throw new Error('District guest login returned no token');
  return token;
}

export function matchesCinema(data) {
  if (data.cinema?.id !== cinemaId || data.date !== showDate || !Array.isArray(data.movies)) {
    throw new Error('District cinema/date response was incomplete or mismatched');
  }
  const movie = data.movies.find(item => item.id === movieId && /^Dune:\s*Part Three$/i.test(item.name));
  if (!movie) return [];
  if (!Array.isArray(movie.sessions)) throw new Error('Dune listing has no session list');
  return movie.sessions.filter(session =>
    typeof session.id === 'string' && session.start_time?.startsWith(`${showDate}T`) &&
    session.start_time?.endsWith('+05:30') && session.language?.toLowerCase() === 'english' &&
    (session.screen?.toUpperCase() === 'IMAX' || session.premium_label?.toUpperCase() === 'IMAX')
  ).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

async function githubState() {
  if (dryRun || !repository) return { state: { seen: [], broken: false }, sha: undefined };
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/monitor-state.json`, {
    signal: AbortSignal.timeout(20000),
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' },
  });
  if (response.status === 404) return { state: { seen: [], broken: false }, sha: undefined };
  if (!response.ok) throw new Error(`GitHub state read: HTTP ${response.status}`);
  const file = await response.json();
  const state = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  return { state: Array.isArray(state.seen) ? state : { seen: [], broken: false }, sha: file.sha };
}

async function saveState(state, sha) {
  if (dryRun || !repository) return;
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/monitor-state.json`, {
    method: 'PUT', signal: AbortSignal.timeout(20000),
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json',
      'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Record Dune IMAX alert state', sha,
      content: Buffer.from(JSON.stringify(state, null, 2)).toString('base64') }),
  });
  if (!response.ok) throw new Error(`GitHub state save: HTTP ${response.status}`);
}

async function bark(title, body, critical = false, url = bookingUrl) {
  if (dryRun) return;
  const key = process.env.BARK_KEY?.trim();
  if (!key) throw new Error('BARK_KEY secret is missing');
  const response = await fetch('https://api.day.app/push', {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device_key: key, title, body, url, group: 'dune-imax-wadala',
      level: critical ? 'critical' : 'active', sound: critical ? 'alarm' : 'bell' }),
  });
  if (!response.ok || (await response.json()).code !== 200) throw new Error(`Bark rejected alert: HTTP ${response.status}`);
}

async function run() {
  if (Date.now() >= Date.parse('2026-12-19T00:00:00+05:30')) return 'Target day passed; monitor retired.';
  const { state, sha } = await githubState();
  try {
    let token, cinema, districtMatches, ticketMatches;
    let districtError, ticketError;
    try {
      token = await guestToken();
      const discovered = await districtCall(token, 1, 'search', {
        query: 'Get all showtimes at cinema 1038682 on December 18 2026', limit: 10,
      });
      if (!discovered.results?.some(item => item.operation === 'consumer.cinema_showtimes' && item.call_with === 'execute')) {
        throw new Error('District cinema showtimes operation is unavailable');
      }
      cinema = await districtCall(token, 2, 'execute', {
        operation: 'consumer.cinema_showtimes', arguments: { cinema_id: cinemaId, date: showDate },
      });
      districtMatches = matchesCinema(cinema);
    } catch (error) { districtError = error; }
    try { ticketMatches = await ticketnewSessions(); }
    catch (error) { ticketError = error; }
    if (!districtMatches && !ticketMatches) {
      throw new Error(`Both checks failed: District ${districtError?.message}; TicketNew ${ticketError?.message}`);
    }
    const source = ticketMatches?.length ? 'TicketNew' : 'District';
    const sessions = ticketMatches?.length ? ticketMatches : districtMatches || [];
    const fresh = sessions.filter(session => !state.seen.includes(session.id));
    const wasBroken = state.broken;
    if (fresh.length && source === 'District') {
      const search = await districtCall(token, 3, 'search', {
        query: `View seats for movie session ${sessions[0].id} at cinema ${cinemaId} without holding seats`, limit: 10,
      });
      if (!search.results?.some(item => item.operation === 'consumer.movie_select_seat' && item.call_with === 'execute')) {
        throw new Error('District seat map operation is unavailable');
      }
      const map = await districtCall(token, 4, 'execute', {
        operation: 'consumer.movie_select_seat', arguments: { cinema_id: cinemaId, session_id: sessions[0].id },
      });
      if (map.show?.movie !== 'Dune: Part Three' || map.show?.language !== 'English' ||
          map.show?.cinema !== cinema.cinema.name || map.show?.screen?.toUpperCase() !== 'IMAX' ||
          !Array.isArray(map.areas)) throw new Error('First IMAX show seat map did not verify');
    }
    if (fresh.length) {
      await bark('Dune Part Three IMAX Wadala listed!',
        `Dec 18, Miraj IMAX Wadala. First English IMAX show: ${sessions[0].start_time.slice(11, 16)} IST. ${fresh.length} new session(s) on ${source}. Check three dead-center seats and complete booking.`,
        true, source === 'TicketNew' ? ticketnewUrl : bookingUrl);
      state.seen = [...new Set([...state.seen, ...fresh.map(session => session.id)])];
    }
    if (state.broken) {
      await bark('Dune IMAX checks recovered', `${source} listing checks are working again.`);
      state.broken = false;
    }
    if (fresh.length || wasBroken) await saveState(state, sha);
    return `${source} OK: ${sessions.length} English IMAX session(s), ${fresh.length} new. First: ${sessions[0]?.start_time || 'none'}. ${districtError ? `District MCP unavailable: ${districtError.message}.` : ''} ${ticketError ? `TicketNew unavailable: ${ticketError.message}.` : ''}`;
  } catch (error) {
    if (!state.broken) {
      await bark('Dune IMAX alert needs attention', `Both listing checks failed: ${error.message}. Check listings manually.`);
      state.broken = true;
      await saveState(state, sha);
    }
    throw error;
  }
}

if (process.argv[1]?.endsWith('monitor.mjs')) {
  try {
    const summary = await run();
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  } catch (error) {
    console.error(`Ticket alert failed: ${error.message}`);
    process.exitCode = 1;
  }
}

