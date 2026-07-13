import {
  DispatchWeights,
  ElevatorSnapshot,
  HallCall,
  SimulationState,
  StrategyConfig,
  StrategyId,
} from "../../types";

export interface DispatchStrategy {
  id: StrategyId;
  name: string;
  description: string;
  assignCall(state: SimulationState, call: HallCall): number; // elevator index
  // Optional idle repositioning suggestion.
  suggestIdleHome?(
    state: SimulationState,
    elevator: ElevatorSnapshot,
  ): number | null;
}

// ---------- Shared helpers ----------

export const DEFAULT_WEIGHTS: DispatchWeights = {
  wait: 1.0,
  detour: 0.6,
  onboardDelay: 0.4,
  capacityRisk: 40.0,
  energy: 0.05,
  cluster: 5.0,
};

// Estimated seconds for an elevator to reach `floor` given its current stop
// queue. Not a full simulation — a decent approximation used by dispatch.
export function estimatePickupSeconds(
  state: SimulationState,
  e: ElevatorSnapshot,
  floor: number,
  callDirection: "up" | "down",
): number {
  const cfg = state.config.elevator;
  const floorTime = cfg.floorTravelSeconds;
  const doorTime =
    cfg.doorOpenSeconds +
    cfg.doorCloseSeconds +
    cfg.accelerationPenaltySeconds;

  // Walk through existing stops, then to the call floor. If the elevator is
  // travelling toward the call in the matching direction and can stop
  // en-route, that's cheap; otherwise we finish the current run and reverse.
  let pos = e.currentFloor;
  let dir: "up" | "down" | "idle" =
    e.direction === "up" ? "up" : e.direction === "down" ? "down" : "idle";
  const queue = [...e.stopQueue];
  let seconds = 0;

  // Boarding/alighting time proxy per stop
  const perStopService =
    cfg.doorOpenSeconds +
    cfg.doorCloseSeconds +
    2 * cfg.boardSecondsPerPassenger; // rough average

  // Case A: elevator is en-route in the requested direction and the call
  // floor is on the way. Then it can slot in without a full route detour.
  if (dir === callDirection) {
    const enroute =
      (callDirection === "up" && floor >= pos) ||
      (callDirection === "down" && floor <= pos);
    if (enroute) {
      // Insert a virtual stop at `floor` — count preceding queued stops
      // that lie between pos and floor in the direction of travel.
      const between = queue.filter((f) =>
        callDirection === "up"
          ? f >= pos && f <= floor
          : f <= pos && f >= floor,
      );
      seconds +=
        Math.abs(floor - pos) * floorTime +
        between.length * perStopService +
        doorTime;
      return seconds;
    }
  }

  // Case B: finish current stop queue, then travel to call floor.
  for (const stop of queue) {
    seconds += Math.abs(stop - pos) * floorTime + perStopService;
    pos = stop;
  }
  seconds += Math.abs(floor - pos) * floorTime + doorTime;
  return seconds;
}

// Utilisation / clustering proxy: number of elevators near `floor`.
export function clusteringPenalty(
  state: SimulationState,
  candidate: number,
  floor: number,
): number {
  let near = 0;
  for (let i = 0; i < state.elevators.length; i++) {
    if (i === candidate) continue;
    if (Math.abs(state.elevators[i].currentFloor - floor) <= 2) near++;
  }
  return near;
}

// Register of strategies (populated by strategy files at import time).
export const strategyRegistry: Record<string, DispatchStrategy> = {};

export function registerStrategy(s: DispatchStrategy) {
  strategyRegistry[s.id] = s;
}
