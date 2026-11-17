# Dune: Part Three — Miraj IMAX Wadala alert

This public repository checks for *Dune: Part Three* on **18 December 2026** at **Miraj Cinemas : IMAX, Wadala**, in **English** and on the **IMAX auditorium**. When a matching session first appears, it sends a Bark push to the iPhone associated with the repository's `BARK_KEY` Actions secret. The message identifies the earliest matching show. The intended booking is **three dead-center seats** in the first show. No seat hold or purchase is automated.

The workflow runs every ten minutes (UTC minute 3, 13, 23, 33, 43, 53) and can also be run manually from GitHub Actions. It checks Miraj Cinemas' own showtime API, District's official guest MCP showtimes, and TicketNew's public Miraj cinema listing. If the Ubuntu runner fails, a Windows runner retries. A listing counts only when the exact movie, cinema, date, language and IMAX screen match. Miraj requires at least three seats listed as available; TicketNew requires `Bookings Open` and seats available. The monitor stores alerted session IDs in `monitor-state.json` to avoid repeat alarms. If all sources fail three times in a row, Bark sends a health warning; it sends a recovery notice when checks resume.

## Current limits

- GitHub's cloud IPs sometimes receive HTTP 403 from District and TicketNew. A green run proves that at least one source worked; a failed run means there was no reliable answer. This monitor is best effort and cannot guarantee an alarm at the instant booking opens.
- BookMyShow is not monitored because its cloud checks were blocked. You can still book there manually if it lists the target first.
- GitHub schedule runs can be delayed or occasionally dropped. The Windows computer can remain off.
- Bark's critical push depends on the phone's notification settings and connectivity. It is not a persistent Clock alarm.
- The workflow cannot confirm three adjacent dead-center seats from the listing alone. Open the booking page and check the seat map. Purchase and payment require your approval and any OTP/CAPTCHA the ticketing site requests.

The repository name is left unchanged to preserve existing links and the `BARK_KEY` secret. The old Doomsday workflow is no longer the target.

## Links

- [District movie page](https://www.district.in/movies/dune-part-three-movie-tickets-in-mumbai-MV207332)
- [District cinema page](https://www.district.in/movies/miraj-cinemas-imax-wadala-mumbai-CD1038682?fromdate=2026-12-18)
- [TicketNew cinema page](https://ticketnew.com/movies/greater-mumbai/miraj-cinemas-imax-wadala-c/1038682?fromdate=2026-12-18)
- [Miraj Cinemas official site](https://mirajcinemas.com/)
- [GitHub Actions](https://github.com/sudhanshushindesknsitscomp-debug/doomsday-pxl-alert/actions)
