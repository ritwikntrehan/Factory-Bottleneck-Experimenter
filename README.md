# Factory Bottleneck Experimenter

A browser-based manufacturing engineering tool for answering a counterfactual question: **which investment increases completed, saleable production, and by how much?** It simulates finite buffers, blocking, starvation, parallel machines, processing-time variability, failures, repairs, and demand-aware economics. Machine utilization is a diagnostic—not a benefit estimate.

The public application is available at [fbe.ritwiktrehan.com](https://fbe.ritwiktrehan.com). It opens with a live, synthetic six-station comparison and progressively reveals the full engineering workbench. Model data and simulation stay in the browser.

All bundled examples are explicitly **synthetic**. They are demonstrations, not measurements.

## What works

- Editable 3–10 station serial lines, machine counts, fixed/triangular/lognormal cycle times, MTBF/MTTR, source badges, finite buffers, shift, supply, replications, and seed.
- Pure TypeScript stable-event simulation with exact state-time integrals, active-processing failure clocks, interrupted-part resume, WIP/flow time/buffer metrics, conservation checks, and keyed seeded streams.
- Browser Web Worker batches with progress and cancellation.
- Example-first visitor flow with an automatic deterministic run, four quick counterfactual controls, and a separate advanced workbench using the same state and engine.
- Simulation fingerprints, physical-input invalidation, superseded-run rejection, and export guards prevent old results from being paired with changed assumptions.
- Four computed interventions: machine addition, cycle-time reduction, buffer expansion, and reliability improvement.
- Common-random-number paired experiments with a labeled paired t 95% confidence interval for the mean effect.
- Demand-limited economics, capital annualization, net annual benefit, cost per added saleable unit, and guarded payback.
- Three synthetic presets, including a calibrated six-station utilization trap.
- JSON import/export, scenario CSV, and a complete downloadable HTML report with print-to-PDF support.
- Cloudflare Worker static hosting and `GET /api/v1/health`; simulation remains in the browser.

## Run locally

Requires Node.js 22.12+ and npm 10+.

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the local Cloudflare Worker on port 8787.

Quality and calibration commands:

```bash
npm run typecheck
npm test
npm run build
npm run check
npm run demo
```

## Six-station demonstration

`Six-station counterfactual trap` uses 100 matched synthetic replications with base seed `730241`. The exact current results are generated with `npm run demo` and are protected by a regression test. The demonstration exposes a highly utilized forming station whose extra machine produces little marginal output, while a coating reliability program produces a materially larger gain. These are stochastic synthetic results; the UI displays the paired mean-effect CI and never presents them as plant measurements.

## Repository map

```text
src/contracts/       Zod-validated stable input/output contracts
src/simulation/      RNG, stable scheduler, discrete-event line simulator
src/experiments/     interventions, matched seeds, paired statistics
src/economics/       pure demand-aware economic derivation
src/examples/        three synthetic presets
src/ui/              responsive React engineering interface
src/workers/         browser simulation Web Worker
src/export/          JSON, CSV, full printable report
src/cloudflare/      hosting Worker and health route
tests/               simulation, statistics, economics, scheduler, UI
examples/            portable JSON datasets
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for operational semantics and [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md) for owner-controlled build and deployment settings. This repository contains no credentials; deployment remains an explicit owner action for each release.

## Scope limits

V1 is one product with strict serial routing, initially empty lines, positive-capacity intermediate buffers, and one shift without warmup. It does not model multiple SKUs, branching, rework, operator sharing, calendars, live MES data, accounts, persistence, or a backend simulation service.
