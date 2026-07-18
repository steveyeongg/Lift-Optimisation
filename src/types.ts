// LiftOpt — shared domain types.
// The simulation engine is deterministic given (config, seed).

export type Direction = "up" | "down" | "idle";

export type ElevatorState =
  | "IDLE"
  | "MOVING_UP"
  | "MOVING_DOWN"
  | "DOOR_OPENING"
  | "BOARDING"
  | "DOOR_CLOSING";

export interface BuildingConfig {
  basementFloors: number;    // e.g. 3 → SB3, SB2, SB1
  aboveGroundFloors: number; // e.g. 44 → 1..44 (G is separate)
  unitsPerFloor: number;
  residentsPerUnit: number;
  // ─── Floor-role model ────────────────────────────────────────────────
  // parkingTopFloor: the highest above-ground floor that is part of the
  //   car park. Together with the basements, floors [0..basements+parkingTopFloor]
  //   form the parking range (e.g. 8 → SB3..L8). Ground floor is always
  //   inside the parking range.
  parkingTopFloor?: number;
  // facilityFloors: floor numbers (above-ground, 1-indexed) that anyone in
  //   the building can access (gym, sky lounge, function room). Residents
  //   ignore access-card restrictions to reach these.
  facilityFloors?: number[];
  // crossResidentialProbability: chance that a residential-origin trip has
  //   a residential destination other than parking/facility (i.e. a card
  //   holder visiting another unit). Small by default.
  crossResidentialProbability?: number;
}

export interface ElevatorConfig {
  count: number;
  capacity: number;                 // passengers
  floorTravelSeconds: number;       // seconds per floor at cruise
  doorOpenSeconds: number;
  doorCloseSeconds: number;
  boardSecondsPerPassenger: number;
  alightSecondsPerPassenger: number;
  accelerationPenaltySeconds: number; // added on every departure
  idleTimeoutSeconds: number;
  idleParkingFloors: number[];      // preferred parking floors (indices)
}

export type TrafficMode =
  | "morning_down_peak"
  | "evening_up_peak"
  | "non_peak"
  | "lunch_spike"
  | "weekend"
  | "extreme"
  | "custom";

export interface TrafficConfig {
  mode: TrafficMode;
  durationSeconds: number;          // total simulated seconds
  intensity: number;                // 0.1 – 3.0 multiplier on arrival rate
  seed: number;
  // Custom-mode overrides:
  customArrivalsPerHour?: number;
  customOriginBias?: "ground" | "basement" | "residential" | "uniform";
  customDestinationBias?: "ground" | "basement" | "residential" | "uniform";
  peakWindowStartSeconds?: number;
  peakWindowEndSeconds?: number;
}

export type StrategyId =
  | "nearest"
  | "directional"
  | "eta"
  | "loadAware"
  | "zoning"
  | "adaptive"
  | "cost";

export interface DispatchWeights {
  wait: number;         // estimated passenger wait time (s)
  detour: number;       // route deviation (floors)
  onboardDelay: number; // existing passenger delay (s)
  capacityRisk: number; // risk of arriving full
  energy: number;       // energy proxy
  cluster: number;      // elevator clustering penalty
}

export interface StrategyConfig {
  id: StrategyId;
  weights: DispatchWeights; // used by "cost" strategy
  zones?: number[][];       // zoning: array of floor-index arrays per elevator
}

export interface SimulationConfig {
  building: BuildingConfig;
  elevator: ElevatorConfig;
  traffic: TrafficConfig;
  strategy: StrategyConfig;
}

export interface HallCall {
  id: number;
  floor: number;         // floor index (0 = lowest basement)
  direction: "up" | "down";
  createdAt: number;     // simulation seconds
  assignedElevator: number | null;
  servedAt: number | null;
}

export interface Passenger {
  id: number;
  originFloor: number;
  destinationFloor: number;
  direction: "up" | "down";
  arrivalTime: number;
  assignedElevator: number | null;
  boardingTime: number | null;
  arrivalAtDestinationTime: number | null;
  hallCallId: number;
}

export interface ElevatorSnapshot {
  id: number;
  state: ElevatorState;
  currentFloor: number;          // fractional during travel
  targetFloor: number | null;
  direction: Direction;
  passengers: Passenger[];       // currently onboard
  stopQueue: number[];           // ordered floor indices to visit
  destinationCounts: Record<number, number>; // by floor
  floorsTravelled: number;
  stops: number;
  doorCycles: number;
  idleSeconds: number;
  activeSeconds: number;
  emptyTravelFloors: number;
  homeFloor: number;             // preferred parking (may change with adaptive)
}

export interface SimulationState {
  time: number;                  // simulation seconds
  config: SimulationConfig;
  elevators: ElevatorSnapshot[];
  hallCalls: HallCall[];
  waitingByFloor: Record<number, Passenger[]>; // by floor index → queue
  waitingByFloorDir: Record<string, Passenger[]>; // "floor:up" or "floor:down"
  completedPassengers: Passenger[];
  generatedCount: number;
  finished: boolean;
  // Time series buffers for charts
  timeline: {
    time: number;
    avgWait: number;
    waiting: number;
    utilisation: number;
  }[];
  elevatorTrace: {
    time: number;
    floors: number[]; // per elevator current floor
  }[];
  odMatrix: number[][]; // [origin][destination] passenger counts
  nextIds: {
    passenger: number;
    hallCall: number;
  };
}

export interface StrategyMetrics {
  strategyId: StrategyId;
  strategyLabel: string;
  passengersGenerated: number;
  passengersCompleted: number;
  passengersWaiting: number;
  avgWait: number;
  medianWait: number;
  p90Wait: number;
  p95Wait: number;
  maxWait: number;
  avgJourney: number;
  avgTotal: number;
  utilisation: number;
  avgLoad: number;
  maxLoad: number;
  maxQueue: number;
  floorsTravelled: number;
  totalStops: number;
  doorCycles: number;
  emptyTravelFloors: number;
  energyProxy: number;
}

// A named traffic-mode profile the demand generator can consume.
export interface DemandProfile {
  meanArrivalsPerHour: (t: number, durationSeconds: number) => number;
  sampleOD: (
    rand: () => number,
    building: BuildingConfig,
    t: number,
    duration: number,
  ) => { origin: number; destination: number };
}

export interface RecommendationBlock {
  title: string;
  window: string;
  dispatchMode: string;
  initialPositions: { elevator: string; floor: string }[];
  operationalLogic: string[];
  expectedImpact: string[];
}
