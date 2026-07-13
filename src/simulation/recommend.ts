import { RecommendationBlock, SimulationConfig, StrategyMetrics, TrafficMode } from "../types";
import { floorLabel } from "./defaults";
import { Engine } from "./engine";
import { ALL_STRATEGIES } from "./dispatch/all";

// Runs Nearest as baseline + all strategies against `cfg`, then produces a
// natural-language recommendation for the current traffic mode. All numeric
// impact figures come from the actual simulation runs.
export function buildRecommendation(
  cfg: SimulationConfig,
): { recommendation: RecommendationBlock; metrics: StrategyMetrics[]; best: StrategyMetrics } {
  const metrics: StrategyMetrics[] = [];
  for (const strat of ALL_STRATEGIES) {
    const eng = new Engine({ ...cfg, strategy: { ...cfg.strategy, id: strat.id } });
    eng.runToCompletion();
    const m = eng.metrics(strat.id);
    m.strategyLabel = strat.name;
    metrics.push(m);
  }
  const baseline = metrics.find((m) => m.strategyId === "nearest")!;
  const best = metrics
    .slice()
    .sort((a, z) => scoreOf(a) - scoreOf(z))[0];

  const impact = (v: number, b: number) => {
    if (b <= 0) return "0%";
    const d = ((v - b) / b) * 100;
    return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
  };

  const windowByMode: Record<TrafficMode, string> = {
    morning_down_peak: "07:00 – 09:00",
    evening_up_peak: "17:30 – 20:30",
    non_peak: "10:00 – 16:00",
    lunch_spike: "12:00 – 13:30",
    weekend: "All day",
    extreme: "Stress test",
    custom: "Custom window",
  };
  const titleByMode: Record<TrafficMode, string> = {
    morning_down_peak: "Recommended Morning Peak Strategy",
    evening_up_peak: "Recommended Evening Peak Strategy",
    non_peak: "Recommended Non-Peak Strategy",
    lunch_spike: "Recommended Lunch-Spike Strategy",
    weekend: "Recommended Weekend Strategy",
    extreme: "Recommended Peak Overflow Strategy",
    custom: "Recommended Custom Strategy",
  };

  const initialPositions = [] as { elevator: string; floor: string }[];
  const N = cfg.elevator.count;
  for (let i = 0; i < N; i++) {
    initialPositions.push({
      elevator: `Lift ${String.fromCharCode(65 + i)}`,
      floor: floorLabel(cfg.building, cfg.elevator.idleParkingFloors[i] ?? 0),
    });
  }

  const modeLogic: Record<TrafficMode, string[]> = {
    morning_down_peak: [
      "Prioritise downward calls originating from residential floors.",
      "Maintain distributed vertical coverage — one car per residential quartile.",
      "Penalise elevator clustering at the lobby after drop-offs.",
      "Use load-aware ETA assignment to avoid cars arriving already full.",
    ],
    evening_up_peak: [
      "Keep at least one car standing at the lobby and one near the basement.",
      "Prefer already-ascending cars for up-peak calls.",
      "Batch passengers with similar destination zones together.",
      "Delay dispatch of a nearly-empty lobby car if another car is inbound.",
    ],
    non_peak: [
      "Return idle cars to spread parking floors.",
      "Use nearest-suitable dispatch to minimise travel.",
      "Reduce unnecessary movement — do not reposition unless demand emerges.",
    ],
    lunch_spike: [
      "Bias idle parking toward the lobby.",
      "Use load-aware ETA to prevent overshoot on packed cars.",
      "Recover to distributed parking once the spike subsides.",
    ],
    weekend: [
      "Spread idle cars across the shaft to serve interfloor traffic.",
      "Use cost-function dispatch with balanced weights.",
      "No lobby reservation is needed outside brief morning/evening bursts.",
    ],
    extreme: [
      "Enable load-aware ETA with aggressive capacity penalty.",
      "Maintain lobby coverage; overflow cars answer basement calls.",
      "Fall back to cost-function dispatch as queues build.",
    ],
    custom: ["Tune the cost-function weights via the Configuration panel."],
  };

  const rec: RecommendationBlock = {
    title: titleByMode[cfg.traffic.mode],
    window: windowByMode[cfg.traffic.mode],
    dispatchMode: best.strategyLabel,
    initialPositions,
    operationalLogic: modeLogic[cfg.traffic.mode],
    expectedImpact: [
      `${impact(best.avgWait, baseline.avgWait)} average waiting time vs Nearest baseline`,
      `${impact(best.p95Wait, baseline.p95Wait)} P95 waiting time`,
      `${impact(best.floorsTravelled, baseline.floorsTravelled)} floors travelled`,
      `${impact(best.energyProxy, baseline.energyProxy)} energy-proxy score`,
    ],
  };
  return { recommendation: rec, metrics, best };
}

function scoreOf(m: StrategyMetrics) {
  return (
    0.4 * (m.avgWait / 60) +
    0.25 * (m.p95Wait / 180) +
    0.15 * (m.avgJourney / 120) +
    0.1 * (m.energyProxy / 20000) +
    0.1 * (m.maxQueue / 30)
  );
}
