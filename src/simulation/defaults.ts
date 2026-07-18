import { SimulationConfig } from "../types";
import { DEFAULT_WEIGHTS } from "./dispatch/index";
import { buildZones } from "./dispatch/zoning";
import { groundFloorIndex, totalFloorCount } from "./demand";

export function defaultConfig(): SimulationConfig {
  const building = {
    basementFloors: 3,           // SB3, SB2, SB1
    aboveGroundFloors: 44,       // 1..44
    unitsPerFloor: 8,
    residentsPerUnit: 3,
    parkingTopFloor: 8,          // SB3..L8 are all car park
    facilityFloors: [9],         // L9 is the facility floor everyone can access
    crossResidentialProbability: 0.03,
  };
  const total = totalFloorCount(building);
  const ground = groundFloorIndex(building);
  const elevatorCount = 4;
  // Idle parking distribution: L1, L14, L27, L40 (rough quartiles).
  const idleParkingFloors = Array.from({ length: elevatorCount }, (_, i) =>
    Math.round(ground + 1 + (i / (elevatorCount - 1)) * (total - 1 - ground - 1)),
  );
  return {
    building,
    elevator: {
      count: elevatorCount,
      capacity: 15,
      floorTravelSeconds: 1.5,
      doorOpenSeconds: 2,
      doorCloseSeconds: 2,
      boardSecondsPerPassenger: 0.6,
      alightSecondsPerPassenger: 0.5,
      accelerationPenaltySeconds: 1,
      idleTimeoutSeconds: 30,
      idleParkingFloors,
    },
    traffic: {
      mode: "morning_down_peak",
      durationSeconds: 2 * 3600,
      intensity: 1,
      seed: 20260713,
    },
    strategy: {
      id: "adaptive",
      weights: { ...DEFAULT_WEIGHTS },
      zones: buildZones(total, elevatorCount),
    },
  };
}

// Human-friendly floor label. Index 0 = lowest basement, ground = basementFloors.
// Convention: SB3, SB2, SB1, G, 1, 2, ... — matches typical Singaporean/Malaysian
// condo signage.
export function floorLabel(
  building: SimulationConfig["building"],
  index: number,
): string {
  const g = building.basementFloors;
  if (index < g) return `SB${g - index}`;
  if (index === g) return "G";
  return `${index - g}`;
}
