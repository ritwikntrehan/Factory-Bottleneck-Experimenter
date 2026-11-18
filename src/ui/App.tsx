import { useMemo, useRef, useState } from "react";
import type { CycleTime, FactoryModel, PhysicalScenarioResult, Scenario, ScenarioEconomics, StationMetric } from "../contracts/model";
import { factoryModelSchema } from "../contracts/model";
import { deriveEconomics } from "../economics/economics";
import { balancedLine, featuredScenarios, misleadingSixStation, presets, reliabilityLine } from "../examples/presets";
import { downloadCsv, downloadModel, downloadReport } from "../export/exporters";

const number = (value: string) => Number(value);
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function meanStations(results: PhysicalScenarioResult[]): StationMetric[] {
  const runs = results[0]?.baselineRuns ?? []; if (!runs.length) return [];
  return runs[0]!.stationMetrics.map((station, i) => ({ ...station,
    processing: runs.reduce((s, r) => s + r.stationMetrics[i]!.processing, 0) / runs.length,
    blocked: runs.reduce((s, r) => s + r.stationMetrics[i]!.blocked, 0) / runs.length,
    starved: runs.reduce((s, r) => s + r.stationMetrics[i]!.starved, 0) / runs.length,
    down: runs.reduce((s, r) => s + r.stationMetrics[i]!.down, 0) / runs.length,
  }));
}

function StateBar({ metric }: { metric: StationMetric }) {
  const parts = [["processing", metric.processing, "#1f7a5a"], ["blocked", metric.blocked, "#e08b2c"], ["starved", metric.starved, "#a9b2ab"], ["down", metric.down, "#ba4d51"]] as const;
  return <div className="state-row"><div><strong>{metric.stationName}</strong><small>{decimal.format(metric.processing * 100)}% processing</small></div><div className="state-bar" aria-label={`${metric.stationName} machine state fractions`}>{parts.map(([name, value, color]) => <span key={name} title={`${name}: ${decimal.format(value * 100)}%`} style={{ width: `${value * 100}%`, background: color }} />)}</div></div>;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string | undefined }) { return <div className="metric"><small>{label}</small><strong>{value}</strong>{note && <span>{note}</span>}</div>; }

export function App() {
  const [model, setModel] = useState<FactoryModel>(structuredClone(misleadingSixStation));
  const [scenarios, setScenarios] = useState<Scenario[]>(structuredClone(featuredScenarios));
  const [results, setResults] = useState<PhysicalScenarioResult[]>([]);
  const [running, setRunning] = useState(false); const [progress, setProgress] = useState(0); const [error, setError] = useState("");
  const [sort, setSort] = useState<"economic" | "physical" | "unit-cost">("economic");
  const worker = useRef<Worker | null>(null); const fileInput = useRef<HTMLInputElement | null>(null);
  const economics = useMemo(() => results.map((result) => deriveEconomics(result, model.economics)), [results, model.economics]);
  const stations = useMemo(() => meanStations(results), [results]);
  const ranked = useMemo(() => results.map((result, i) => ({ result, economics: economics[i]! })).sort((a, b) => sort === "economic" ? b.economics.netAnnualBenefit - a.economics.netAnnualBenefit : sort === "physical" ? b.result.pairedDelta.mean - a.result.pairedDelta.mean : (a.economics.costPerAddedSaleableUnit ?? Infinity) - (b.economics.costPerAddedSaleableUnit ?? Infinity)), [results, economics, sort]);

  const patchModel = (patch: Partial<FactoryModel>) => setModel((current) => ({ ...current, ...patch }));
  const patchStation = (index: number, patch: Partial<FactoryModel["stations"][number]>) => setModel((current) => ({ ...current, stations: current.stations.map((station, i) => i === index ? { ...station, ...patch } : station) }));
  const patchScenario = (index: number, patch: Partial<Scenario>) => setScenarios((current) => current.map((scenario, i) => i === index ? { ...scenario, ...patch } as Scenario : scenario));
  const addStation = () => setModel((current) => current.stations.length >= 10 ? current : ({ ...current, stations: [...current.stations, { id: `station-${current.stations.length + 1}`, name: `Station ${current.stations.length + 1}`, machines: 1, cycleTime: { kind: "fixed", minutes: 4 }, mtbfMinutes: 2_000, mttrMinutes: 20, source: "estimated", outputBufferCapacity: 5 }] }));
  const removeStation = () => setModel((current) => current.stations.length <= 3 ? current : ({ ...current, stations: current.stations.slice(0, -1) }));

  const run = () => {
    setError(""); const parsed = factoryModelSchema.safeParse(model);
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" · ")); return; }
    setRunning(true); setProgress(0); setResults([]);
    const instance = new Worker(new URL("../workers/simulation.worker.ts", import.meta.url), { type: "module" }); worker.current = instance;
    instance.onmessage = (event: MessageEvent<{ type: string; completed?: number; total?: number; results?: PhysicalScenarioResult[]; message?: string }>) => {
      if (event.data.type === "progress") setProgress((event.data.completed ?? 0) / (event.data.total ?? 1));
      if (event.data.type === "complete") { setResults(event.data.results ?? []); setRunning(false); setProgress(1); instance.terminate(); }
      if (event.data.type === "error") { setError(event.data.message ?? "Simulation failed"); setRunning(false); instance.terminate(); }
    };
    instance.postMessage({ type: "run", model: parsed.data, scenarios, replications: model.defaultReplications });
  };
  const cancel = () => { worker.current?.terminate(); setRunning(false); setError("Experiment cancelled."); };
  const loadPreset = (name: string) => {
    const next = name === balancedLine.name ? balancedLine : name === reliabilityLine.name ? reliabilityLine : misleadingSixStation;
    setModel(structuredClone(next)); setResults([]);
    if (next !== misleadingSixStation) setScenarios(featuredScenarios.map((scenario) => {
      const intervention = scenario.intervention;
      if (intervention.type === "add-machine") return { ...scenario, intervention: { ...intervention, stationId: next.stations[1]!.id } };
      if (intervention.type === "increase-buffer") return { ...scenario, intervention: { ...intervention, stationId: next.stations[1]!.id, capacity: next.stations[1]!.outputBufferCapacity + 5 } };
      if (intervention.type === "improve-reliability") return { ...scenario, intervention: { ...intervention, stationId: next.stations[Math.min(2, next.stations.length - 1)]!.id } };
      return { ...scenario, intervention: { ...intervention, stationId: next.stations.at(-1)!.id } };
    })); else setScenarios(structuredClone(featuredScenarios));
  };
  const importModel = async (file?: File) => { if (!file) return; try { const next = factoryModelSchema.parse(JSON.parse(await file.text())); setModel(next); setResults([]); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Invalid model JSON"); } };

  const baseline = results[0]?.baseline;
  const baselineRuns = results[0]?.baselineRuns ?? [];
  const meanWip = baselineRuns.length ? baselineRuns.reduce((s, r) => s + r.meanWip, 0) / baselineRuns.length : 0;
  const meanFlow = baselineRuns.length ? baselineRuns.reduce((s, r) => s + (r.meanFlowTimeMinutes ?? 0), 0) / baselineRuns.length : 0;

  return <>
    <header className="hero"><div><p className="eyebrow">Manufacturing decision lab</p><h1>Factory Bottleneck<br/>Experimenter</h1><p>Test investments against completed, saleable production—not machine busyness.</p></div><div className="hero-status"><span>Simulation</span><strong>Runs locally in your browser</strong><small>No production data leaves this page</small></div></header>
    <main>
      {model.synthetic && <div className="synthetic" role="status"><strong>Synthetic example</strong> These values are demonstrative estimates, not factory measurements.</div>}
      {error && <div className="error" role="alert">{error}</div>}

      <section><div className="section-head"><div><span>01 · Configure</span><h2>Factory model</h2></div><div className="actions"><select aria-label="Example line" value={model.name} onChange={(e) => loadPreset(e.target.value)}>{presets.map((p) => <option key={p.name}>{p.name}</option>)}</select><button className="secondary" disabled={model.stations.length >= 10} onClick={addStation}>Add station</button><button className="secondary" disabled={model.stations.length <= 3} onClick={removeStation}>Remove last</button><button className="secondary" onClick={() => fileInput.current?.click()}>Import JSON</button><input ref={fileInput} hidden type="file" accept="application/json" onChange={(e) => void importModel(e.target.files?.[0])}/><button className="secondary" onClick={() => downloadModel(model)}>Export model</button></div></div>
        <div className="line-diagram" aria-label="Production line diagram">{model.stations.map((station, i) => <div className="line-unit" key={station.id}><article><span>{String(i + 1).padStart(2, "0")}</span><strong>{station.name}</strong><small>{station.machines} machine{station.machines > 1 ? "s" : ""} · {station.source}</small></article>{i < model.stations.length - 1 && <div className="buffer"><span>{station.outputBufferCapacity}</span><small>buffer</small></div>}</div>)}</div>
        <div className="global-grid">
          <label>Shift minutes<input type="number" value={model.shiftMinutes} onChange={(e) => patchModel({ shiftMinutes: number(e.target.value) })}/></label>
          <label>Supply cap<input type="number" value={model.supplyCap} onChange={(e) => patchModel({ supplyCap: number(e.target.value) })}/></label>
          <label>Arrival interval, min<input type="number" step="0.1" value={model.interarrivalMinutes} onChange={(e) => patchModel({ interarrivalMinutes: number(e.target.value) })}/></label>
          <label>Replications<input type="number" value={model.defaultReplications} onChange={(e) => patchModel({ defaultReplications: number(e.target.value) })}/></label>
          <label>Base seed<input type="number" value={model.baseSeed} onChange={(e) => patchModel({ baseSeed: number(e.target.value) })}/></label>
        </div>
        <div className="table-wrap"><table className="editor"><thead><tr><th>Station / source</th><th>Machines</th><th>Cycle distribution</th><th>Parameters, min</th><th>MTBF</th><th>MTTR</th><th>Output buffer</th></tr></thead><tbody>{model.stations.map((s, i) => <tr key={s.id}><td><input aria-label={`Station ${i + 1} name`} value={s.name} onChange={(e) => patchStation(i, { name: e.target.value })}/><select value={s.source} onChange={(e) => patchStation(i, { source: e.target.value as "measured" | "estimated" })}><option value="measured">Measured</option><option value="estimated">Estimated</option></select></td><td><input aria-label={`${s.name} machines`} type="number" value={s.machines} onChange={(e) => patchStation(i, { machines: number(e.target.value) })}/></td><td><select value={s.cycleTime.kind} onChange={(e) => { const kind = e.target.value; const cycleTime: CycleTime = kind === "fixed" ? { kind, minutes: 4 } : kind === "triangular" ? { kind, min: 3, mode: 4, max: 5 } : { kind: "lognormal", meanMinutes: 4, cv: 0.2 }; patchStation(i, { cycleTime }); }}><option value="fixed">Fixed</option><option value="triangular">Triangular</option><option value="lognormal">Lognormal</option></select></td><td>{s.cycleTime.kind === "fixed" ? <input type="number" step="0.1" value={s.cycleTime.minutes} onChange={(e) => patchStation(i, { cycleTime: { kind: "fixed", minutes: number(e.target.value) } })}/> : s.cycleTime.kind === "triangular" ? <div className="triple"><input title="Minimum" type="number" step="0.1" value={s.cycleTime.min} onChange={(e) => patchStation(i, { cycleTime: { kind: "triangular", min: number(e.target.value), mode: s.cycleTime.kind === "triangular" ? s.cycleTime.mode : 4, max: s.cycleTime.kind === "triangular" ? s.cycleTime.max : 5 } })}/><input title="Mode" type="number" step="0.1" value={s.cycleTime.mode} onChange={(e) => patchStation(i, { cycleTime: { kind: "triangular", min: s.cycleTime.kind === "triangular" ? s.cycleTime.min : 3, mode: number(e.target.value), max: s.cycleTime.kind === "triangular" ? s.cycleTime.max : 5 } })}/><input title="Maximum" type="number" step="0.1" value={s.cycleTime.max} onChange={(e) => patchStation(i, { cycleTime: { kind: "triangular", min: s.cycleTime.kind === "triangular" ? s.cycleTime.min : 3, mode: s.cycleTime.kind === "triangular" ? s.cycleTime.mode : 4, max: number(e.target.value) } })}/></div> : <div className="triple"><input title="Mean minutes" type="number" step="0.1" value={s.cycleTime.meanMinutes} onChange={(e) => patchStation(i, { cycleTime: { kind: "lognormal", meanMinutes: number(e.target.value), cv: s.cycleTime.kind === "lognormal" ? s.cycleTime.cv : .2 } })}/><input title="Coefficient of variation" type="number" step="0.05" value={s.cycleTime.cv} onChange={(e) => patchStation(i, { cycleTime: { kind: "lognormal", meanMinutes: s.cycleTime.kind === "lognormal" ? s.cycleTime.meanMinutes : 4, cv: number(e.target.value) } })}/></div>}</td><td><input type="number" value={s.mtbfMinutes} onChange={(e) => patchStation(i, { mtbfMinutes: number(e.target.value) })}/></td><td><input type="number" value={s.mttrMinutes} onChange={(e) => patchStation(i, { mttrMinutes: number(e.target.value) })}/></td><td>{i < model.stations.length - 1 ? <input type="number" value={s.outputBufferCapacity} onChange={(e) => patchStation(i, { outputBufferCapacity: number(e.target.value) })}/> : <span>Finished goods</span>}</td></tr>)}</tbody></table></div>
      </section>

      <section><div className="section-head"><div><span>02 · Diagnose</span><h2>Baseline performance</h2></div>{!results.length && <p className="section-note">Run the experiment to calculate diagnostics.</p>}</div>
        <div className="metrics"><Metric label="Finished units / shift" value={baseline ? decimal.format(baseline.mean) : "—"} note={baseline ? `95% mean CI ${decimal.format(baseline.ci95[0])}–${decimal.format(baseline.ci95[1])}` : undefined}/><Metric label="Mean work in process" value={baseline ? decimal.format(meanWip) : "—"} note="time-weighted units"/><Metric label="Mean production lead time" value={baseline ? `${decimal.format(meanFlow)} min` : "—"} note="completed units only"/><Metric label="Matched seed set" value={baseline ? String(results[0]!.replicationSeeds.length) : "—"} note={`base ${model.baseSeed}`}/></div>
        {stations.length > 0 && <div className="diagnostic"><div className="legend"><span><i className="processing"/>Processing</span><span><i className="blocked"/>Blocked</span><span><i className="starved"/>Starved</span><span><i className="down"/>Down</span></div>{stations.map((metric) => <StateBar key={metric.stationId} metric={metric}/>)}<p className="caveat">Candidate bottlenecks require counterfactual testing. Processing fraction is utilization; blocked time is not useful production.</p></div>}
      </section>

      <section><div className="section-head"><div><span>03 · Experiment</span><h2>Investment scenarios</h2></div><button className="run" disabled={running} onClick={run}>{running ? `Running ${Math.round(progress * 100)}%` : `Run ${model.defaultReplications} matched replications`}</button>{running && <button className="secondary" onClick={cancel}>Cancel</button>}</div>
        {running && <progress value={progress} max={1}/>}<div className="scenario-grid">{scenarios.map((s, i) => <article className="scenario" key={s.id}><span>{s.intervention.type.replaceAll("-", " ")}</span><input aria-label={`Scenario ${i + 1} name`} value={s.name} onChange={(e) => patchScenario(i, { name: e.target.value })}/><label>Target<select value={s.intervention.stationId} onChange={(e) => patchScenario(i, { intervention: { ...s.intervention, stationId: e.target.value } })}>{model.stations.map((st) => <option value={st.id} key={st.id}>{st.name}</option>)}</select></label>{s.intervention.type === "add-machine" ? <label>Machines to add<input type="number" value={s.intervention.count} onChange={(e) => patchScenario(i, { intervention: { ...s.intervention, count: number(e.target.value) } as Scenario["intervention"] })}/></label> : s.intervention.type === "reduce-cycle-time" ? <label>Cycle reduction, %<input type="number" value={s.intervention.percent} onChange={(e) => patchScenario(i, { intervention: { ...s.intervention, percent: number(e.target.value) } as Scenario["intervention"] })}/></label> : s.intervention.type === "increase-buffer" ? <label>New capacity<input type="number" value={s.intervention.capacity} onChange={(e) => patchScenario(i, { intervention: { ...s.intervention, capacity: number(e.target.value) } as Scenario["intervention"] })}/></label> : <div className="scenario-costs"><label>MTBF multiplier<input type="number" step="0.1" value={s.intervention.mtbfMultiplier} onChange={(e) => patchScenario(i, { intervention: { ...s.intervention, mtbfMultiplier: number(e.target.value) } as Scenario["intervention"] })}/></label><label>MTTR reduction, %<input type="number" value={s.intervention.mttrReductionPercent} onChange={(e) => patchScenario(i, { intervention: { ...s.intervention, mttrReductionPercent: number(e.target.value) } as Scenario["intervention"] })}/></label></div>}<div className="scenario-costs"><label>Capex<input type="number" value={s.capex} onChange={(e) => patchScenario(i, { capex: number(e.target.value) })}/></label><label>Life, years<input type="number" value={s.usefulLifeYears} onChange={(e) => patchScenario(i, { usefulLifeYears: number(e.target.value) })}/></label><label>Annual opex<input type="number" value={s.annualOperatingExpense} onChange={(e) => patchScenario(i, { annualOperatingExpense: number(e.target.value) })}/></label></div></article>)}</div>
      </section>

      <section><div className="section-head"><div><span>04 · Decide</span><h2>Demand-aware ranking</h2></div><label>Rank by<select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="economic">Net annual benefit</option><option value="physical">Physical throughput gain</option><option value="unit-cost">Cost / saleable unit</option></select></label></div>
        <div className="economics-inputs"><label>Shifts / day<input type="number" step="0.1" value={model.economics.shiftsPerDay} onChange={(e) => patchModel({ economics: { ...model.economics, shiftsPerDay: number(e.target.value) } })}/></label><label>Days / year<input type="number" value={model.economics.operatingDaysPerYear} onChange={(e) => patchModel({ economics: { ...model.economics, operatingDaysPerYear: number(e.target.value) } })}/></label><label>Annual demand<input type="number" value={model.economics.annualDemandUnits} onChange={(e) => patchModel({ economics: { ...model.economics, annualDemandUnits: number(e.target.value) } })}/></label><label>Contribution margin<input type="number" value={model.economics.contributionMarginPerUnit} onChange={(e) => patchModel({ economics: { ...model.economics, contributionMarginPerUnit: number(e.target.value) } })}/></label></div>
        {ranked.length ? <div className="table-wrap"><table className="results"><thead><tr><th>Rank / scenario</th><th>Units / shift</th><th>Paired gain (95% CI)</th><th>Saleable gain / yr</th><th>Net annual benefit</th><th>Cost / added unit</th><th>Payback</th></tr></thead><tbody>{ranked.map(({ result: r, economics: e }, i) => <tr key={r.scenario.id}><td><b>#{i + 1}</b> {r.scenario.name}{e.uncertaintyWarning && <em>CI includes zero</em>}</td><td>{decimal.format(r.modified.mean)}</td><td><strong>{r.pairedDelta.mean >= 0 ? "+" : ""}{decimal.format(r.pairedDelta.mean)}</strong><small>{decimal.format(r.pairedDelta.ci95[0])} to {decimal.format(r.pairedDelta.ci95[1])}</small></td><td>{decimal.format(e.incrementalSaleableUnits)}</td><td className={e.netAnnualBenefit >= 0 ? "positive" : "negative"}>{money.format(e.netAnnualBenefit)}</td><td>{e.costPerAddedSaleableUnit === null ? "N/A" : money.format(e.costPerAddedSaleableUnit)}</td><td>{e.simplePaybackYears === null ? "N/A" : `${decimal.format(e.simplePaybackYears)} yr`}</td></tr>)}</tbody></table></div> : <div className="empty">No computed scenario rows yet. Results are always simulated—never hardcoded.</div>}
        <p className="caveat">Economics use simulated mean output and demand-limited sales. Net annual benefit is accounting-style; payback is not established when the physical-gain CI includes zero. Editing these inputs does not rerun physics.</p>
      </section>

      <section className="export"><div><span>05 · Reproduce</span><h2>Export the complete decision record</h2><p>Configuration, intervention parameters, matched seeds, assumptions, physical results, and economics stay together.</p></div><div className="actions"><button className="secondary" disabled={!results.length} onClick={() => downloadCsv(results, economics)}>Scenario CSV</button><button disabled={!results.length} onClick={() => downloadReport(model, results, economics)}>Printable HTML report</button></div></section>
    </main><footer><strong>Factory Bottleneck Experimenter</strong><span>Simulation in browser Web Worker · hosting in Cloudflare Worker · no deployment performed</span></footer>
  </>;
}
