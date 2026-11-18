# Architecture and simulation semantics

```text
React editor / diagnostics / economics
                 │
                 ▼
Browser Web Worker ── paired experiment runner ── pure economics
                 │
                 ▼
validated contracts → stable event queue → line simulator → result contract

Cloudflare Worker (separate runtime): static assets + GET /api/v1/health only
```

The computational layer imports no React, browser DOM, Cloudflare binding, or network client. Stable JSON-compatible contracts are intended to allow a future standalone computation endpoint without changing simulation meaning. V1 deliberately has no MCP or database.

## Material flow

Every part visits all stations exactly once in array order. Supply arrivals wait in a pre-line supply queue, which is reported separately and does not count as factory WIP. A part becomes WIP when station 1 accepts it. Each later station can accept only from the preceding FIFO buffer. Intermediate buffer capacity is at least one; zero-slot synchronous transfer is out of scope.

A machine holds its part during processing. On completion it moves the part to its finite output buffer. If that buffer is full, the machine becomes `blocked` and continues holding the finished operation. When a downstream machine takes a buffered part, the newly freed slot immediately releases the earliest blocked upstream machine in stable machine order and prompts upstream dispatch. The last station sends its part directly to finished output. Only last-station completions at or before the shift cutoff are counted.

The queue orders first by event time and then by a monotonic insertion sequence. This makes equal-time behavior reproducible. FIFO buffers and stable machine traversal resolve all remaining ties.

## Time and randomness

The line starts empty at `t=0`; no warmup is applied. Fixed, triangular, and lognormal cycle times are positive. Lognormal input is arithmetic mean minutes plus coefficient of variation; it is converted to log-space parameters before sampling.

Failure hazard accrues only during active processing. Each active interval draws exponential time-to-failure using MTBF in processing minutes. A mid-part failure records remaining processing time, changes the machine to `down` for deterministic MTTR minutes, then resumes the same part. Starved and blocked machines do not fail. This is an explicit interruption model, not an availability multiplier.

Randomness uses a reproducible seed and independent keyed streams for each station, machine, and purpose (cycle/failure). Replications derive a stable seed list from the base seed. Baseline and modified models use the identical list—common random numbers—although structural machine changes can naturally consume different streams.

## Metrics and conservation

Machine states are mutually exclusive: `processing`, `blocked`, `starved`, or `down`. Every transition closes the previous state's exact time integral. Station fractions divide summed state minutes by `machine count × shift minutes`; the four displayed fractions therefore sum to one. Utilization means processing fraction only.

System WIP is all parts processing, blocked, or in intermediate buffers. Pre-line supply waiting is `unusedSupplyQueue`, not WIP. The simulator integrates WIP and buffer occupancy over time, records peaks, and calculates flow time from first-machine acceptance to final completion for completed units only.

Every result checks:

```text
arrived supply = completed units + system WIP at cutoff + unused pre-line supply queue
```

Completed parts also carry a route-visit count, tested against the station count. Buffer maxima are tested against configured capacities. Runtime bounds include 3–10 stations, at most 20 machines/station, supply at most 100,000, no more than 2,000 replications, finite positive timing values, and a 5,000,000-event emergency ceiling per shift.

## Experiments and uncertainty

An intervention is a pure transformation of a validated model. Each paired replication calculates `modified completed − baseline completed`. The displayed interval is a normal-critical paired t-style 95% CI for the **estimated mean effect**, not a prediction interval for an individual shift. The UI warns whenever the interval includes zero and does not infer a gain from a positive point estimate alone.

Economics consumes only physical result summaries. Changing demand, contribution margin, capex, life, opex, or discount rate cannot mutate or rerun simulation. Saleable output is `min(physical output, annual demand)`. Without a discount rate, capex uses disclosed straight-line annualization; with a positive rate it uses the capital-recovery factor. Payback uses positive incremental cash contribution after opex and is marked risky if the physical-gain CI includes zero.

## Hosting and failure behavior

The browser worker performs all heavy computation and emits progress. Cancellation terminates it. The Cloudflare Worker only provides the health endpoint and Workers Static Assets fallback; there are no secrets, bindings, upstream services, or storage. Invalid model/scenario imports are rejected with Zod paths and useful messages. A simulation event ceiling failure becomes a visible UI error rather than a partial result.
