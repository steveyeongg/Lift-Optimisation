import { DispatchStrategy, estimatePickupSeconds } from "./index";

// Strategy D — Load-Aware ETA.
// Extends ETA by penalising elevators likely to arrive near or at capacity.
export const loadAware: DispatchStrategy = {
  id: "loadAware",
  name: "Load-Aware ETA",
  description:
    "Combines ETA with a penalty for elevators approaching capacity or already committed to many stops, avoiding assignments that would arrive full.",
  assignCall(state, call) {
    const capacity = state.config.elevator.capacity;
    let bestScore = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < state.elevators.length; i++) {
      const e = state.elevators[i];
      const eta = estimatePickupSeconds(state, e, call.floor, call.direction);
      const load = e.passengers.length;
      const load01 = load / capacity;
      // Sharp penalty when very full — quadratic so an 80% full car is much
      // worse than a 60% full one.
      const loadPenalty = load01 >= 0.95 ? 400 : Math.pow(load01, 3) * 90;
      const committed = e.stopQueue.length;
      const congestion = committed * 4;
      const score = eta + loadPenalty + congestion;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  },
};
