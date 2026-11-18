# Contributor guidance

- Keep simulation, experiment statistics, and economics pure and independent of React and Cloudflare.
- Preserve deterministic stable ordering and common-random-number seed matching.
- Any change to operational semantics requires an `ARCHITECTURE.md` update and focused conservation/state-time tests.
- Never hardcode demonstration result rows; calibrate physical inputs and regenerate with `npm run demo`.
- Label all bundled datasets synthetic. Do not imply that utilization alone establishes a bottleneck.
- Keep Cloudflare deployment owner-run. Do not add shared sibling bindings, credentials, domains, or routes.
- Run `npm run check` before completion.
