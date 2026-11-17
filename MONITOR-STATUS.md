# Monitor status — Dune IMAX Wadala

Target: Dune: Part Three, English, Miraj Cinemas : IMAX, Wadala, 18 December 2026. Three dead-center seats in the earliest IMAX show are the booking preference.

District MCP currently reports the movie as `coming_soon` with release date 2026-12-18 and no matching sessions. The cinema is District ID `1038682`; the movie is District ID `207332`.

The GitHub workflow is active on the default branch with a ten-minute cron and a Windows runner retry if the Ubuntu job fails. The 17 November 09:41 UTC push-triggered run passed all five tests and logged `Miraj OK: 0 English IMAX session(s)`, while District and TicketNew returned HTTP 403. This confirms that GitHub's runner can read Miraj Cinemas' official showtime feed. No cron-triggered run had appeared by 09:45 UTC, so scheduled execution has not yet been observed. GitHub may delay or drop cron runs. This is a best-effort alert, not guaranteed monitoring. Failure warnings go to Bark after three consecutive failed checks.

The earlier Doomsday PXL alert target is retired because the user has already booked it. The workflow does not hold or purchase seats.
