import { DispatchWeights, SimulationConfig, StrategyMetrics } from "../types";
import { Engine } from "./engine";
import { DEFAULT_WEIGHTS } from "./dispatch/index";
import { mulberry32 } from "./rng";

export interface ObjectiveWeights {
  avgWait: number;
  p95Wait: number;
  journey: number;
  energy: number;
  maxQueue: number;
}

export const DEFAULT_OBJECTIVE_WEIGHTS: ObjectiveWeights = {
  avgWait: 0.4,
  p95Wait: 0.25,
  journey: 0.15,
  energy: 0.1,
  maxQueue: 0.1,
};

// Score is a normalised weighted sum (lower = better).
export function scoreMetrics(m: StrategyMetrics, w: ObjectiveWeights): number {
  const norm = (v: number, ref: number) => (ref <= 0 ? 0 : v / ref);
  return (
    w.avgWait * norm(m.avgWait, 60) +
    w.p95Wait * norm(m.p95Wait, 180) +
    w.journey * norm(m.avgJourney, 120) +
    w.energy * norm(m.energyProxy, 20000) +
    w.maxQueue * norm(m.maxQueue, 30)
  );
}

export interface OptimiserProgress {
  iteration: number;
  totalIterations: number;
  currentScore: number;
  bestScore: number;
  bestConfig: SimulationConfig;
  bestMetrics: StrategyMetrics;
  history: { score: number; metrics: StrategyMetrics }[];
}

export interface OptimiserOptions {
  iterations: number;
  seedSweep: number[];       // seeds to average over
  objective: ObjectiveWeights;
  onProgress?: (p: OptimiserProgress) => void;
}

// Randomly perturbs cost-function weights within [0.5, 2.5]× default.
function sampleWeights(rand: () => number): DispatchWeights {
  const jitter = (base: number) =>
    Math.max(0.01, base * (0.4 + rand() * 2.2));
  return {
    wait: jitter(DEFAULT_WEIGHTS.wait),
    detour: jitter(DEFAULT_WEIGHTS.detour),
    onboardDelay: jitter(DEFAULT_WEIGHTS.onboardDelay),
    capacityRisk: jitter(DEFAULT_WEIGHTS.capacityRisk),
    energy: jitter(DEFAULT_WEIGHTS.energy),
    cluster: jitter(DEFAULT_WEIGHTS.cluster),
  };
}

// Random-search optimiser over dispatch cost-function weights + idle parking.
// Baseline evaluation uses the config passed in; every candidate is tested on
// the SAME set of seeds → apples-to-apples comparison.
export function optimise(
  baseConfig: SimulationConfig,
  opts: OptimiserOptions,
): OptimiserProgress {
  const rand = mulberry32(baseConfig.traffic.seed ^ 0x9e3779b1);
  const evaluate = (cfg: SimulationConfig) => {
    const scoresPerSeed: StrategyMetrics[] = [];
    for (const seed of opts.seedSweep) {
      const eng = new Engine({
        ...cfg,
        traffic: { ...cfg.traffic, seed },
      });
      eng.runToCompletion();
      scoresPerSeed.push(eng.metrics());
    }
    // Average metrics.
    const avg = averageMetrics(scoresPerSeed);
    return { avg, score: scoreMetrics(avg, opts.objective) };
  };

  // Baseline: passed-in config.
  const baseline = evaluate({
    ...baseConfig,
    strategy: { ...baseConfig.strategy, id: "cost" },
  });
  let best = baseline;
  let bestConfig = baseConfig;
  const history: OptimiserProgress["history"] = [
    { score: baseline.score, metrics: baseline.avg },
  ];

  for (let i = 0; i < opts.iterations; i++) {
    const cand: SimulationConfig = {
      ...baseConfig,
      strategy: {
        ...baseConfig.strategy,
        id: "cost",
        weights: sampleWeights(rand),
      },
    };
    const evalRes = evaluate(cand);
    history.push({ score: evalRes.score, metrics: evalRes.avg });
    if (evalRes.score < best.score) {
      best = evalRes;
      bestConfig = cand;
    }
    opts.onProgress?.({
      iteration: i + 1,
      totalIterations: opts.iterations,
      currentScore: evalRes.score,
      bestScore: best.score,
      bestConfig,
      bestMetrics: best.avg,
      history,
    });
  }

  return {
    iteration: opts.iterations,
    totalIterations: opts.iterations,
    currentScore: history[history.length - 1].score,
    bestScore: best.score,
    bestConfig,
    bestMetrics: best.avg,
    history,
  };
}

function averageMetrics(list: StrategyMetrics[]): StrategyMetrics {
  const n = list.length;
  const zero = list[0];
  const mean = (key: keyof StrategyMetrics) =>
    list.reduce((s, m) => s + (m[key] as number), 0) / n;
  return {
    ...zero,
    passengersGenerated: mean("passengersGenerated"),
    passengersCompleted: mean("passengersCompleted"),
    passengersWaiting: mean("passengersWaiting"),
    avgWait: mean("avgWait"),
    medianWait: mean("medianWait"),
    p90Wait: mean("p90Wait"),
    p95Wait: mean("p95Wait"),
    maxWait: mean("maxWait"),
    avgJourney: mean("avgJourney"),
    avgTotal: mean("avgTotal"),
    utilisation: mean("utilisation"),
    avgLoad: mean("avgLoad"),
    maxLoad: mean("maxLoad"),
    maxQueue: mean("maxQueue"),
    floorsTravelled: mean("floorsTravelled"),
    totalStops: mean("totalStops"),
    doorCycles: mean("doorCycles"),
    emptyTravelFloors: mean("emptyTravelFloors"),
    energyProxy: mean("energyProxy"),
  } as StrategyMetrics;
}
