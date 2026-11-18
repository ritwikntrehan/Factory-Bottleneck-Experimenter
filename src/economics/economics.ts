import type { EconomicsInputs, PhysicalScenarioResult, ScenarioEconomics } from "../contracts/model";

export function annualizedCapital(capex: number, usefulLifeYears: number, discountRate?: number): { cost: number; method: ScenarioEconomics["annualizationMethod"] } {
  if (!discountRate) return { cost: capex / usefulLifeYears, method: "straight-line" };
  const factor = discountRate * (1 + discountRate) ** usefulLifeYears / ((1 + discountRate) ** usefulLifeYears - 1);
  return { cost: capex * factor, method: "capital-recovery-factor" };
}

export function deriveEconomics(result: PhysicalScenarioResult, inputs: EconomicsInputs): ScenarioEconomics {
  const annualShifts = inputs.shiftsPerDay * inputs.operatingDaysPerYear;
  const annualBaselinePhysicalUnits = result.baseline.mean * annualShifts;
  const annualScenarioPhysicalUnits = result.modified.mean * annualShifts;
  const annualBaselineSaleableUnits = Math.min(annualBaselinePhysicalUnits, inputs.annualDemandUnits);
  const annualScenarioSaleableUnits = Math.min(annualScenarioPhysicalUnits, inputs.annualDemandUnits);
  const incrementalSaleableUnits = annualScenarioSaleableUnits - annualBaselineSaleableUnits;
  const grossIncrementalContribution = incrementalSaleableUnits * inputs.contributionMarginPerUnit;
  const annualized = annualizedCapital(result.scenario.capex, result.scenario.usefulLifeYears, inputs.discountRate);
  const annualCost = annualized.cost + result.scenario.annualOperatingExpense;
  const cashContribution = grossIncrementalContribution - result.scenario.annualOperatingExpense;
  return {
    annualBaselinePhysicalUnits, annualScenarioPhysicalUnits, annualBaselineSaleableUnits, annualScenarioSaleableUnits,
    incrementalSaleableUnits, grossIncrementalContribution, annualizedCapex: annualized.cost,
    netAnnualBenefit: grossIncrementalContribution - annualCost,
    costPerAddedSaleableUnit: incrementalSaleableUnits > 0 ? annualCost / incrementalSaleableUnits : null,
    simplePaybackYears: cashContribution > 0 ? result.scenario.capex / cashContribution : null,
    uncertaintyWarning: result.pairedDelta.ci95[0] <= 0,
    annualizationMethod: annualized.method,
  };
}
