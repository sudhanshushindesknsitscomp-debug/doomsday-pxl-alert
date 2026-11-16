# Free PXL alert: setup test

Status: NOT an active monitor. This package only checks cloud access and optionally sends one audible iPhone test. It does not buy or reserve tickets.

Target: Avengers: Doomsday, English, December 17, 2026 (Asia/Kolkata), specifically PXL at PVR ICON Oberoi Mall, Goregaon East, Mumbai. The eventual monitor should identify the earliest listed matching show and notify if an earlier show is added. Two adjacent centre seats roughly two-thirds back are a preference, not a reason to delay the opening alert. No other auditorium, language, date or venue is a substitute.

## Setup

1. Create a new public GitHub repository named `doomsday-pxl-alert`. Standard GitHub-hosted Actions runners in public repositories are free. Public means the code and workflow logs are visible to anyone. Never put account credentials, phone keys or personal data in those files. Private repositories have a limited free monthly Actions allowance.
2. Add the files in this folder at the repository root, preserving `.github/workflows/setup-check.yml`. Uploading only the ZIP will not install a workflow. If the file picker hides `.github`, use GitHub's Add file > Create new file and enter `.github/workflows/setup-check.yml` as the filename.
3. Install Bark on your iPhone: https://apps.apple.com/in/app/bark-custom-notifications/id1403753865 . Enable notifications and Critical Alerts. No donation is required.
4. Bark shows a personal URL like `https://api.day.app/YOUR_KEY/...`. Copy only YOUR_KEY into GitHub Settings > Secrets and variables > Actions > New repository secret, named `BARK_KEY`. Do not paste this key in chat, public files or screenshots.
5. Go to Actions > Test website access and iPhone alert > Run workflow. Tick the phone test only when ready for a 30-second audible notification. Lock your phone to test delivery. Enabling Critical Alerts may allow sound through Silent/Focus modes.
6. Read the run summary. A green workflow means the test ran; it does NOT mean monitoring works. Share the summary without secrets so the exact show parser and schedule can be finished after access is verified.

## Important limitations

- No recurring schedule is included yet. Your computer can be off while this manual GitHub test runs.
- Both ticket sites may block cloud requests. The test reports that rather than claiming there are no tickets. It does not bypass challenges.
- Public cinema-page URLs are starting points, not confirmed movie/session IDs. Their response structure and selected date require validation.
- Before enabling monitoring, test strict matching against wrong movie/language/date/auditorium, sold-out and listed-only shows, parsing failures, and repeated observations. Alert separately for first listing and confirmed booking availability.
- GitHub scheduled jobs can be delayed or dropped. No guaranteed immediate alert, continuous alarm or unattended purchase is promised.
- Bark's 30-second sound is not a Clock alarm and is not Pushover's acknowledged retry feature. Any future retry mechanism needs its own bounded retries and stop control.
- Notification keys belong only in GitHub Secrets. Only the test text is sent to Bark. No booking-site login or payment details are needed for this test.

## References

- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/how-tos/troubleshoot-workflows
- https://github.com/Finb/Bark
- https://github.com/aculix/ticket-monitoring
