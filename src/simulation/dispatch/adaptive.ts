import { groundFloorIndex, basementFloorIndices } from "../demand";
import {
  DispatchStrategy,
  clusteringPenalty,
  estimatePickupSeconds,
} from "./index";

// Strategy F — Peak-Hour Adaptive Control.
// Behaviour switches based on the traffic mode configured for the run:
//   • Morning down-peak: distributed vertical parking, penalise clustering,
//     prioritise downward calls, prefer already-descending cars.
//   • Evening up-peak: keep an elevator at lobby, use load-aware ETA.
//   • Non-peak: distributed parking, cheap nearest-suitable assignment.
export const adaptive: DispatchStrategy = {
  id: "adaptive",
  name: "Peak-Hour Adaptive",
  description:
    "Automatically switches between down-peak, up-peak, and non-peak behaviours: adjusts idle parking, favours en-route matches, and penalises elevator clustering during peak windows.",
  assignCall(state, call) {
    const mode = state.config.traffic.mode;
    const capacity = state.config.elevator.capacity;

    let bestScore = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < state.elevators.length; i++) {
      const e = state.elevators[i];
      const eta = estimatePickupSeconds(state, e, call.floor, call.direction);
      const load01 = e.passengers.length / capacity;
      const loadPenalty = Math.pow(load01, 3) * 90;
      const cluster = clusteringPenalty(state, i, call.floor);

      let score = eta + loadPenalty;

      if (mode === "morning_down_peak") {
        // Penalise clustering hard; small bonus if already descending.
        score += cluster * 12;
        if (e.direction === "down" && call.direction === "down") score -= 10;
      } else if (mode === "evening_up_peak" || mode === "lunch_spike") {
        // Reserve at least one lobby-close elevator: if a car is at ground
        // and idle and the call is not lobby-generated, mildly avoid it.
        const g = groundFloorIndex(state.config.building);
        const isLobbyCar =
          Math.abs(e.currentFloor - g) < 1 && e.state === "IDLE";
        if (isLobbyCar && call.floor !== g) score += 25;
        // Prefer ascending cars for up-peak calls.
        if (e.direction === "up" && call.direction === "up") score -= 10;
      } else {
        // Non-peak: reduce unnecessary movement, prefer idle nearest.
        if (e.state === "IDLE") score -= 6;
        score += cluster * 3;
      }

      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  },

  suggestIdleHome(state, elevator) {
    const b = state.config.building;
    const g = groundFloorIndex(b);
    const bs = basementFloorIndices(b);
    const total = b.basementFloors + 1 + b.aboveGroundFloors;
    const N = state.elevators.length;
    const idx = elevator.id;

    switch (state.config.traffic.mode) {
      case "morning_down_peak": {
        // Distribute idle cars up the shaft so they're near residents.
        const residentialStart = g + 1;
        const residentialEnd = total - 1;
        const span = residentialEnd - residentialStart;
        const pos = residentialStart + Math.round(((idx + 1) / (N + 1)) * span);
        return pos;
      }
      case "evening_up_peak":
      case "lunch_spike": {
        // Keep two-thirds of fleet near lobby / basement.
        if (idx === 0) return g;
        if (idx === 1 && bs.length > 0) return bs[0];
        return g;
      }
      default: {
        // Non-peak: spread across shaft.
        return Math.round((idx / Math.max(N - 1, 1)) * (total - 1));
      }
    }
  },
};
