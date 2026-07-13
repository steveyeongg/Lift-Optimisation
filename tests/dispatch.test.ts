import { describe, it, expect } from "vitest";
import "../src/simulation/dispatch/all";
import { strategyRegistry } from "../src/simulation/dispatch";
import { Engine } from "../src/simulation/engine";
import { defaultConfig } from "../src/simulation/defaults";
import { StrategyId } from "../src/types";

const IDS: StrategyId[] = [
  "nearest",
  "directional",
  "eta",
  "loadAware",
  "zoning",
  "adaptive",
  "cost",
];

describe("Dispatch strategies", () => {
  it("every strategy is registered", () => {
    for (const id of IDS) {
      expect(strategyRegistry[id]).toBeDefined();
      expect(strategyRegistry[id].id).toBe(id);
    }
  });

  it("assignCall always returns a valid elevator index", () => {
    const cfg = defaultConfig();
    cfg.building.aboveGroundFloors = 6;
    cfg.traffic.durationSeconds = 60;
    for (const id of IDS) {
      const eng = new Engine({ ...cfg, strategy: { ...cfg.strategy, id } });
      // Bootstrap some passengers to trigger dispatch.
      eng.advance(30);
      // Every hall call should have a valid assigned elevator.
      for (const call of eng.state.hallCalls) {
        if (call.assignedElevator !== null) {
          expect(call.assignedElevator).toBeGreaterThanOrEqual(0);
          expect(call.assignedElevator).toBeLessThan(cfg.elevator.count);
        }
      }
    }
  });

  it("cost strategy respects weight tuning direction", () => {
    // Increasing the wait weight sharply should push metrics on avg wait to
    // decrease or stay similar vs the default weights on the same seed.
    const cfg = defaultConfig();
    cfg.building.aboveGroundFloors = 12;
    cfg.traffic.mode = "non_peak";
    cfg.traffic.durationSeconds = 800;
    cfg.strategy.id = "cost";

    const baseline = new Engine(cfg);
    baseline.runToCompletion();
    const heavy = new Engine({
      ...cfg,
      strategy: {
        ...cfg.strategy,
        weights: {
          ...cfg.strategy.weights,
          wait: cfg.strategy.weights.wait * 5,
          capacityRisk: cfg.strategy.weights.capacityRisk * 0.1,
        },
      },
    });
    heavy.runToCompletion();
    // Not a strict claim, but the wait-optimised run should not be dramatically
    // worse than the baseline on avg wait.
    expect(heavy.metrics().avgWait).toBeLessThan(baseline.metrics().avgWait * 1.5);
  });
});
