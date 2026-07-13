import { DispatchStrategy } from "./index";

// Strategy A — Naive Nearest Elevator (baseline).
export const nearest: DispatchStrategy = {
  id: "nearest",
  name: "Nearest Elevator",
  description:
    "Baseline. Assigns the hall call to the elevator with the smallest floor-index distance regardless of direction or existing route.",
  assignCall(state, call) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < state.elevators.length; i++) {
      const d = Math.abs(state.elevators[i].currentFloor - call.floor);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  },
};
