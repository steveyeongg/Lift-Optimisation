import { DispatchStrategy } from "./index";

// Strategy B — Direction-Aware Collective Control.
// Priority tiers:
//   1. Elevator travelling toward caller in same direction, call is en-route.
//   2. Idle elevator (cheapest by distance).
//   3. Elevator finishing current run then reversing.
export const directional: DispatchStrategy = {
  id: "directional",
  name: "Direction-Aware Collective",
  description:
    "Prefers elevators already travelling toward the caller in the same direction; idle elevators next; otherwise the elevator that can reverse most cheaply.",
  assignCall(state, call) {
    const elevators = state.elevators;
    let bestScore = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < elevators.length; i++) {
      const e = elevators[i];
      const dist = Math.abs(e.currentFloor - call.floor);
      let tier = 3;
      if (
        (e.direction === "up" &&
          call.direction === "up" &&
          call.floor >= e.currentFloor) ||
        (e.direction === "down" &&
          call.direction === "down" &&
          call.floor <= e.currentFloor)
      ) {
        tier = 0;
      } else if (e.state === "IDLE") {
        tier = 1;
      } else if (
        (e.direction === "up" && call.direction === "up") ||
        (e.direction === "down" && call.direction === "down")
      ) {
        tier = 2;
      }
      const score = tier * 1000 + dist;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  },
};
