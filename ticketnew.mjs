const cinemaId = '1038682';
const movieId = 207332;
const showDate = '2026-12-18';
export const ticketnewUrl = 'https://ticketnew.com/movies/greater-mumbai/miraj-cinemas-imax-wadala-c/1038682?fromdate=2026-12-18';

export function parseTicketnew(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (!match) throw new Error('TicketNew page has no server rendered show data');
  const page = JSON.parse(match[1]).props?.pageProps?.data;
  if (page?.cinemaId !== cinemaId) throw new Error('TicketNew returned a different cinema');
  const listing = page.serverState?.cinemaSessions?.[`${cinemaId}${showDate}`];
  if (!listing || !Array.isArray(listing.pageData?.sessions) || !Array.isArray(listing.meta?.movies)) {
    throw new Error('TicketNew cinema listing is missing the target date or sessions');
  }
  const variants = listing.meta.movies.filter(movie => movie.contentId === movieId &&
    movie.name === 'Dune: Part Three' && movie.lang === 'English');
  if (!variants.length) return [];
  const open = listing.meta.groupedMovies?.some(movie => movie.contentId === movieId &&
    movie.bookingStatus === 'Bookings Open');
  if (!open) return [];
  return listing.pageData.sessions.filter(session => {
    const variant = variants.find(movie => movie.id === session.mid && movie.frmtId === session.fid);
    if (!variant || session.cid !== Number(cinemaId) || session.lang !== 'English') return false;
    if (session.audi?.toUpperCase() !== 'IMAX' && session.premiumLabel?.toUpperCase() !== 'IMAX') return false;
    if (typeof session.showTime !== 'string' || !Number.isInteger(session.avail) || session.avail < 1) return false;
    const local = new Date(Date.parse(`${session.showTime}Z`) + 330 * 60_000).toISOString().slice(0, 16);
    return local.startsWith(`${showDate}T`);
  }).map(session => ({
    id: session.sid,
    start_time: new Date(Date.parse(`${session.showTime}Z`) + 330 * 60_000).toISOString().slice(0, 16) + ':00+05:30',
    language: 'English', screen: session.audi, premium_label: session.premiumLabel,
    available_seats: session.avail,
  })).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export async function ticketnewSessions() {
  const response = await fetch(ticketnewUrl, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; DuneTicketAlert/1.0)' },
  });
  if (!response.ok) throw new Error(`TicketNew: HTTP ${response.status}`);
  return parseTicketnew(await response.text());
}

