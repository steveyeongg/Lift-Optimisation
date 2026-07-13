import {
  DispatchStrategy,
  clusteringPenalty,
  estimatePickupSeconds,
} from "./index";

// Strategy G — Optimised Cost Function.
// Explicit weighted-sum objective:
//   cost = w_wait * ETA
//        + w_detour * projected route deviation
//        + w_onboardDelay * approx delay to existing onboard passengers
//        + w_capacityRisk * (load^3)   (risk of arriving full)
//        + w_energy * energy proxy delta
//        + w_cluster * clustering count
// Weights are configurable; sensible defaults live in dispatch/index.ts.
export const costFunction: DispatchStrategy = {
  id: "cost",
  name: "Cost-Function Optimised",
  description:
    "Weighted-sum objective covering wait time, route deviation, onboard delay, capacity risk, energy proxy, and elevator clustering. Weights are user-configurable.",
  assignCall(state, call) {
    const w = state.config.strategy.weights;
    const capacity = state.config.elevator.capacity;

    let bestCost = Infinity;
    let bestIdx = 0;

    for (let i = 0; i < state.elevators.length; i++) {
      const e = state.elevators[i];
      const eta = estimatePickupSeconds(state, e, call.floor, call.direction);
      const load01 = e.passengers.length / capacity;
      const capacityRisk = Math.pow(load01, 3);
      const cluster = clusteringPenalty(state, i, call.floor);

      // Route deviation: extra travel over a hypothetical direct trip.
      const directDistance = Math.abs(e.currentFloor - call.floor);
      const routeDeviation = Math.max(
        0,
        eta / state.config.elevator.floorTravelSeconds - directDistance,
      );

      // Onboard delay: extra seconds we'd add to each existing passenger's
      // journey by inserting this stop.
      const onboardDelay = e.passengers.length * (routeDeviation * 0.5);

      // Energy proxy delta: each additional stop and door cycle adds cost.
      const energyDelta =
        Math.abs(e.currentFloor - call.floor) * 1 + 3; // one extra door cycle

      const cost =
        w.wait * eta +
        w.detour * routeDeviation +
        w.onboardDelay * onboardDelay +
        w.capacityRisk * capacityRisk +
        w.energy * energyDelta +
        w.cluster * cluster;

      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }
    return bestIdx;
  },
};
