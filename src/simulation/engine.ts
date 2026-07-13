import {
  Direction,
  ElevatorSnapshot,
  HallCall,
  Passenger,
  SimulationConfig,
  SimulationState,
  StrategyMetrics,
} from "../types";
import {
  getDemandProfile,
  groundFloorIndex,
  populationScale,
  totalFloorCount,
} from "./demand";
import { mulberry32 } from "./rng";
import { strategyRegistry } from "./dispatch/all";

// -----------------------------------------------------------------------------
// Engine — deterministic given (config, seed).
// Fine-tick advance (default dt = 0.5s) with an event-driven feel: hall calls
// are dispatched instantly on arrival, elevator state transitions fire when
// per-state timers elapse.
// -----------------------------------------------------------------------------

const DT = 0.5;

interface EngineInternal {
  rand: () => number;
  demand: ReturnType<typeof getDemandProfile>;
  arrivalCarryover: number; // fractional expected arrivals from last tick
  elevatorService: { timeRemaining: number }[]; // per-elevator service timer
  elevatorDirectionIntent: Direction[]; // next direction picked at each stop
  // Bookkeeping for waiting time chart aggregation.
  bucketSeconds: number;
  waitAccumulator: number[]; // waits recorded this bucket
  utilAccumulator: number; // sum of "busy" per tick
  utilTicks: number;
  buildingFloors: number;
}

export interface RunResult {
  state: SimulationState;
  metrics: StrategyMetrics;
}

export class Engine {
  state: SimulationState;
  private internal: EngineInternal;

  constructor(config: SimulationConfig) {
    const totalFloors = totalFloorCount(config.building);
    const rand = mulberry32(config.traffic.seed);
    const demand = getDemandProfile(config.traffic);

    const elevators: ElevatorSnapshot[] = [];
    for (let i = 0; i < config.elevator.count; i++) {
      const rawHome =
        config.elevator.idleParkingFloors[
          i % Math.max(1, config.elevator.idleParkingFloors.length)
        ] ?? groundFloorIndex(config.building);
      const home = Math.max(0, Math.min(totalFloors - 1, rawHome));
      elevators.push({
        id: i,
        state: "IDLE",
        currentFloor: home,
        targetFloor: null,
        direction: "idle",
        passengers: [],
        stopQueue: [],
        destinationCounts: {},
        floorsTravelled: 0,
        stops: 0,
        doorCycles: 0,
        idleSeconds: 0,
        activeSeconds: 0,
        emptyTravelFloors: 0,
        homeFloor: home,
      });
    }

    const waitingByFloor: Record<number, Passenger[]> = {};
    for (let f = 0; f < totalFloors; f++) waitingByFloor[f] = [];

    this.state = {
      time: 0,
      config,
      elevators,
      hallCalls: [],
      waitingByFloor,
      waitingByFloorDir: {},
      completedPassengers: [],
      generatedCount: 0,
      finished: false,
      timeline: [],
      elevatorTrace: [],
      odMatrix: Array.from({ length: totalFloors }, () =>
        Array(totalFloors).fill(0),
      ),
      nextIds: { passenger: 0, hallCall: 0 },
    };

    this.internal = {
      rand,
      demand,
      arrivalCarryover: 0,
      elevatorService: elevators.map(() => ({ timeRemaining: 0 })),
      elevatorDirectionIntent: elevators.map(() => "idle"),
      bucketSeconds: 30,
      waitAccumulator: [],
      utilAccumulator: 0,
      utilTicks: 0,
      buildingFloors: totalFloors,
    };
  }

  // -------- Public loop control -------------------------------------------

  /** Advance the simulation by `simSeconds` of simulated time. */
  advance(simSeconds: number) {
    const steps = Math.max(1, Math.round(simSeconds / DT));
    for (let i = 0; i < steps; i++) this.tick(DT);
  }

  /** Run the simulation until traffic duration is reached AND all passengers
   *  currently in the building have finished their journeys. */
  runToCompletion(maxExtraSeconds = 3600) {
    const cfg = this.state.config;
    while (this.state.time < cfg.traffic.durationSeconds) this.tick(DT);
    const stopAt = this.state.time + maxExtraSeconds;
    while (this.state.time < stopAt && !this.everyoneDone()) this.tick(DT);
    this.state.finished = true;
  }

  reset(seed?: number) {
    const cfg = this.state.config;
    if (seed !== undefined) cfg.traffic.seed = seed;
    const fresh = new Engine(cfg);
    this.state = fresh.state;
    this.internal = fresh.internal;
  }

  everyoneDone() {
    for (const q of Object.values(this.state.waitingByFloor))
      if (q.length > 0) return false;
    for (const e of this.state.elevators) if (e.passengers.length > 0) return false;
    return true;
  }

  metrics(strategyId = this.state.config.strategy.id): StrategyMetrics {
    return computeMetrics(this.state, strategyId);
  }

  // -------- Tick ----------------------------------------------------------

  private tick(dt: number) {
    const s = this.state;
    const cfg = s.config;

    // 1. Generate arrivals via non-homogeneous Poisson (thinning).
    if (s.time < cfg.traffic.durationSeconds) this.generateArrivals(dt);

    // 2. Advance every elevator's state machine.
    for (let i = 0; i < s.elevators.length; i++) this.stepElevator(i, dt);

    // 3. Time series bookkeeping every `bucketSeconds`.
    this.internal.utilAccumulator += this.currentBusyCount();
    this.internal.utilTicks += 1;
    if (Math.floor((s.time + dt) / this.internal.bucketSeconds) !==
        Math.floor(s.time / this.internal.bucketSeconds)) {
      this.flushBucket();
    }

    s.time += dt;
  }

  // -------- Passenger arrivals --------------------------------------------

  private generateArrivals(dt: number) {
    const s = this.state;
    const cfg = s.config;
    const meanPerHour = this.internal.demand.meanArrivalsPerHour(
      s.time,
      cfg.traffic.durationSeconds,
    );
    // Scale arrival rate linearly with building population so config changes
    // (floors × units × residents) actually move the traffic.
    const popFactor = populationScale(cfg.building);
    const lambda = (meanPerHour / 3600) * cfg.traffic.intensity * popFactor;
    // Per-tick expected count. Take the deterministic integer part and
    // treat the fractional remainder as a single Bernoulli. This preserves
    // fractional λ·dt in expectation without accumulating a running carryover
    // (which would double-count arrivals).
    const expected = lambda * dt;
    let whole = Math.floor(expected);
    const frac = expected - whole;
    if (this.internal.rand() < frac) whole += 1;

    for (let k = 0; k < whole; k++) this.spawnPassenger();
  }

  private spawnPassenger() {
    const s = this.state;
    const b = s.config.building;
    const { origin, destination } = this.internal.demand.sampleOD(
      this.internal.rand,
      b,
      s.time,
      s.config.traffic.durationSeconds,
    );
    if (origin === destination) return;
    const direction: "up" | "down" = destination > origin ? "up" : "down";
    const p: Passenger = {
      id: s.nextIds.passenger++,
      originFloor: origin,
      destinationFloor: destination,
      direction,
      arrivalTime: s.time,
      assignedElevator: null,
      boardingTime: null,
      arrivalAtDestinationTime: null,
      hallCallId: -1,
    };
    s.waitingByFloor[origin].push(p);
    s.generatedCount++;
    s.odMatrix[origin][destination]++;

    // Look for an existing pending hall call at this floor+direction.
    let call = s.hallCalls.find(
      (c) =>
        c.floor === origin &&
        c.direction === direction &&
        c.servedAt === null &&
        c.assignedElevator !== null,
    );
    if (!call) {
      call = {
        id: s.nextIds.hallCall++,
        floor: origin,
        direction,
        createdAt: s.time,
        assignedElevator: null,
        servedAt: null,
      };
      s.hallCalls.push(call);
      // Dispatch.
      const strat = strategyRegistry[s.config.strategy.id];
      const assigned = strat.assignCall(s, call);
      call.assignedElevator = assigned;
      const elev = s.elevators[assigned];
      addStop(elev, origin);
      // Wake it up if idle.
      if (elev.state === "IDLE") this.wakeElevator(assigned);
    }
    p.hallCallId = call.id;
    p.assignedElevator = call.assignedElevator;
  }

  // -------- Elevator state machine ----------------------------------------

  private stepElevator(idx: number, dt: number) {
    const s = this.state;
    const e = s.elevators[idx];
    const svc = this.internal.elevatorService[idx];
    const cfg = s.config.elevator;

    switch (e.state) {
      case "IDLE": {
        e.idleSeconds += dt;
        if (e.stopQueue.length > 0) this.wakeElevator(idx);
        else {
          // Optional: drift toward home floor if adaptive strategy asks.
          const strat = strategyRegistry[s.config.strategy.id];
          if (strat.suggestIdleHome) {
            const home = strat.suggestIdleHome(s, e);
            if (home !== null && home !== e.homeFloor) e.homeFloor = home;
          }
          if (Math.abs(e.currentFloor - e.homeFloor) > 0.05) {
            e.state = e.homeFloor > e.currentFloor ? "MOVING_UP" : "MOVING_DOWN";
            e.direction = e.state === "MOVING_UP" ? "up" : "down";
            e.targetFloor = e.homeFloor;
          }
        }
        break;
      }

      case "MOVING_UP":
      case "MOVING_DOWN": {
        e.activeSeconds += dt;
        const dir = e.state === "MOVING_UP" ? 1 : -1;
        const before = e.currentFloor;
        e.currentFloor += (dir * dt) / cfg.floorTravelSeconds;
        e.floorsTravelled += Math.abs(e.currentFloor - before);
        if (e.passengers.length === 0)
          e.emptyTravelFloors += Math.abs(e.currentFloor - before);

        const target = e.targetFloor ?? e.stopQueue[0];
        const reached =
          (dir === 1 && e.currentFloor >= target) ||
          (dir === -1 && e.currentFloor <= target);
        if (reached) {
          e.currentFloor = target;
          e.state = "DOOR_OPENING";
          svc.timeRemaining = cfg.doorOpenSeconds;
          e.doorCycles += 1;
        }
        break;
      }

      case "DOOR_OPENING": {
        e.activeSeconds += dt;
        svc.timeRemaining -= dt;
        if (svc.timeRemaining <= 0) {
          // Compute alighting + boarding, decide effective boarding time.
          this.doAlightAndBoard(idx);
          e.state = "BOARDING";
          // svc.timeRemaining already set inside doAlightAndBoard.
        }
        break;
      }

      case "BOARDING": {
        e.activeSeconds += dt;
        svc.timeRemaining -= dt;
        if (svc.timeRemaining <= 0) {
          e.state = "DOOR_CLOSING";
          svc.timeRemaining = cfg.doorCloseSeconds;
        }
        break;
      }

      case "DOOR_CLOSING": {
        e.activeSeconds += dt;
        svc.timeRemaining -= dt;
        if (svc.timeRemaining <= 0) {
          // Departure penalty (acceleration) added as a small standstill:
          svc.timeRemaining = cfg.accelerationPenaltySeconds;
          this.pickNextStop(idx);
        }
        break;
      }
    }
  }

  private currentBusyCount() {
    let c = 0;
    for (const e of this.state.elevators) if (e.state !== "IDLE") c++;
    return c;
  }

  private wakeElevator(idx: number) {
    const s = this.state;
    const e = s.elevators[idx];
    if (e.stopQueue.length === 0) {
      e.state = "IDLE";
      e.direction = "idle";
      e.targetFloor = null;
      return;
    }
    this.pickNextStop(idx);
  }

  private pickNextStop(idx: number) {
    const s = this.state;
    const e = s.elevators[idx];
    if (e.stopQueue.length === 0) {
      e.state = "IDLE";
      e.direction = "idle";
      e.targetFloor = null;
      e.stops += 1;
      return;
    }
    // Collective control: keep going in current direction if any stops
    // remain that way; otherwise reverse.
    let candidate: number | null = null;
    if (e.direction === "up") {
      candidate = smallestAbove(e.stopQueue, e.currentFloor);
      if (candidate === null) {
        candidate = largestBelow(e.stopQueue, e.currentFloor);
        e.direction = candidate !== null ? "down" : "idle";
      }
    } else if (e.direction === "down") {
      candidate = largestBelow(e.stopQueue, e.currentFloor);
      if (candidate === null) {
        candidate = smallestAbove(e.stopQueue, e.currentFloor);
        e.direction = candidate !== null ? "up" : "idle";
      }
    } else {
      // Idle → pick nearest
      let best = e.stopQueue[0];
      let bestDist = Math.abs(best - e.currentFloor);
      for (const f of e.stopQueue) {
        const d = Math.abs(f - e.currentFloor);
        if (d < bestDist) {
          best = f;
          bestDist = d;
        }
      }
      candidate = best;
      e.direction = best > e.currentFloor ? "up" : best < e.currentFloor ? "down" : "idle";
    }
    if (candidate === null) {
      e.state = "IDLE";
      e.direction = "idle";
      e.targetFloor = null;
      return;
    }
    if (Math.abs(candidate - e.currentFloor) < 0.01) {
      // Already there — snap and open doors.
      e.currentFloor = candidate;
      e.state = "DOOR_OPENING";
      this.internal.elevatorService[idx].timeRemaining =
        s.config.elevator.doorOpenSeconds;
      e.doorCycles += 1;
      e.targetFloor = candidate;
      return;
    }
    e.targetFloor = candidate;
    e.state = e.direction === "up" ? "MOVING_UP" : "MOVING_DOWN";
    e.stops += 1;
  }

  private doAlightAndBoard(idx: number) {
    const s = this.state;
    const e = s.elevators[idx];
    const cfg = s.config.elevator;
    const floor = e.currentFloor;

    // Alight all passengers whose destination = this floor.
    const staying: Passenger[] = [];
    let alighted = 0;
    for (const p of e.passengers) {
      if (Math.abs(p.destinationFloor - floor) < 0.01) {
        p.arrivalAtDestinationTime = s.time;
        s.completedPassengers.push(p);
        alighted += 1;
      } else {
        staying.push(p);
      }
    }
    e.passengers = staying;
    // Recompute destinationCounts.
    e.destinationCounts = {};
    for (const p of e.passengers) {
      e.destinationCounts[p.destinationFloor] =
        (e.destinationCounts[p.destinationFloor] ?? 0) + 1;
    }
    // Remove this floor from stopQueue.
    e.stopQueue = e.stopQueue.filter((f) => Math.abs(f - floor) > 0.01);

    // Determine boarding direction. If there's still stops in current dir,
    // keep it; else reverse; else any direction (fresh idle).
    let boardDir: "up" | "down" | null = null;
    if (e.direction === "up") {
      if (smallestAbove(e.stopQueue, floor) !== null) boardDir = "up";
      else if (largestBelow(e.stopQueue, floor) !== null) boardDir = "down";
    } else if (e.direction === "down") {
      if (largestBelow(e.stopQueue, floor) !== null) boardDir = "down";
      else if (smallestAbove(e.stopQueue, floor) !== null) boardDir = "up";
    }

    // Load waiters at this floor whose direction matches (or any if boardDir null).
    const floorKey = Math.round(floor);
    if (!s.waitingByFloor[floorKey]) s.waitingByFloor[floorKey] = [];
    const queue = s.waitingByFloor[floorKey];
    const boarded: Passenger[] = [];
    for (let i = 0; i < queue.length && e.passengers.length < cfg.capacity; i++) {
      const p = queue[i];
      if (boardDir === null || p.direction === boardDir) {
        p.boardingTime = s.time;
        p.assignedElevator = idx;
        e.passengers.push(p);
        boarded.push(p);
        addStop(e, p.destinationFloor);
        if (boardDir === null) boardDir = p.direction;
      }
    }
    // Remove boarded passengers from queue.
    if (boarded.length > 0) {
      s.waitingByFloor[floorKey] = queue.filter((p) => !boarded.includes(p));
      // Mark associated hall call served if now empty for this direction.
      const stillWaitingSameDir = s.waitingByFloor[floorKey].some(
        (p) => p.direction === boardDir,
      );
      if (!stillWaitingSameDir) {
        for (const call of s.hallCalls) {
          if (
            call.floor === floorKey &&
            call.direction === boardDir &&
            call.servedAt === null
          ) {
            call.servedAt = s.time;
          }
        }
      }
      // Record waits for chart.
      for (const p of boarded) {
        this.internal.waitAccumulator.push(
          (p.boardingTime ?? s.time) - p.arrivalTime,
        );
      }
    }

    // If elevator direction became clear (had none), commit it.
    if (e.direction === "idle" && boardDir) e.direction = boardDir;

    // Boarding time cost.
    const svcTime =
      alighted * cfg.alightSecondsPerPassenger +
      boarded.length * cfg.boardSecondsPerPassenger;
    this.internal.elevatorService[idx].timeRemaining = Math.max(0.1, svcTime);
  }

  private flushBucket() {
    const s = this.state;
    const bucketWaits = this.internal.waitAccumulator;
    const avgWait =
      bucketWaits.length > 0
        ? bucketWaits.reduce((a, b) => a + b, 0) / bucketWaits.length
        : this.state.timeline.length > 0
          ? this.state.timeline[this.state.timeline.length - 1].avgWait
          : 0;
    const util =
      this.internal.utilTicks > 0
        ? this.internal.utilAccumulator /
          (this.internal.utilTicks * s.elevators.length)
        : 0;
    let waiting = 0;
    for (const q of Object.values(s.waitingByFloor)) waiting += q.length;
    s.timeline.push({
      time: s.time,
      avgWait,
      waiting,
      utilisation: util,
    });
    s.elevatorTrace.push({
      time: s.time,
      floors: s.elevators.map((e) => e.currentFloor),
    });
    this.internal.waitAccumulator = [];
    this.internal.utilAccumulator = 0;
    this.internal.utilTicks = 0;
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function addStop(e: ElevatorSnapshot, floor: number) {
  if (e.stopQueue.some((f) => Math.abs(f - floor) < 0.01)) return;
  e.stopQueue.push(floor);
}

function smallestAbove(list: number[], threshold: number): number | null {
  let best: number | null = null;
  for (const v of list) {
    if (v > threshold + 0.01 && (best === null || v < best)) best = v;
  }
  return best;
}

function largestBelow(list: number[], threshold: number): number | null {
  let best: number | null = null;
  for (const v of list) {
    if (v < threshold - 0.01 && (best === null || v > best)) best = v;
  }
  return best;
}

// -----------------------------------------------------------------------------
// Metrics
// -----------------------------------------------------------------------------

export function computeMetrics(
  state: SimulationState,
  strategyId: StrategyMetrics["strategyId"],
): StrategyMetrics {
  const completed = state.completedPassengers;
  const waits = completed.map(
    (p) => (p.boardingTime ?? p.arrivalTime) - p.arrivalTime,
  );
  const journeys = completed.map(
    (p) =>
      (p.arrivalAtDestinationTime ?? 0) - (p.boardingTime ?? p.arrivalTime),
  );
  const totals = completed.map(
    (p) => (p.arrivalAtDestinationTime ?? 0) - p.arrivalTime,
  );

  const p = (arr: number[], q: number) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
    return sorted[idx];
  };

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const mean = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);

  const floorsTravelled = sum(state.elevators.map((e) => e.floorsTravelled));
  const totalStops = sum(state.elevators.map((e) => e.stops));
  const doorCycles = sum(state.elevators.map((e) => e.doorCycles));
  const emptyTravelFloors = sum(
    state.elevators.map((e) => e.emptyTravelFloors),
  );

  let maxQueue = 0;
  for (const q of Object.values(state.waitingByFloor))
    if (q.length > maxQueue) maxQueue = q.length;

  let maxLoad = 0;
  for (const e of state.elevators) if (e.passengers.length > maxLoad) maxLoad = e.passengers.length;
  const avgLoad = mean(state.elevators.map((e) => e.passengers.length));

  const totalTime = Math.max(state.time, 1);
  const utilisation = mean(state.elevators.map((e) => e.activeSeconds / totalTime));

  // Energy proxy — see methodology page for the formula.
  const energyProxy =
    floorsTravelled * 1.0 +
    totalStops * 2.5 +
    doorCycles * 1.5 +
    emptyTravelFloors * 1.2;

  let waiting = 0;
  for (const q of Object.values(state.waitingByFloor)) waiting += q.length;

  return {
    strategyId,
    strategyLabel: strategyId,
    passengersGenerated: state.generatedCount,
    passengersCompleted: completed.length,
    passengersWaiting: waiting,
    avgWait: mean(waits),
    medianWait: p(waits, 0.5),
    p90Wait: p(waits, 0.9),
    p95Wait: p(waits, 0.95),
    maxWait: waits.length ? Math.max(...waits) : 0,
    avgJourney: mean(journeys),
    avgTotal: mean(totals),
    utilisation,
    avgLoad,
    maxLoad,
    maxQueue,
    floorsTravelled,
    totalStops,
    doorCycles,
    emptyTravelFloors,
    energyProxy,
  };
}
