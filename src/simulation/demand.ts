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

export function residentialFloorIndices(b: BuildingConfig): number[] {
  const g = groundFloorIndex(b);
  const out: number[] = [];
  for (let i = 1; i <= b.aboveGroundFloors; i++) out.push(g + i);
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
  return floors[Math.floor(rand() * floors.length)];
}

function pickBasementFloor(rand: () => number, b: BuildingConfig): number {
  const floors = basementFloorIndices(b);
  if (floors.length === 0) return groundFloorIndex(b);
  return floors[Math.floor(rand() * floors.length)];
}

// ---- Profiles ----------------------------------------------------------------

// Morning down-peak: residents leave residential floors → ground/basement.
const morningDownPeak: DemandProfile = {
  meanArrivalsPerHour: (t, dur) => {
    // Peak centred at 1/3 of simulated window (approx 8AM in a 7-9AM run).
    return 600 * (0.35 + 0.9 * bell(t, dur, 0.4, 0.22));
  },
  sampleOD: (rand, b) => {
    const origin = pickResidentialFloor(rand, b);
    const dest = pickWeighted(
      rand,
      ["ground", "basement", "other"],
      [0.7, 0.25, 0.05],
    );
    if (dest === "ground") return { origin, destination: groundFloorIndex(b) };
    if (dest === "basement")
      return { origin, destination: pickBasementFloor(rand, b) };
    let other = pickResidentialFloor(rand, b);
    while (other === origin) other = pickResidentialFloor(rand, b);
    return { origin, destination: other };
  },
};

// Evening up-peak: residents arrive at ground/basement → residential floors.
const eveningUpPeak: DemandProfile = {
  meanArrivalsPerHour: (t, dur) => {
    return 550 * (0.35 + 0.9 * bell(t, dur, 0.45, 0.25));
  },
  sampleOD: (rand, b) => {
    const from = pickWeighted(rand, ["ground", "basement"], [0.65, 0.35]);
    const origin =
      from === "ground" ? groundFloorIndex(b) : pickBasementFloor(rand, b);
    return { origin, destination: pickResidentialFloor(rand, b) };
  },
};

// Non-peak / interfloor: mixed low intensity.
const nonPeak: DemandProfile = {
  meanArrivalsPerHour: () => 90,
  sampleOD: (rand, b) => {
    const kind = pickWeighted(
      rand,
      ["down", "up", "interfloor", "basement"],
      [0.35, 0.35, 0.2, 0.1],
    );
    if (kind === "down") {
      return {
        origin: pickResidentialFloor(rand, b),
        destination: groundFloorIndex(b),
      };
    }
    if (kind === "up") {
      return {
        origin: groundFloorIndex(b),
        destination: pickResidentialFloor(rand, b),
      };
    }
    if (kind === "basement") {
      return {
        origin: pickResidentialFloor(rand, b),
        destination: pickBasementFloor(rand, b),
      };
    }
    // interfloor
    let a = pickResidentialFloor(rand, b);
    let d = pickResidentialFloor(rand, b);
    while (d === a) d = pickResidentialFloor(rand, b);
    return { origin: a, destination: d };
  },
};

// Lunch delivery spike: short concentrated surge to ground.
const lunchSpike: DemandProfile = {
  meanArrivalsPerHour: (t, dur) => 120 + 700 * bell(t, dur, 0.5, 0.08),
  sampleOD: (rand, b) => {
    const dir = pickWeighted(rand, ["down", "up"], [0.75, 0.25]);
    if (dir === "down") {
      return {
        origin: pickResidentialFloor(rand, b),
        destination: groundFloorIndex(b),
      };
    }
    return {
      origin: groundFloorIndex(b),
      destination: pickResidentialFloor(rand, b),
    };
  },
};

// Weekend: bi-modal (mid-morning + late-afternoon), more interfloor traffic.
const weekend: DemandProfile = {
  meanArrivalsPerHour: (t, dur) =>
    120 +
    260 * bell(t, dur, 0.3, 0.12) +
    240 * bell(t, dur, 0.75, 0.15),
  sampleOD: (rand, b) => {
    const kind = pickWeighted(
      rand,
      ["down", "up", "interfloor", "basement"],
      [0.28, 0.28, 0.3, 0.14],
    );
    if (kind === "down") {
      return {
        origin: pickResidentialFloor(rand, b),
        destination: groundFloorIndex(b),
      };
    }
    if (kind === "up") {
      return {
        origin: groundFloorIndex(b),
        destination: pickResidentialFloor(rand, b),
      };
    }
    if (kind === "basement") {
      return {
        origin: pickResidentialFloor(rand, b),
        destination: pickBasementFloor(rand, b),
      };
    }
    let a = pickResidentialFloor(rand, b);
    let d = pickResidentialFloor(rand, b);
    while (d === a) d = pickResidentialFloor(rand, b);
    return { origin: a, destination: d };
  },
};

// Extreme congestion stress-test.
const extreme: DemandProfile = {
  meanArrivalsPerHour: () => 1400,
  sampleOD: (rand, b) => {
    // Mixed direction, high volume.
    const dir = pickWeighted(rand, ["down", "up", "inter"], [0.45, 0.4, 0.15]);
    if (dir === "down")
      return {
        origin: pickResidentialFloor(rand, b),
        destination: groundFloorIndex(b),
      };
    if (dir === "up")
      return {
        origin: groundFloorIndex(b),
        destination: pickResidentialFloor(rand, b),
      };
    let a = pickResidentialFloor(rand, b);
    let d = pickResidentialFloor(rand, b);
    while (d === a) d = pickResidentialFloor(rand, b);
    return { origin: a, destination: d };
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
