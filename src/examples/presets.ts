import type { FactoryModel, Scenario } from "../contracts/model";

const economics = { shiftsPerDay: 2, operatingDaysPerYear: 250, annualDemandUnits: 120_000, contributionMarginPerUnit: 18, discountRate: 0.08 };
const station = (id: string, name: string, minutes: number, buffer: number, mtbfMinutes = 2_000, mttrMinutes = 20) => ({ id, name, machines: 1, cycleTime: { kind: "fixed" as const, minutes }, mtbfMinutes, mttrMinutes, source: "estimated" as const, outputBufferCapacity: buffer });

export const misleadingSixStation: FactoryModel = {
  schemaVersion: "1.0", name: "Six-station counterfactual trap", synthetic: true,
  description: "Synthetic demonstration: a highly utilized upstream station is visually tempting, but downstream reliability and blocking determine saleable output.",
  shiftMinutes: 480, supplyCap: 1_000, interarrivalMinutes: 0, defaultReplications: 100, baseSeed: 730_241, economics,
  stations: [
    station("cut", "Cutting", 3.5, 6, 5_000, 10),
    station("form", "Forming", 4.15, 2, 5_000, 10),
    station("weld", "Welding", 3.7, 1, 3_000, 15),
    station("coat", "Coating", 3.9, 1, 140, 34),
    station("cure", "Curing", 3.65, 5, 3_000, 15),
    station("pack", "Packing", 3.7, 5, 4_000, 10),
  ],
};

export const featuredScenarios: Scenario[] = [
  { id: "extra-former", name: "Add a forming machine", intervention: { type: "add-machine", stationId: "form", count: 1 }, capex: 280_000, usefulLifeYears: 10, annualOperatingExpense: 12_000 },
  { id: "coat-buffer", name: "Expand pre-coating buffer", intervention: { type: "increase-buffer", stationId: "weld", capacity: 8 }, capex: 18_000, usefulLifeYears: 8, annualOperatingExpense: 500 },
  { id: "coat-reliability", name: "Coating reliability program", intervention: { type: "improve-reliability", stationId: "coat", mtbfMultiplier: 2.2, mttrReductionPercent: 35 }, capex: 65_000, usefulLifeYears: 5, annualOperatingExpense: 4_000 },
  { id: "faster-pack", name: "Reduce packing cycle", intervention: { type: "reduce-cycle-time", stationId: "pack", percent: 15 }, capex: 40_000, usefulLifeYears: 5, annualOperatingExpense: 1_500 },
];

export const balancedLine: FactoryModel = {
  ...misleadingSixStation, name: "Balanced four-station line", description: "Synthetic near-balanced line with moderate variability.", baseSeed: 918_221,
  stations: [station("prep", "Preparation", 4, 5, 1_500, 12), station("assemble", "Assembly", 4.1, 5, 1_500, 12), station("test", "Test", 4, 5, 1_500, 12), station("pack", "Pack", 3.9, 5, 1_500, 12)],
};

export const reliabilityLine: FactoryModel = {
  ...misleadingSixStation, name: "Reliability-constrained line", description: "Synthetic line where the test station has frequent, long repairs.", baseSeed: 122_419,
  stations: [station("mix", "Mix", 3.2, 4), station("fill", "Fill", 3.2, 3), station("inspect", "Inspection", 3.1, 2, 90, 28), station("case", "Case pack", 3.1, 4)],
};

export const presets = [misleadingSixStation, balancedLine, reliabilityLine];
