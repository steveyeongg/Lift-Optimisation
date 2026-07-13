import { DispatchStrategy, estimatePickupSeconds } from "./index";

// Strategy E — Zoning.
// Elevators are (softly) assigned to vertical zones. Calls prefer the owning
// zone but can fall back to the least-busy elevator if the owning car is far.
export const zoning: DispatchStrategy = {
  id: "zoning",
  name: "Soft Zoning",
  description:
    "Divides floors into vertical zones per elevator. Prefers the owning zone but allows overflow when it would otherwise cause long waits.",
  assignCall(state, call) {
    const zones = state.config.strategy.zones ?? [];
    const N = state.elevators.length;

    let owner = -1;
    if (zones.length === N) {
      for (let i = 0; i < N; i++) {
        if (zones[i].includes(call.floor)) {
          owner = i;
          break;
        }
      }
    }

    // If no owner or owner is heavily loaded / far, allow overflow.
    const OVERFLOW_ETA_TOLERANCE = 45; // seconds

    let bestEta = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < N; i++) {
      const eta = estimatePickupSeconds(
        state,
        state.elevators[i],
        call.floor,
        call.direction,
      );
      const boost = i === owner ? -8 : 0; // owning zone gets a small bonus
      const score = eta + boost;
      if (score < bestEta) {
        bestEta = score;
        bestIdx = i;
      }
    }

    if (owner >= 0) {
      const ownerEta = estimatePickupSeconds(
        state,
        state.elevators[owner],
        call.floor,
        call.direction,
      );
      if (ownerEta - bestEta <= OVERFLOW_ETA_TOLERANCE) return owner;
    }
    return bestIdx;
  },
};

// Utility used by config UI: divides floor indices into N contiguous zones.
export function buildZones(totalFloors: number, elevators: number): number[][] {
  const zones: number[][] = Array.from({ length: elevators }, () => []);
  for (let f = 0; f < totalFloors; f++) {
    const owner = Math.floor((f * elevators) / totalFloors);
    zones[Math.min(owner, elevators - 1)].push(f);
  }
  return zones;
}
