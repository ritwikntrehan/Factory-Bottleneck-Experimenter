import type { FactoryModel, PhysicalScenarioResult, ScenarioEconomics } from "../contracts/model";

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}
const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const html = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function downloadModel(model: FactoryModel): void { download("factory-model.json", JSON.stringify(model, null, 2), "application/json"); }
export function buildScenarioCsv(results: PhysicalScenarioResult[], economics: ScenarioEconomics[]): string {
  const header = ["scenario", "baseline_units_shift", "scenario_units_shift", "paired_gain", "gain_ci_low", "gain_ci_high", "percent_gain", "incremental_saleable_units_year", "net_annual_benefit", "cost_per_added_saleable_unit", "payback_years"];
  const rows = results.map((r, i) => { const e = economics[i]!; return [r.scenario.name, r.baseline.mean, r.modified.mean, r.pairedDelta.mean, ...r.pairedDelta.ci95, r.percentGain, e.incrementalSaleableUnits, e.netAnnualBenefit, e.costPerAddedSaleableUnit, e.simplePaybackYears]; });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
export function downloadCsv(results: PhysicalScenarioResult[], economics: ScenarioEconomics[]): void { download("scenario-results.csv", buildScenarioCsv(results, economics), "text/csv;charset=utf-8"); }

export function buildReportHtml(model: FactoryModel, results: PhysicalScenarioResult[], economics: ScenarioEconomics[], fingerprint: string): string {
  const generated = new Date().toISOString();
  const rows = results.map((r, i) => `<tr><td>${html(r.scenario.name)}</td><td>${r.baseline.mean.toFixed(2)}</td><td>${r.modified.mean.toFixed(2)}</td><td>${r.pairedDelta.mean.toFixed(2)} [${r.pairedDelta.ci95.map((v) => v.toFixed(2)).join(", ")}]</td><td>${economics[i]!.netAnnualBenefit.toFixed(0)}</td></tr>`).join("");
  const payload = html(JSON.stringify({ fingerprint, model, scenarios: results.map((r, i) => ({ physical: r, economics: economics[i] })) }, null, 2));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${html(model.name)} experiment report</title><style>body{font:14px system-ui;max-width:1000px;margin:40px auto;color:#17211b}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:8px;text-align:left}pre{white-space:pre-wrap;font-size:11px}@media print{button{display:none}}</style></head><body><button onclick="print()">Print / Save PDF</button><h1>Factory Bottleneck Experiment</h1><p><strong>${html(model.name)}</strong> · ${model.synthetic ? "SYNTHETIC DATA" : "user-supplied data"} · generated ${generated}</p><p>Simulator 1.0.0. Browser Web Worker simulation. Initially empty line; active-processing failure clock; finite buffers; completed units counted at shift cutoff.</p><h2>Results</h2><table><thead><tr><th>Scenario</th><th>Baseline</th><th>Modified</th><th>Paired effect, 95% mean CI</th><th>Net annual benefit</th></tr></thead><tbody>${rows}</tbody></table><h2>Reproducibility</h2><p>Base seed ${model.baseSeed}; ${results[0]?.replicationSeeds.length ?? 0} matched seeds.</p><p>Simulation configuration fingerprint: <code>${html(fingerprint)}</code></p><pre>${payload}</pre></body></html>`;
}
export function downloadReport(model: FactoryModel, results: PhysicalScenarioResult[], economics: ScenarioEconomics[], fingerprint: string): void { download("factory-experiment-report.html", buildReportHtml(model, results, economics, fingerprint), "text/html;charset=utf-8"); }
