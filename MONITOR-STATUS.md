# Monitoring status

Automatic scheduling is disabled pending reliable District access and exact show-card extraction validation. The manual monitor workflow is experimental, not production-ready.

Confirmed: Bark notifications reach the user's iPhone. Standard Chromium on GitHub successfully loaded District on earlier runs, including current PXL shows. Later runs received HTTP 403 from District, so this path is not reliable. BookMyShow also returns 403.

The first monitor run failed its positive control: exact PXL extraction could not be validated against current shows. It correctly sent an attention warning rather than claiming no tickets. Subsequent browser diagnostics were blocked by District. Do not enable a schedule until both access stability and positive/negative matching tests pass.

The prepared monitor uses strict movie/date/venue/language/PXL conditions, persists notification state in monitor-state.json and does not purchase or reserve tickets. Its future scheduled use remains unverified. No guaranteed alarms for booking openings are currently provided.

