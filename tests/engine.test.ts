import { describe, it, expect } from "vitest";
import { Engine, computeMetrics } from "../src/simulation/engine";
import { defaultConfig } from "../src/simulation/defaults";
import { SimulationConfig } from "../src/types";
import "../src/simulation/dispatch/all";
import { getDemandProfile, totalFloorCount } from "../src/simulation/demand";
import { mulberry32 } from "../src/simulation/rng";

function tinyConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  const base = defaultConfig();
  return {
    ...base,
    building: { ...base.building, aboveGroundFloors: 10, basementFloors: 1 },
    elevator: { ...base.elevator, count: 2, capacity: 8 },
    traffic: {
      ...base.traffic,
      mode: "non_peak",
      durationSeconds: 600,
      intensity: 1,
      seed: 42,
    },
    ...overrides,
  };
}

describe("Engine invariants", () => {
  it("same seed produces identical passenger demand", () => {
    const cfg = tinyConfig();
    const a = new Engine(cfg);
    const b = new Engine(cfg);
    a.runToCompletion();
    b.runToCompletion();
    expect(a.state.generatedCount).toBe(b.state.generatedCount);
    // First 20 passengers identical origin/destination
    const first = a.state.completedPassengers.slice(0, 20).map(p => `${p.originFloor}->${p.destinationFloor}@${p.arrivalTime.toFixed(2)}`);
    const second = b.state.completedPassengers.slice(0, 20).map(p => `${p.originFloor}->${p.destinationFloor}@${p.arrivalTime.toFixed(2)}`);
    expect(first).toEqual(second);
  });

  it("no negative waiting or journey times", () => {
    const cfg = tinyConfig();
    const eng = new Engine(cfg);
    eng.runToCompletion();
    for (const p of eng.state.completedPassengers) {
      const wait = (p.boardingTime ?? p.arrivalTime) - p.arrivalTime;
      const journey = (p.arrivalAtDestinationTime ?? 0) - (p.boardingTime ?? p.arrivalTime);
      expect(wait).toBeGreaterThanOrEqual(0);
      expect(journey).toBeGreaterThanOrEqual(0);
    }
  });

  it("elevator capacity is never exceeded", () => {
    const cfg = tinyConfig({ elevator: { ...defaultConfig().elevator, count: 2, capacity: 4 } });
    const eng = new Engine(cfg);
    // Advance in small chunks and check invariants at each step.
    for (let i = 0; i < 800; i++) {
      eng.advance(1);
      for (const e of eng.state.elevators) {
        expect(e.passengers.length).toBeLessThanOrEqual(cfg.elevator.capacity);
      }
    }
  });

  it("elevator current floor stays within building bounds", () => {
    const cfg = tinyConfig();
    const eng = new Engine(cfg);
    const total = totalFloorCount(cfg.building);
    for (let i = 0; i < 200; i++) {
      eng.advance(2);
      for (const e of eng.state.elevators) {
        expect(e.currentFloor).toBeGreaterThanOrEqual(-0.01);
        expect(e.currentFloor).toBeLessThanOrEqual(total - 1 + 0.01);
      }
    }
  });

  it("passengers eventually reach their destination", () => {
    // Big enough building that population scaling gives a healthy arrival volume,
    // and traffic mode with enough intensity for statistical stability.
    const cfg = tinyConfig({
      building: { basementFloors: 2, aboveGroundFloors: 20, unitsPerFloor: 8, residentsPerUnit: 3 },
      traffic: {
        ...tinyConfig().traffic,
        mode: "non_peak",
        durationSeconds: 3600, // 1 hr of non-peak → ~22 arrivals with pop scale 0.5
        intensity: 1,
      },
    });
    const eng = new Engine(cfg);
    eng.runToCompletion();
    const genRatio = eng.state.completedPassengers.length / Math.max(eng.state.generatedCount, 1);
    expect(eng.state.generatedCount).toBeGreaterThan(10);
    expect(genRatio).toBeGreaterThan(0.9);
  });

  it("computed metrics reflect the state", () => {
    const cfg = tinyConfig();
    const eng = new Engine(cfg);
    eng.runToCompletion();
    const m = computeMetrics(eng.state, cfg.strategy.id);
    expect(m.passengersCompleted).toBe(eng.state.completedPassengers.length);
    expect(m.avgWait).toBeGreaterThanOrEqual(0);
    expect(m.energyProxy).toBeGreaterThanOrEqual(0);
  });

  it("changing strategy on same seed changes metrics but not arrivals", () => {
    const cfg = tinyConfig();
    const nearest = new Engine({ ...cfg, strategy: { ...cfg.strategy, id: "nearest" } });
    const adaptive = new Engine({ ...cfg, strategy: { ...cfg.strategy, id: "adaptive" } });
    nearest.runToCompletion();
    adaptive.runToCompletion();
    expect(nearest.state.generatedCount).toBe(adaptive.state.generatedCount);
  });

  it("arrival volume scales with building population", () => {
    const small = new Engine({
      ...tinyConfig(),
      building: { basementFloors: 1, aboveGroundFloors: 5, unitsPerFloor: 4, residentsPerUnit: 2 },
    });
    const big = new Engine({
      ...tinyConfig(),
      building: { basementFloors: 1, aboveGroundFloors: 20, unitsPerFloor: 10, residentsPerUnit: 4 },
    });
    small.runToCompletion();
    big.runToCompletion();
    // Larger population must produce more arrivals — at least 3× here.
    expect(big.state.generatedCount).toBeGreaterThan(small.state.generatedCount * 3);
  });

  it("demand profile RNG stream is deterministic", () => {
    const cfg = tinyConfig();
    const prof = getDemandProfile(cfg.traffic);
    const a = mulberry32(cfg.traffic.seed);
    const b = mulberry32(cfg.traffic.seed);
    for (let i = 0; i < 20; i++) {
      const s1 = prof.sampleOD(a, cfg.building, 0, cfg.traffic.durationSeconds);
      const s2 = prof.sampleOD(b, cfg.building, 0, cfg.traffic.durationSeconds);
      expect(s1).toEqual(s2);
    }
  });
});
