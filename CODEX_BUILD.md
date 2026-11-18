# Codex build brief: Factory Bottleneck Experimenter

## Your assignment

Implement a **complete, runnable, tested V1** of the Factory Bottleneck Experimenter in this repository. **Write the application, not merely a plan, scaffold, or issue list.** The deliverable is a usable manufacturing engineering experiment tool that runs in the browser and can be deployed from GitHub to Cloudflare Workers. Do not deploy, configure credentials, or modify other repositories.

Reference architecture and deployment conventions from these existing sibling repositories:

- https://github.com/ritwikntrehan/Interesting
- https://github.com/ritwikntrehan/federated-corridor-kernel

Inspect their actual source and deployment files as useful. Reuse their *patterns*: TypeScript-first, typed contracts, independent deterministic computational layer, browser inspector, automated tests, Cloudflare Worker + Static Assets, explicit owner-run deployment documentation. **Do not copy their domain-specific code** or connect the factory app to them in V1.

Build directly on `main` if this is an empty repository and your environment permits it; otherwise work in a branch and open a PR. Run tests and build, fix failures, and report exactly what passed. No placeholders for core functionality.

## Product question

The tool answers:

> Which improvement increases *completed, saleable production*, and by how much, rather than merely making a busy machine less busy?

An engineer models a simple serial production line (3–10 stations), runs a stochastic baseline, evaluates counterfactual capital improvements using paired random replications, and gets ranked investment scenarios with uncertainty and demand-aware economics.

The distinguishing feature is counterfactual **system throughput**, not a utilization ranking.

## V1 scope

**Include:**

- One product type; strict linear routing through 3–10 stations.
- Editable stations: name, machine count, cycle-time distribution and parameters, MTBF, MTTR, measured-versus-estimated source flag, output buffer capacity.
- Finite intermediate buffers, blocking and starvation, queueing, parallel machines, machine failures and repairs.
- Shift duration; part arrivals / supply cap; 100 default replications; reproducible seed.
- Four intervention types: add machine, reduce cycle time, increase buffer, improve reliability.
- Performance: finished units/shift, per-station machine states, WIP, flow/production lead time, throughput distribution and paired confidence intervals.
- Economics: annualized capital and operating costs, contribution margin, saleable demand ceiling, cost per incremental saleable unit, net annual benefit and payback where valid.
- Three demonstrative example lines; one must exhibit a misleading high-utilization machine where adding capacity gives negligible throughput gain, while a different buffer/reliability improvement does better.
- JSON model import/export and CSV scenario export; downloadable, reproducible report (HTML print-to-PDF is acceptable if clearly labeled and produces complete report).

**Exclude:** MES/ERP integration, real-time equipment telemetry, multiple SKUs, job-shop or branching routes, operator sharing, rework, complex calendars, AI explanations, accounts, payments, persistence/database.

Synthetic data must be explicitly labeled synthetic. Never present example numbers as measurements.

## Implementation stack and topology

- TypeScript, React, Vite; responsive accessible interface. Follow the ergonomics of the sibling repositories, but design a clear factory-specific UI.
- A **pure TypeScript discrete-event simulation engine**, with a stable event priority queue and testable functional API, wholly separate from React. Do **not** require Python/SimPy or a running backend for simulation.
- Run heavy replication batches in a browser Web Worker to avoid blocking the UI; allow progress reporting and cancellation if practical.
- Cloudflare Worker serves static built assets and lightweight `GET /api/v1/health` endpoint. Use `wrangler.jsonc` with Cloudflare Workers Static Assets. No D1/KV/AI/API keys required. Document that simulation runs in the **browser Web Worker**, distinct from the **Cloudflare Worker** that serves the app.
- Use a schema validator (Zod or equivalent), explicit units, strict bounds and useful validation errors.
- Scripts: `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check`, `npm run deploy`. Use Vitest, TypeScript strictness, and CI workflow `npm ci && npm run check`.
- Add `README.md`, `ARCHITECTURE.md`, `DEPLOY_CLOUDFLARE.md`, `AGENTS.md`, `.gitignore`, and example datasets.
- Retain reproducibility and machine-readable input/output as stable contracts so the simulator can become a standalone computation endpoint in a later federated system; do not prematurely add MCP.

Suggested module boundaries (you may improve these):

```text
src/contracts/        validated model, scenario, report schemas
src/simulation/       scheduler, RNG, line simulator, metrics
src/experiments/      intervention transformations, paired runs, uncertainty
src/economics/        demand-aware investment analysis
src/examples/         documented synthetic factory configurations
src/ui/               React app, line visualization, editors, charts, tables
src/workers/          browser simulation worker
src/export/           JSON, CSV, printable full experiment report
src/cloudflare/       Cloudflare Worker entry (or equivalent)
tests/                focused simulation, economics, and UI tests
```

## Physical model: precise operational semantics

Write down the chosen semantics in `ARCHITECTURE.md`, and test them.

1. Each part traverses every station in sequence exactly once. A machine cannot start a part unless a part is available at its input. For the first station, parts come from the configured arrival process/supply. For later stations, parts come only from the preceding finite-capacity buffer.
2. Each station has `machines >= 1`. A machine working on a part holds that part until processing finishes. Finished parts attempt to enter the output buffer; when full, that machine remains **blocked** holding the part until a slot becomes free. A part at the final station exits as a completed finished unit. Use finite intermediate buffers of capacity >= 1 in V1; explain that zero-slot transfer is out of scope if not implemented.
3. A downstream station accepting a buffered part frees one buffer slot and should trigger upstream unblocking. Ensure correct ordering for simultaneous events, using monotonic event sequence IDs to break ties reproducibly.
4. Machine states are exclusive: **processing**, **blocked**, **starved** (available but no part), or **down**. Track exact time integrals over the shift, per machine, and show aggregated station fractions with a clear denominator. For each machine, fractions must sum to ~100%. Utilization is **processing fraction**, not total occupied time. Do not mistake blocked machines for idle or useful processing.
5. Model processing-time distributions: fixed and at least one positive stochastic form (e.g., lognormal, gamma, or triangular), with explicitly documented parameters/mean. Do not generate negative times.
6. Model failures using a clearly stated clock. Recommended: failure hazard accrues only while **actively processing**; draw time-to-failure from an exponential distribution with MTBF in processing minutes. If a failure occurs mid-part, interrupt processing, enter down for a sampled repair duration, then resume the **remaining processing time**. Model MTTR with deterministic or stochastic positive repair time, and document it. No silent availability multiplier shortcut. Machines do not fail when starved/blocked under this V1 rule.
7. Track completed part start/end timestamps to calculate completed-unit flow time, WIP as processing+blocked+queued parts, time-weighted mean WIP, peak WIP, and each buffer's mean/max occupancy. Define whether pre-first-station waiting parts count toward WIP; document and show separately if needed.
8. The simulation runs from t=0 until a single shift cutoff. Count only parts that have **completed the final station** by cutoff. Preserve accurate WIP/incomplete parts at cutoff. No warmup unless explicitly documented; the default is an initially empty line. Bound arrivals, events, and input sizes to prevent pathological simulation.
9. All random streams are seeded. For counterfactuals use **common random numbers / matched replication seeds**. Prefer independent keyed streams per station, machine, and random purpose so a change in one station does not needlessly perturb another. Same model, simulator version, seeds and interventions must produce identical results.
10. Event conservation tests are mandatory: no creation, loss, duplication, bypass of routing, over-capacity buffer, or negative WIP. Explain how to verify conservation accounting for arrivals, completed output and remaining parts in progress or queues.

## Experiment protocol

- Baseline plus all selected interventions use the *same replication seed set*.
- Calculate baseline and modified throughput distributions across 100 replications by default. For each replication compute **paired delta** (`modified completed - baseline completed`); report mean difference and 95% uncertainty interval (paired bootstrap percentile CI or paired t CI, with method labeled). Distinguish a **CI for estimated mean effect** from a prediction interval for individual shifts. Never infer significant gains just from positive point estimates.
- Show baseline and scenario completed units/shift; percent gain; absolute gain; 95% paired CI; cost and economic result; include the caveat when CI crosses zero.
- Scenarios must produce computed results, not hardcoded demo rows.
- Changes to contribution margin, demand or capital costs should recompute rankings **without rerunning the simulation**; make economics a pure derivation from physical scenario outputs.
- A user may choose target station/buffer and edit a scenario's parameters and cost; validate intervention applicability and prevent nonsensical values.

## Economics

Inputs:

- Shifts per operating day; operating days/year; annual saleable demand in units.
- Contribution margin per additional **sold** unit; capex, useful life (years), optional annual incremental operating expense.
- Optional annual discount rate for a more explicit annualization; if omitted, straight-line capital annualization is acceptable and must be disclosed.

Calculate:

- Annual baseline physical output = baseline mean completed units/shift × annual shifts.
- Annual scenario physical output = scenario mean completed units/shift × annual shifts.
- Annual baseline saleable output = `min(baseline output, annual demand)`.
- Annual scenario saleable output = `min(scenario output, annual demand)`.
- Incremental saleable units = difference between those saleable outputs (can be <= 0).
- Annual gross incremental contribution = incremental saleable units × unit contribution margin.
- Annual net benefit = annual gross incremental contribution - incremental operating expense - annualized capex (label this measure as accounting-style net annual benefit, not necessarily cash flow).
- **Cost per added unit** = (annualized capex + incremental annual operating expense) / positive annual incremental *saleable* units, otherwise show **N/A**, never divide by zero.
- Simple payback = capex / positive incremental annual **cash contribution after incremental opex**, otherwise N/A. Do not treat payback as established if gain CI includes zero; show risk/uncertainty.
- Clearly separate *potential physical throughput* from *saleable output limited by demand*. Ranking should default to economic gain with uncertainty shown, and allow sorting by physical throughput or cost per added unit. Avoid monetizing unsold output.

The above scenario economics are point estimates based on simulated means; optionally propagate paired throughput draws to economic uncertainty, clearly labeled.

## UI: a real engineer-facing application

A practical information hierarchy:

1. **Factory model:** simple left-to-right line diagram with station cards and intermediate buffer capacities, editable workstation grid, global run settings. Station badges for measured vs estimated parameters.
2. **Baseline diagnostics:** finished units/shift, WIP, flow time, confidence interval, per-station processing/starved/blocked/down stacked percentages and buffered WIP chart. Indicate *candidate bottlenecks*, not a magic single bottleneck score.
3. **Investment experimenter:** editable four scenario types with targets and costs, run button, progress feedback, scenario comparison table and gain uncertainty visualization.
4. **Decision/economics:** demand-limited saleable gains, incremental contribution, annualized cost, cost per added saleable unit, payback, warning when a CI spans zero.
5. **Reproducibility & export:** full model, intervention parameters, seed list, simulator version, simulation assumptions and results, downloadable JSON and CSV, printable report with the complete configuration.

Use readable desktop layout that works reasonably on mobile; avoid opaque heatmaps without numbers and don't make unsupported causal claims. Prefer useful charts to decoration.

## Synthetic examples and public demo

Include three distinct presets (e.g., balanced line, reliability-constrained line, blocking/variability-constrained line). The featured **six-station misleading-utilization demo** must be calibrated by actually running simulation experiments to show this pattern under fixed documented configuration and seeds:

- A highly utilized station *looks* like an obvious target.
- Adding an extra machine there produces very little gain in completed output.
- A smaller buffer expansion or reliability intervention elsewhere produces a material, larger gain.

Do **not** hardcode illustrative `410`, `+18%`, or other values from the original challenge. If your first synthetic example doesn't produce the intended behavior, **adjust its underlying physical parameters**, rerun experiments, and include a regression test that preserves the observed counterfactual ordering within tolerances. Explicitly label the examples synthetic.

## Acceptance tests (automated)

At minimum implement tests that verify:

1. Three deterministic stations with ample input/buffers converge toward the slowest sustained station rate over a sufficiently long run; allow startup edge effects.
2. Increasing failures under otherwise comparable conditions increases downtime and generally decreases throughput when averaged over controlled seeds.
3. No buffer ever exceeds capacity; every completed unit passed all stations; arrivals = completed + total remaining system WIP + any explicitly tracked out-of-system unused supply/queue.
4. Speeding a nonconstraint station can leave throughput unchanged or near unchanged; do not assign benefits from utilization alone.
5. Same configuration + seed set => bit-for-bit or numerically identical results, including paired comparison.
6. Editing price, contribution margin, capex or demand changes economics only, not physics.
7. Paired delta arithmetic and 95% intervals are correctly calculated for known synthetic fixtures.
8. A highly utilized station with little marginal throughput benefit is correctly exposed by the featured six-station demo.
9. Machine state-time totals conserve shift minutes, including processing interrupted by downtime and blocking.
10. Test edge cases: empty supply, finite shift ending mid-operation, full buffer unblocking, multi-machine parallelism, repeatable equal-time event ordering, invalid inputs and bounded execution.

Add meaningful unit tests for state/queueing behavior, not only snapshots of UI or happy-path simulations.

## Execution sequence

1. Inspect the two reference repositories and record the minimal architecture choices. Confirm this repository is empty/new; don't mutate siblings.
2. Implement schemas, RNG, event scheduler, production line, metrics and correctness tests.
3. Implement interventions, paired replication runner, confidence intervals and demand-aware economics, then tests.
4. Build the React experience and browser worker with fully functional editing, experiment running, scenarios, visuals and exports.
5. Calibrate real synthetic six-station example to demonstrate a surprising investment ranking; add other presets.
6. Add Cloudflare Worker, build scripts, checks, CI, docs and final verification.
7. Run `npm ci` (or `npm install` initially to generate committed lockfile), `npm run check`, and an app smoke test if tooling permits. Fix failures before stopping.

Finish with a concise delivery summary: what works, repository/commit or PR link, the actual six-station simulation finding and seed set, exact test/build status, known limitations and **owner-run Cloudflare GitHub Build settings**.

## Cloudflare handoff

Follow the **GitHub → Cloudflare Workers Builds** pattern used for the sibling apps, not a Streamlit host:

- Production branch `main`.
- Root directory `/`.
- Build command `npm ci && npm run build`.
- Deploy command `npm run deploy` (Wrangler); document any Cloudflare-specific config requirements.
- Node.js 22.12+.
- Unique Worker name, e.g. `factory-bottleneck-experimenter`.
- No shared bindings, credentials, routes or domains with the sibling apps.
- Provide a `workers.dev` preview verification checklist and rollback notes.
- **Do not deploy** as part of this implementation; Cloudflare connection/domain activation remain owner actions.

## Definition of done

A manufacturing engineer can open the application, load a calibrated six-station demo, change line parameters, run 100 repeatable baseline and intervention replications, inspect where time is being lost, choose among four investments based on *incremental completed and saleable output*, see paired uncertainty intervals and honest payback economics, and download a report containing the full model and seed list. The GitHub repository passes CI and is ready for owner-controlled Cloudflare deployment.
