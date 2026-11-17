# Monitor status — Dune IMAX Wadala

Target: Dune: Part Three, English, Miraj Cinemas : IMAX, Wadala, 18 December 2026. Three dead-center seats in the earliest IMAX show are the booking preference.

District MCP currently reports the movie as `coming_soon` with release date 2026-12-18 and no matching sessions. The cinema is District ID `1038682`; the movie is District ID `207332`.

The GitHub schedule is configured every ten minutes. The local live check returned zero matching sessions. Matching tests cover wrong cinema, language, screen and date, plus TicketNew's booking-open gate. GitHub live runs have been intermittent: one completed successfully, while another received HTTP 403 from both District and TicketNew. This is a best-effort alert, not guaranteed monitoring. Failure warnings go to Bark after three consecutive failed checks.

The earlier Doomsday PXL alert target is retired because the user has already booked it. The workflow does not hold or purchase seats.

