import { BuildingConfig, DemandProfile, TrafficConfig } from "../types";
import { pickWeighted } from "./rng";

// Helper: bell-shaped surge factor centred at 0.5 with width w in [0,1] time.
function bell(t: number, duration: number, centre: number, width: number) {
  const x = (t / duration - centre) / width;
  return Math.exp(-x * x);
}

// Total number of floor slots (0 = lowest basement, groundIdx = ground floor).
export function totalFloorCount(b: BuildingConfig) {
  return b.basementFloors + 1 + b.aboveGroundFloors;
}

export function groundFloorIndex(b: BuildingConfig) {
  return b.basementFloors; // basement floors sit below ground
}

// Human-level number → floor index. `1` = L1, `-2` = SB2. G = 0.
function levelToIndex(b: BuildingConfig, level: number): number {
  return b.basementFloors + level;
}

// True facility floor set as GLOBAL indices.
function facilityIndices(b: BuildingConfig): number[] {
  const raw = b.facilityFloors ?? [];
  return raw
    .map((l) => levelToIndex(b, l))
    .filter((i) => i >= 0 && i < totalFloorCount(b));
}

// True car-park range as GLOBAL indices [0..parkingTopIndex], inclusive.
function parkingTopIndex(b: BuildingConfig): number {
  const top = b.parkingTopFloor;
  if (top === undefined) return groundFloorIndex(b); // legacy = only up to G
  return Math.min(levelToIndex(b, top), totalFloorCount(b) - 1);
}

export function parkingIndices(b: BuildingConfig): number[] {
  const out: number[] = [];
  const top = parkingTopIndex(b);
  for (let i = 0; i <= top; i++) out.push(i);
  return out;
}

export function residentialFloorIndices(b: BuildingConfig): number[] {
  const facility = new Set(facilityIndices(b));
  const parkTop = parkingTopIndex(b);
  const out: number[] = [];
  for (let i = parkTop + 1; i < totalFloorCount(b); i++) {
    if (!facility.has(i)) out.push(i);
  }
  return out;
}

export function basementFloorIndices(b: BuildingConfig): number[] {
  const out: number[] = [];
  for (let i = 0; i < b.basementFloors; i++) out.push(i);
  return out;
}

// Base building population — used to normalise arrival rates.
export function population(b: BuildingConfig) {
  return b.unitsPerFloor * b.residentsPerUnit * b.aboveGroundFloors;
}

// Reference condominium: 40 residential floors × 8 units × 3 residents = 960.
// All profile arrival rates are quoted for this reference building. A different
// building scales its arrival rate linearly with its own population — a 20-floor
// building generates half the arrivals, an 88-floor building nearly twice.
export const REFERENCE_POPULATION = 40 * 8 * 3;

export function populationScale(b: BuildingConfig): number {
  const pop = population(b);
  if (pop <= 0) return 0;
  // Gentle floor / ceiling so an extreme building doesn't produce zero or
  // absurd traffic when the user is exploring the config space.
  const raw = pop / REFERENCE_POPULATION;
  return Math.max(0.05, Math.min(4, raw));
}

function pickResidentialFloor(rand: () => number, b: BuildingConfig): number {
  const floors = residentialFloorIndices(b);
  if (floors.length === 0) return groundFloorIndex(b);
  return floors[Math.floor(rand() * floors.length)];
}

function pickBasementFloor(rand: () => number, b: BuildingConfig): number {
  const floors = basementFloorIndices(b);
  if (floors.length === 0) return groundFloorIndex(b);
  return floors[Math.floor(rand() * floors.length)];
}

// A parking destination weighted toward Ground (residents walking to lobby)
// and the rest spread across basement + above-ground car park floors.
function pickCarParkDestination(rand: () => number, b: BuildingConfig): number {
  const g = groundFloorIndex(b);
  const roll = rand();
  if (roll < 0.55) return g; // most people exit via GF
  const parking = parkingIndices(b).filter((i) => i !== g);
  if (parking.length === 0) return g;
  return parking[Math.floor(rand() * parking.length)];
}

// A parking origin — where an arriving resident enters the lift.
function pickCarParkOrigin(rand: () => number, b: BuildingConfig): number {
  const g = groundFloorIndex(b);
  // 65% arrive at GF, 35% at basement parking (matching the user's spec).
  if (rand() < 0.65) return g;
  const basements = basementFloorIndices(b);
  if (basements.length === 0) return g;
  return basements[Math.floor(rand() * basements.length)];
}

function pickFacilityFloor(rand: () => number, b: BuildingConfig): number | null {
  const idxs = facilityIndices(b);
  if (idxs.length === 0) return null;
  return idxs[Math.floor(rand() * idxs.length)];
}

// Access-aware residential-origin destination sampler.
// A resident at floor `origin` typically leaves for parking; sometimes for
// the facility; rarely to another residential floor (card holder visiting).
function residentDestination(
  rand: () => number,
  b: BuildingConfig,
  origin: number,
): number {
  const facility = pickFacilityFloor(rand, b);
  const crossProb = b.crossResidentialProbability ?? 0.03;
  const roll = rand();
  if (facility !== null && roll < 0.08) return facility;      // facility trips
  if (roll < 0.08 + crossProb) {                              // cross-residential
    const others = residentialFloorIndices(b).filter((f) => f !== origin);
    if (others.length > 0) return others[Math.floor(rand() * others.length)];
  }
  return pickCarParkDestination(rand, b);                      // default: car park
}

// ---- Profiles ----------------------------------------------------------------

// Morning down-peak: residents leave residential floors → parking / facility.
const morningDownPeak: DemandProfile = {
  meanArrivalsPerHour: (t, dur) => {
    // Peak centred at 1/3 of simulated window (approx 8AM in a 7-9AM run).
    return 600 * (0.35 + 0.9 * bell(t, dur, 0.4, 0.22));
  },
  sampleOD: (rand, b) => {
    const origin = pickResidentialFloor(rand, b);
    return { origin, destination: residentDestination(rand, b, origin) };
  },
};

// Evening up-peak: residents arrive from parking → residential floors (+ some
// to the facility floor for evening use).
const eveningUpPeak: DemandProfile = {
  meanArrivalsPerHour: (t, dur) => {
    return 550 * (0.35 + 0.9 * bell(t, dur, 0.45, 0.25));
  },
  sampleOD: (rand, b) => {
    const origin = pickCarParkOrigin(rand, b);
    const facility = pickFacilityFloor(rand, b);
    if (facility !== null && rand() < 0.1) return { origin, destination: facility };
    return { origin, destination: pickResidentialFloor(rand, b) };
  },
};

// Non-peak / interfloor: mixed low intensity respecting the access model.
const nonPeak: DemandProfile = {
  meanArrivalsPerHour: () => 90,
  sampleOD: (rand, b) => {
    const facility = pickFacilityFloor(rand, b);
    const kind = pickWeighted(
      rand,
      ["down", "up", "facilityUp", "facilityDown", "interfloor"],
      [0.4, 0.35, 0.1, 0.08, 0.07],
    );
    if (kind === "down") {
      // Resident → parking
      const origin = pickResidentialFloor(rand, b);
      return { origin, destination: pickCarParkDestination(rand, b) };
    }
    if (kind === "up") {
      // Arrival at parking → resident's floor
      return {
        origin: pickCarParkOrigin(rand, b),
        destination: pickResidentialFloor(rand, b),
      };
    }
    if (facility !== null && kind === "facilityUp") {
      // Someone going to the facility floor from parking or a residential floor.
      const originIsResidential = rand() < 0.6;
      return {
        origin: originIsResidential
          ? pickResidentialFloor(rand, b)
          : pickCarParkOrigin(rand, b),
        destination: facility,
      };
    }
    if (facility !== null && kind === "facilityDown") {
      // Leaving the facility.
      const destResidential = rand() < 0.55;
      return {
        origin: facility,
        destination: destResidential
          ? pickResidentialFloor(rand, b)
          : pickCarParkDestination(rand, b),
      };
    }
    // Card-holder cross-residential visit (rare).
    const a = pickResidentialFloor(rand, b);
    const others = residentialFloorIndices(b).filter((f) => f !== a);
    if (others.length === 0) {
      // Only one residential floor exists → fall back to a parking trip.
      return { origin: a, destination: pickCarParkDestination(rand, b) };
    }
    return { origin: a, destination: others[Math.floor(rand() * others.length)] };
  },
};

// Lunch delivery spike: short concentrated surge — residents down to GF for
// food delivery pickup, some incoming visitors going up to residents.
const lunchSpike: DemandProfile = {
  meanArrivalsPerHour: (t, dur) => 120 + 700 * bell(t, dur, 0.5, 0.08),
  sampleOD: (rand, b) => {
    const facility = pickFacilityFloor(rand, b);
    const dir = pickWeighted(rand, ["down", "up", "facility"], [0.7, 0.2, 0.1]);
    if (dir === "down") {
      return {
        origin: pickResidentialFloor(rand, b),
        destination: groundFloorIndex(b),
      };
    }
    if (dir === "up") {
      return {
        origin: groundFloorIndex(b),
        destination: pickResidentialFloor(rand, b),
      };
    }
    if (facility !== null) {
      return { origin: pickResidentialFloor(rand, b), destination: facility };
    }
    return { origin: pickResidentialFloor(rand, b), destination: groundFloorIndex(b) };
  },
};

// Weekend: bi-modal (mid-morning + late-afternoon), more facility use.
const weekend: DemandProfile = {
  meanArrivalsPerHour: (t, dur) =>
    120 +
    260 * bell(t, dur, 0.3, 0.12) +
    240 * bell(t, dur, 0.75, 0.15),
  sampleOD: (rand, b) => {
    const facility = pickFacilityFloor(rand, b);
    const kind = pickWeighted(
      rand,
      ["down", "up", "facilityUp", "facilityDown", "cross"],
      [0.3, 0.3, 0.15, 0.15, 0.1],
    );
    if (kind === "down") {
      return {
        origin: pickResidentialFloor(rand, b),
        destination: pickCarParkDestination(rand, b),
      };
    }
    if (kind === "up") {
      return {
        origin: pickCarParkOrigin(rand, b),
        destination: pickResidentialFloor(rand, b),
      };
    }
    if (facility !== null && kind === "facilityUp") {
      return {
        origin: rand() < 0.5 ? pickResidentialFloor(rand, b) : pickCarParkOrigin(rand, b),
        destination: facility,
      };
    }
    if (facility !== null && kind === "facilityDown") {
      return {
        origin: facility,
        destination: rand() < 0.5 ? pickResidentialFloor(rand, b) : pickCarParkDestination(rand, b),
      };
    }
    const a = pickResidentialFloor(rand, b);
    const others = residentialFloorIndices(b).filter((f) => f !== a);
    if (others.length === 0) {
      return { origin: a, destination: pickCarParkDestination(rand, b) };
    }
    return { origin: a, destination: others[Math.floor(rand() * others.length)] };
  },
};

// Extreme congestion stress-test — access rules still apply.
const extreme: DemandProfile = {
  meanArrivalsPerHour: () => 1400,
  sampleOD: (rand, b) => {
    const dir = pickWeighted(rand, ["down", "up", "facility"], [0.5, 0.4, 0.1]);
    if (dir === "down") {
      return {
        origin: pickResidentialFloor(rand, b),
        destination: pickCarParkDestination(rand, b),
      };
    }
    if (dir === "up") {
      return {
        origin: pickCarParkOrigin(rand, b),
        destination: pickResidentialFloor(rand, b),
      };
    }
    const facility = pickFacilityFloor(rand, b);
    if (facility !== null) {
      return { origin: pickCarParkOrigin(rand, b), destination: facility };
    }
    return { origin: pickCarParkOrigin(rand, b), destination: pickResidentialFloor(rand, b) };
  },
};

function customProfile(cfg: TrafficConfig): DemandProfile {
  const rate = cfg.customArrivalsPerHour ?? 300;
  const peakStart = cfg.peakWindowStartSeconds ?? 0;
  const peakEnd = cfg.peakWindowEndSeconds ?? cfg.durationSeconds;
  return {
    meanArrivalsPerHour: (t) => {
      const inPeak = t >= peakStart && t <= peakEnd;
      return inPeak ? rate : rate * 0.3;
    },
    sampleOD: (rand, b) => {
      const originBias = cfg.customOriginBias ?? "residential";
      const destBias = cfg.customDestinationBias ?? "ground";
      const pickFor = (bias: typeof originBias) => {
        switch (bias) {
          case "ground":
            return groundFloorIndex(b);
          case "basement":
            return pickBasementFloor(rand, b);
          case "residential":
            return pickResidentialFloor(rand, b);
          default: {
            const total = totalFloorCount(b);
            return Math.floor(rand() * total);
          }
        }
      };
      let origin = pickFor(originBias);
      let destination = pickFor(destBias);
      if (destination === origin) {
        // Avoid same-floor trips.
        destination = pickResidentialFloor(rand, b);
        if (destination === origin) destination = groundFloorIndex(b);
      }
      return { origin, destination };
    },
  };
}

export function getDemandProfile(cfg: TrafficConfig): DemandProfile {
  switch (cfg.mode) {
    case "morning_down_peak":
      return morningDownPeak;
    case "evening_up_peak":
      return eveningUpPeak;
    case "non_peak":
      return nonPeak;
    case "lunch_spike":
      return lunchSpike;
    case "weekend":
      return weekend;
    case "extreme":
      return extreme;
    case "custom":
      return customProfile(cfg);
  }
}
