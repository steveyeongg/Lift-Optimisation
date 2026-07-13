import { DispatchStrategy, estimatePickupSeconds } from "./index";

// Strategy C — Estimated Time of Arrival.
// Chooses the elevator with the lowest projected pickup ETA that accounts for
// existing stops, direction, door and boarding time.
export const etaStrategy: DispatchStrategy = {
  id: "eta",
  name: "Estimated Time of Arrival",
  description:
    "Assigns the elevator with the lowest estimated pickup time, factoring in current stops, direction, door cycles, and boarding time.",
  assignCall(state, call) {
    let bestEta = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < state.elevators.length; i++) {
      const eta = estimatePickupSeconds(
        state,
        state.elevators[i],
        call.floor,
        call.direction,
      );
      if (eta < bestEta) {
        bestEta = eta;
        bestIdx = i;
      }
    }
    return bestIdx;
  },
};
