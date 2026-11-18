import type { BufferMetric, CycleTime, FactoryModel, MachineState, SimulationResult, StateFractions, StationMetric } from "../contracts/model";
import { parseFactoryModel } from "../contracts/model";
import { KeyedRng, type SeededRng } from "./rng";
import { StableEventQueue } from "./scheduler";

export const SIMULATOR_VERSION = "1.0.0";

interface Part { id: number; enteredSystemAt: number; routeVisits: number }
interface Machine {
  stationIndex: number; machineIndex: number; state: MachineState; stateSince: number;
  totals: StateFractions; part: Part | null; remainingProcess: number; processStartedAt: number; token: number;
}
interface BufferState { parts: Part[]; area: number; lastChangedAt: number; max: number }
type Event =
  | { type: "arrival" }
  | { type: "process-complete"; stationIndex: number; machineIndex: number; token: number }
  | { type: "failure"; stationIndex: number; machineIndex: number; token: number }
  | { type: "repair"; stationIndex: number; machineIndex: number; token: number };

function sampleCycleTime(spec: CycleTime, rng: SeededRng): number {
  if (spec.kind === "fixed") return spec.minutes;
  if (spec.kind === "triangular") {
    const u = rng.uniform(); const split = (spec.mode - spec.min) / (spec.max - spec.min);
    return u < split
      ? spec.min + Math.sqrt(u * (spec.max - spec.min) * (spec.mode - spec.min))
      : spec.max - Math.sqrt((1 - u) * (spec.max - spec.min) * (spec.max - spec.mode));
  }
  const sigma = Math.sqrt(Math.log(1 + spec.cv * spec.cv));
  const mu = Math.log(spec.meanMinutes) - (sigma * sigma) / 2;
  return Math.exp(mu + sigma * rng.normal());
}

export function simulateFactory(unvalidatedModel: FactoryModel, seed: number): SimulationResult {
  const model = parseFactoryModel(unvalidatedModel);
  const rng = new KeyedRng(seed);
  const events = new StableEventQueue<Event>();
  const supplyQueue: Part[] = [];
  const buffers: BufferState[] = model.stations.slice(0, -1).map(() => ({ parts: [], area: 0, lastChangedAt: 0, max: 0 }));
  const machines: Machine[][] = model.stations.map((station, stationIndex) => Array.from({ length: station.machines }, (_, machineIndex) => ({
    stationIndex, machineIndex, state: "starved", stateSince: 0,
    totals: { processing: 0, blocked: 0, starved: 0, down: 0 }, part: null, remainingProcess: 0, processStartedAt: 0, token: 0,
  })));
  let now = 0; let nextPartId = 1; let arrivedSupply = 0; let completedUnits = 0; let eventCount = 0;
  let systemWip = 0; let peakWip = 0; let wipArea = 0; let wipChangedAt = 0;
  const flowTimes: number[] = []; const completedPartRoutes: number[] = [];

  const updateWip = (next: number): void => { wipArea += systemWip * (now - wipChangedAt); systemWip = next; peakWip = Math.max(peakWip, systemWip); wipChangedAt = now; };
  const updateBuffer = (index: number): void => { const b = buffers[index]!; b.area += b.parts.length * (now - b.lastChangedAt); b.lastChangedAt = now; b.max = Math.max(b.max, b.parts.length); };
  const transition = (machine: Machine, next: MachineState): void => {
    machine.totals[machine.state] += now - machine.stateSince; machine.state = next; machine.stateSince = now;
  };
  const streamKey = (m: Machine, purpose: string) => `station:${model.stations[m.stationIndex]!.id}:machine:${m.machineIndex}:${purpose}`;

  const scheduleProcessing = (machine: Machine): void => {
    const station = model.stations[machine.stationIndex]!; machine.processStartedAt = now; machine.token += 1;
    const token = machine.token;
    const failureAfter = rng.stream(streamKey(machine, "failure")).exponential(station.mtbfMinutes);
    if (failureAfter < machine.remainingProcess) events.schedule(now + failureAfter, { type: "failure", stationIndex: machine.stationIndex, machineIndex: machine.machineIndex, token });
    else events.schedule(now + machine.remainingProcess, { type: "process-complete", stationIndex: machine.stationIndex, machineIndex: machine.machineIndex, token });
  };

  const startPart = (machine: Machine, part: Part): void => {
    machine.part = part; part.routeVisits += 1;
    machine.remainingProcess = sampleCycleTime(model.stations[machine.stationIndex]!.cycleTime, rng.stream(streamKey(machine, "cycle")));
    transition(machine, "processing"); scheduleProcessing(machine);
  };

  const releaseBlocked = (stationIndex: number): void => {
    if (stationIndex < 0 || stationIndex >= buffers.length) return;
    const buffer = buffers[stationIndex]!; const capacity = model.stations[stationIndex]!.outputBufferCapacity;
    for (const machine of machines[stationIndex]!) {
      if (machine.state !== "blocked" || buffer.parts.length >= capacity) continue;
      if (!machine.part) throw new Error("Blocked machine has no part");
      updateBuffer(stationIndex); buffer.parts.push(machine.part); machine.part = null; machine.remainingProcess = 0;
      transition(machine, "starved");
    }
  };

  const dispatchStation = (stationIndex: number): void => {
    for (const machine of machines[stationIndex]!) {
      if (machine.state !== "starved") continue;
      let part: Part | undefined;
      if (stationIndex === 0) {
        part = supplyQueue.shift();
        if (part) { part.enteredSystemAt = now; updateWip(systemWip + 1); }
      } else {
        const input = buffers[stationIndex - 1]!;
        if (input.parts.length) { updateBuffer(stationIndex - 1); part = input.parts.shift(); releaseBlocked(stationIndex - 1); dispatchStation(stationIndex - 1); }
      }
      if (!part) break;
      startPart(machine, part);
    }
    if (stationIndex > 0) {
      releaseBlocked(stationIndex - 1);
      dispatchStation(stationIndex - 1);
      if (machines[stationIndex]!.some((m) => m.state === "starved") && buffers[stationIndex - 1]!.parts.length) dispatchStation(stationIndex);
    }
  };

  const finishProcessing = (machine: Machine): void => {
    const stationIndex = machine.stationIndex; const part = machine.part;
    if (!part) throw new Error("Completing machine has no part");
    machine.remainingProcess = 0;
    if (stationIndex === model.stations.length - 1) {
      completedUnits += 1; flowTimes.push(now - part.enteredSystemAt); completedPartRoutes.push(part.routeVisits);
      updateWip(systemWip - 1); machine.part = null; transition(machine, "starved"); dispatchStation(stationIndex);
      return;
    }
    const buffer = buffers[stationIndex]!; const capacity = model.stations[stationIndex]!.outputBufferCapacity;
    if (buffer.parts.length >= capacity) { transition(machine, "blocked"); return; }
    updateBuffer(stationIndex); buffer.parts.push(part); machine.part = null; transition(machine, "starved");
    dispatchStation(stationIndex + 1); dispatchStation(stationIndex);
  };

  const arrive = (): void => {
    const part: Part = { id: nextPartId++, enteredSystemAt: -1, routeVisits: 0 };
    arrivedSupply += 1; supplyQueue.push(part); dispatchStation(0);
  };

  if (model.interarrivalMinutes === 0) for (let i = 0; i < model.supplyCap; i += 1) arrive();
  else for (let i = 0; i < model.supplyCap; i += 1) { const time = i * model.interarrivalMinutes; if (time > model.shiftMinutes) break; events.schedule(time, { type: "arrival" }); }

  while (events.size) {
    const scheduled = events.pop()!; if (scheduled.time > model.shiftMinutes) break;
    now = scheduled.time; eventCount += 1; if (eventCount > 5_000_000) throw new Error("Simulation event limit exceeded");
    const event = scheduled.payload;
    if (event.type === "arrival") { arrive(); continue; }
    const machine = machines[event.stationIndex]![event.machineIndex]!;
    if (event.token !== machine.token) continue;
    if (event.type === "process-complete") { if (machine.state === "processing") finishProcessing(machine); continue; }
    if (event.type === "failure") {
      if (machine.state !== "processing") continue;
      machine.remainingProcess = Math.max(0, machine.remainingProcess - (now - machine.processStartedAt));
      transition(machine, "down"); machine.token += 1;
      const repair = model.stations[event.stationIndex]!.mttrMinutes;
      events.schedule(now + repair, { type: "repair", stationIndex: event.stationIndex, machineIndex: event.machineIndex, token: machine.token });
      continue;
    }
    if (event.type === "repair" && machine.state === "down") { transition(machine, "processing"); scheduleProcessing(machine); }
  }

  now = model.shiftMinutes; wipArea += systemWip * (now - wipChangedAt);
  for (const b of buffers) { b.area += b.parts.length * (now - b.lastChangedAt); }
  for (const stationMachines of machines) for (const machine of stationMachines) machine.totals[machine.state] += now - machine.stateSince;

  const stationMetrics: StationMetric[] = machines.map((stationMachines, index) => {
    const denominator = stationMachines.length * model.shiftMinutes;
    const sums = stationMachines.reduce<StateFractions>((a, m) => ({ processing: a.processing + m.totals.processing, blocked: a.blocked + m.totals.blocked, starved: a.starved + m.totals.starved, down: a.down + m.totals.down }), { processing: 0, blocked: 0, starved: 0, down: 0 });
    return { stationId: model.stations[index]!.id, stationName: model.stations[index]!.name, machineMinutes: denominator, processing: sums.processing / denominator, blocked: sums.blocked / denominator, starved: sums.starved / denominator, down: sums.down / denominator };
  });
  const bufferMetrics: BufferMetric[] = buffers.map((b, index) => ({ stationId: model.stations[index]!.id, capacity: model.stations[index]!.outputBufferCapacity, meanOccupancy: b.area / model.shiftMinutes, maxOccupancy: b.max }));
  const conservation = { arrivals: arrivedSupply, completed: completedUnits, systemWip, unusedSupplyQueue: supplyQueue.length, balanced: arrivedSupply === completedUnits + systemWip + supplyQueue.length };
  return {
    simulatorVersion: SIMULATOR_VERSION, seed, shiftMinutes: model.shiftMinutes, completedUnits, arrivedSupply,
    unusedSupplyQueue: supplyQueue.length, systemWipAtCutoff: systemWip, meanWip: wipArea / model.shiftMinutes, peakWip,
    meanFlowTimeMinutes: flowTimes.length ? flowTimes.reduce((a, b) => a + b, 0) / flowTimes.length : null,
    stationMetrics, bufferMetrics, completedPartRoutes, conservation,
  };
}
