# CODEX PRODUCT PASS: Factory Bottleneck Experimenter

## Assignment

Make a **second, finished product/UX pass** on the existing deployed Factory Bottleneck Experimenter. This is an implementation brief, not a request for a proposal, mockup, or landing-page-only redesign. Work on the real React application, preserve the functioning deterministic simulation, run tests, and leave a deploy-ready commit or PR. **Do not deploy to Cloudflare or change Cloudflare settings/domains.**

Site: https://fbe.ritwiktrehan.com
Repository: https://github.com/ritwikntrehan/Factory-Bottleneck-Experimenter

Reference sibling repositories for project conventions only:
- https://github.com/ritwikntrehan/Interesting
- https://github.com/ritwikntrehan/federated-corridor-kernel

Inspect the existing source before changing it, especially `src/ui/App.tsx`, `src/ui/styles.css`, `src/examples/presets.ts`, `src/experiments`, `src/economics`, `src/export`, and the existing tests. Existing architecture is TypeScript/React, a browser Web Worker, pure deterministic simulation core, and Cloudflare Worker static hosting. Preserve it.

## Why this pass exists

The application currently opens with a giant title and a detailed factory model editor, followed by a baseline section showing blank metrics until the visitor finds the run button farther down. A visitor has to understand MTBF, MTTR, distributions, buffers and seeds *before* seeing why the tool exists.

The product is simultaneously:
1. A **useful free production improvement experimenter**: compare hypothetical improvements on completed units, with uncertainty and demand-aware economics.
2. A **credible, inspectable AI-assisted software-building demonstration**: manufacturers can create narrowly useful mathematical tools around their own operations, rather than purchase a general-purpose suite for every decision.

The first message should lead. The second should be available but not dominate the tool. Do not make a marketing funnel or add a lead-capture gate.

**Core product promise:** “Before buying another machine, see what actually increases production.”

**Core story:** In the featured *synthetic* six-station model, the heavily utilized forming station looks like the obvious investment target. Adding a $280k machine yields little extra output; a $65k coating reliability improvement produces much more. This is a reproducible *model result*, not a factory measurement or a universally valid engineering recommendation.

Previously verified illustrative regression result, 100 paired replications, base seed 730241:
- Baseline: 93.22 finished units/shift
- Forming processing utilization: 85.47%
- Add a forming machine: +2.24 units/shift, paired 95% mean-effect CI 1.85–2.63
- Improve coating reliability: +12.29 units/shift, paired 95% mean-effect CI 10.80–13.78
- Reliability upgrade assumed capex $65k, extra former $280k

These are **reference checks only**. Do not hardcode these result numbers into live result components or imply they are measured plant data. Verify by rerunning the actual current engine. If a precomputed reference snapshot is used to improve first paint, explicitly label it a saved synthetic run with simulator version/seed/config fingerprint; invalidate it for any changed physics or scenarios. Prefer performing the real simulation on initial load if sufficiently fast.

## Product principles

- **Show, then explain, then configure.** The public story comes before the spreadsheet-like editor.
- **One working product, two depths.** A simple “Explore example” experience and a full “Model my line” workbench should operate on the SAME model, scenarios, simulation results and economics. Do not fork calculations, data models, or create a nonfunctional hero demo.
- **Credibility over hype.** No invented production claims, “AI predicted” language, manufactured urgency, vague ROI promises, or unverified testimonials.
- **No artificial friction.** No login, email gate, webinar, signup wall, paywall, or forced tutorial.
- **AI-assisted creation, deterministic calculation.** The site may tell the build story, but its physics are explicit code and not generated guesses.
- **Honest about limits.** Synthetic inputs are never represented as calibrated factory output. The app cannot establish an actual plant bottleneck without plant-specific input data and calibration.
- **Privacy-first.** Model computation continues in the browser, without telemetry of user-entered factory data.
- **Restraint.** Prefer a sharply composed functional industrial interface to “AI SaaS” decoration, stock images, 3D hero renders, endless cards, or gratuitous motion.

## Implement the revised user journey

### A. Above-the-fold: compelling example, not a configuration wall

Replace the present oversized title-first hero with a compact, serious first screen:

- Clear headline: **“Before buying another machine, see what actually increases production.”**
- A single-sentence explanation: “Test equipment, buffer and reliability improvements against finished output, cost and uncertainty.”
- Primary action: **“Explore the example”** or **“Run the example”** (must actually run/reveal computed results).
- Secondary action: **“Model my production line”** (takes visitor to the functional editor/workbench).
- A modest “Synthetic example” indicator directly beside the example and clearly explained; never bury it in footnotes.
- Concise trust indicators: “Free & open source”, “Runs in your browser”, “No account required”. Only say data stays local if source code supports the claim.
- A link to the public GitHub repository.

The default visitor should see meaningful *computed* information quickly. Resolve the current blank-state problem: use deterministic initial auto-run of the featured example on mount (once, without repeated loops) if performance is acceptable, with progress/skeleton state; or use an honestly labeled, versioned and reproducible saved example snapshot then live-verify when interacting. Never show static values as if they update when parameters change.

### B. Tell the story in a compact, visual result

Show the featured six-station line as a readable left-to-right **flow diagram** (not an EV battery image unrelated to the actual model). Make machine counts and between-station buffer capacities legible and ensure connectors, labels and station cards never overlap. The current horizontal diagram has awkward buffer placement and scrolling; fix.

Near the diagram, show:
- Baseline completed units per shift
- Forming station processing utilization, described accurately
- Two visually contrasted choices:
  - Buy another forming machine ($280k in synthetic input)
  - Improve coating reliability ($65k in synthetic input)
- Actual paired mean delta completed units/shift, 95% paired CI (either visible or readily accessible), and economic impact *only when demand assumptions support it*.
- A short, mathematically faithful interpretation: “The busiest-looking station is not necessarily where an investment produces the most finished output.”

Make it possible to see the two scenarios side by side without navigating down through 30 form fields. Show all four tested interventions somewhere in the default results area; do not hide counterexamples or manipulate the ranking.

Keep the example synthetic label continuously visible with results. Use a helpful, no-jargon microexplanation of confidence interval (“Range for the estimated average gain across repeated simulated shifts”) without incorrectly calling a mean-effect CI an individual-shift forecast.

### C. Give visitors a quick, real interaction

Create a simple “What would you change?” area linked to the actual scenario engine. Examples of useful high-level controls:
- Add a machine to selected station
- Increase a selected intermediate buffer
- Reduce downtime / improve a station's reliability
- Shorten a station's cycle time

An attractive approach is four choice cards with a modest one- or two-field edit flow, a prominent **“Recalculate”** action, and a concise before/after comparison. Reuse underlying `Scenario` definitions and worker runner. Pick the simplest implementation consistent with correctness. Avoid creating a second simulation system or a set of fake sliders.

Reveal technical parameters on demand (e.g. `Advanced settings`), not as the first contact. Clearly communicate that physics needs rerunning after changes and economics-only inputs do not.

### D. Full engineering workbench (existing capabilities stay)

Keep editable 3–10 stations, machine counts, cycle-time distributions, MTBF/MTTR, buffers, shift/supply settings, seed/replication count, example presets and JSON import/export. Keep baseline diagnostics, station-state bars, scenario editing, uncertainty, full demand-aware investment ranking, CSV and printable report.

Improve the workbench:
- View switch / sections such as “Explore example” and “Build your own model”, with navigation that works by keyboard and browser history where appropriate. No duplicate or confusing simultaneous editing states.
- Group inputs under understandable panels: line layout; production schedule; processing; reliability; investment costs; advanced simulation settings.
- Explain MTBF/MTTR and buffer ownership in tooltips or plain-language field hints.
- Prefer inline field validation and disabled invalid actions to a single enormous error paragraph. Preserve Zod validation and strict limits.
- Make tables scroll predictably on small screens, avoid microscopic headers and overlapping badges.
- Distinguish `synthetic preset`, `modified synthetic preset`, and `user-supplied model` accurately. Do not treat model changes as new calibrated measurements.
- Provide clear Reset to featured example and Load example actions.
- Use understandable result labels (“Finished units per shift”, “Additional units from this change”, “Estimated net annual benefit”) while preserving precise descriptions.
- Empty states should show what to do next; loading and cancellation should provide useful feedback.
- Keep results visually readable in mobile as well as desktop. No horizontal scrolling on the entire page. The detailed table may have its own accessible horizontal scroll.

### E. Small, authentic “how this was built” section

After the usable tool, add a **short** section along these lines:

“This is a working example of the specialized software manufacturers can now build around their own operations. AI-assisted development helped create the application; a deterministic simulation engine calculates the results. The source and tests are public.”

Include:
- Link to GitHub source
- Plain-English explanation of what is simulated: variability, breakdowns, finite buffers and shift cutoff
- Clear distinction between example assumptions and a calibrated real-factory model
- Optional simple invitation to explore or adapt the open code

**Do not invent** a contact email, consultation booking URL, testimonials, client names, or commercial service prices. If no verified contact destination is configured, omit the contact CTA. Make the app useful with zero conversion friction.

Leave LinkedIn copy, promotion posts and the broader catalog/agency site for a later stage. This pass is about making this artifact worth showing.

## Critical correctness / state consistency

The current `src/ui/App.tsx` computes `results` once, and physical model/scenario setters don't consistently invalidate those results. Therefore a visitor can modify station cycle times, machine counts, reliability, buffers, arrivals, shift, seed, replications or intervention parameters and still see results computed from earlier physics. Because economics derive from `results` and current `model.economics`, this can silently misrepresent a changed scenario.

Fix robustly:
1. Distinguish **physical inputs** (station configuration, supply, shift, failure assumptions, seed, replication count, intervention targets and changes) from **economic-only inputs** (demand, margin, operating days/shifts, capex, opex and useful life).
2. Any physical input change must immediately invalidate/mark stale the affected scenario calculations; either clear stale numeric results or show a visible “Inputs changed. Recalculate” state with previous results unmistakably separated. Do not let stale numbers appear current.
3. Economics-only edits should recompute economic outputs immediately without running simulation again. Per-scenario capex, life, and opex are economics-only: ensure changed costs are reflected in displayed/exported economic results without retaining stale cost metadata from the original scenario. If current `PhysicalScenarioResult.scenario` snapshots contain old cost fields, decouple or synchronize economics source explicitly.
4. Cancel or supersede any in-progress worker when inputs change. Discard late worker responses for outdated models/scenarios using a monotonic run ID and a canonical simulation-configuration fingerprint.
5. Keep all exports tied to the same current model, scenarios, seeds, simulator version, and computed result fingerprint. Refuse or clearly watermark stale exports. A downloadable report must not contain the new configuration paired with old results.
6. Changing a model via import or preset switch must update example/scenario targets coherently and preserve scenario validity.
7. No run should silently persist results after malformed inputs; clarify errors and recovery.

Preserve original simulation/economic semantics and tests. No silent changes to the engine to make a more spectacular demonstration.

## Visual/design direction

Industrial, editorial, practical. The current cream/ink/green palette is a workable starting point. Improve information hierarchy and legibility rather than adding trendy effects. Desktop first screen should show a concrete question and at least the beginning of an actionable demonstration without the user scrolling past a giant title. On mobile, prioritise a simple action, 2-option contrast and readable production flow.

Specific current presentation issues to address:
- Current hero has excessive vertical height, especially on phone.
- Visitors see `01 Configure` and many blank results before seeing an outcome.
- Current line-diagram buffer circles and text appear crowded/overlap in the existing PDF visual review; rebuild responsive layout thoughtfully.
- Four investment scenario editors are huge and appear before any ranking, making the narrative feel like data entry.
- Footer/source copy “no deployment performed” is now outdated. The public site is live at `fbe.ritwiktrehan.com`.
- Current documentation may still describe owner deployment as not performed. Update wording to distinguish historical handoff vs current live project without inventing Cloudflare account details.
- The existing results and input fields must never be truncated on phone or require zoom.

No auto-playing video, animations, third-party lead forms, or decorative images needed.

## Text/copy examples (adapt for clarity, don't mechanically copy)

Hero: “Before buying another machine, see what actually increases production.”
Deck: “A small, open-source factory simulator. Compare investments in equipment, buffers and reliability before spending capital.”
Example summary: “The $280k machine looks obvious. In this synthetic model, the $65k reliability intervention produces substantially more finished units.”
Help text: “Utilization tells you how busy a machine is. A counterfactual experiment tests whether changing it helps the entire line.”
Workbench invitation: “Try your own production line. Start with estimates, replace them with measurements as you have them.”
Build story: “Built with AI assistance. Calculated with a reproducible simulation engine.”

Be careful with words like “predict”, “guarantee”, “find your real bottleneck” or “optimize your factory”. Use “estimate”, “test”, “compare” and “model” unless grounded calibration makes stronger claims supportable.

## Accessibility, polish and performance

- Proper labels and semantic landmarks; keyboard navigation, logical focus on view changes, screen-reader announcement for worker progress and completed run, visible focus styles.
- Mobile 360–390px and tablet 768px checks; desktop 1280/1440px checks.
- Contrast for diagnostic state bars; don't use color alone.
- Initial results must not freeze the page or cause flickering/infinite rerenders. Preserve worker cancellation and progress.
- Avoid unnecessary API calls, trackers, and external fonts where practical.
- Build/generate results deterministically. No caching mismatch or claims when results are unrun.

## Testing / acceptance

Add and update focused tests. Minimum acceptance scenarios:

1. A new visitor sees the product question and a concrete, accurately labeled synthetic example immediately; first-time experience does not require scrolling through station configuration to find a Run button.
2. Default featured demo yields actual computed baseline and all four scenario results; forming machine vs coating reliability ordering remains verified using 100 runs, seed 730241 (within existing regression tolerances).
3. Quick-change controls run the same simulation logic as the advanced workbench for the identical configuration and seeds.
4. Modifying any physical input marks results stale or clears them; no new configuration is displayed with prior throughput/economic claims, including exports.
5. A run finishing after its inputs changed cannot overwrite new state.
6. Changing **only** margin/demand/annual operating shifts recomputes economics without changing physical throughput. Changing a scenario's capex/opex/life also updates economics with no physics rerun.
7. Demand below baseline capacity yields zero additional saleable output and never monetizes excess physical throughput.
8. JSON import, model/export CSV and complete HTML report work after changes; seeded reproducibility metadata stays intact and malicious text in user-entered station/scenario names is safely escaped in HTML exports. CSV spreadsheet formula injection is mitigated without breaking legitimate numeric fields.
9. Presets switch cleanly, valid targets remain valid, Reset works, synthetic provenance stays accurate.
10. On narrow screens the flow diagram, tables and controls are usable and non-overlapping.
11. UI and simulation tests pass; `npm run check`, `npm run demo`, and Cloudflare build/dry-run pass. Run a real browser smoke test if environment permits and report any coverage gap honestly.

Be pragmatic about adding browser tests if Playwright is already available or easy to install; otherwise add targeted React component/logic tests and manual verification notes. Do not overengineer.

## Scope exclusions

Do NOT add MES connectors, CSV ingestion from factory systems, multi-product routing, persistence/login, payment processing, AI chat, agent tooling, external analytics, new databases, MCP, a consultancy landing site, webinar gating, or a rewrite of the simulation scheduler. Do not change GitHub/Cloudflare deployment beyond committed source/config documentation.

Do NOT redesign by replacing the app with a static marketing website. Every “try this” control should result in real calculated, seeded simulation output.

## Suggested execution plan

1. Inspect code, current tests, Cloudflare docs, and existing deployed visual where accessible. Establish exact UX and state bugs with a baseline.
2. Restructure the homepage around a working synthetic example with immediate results and strong CTA.
3. Implement the quick-experiment experience, sharing model/scenario state and worker calculations with the full workbench.
4. Reorganize advanced controls, scenario editors and diagnostics with progressive disclosure and precise copy.
5. Fix stale-state/race/export correctness; add tests, especially scenarios changed after an initial run.
6. Polish diagram, responsive behavior, copy, build-story section and docs; remove outdated “not deployed” claims.
7. Verify with `npm ci`, `npm run check`, `npm run demo`, a production build, Wrangler dry-run and a desktop/mobile browser pass.
8. Deliver the commit or PR and report changes plus proof of the actual synthetic result. **Do not deploy.**

## Definition of done

Within roughly 15 seconds of arriving at the site (assuming normal browser performance), a first-time manufacturing visitor understands what question the tool answers and can see an authentic, computed synthetic case. They can test a different investment without learning simulation terminology, then open the full, precise engineering workbench when interested. The tool remains open source, assumption-driven, testable, downloadable and transparent about uncertainty and data provenance.

**This is a better public demonstration of manufacturing software built with AI, not a conversion-optimized landing page.**
