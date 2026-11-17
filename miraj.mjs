const url = 'https://mirajcinemas.com/api/v1.0/webapp/cinemas/0074/2026-12-18';
export const mirajBookingUrl = 'https://mirajcinemas.com/';

export function parseMiraj(data) {
  if (data.status !== true || data.data?.cinemaDetails?.Cinema_strID !== '0074' ||
      !/Wadala/i.test(data.data.cinemaDetails.Cinema_strName) || !Array.isArray(data.data.sessionDetails)) {
    throw new Error('Miraj returned an incomplete or different cinema listing');
  }
  return data.data.sessionDetails.filter(film =>
    /\bDune:\s*Part Three\b/i.test(film.name) && /\bIMAX\b/i.test(film.name) &&
    film.language_name?.toLowerCase() === 'english' && Array.isArray(film.timing)
  ).flatMap(film => film.timing.filter(show =>
    typeof show.id === 'number' && show.time?.startsWith('2026-12-18 ') &&
    Number.isInteger(show.seats_available_for_sale) && show.seats_available_for_sale >= 3
  ).map(show => ({
    id: String(show.id), start_time: show.time.replace(' ', 'T').slice(0, 19) + '+05:30',
    language: 'English', screen: 'IMAX', available_seats: show.seats_available_for_sale,
  }))).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export async function mirajSessions() {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Miraj: HTTP ${response.status}`);
  return parseMiraj(await response.json());
}
