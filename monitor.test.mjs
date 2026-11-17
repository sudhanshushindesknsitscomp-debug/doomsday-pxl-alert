import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesCinema } from './monitor.mjs';
import { parseTicketnew } from './ticketnew.mjs';

const cinema = {
  cinema: { id: '1038682' }, date: '2026-12-18',
  movies: [{ id: '207332', name: 'Dune: Part Three', sessions: [
    { id: 'first', start_time: '2026-12-18T06:00:00+05:30', language: 'English', screen: 'IMAX' },
    { id: 'later', start_time: '2026-12-18T10:00:00+05:30', language: 'English', premium_label: 'IMAX' },
    { id: 'wrong-screen', start_time: '2026-12-18T04:00:00+05:30', language: 'English', screen: 'SCREEN 2' },
    { id: 'wrong-language', start_time: '2026-12-18T05:00:00+05:30', language: 'Hindi', screen: 'IMAX' },
    { id: 'wrong-day', start_time: '2026-12-19T03:00:00+05:30', language: 'English', screen: 'IMAX' },
  ] }],
};

test('only English IMAX sessions on the target day qualify; first is earliest', () => {
  assert.deepEqual(matchesCinema(cinema).map(session => session.id), ['first', 'later']);
});

test('other cinema and missing date never qualify', () => {
  assert.throws(() => matchesCinema({ ...cinema, cinema: { id: '123' } }));
  assert.throws(() => matchesCinema({ ...cinema, date: '2026-12-19' }));
});

test('missing Dune does not trigger', () => {
  assert.deepEqual(matchesCinema({ ...cinema, movies: [{ id: '176735', name: 'Avengers: Doomsday', sessions: cinema.movies[0].sessions }] }), []);
});

function ticketnewHtml(status = 'Bookings Open') {
  const data = { props: { pageProps: { data: { cinemaId: '1038682', serverState: {
    cinemaSessions: { '10386822026-12-18': {
      meta: { movies: [{ contentId: 207332, name: 'Dune: Part Three', lang: 'English', id: 'DUNE', frmtId: 'EnglishIMAX' }],
        groupedMovies: [{ contentId: 207332, bookingStatus: status }] },
      pageData: { sessions: [
        { sid: 'a', cid: 1038682, mid: 'DUNE', fid: 'EnglishIMAX', lang: 'English',
          audi: 'IMAX', showTime: '2026-12-18T01:30', avail: 20 },
        { sid: 'wrong-screen', cid: 1038682, mid: 'DUNE', fid: 'EnglishIMAX', lang: 'English',
          audi: 'SCREEN 3', showTime: '2026-12-18T00:30', avail: 20 },
        { sid: 'wrong-day', cid: 1038682, mid: 'DUNE', fid: 'EnglishIMAX', lang: 'English',
          audi: 'IMAX', showTime: '2026-12-18T20:30', avail: 20 },
      ] },
    } },
  } } } } };
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`;
}

test('TicketNew checks booking status, cinema, IMAX screen, and IST date', () => {
  assert.deepEqual(parseTicketnew(ticketnewHtml()).map(item => [item.id, item.start_time]),
    [['a', '2026-12-18T07:00:00+05:30']]);
  assert.deepEqual(parseTicketnew(ticketnewHtml('Coming Soon')), []);
});

