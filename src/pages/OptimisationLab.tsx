import React, { useState } from "react";
import {
  DEFAULT_OBJECTIVE_WEIGHTS,
  ObjectiveWeights,
  optimise,
  OptimiserProgress,
  scoreMetrics,
} from "../simulation/optimiser";
import { SimulationConfig, StrategyMetrics } from "../types";
import { Engine } from "../simulation/engine";
import { fmtFloat, fmtSeconds } from "../utils/format";
import { floorLabel } from "../simulation/defaults";

interface Props {
  baseConfig: SimulationConfig;
  onApply: (cfg: SimulationConfig) => void;
}

export function OptimisationLab({ baseConfig, onApply }: Props) {
  const [iterations, setIterations] = useState(30);
  const [seedCount, setSeedCount] = useState(1);
  const [objective, setObjective] = useState<ObjectiveWeights>({ ...DEFAULT_OBJECTIVE_WEIGHTS });
  const [progress, setProgress] = useState<OptimiserProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [baseline, setBaseline] = useState<StrategyMetrics | null>(null);

  const run = async () => {
    setRunning(true);
    setProgress(null);

    // Compute a baseline first (Nearest strategy) for improvement comparison.
    const baseSeeds = Array.from({ length: seedCount }, (_, i) =>
      baseConfig.traffic.seed + i * 97,
    );
    const baseMetrics: StrategyMetrics[] = [];
    for (const seed of baseSeeds) {
      const eng = new Engine({
        ...baseConfig,
        traffic: { ...baseConfig.traffic, seed },
        strategy: { ...baseConfig.strategy, id: "nearest" },
      });
      eng.runToCompletion();
      baseMetrics.push(eng.metrics("nearest"));
    }
    const baseAvg = averageMetrics(baseMetrics);
    setBaseline(baseAvg);
    await new Promise((r) => setTimeout(r, 0));

    // Run search asynchronously via small chunks so UI can update.
    const runSearch = () =>
      new Promise<void>((resolve) => {
        const total = iterations;
        let done = 0;
        const doChunk = () => {
          const chunk = Math.min(2, total - done);
          if (chunk <= 0) return resolve();
          const partial = optimise(baseConfig, {
            iterations: chunk,
            seedSweep: baseSeeds,
            objective,
            onProgress: (p) => {
              done += 0; // handled below
              setProgress((prev) => {
                if (!prev) return { ...p, iteration: (done + p.iteration) };
                if (p.bestScore < prev.bestScore) {
                  return { ...p, iteration: done + p.iteration, totalIterations: total };
                }
                return { ...prev, iteration: done + p.iteration, totalIterations: total, currentScore: p.currentScore };
              });
            },
          });
          done += chunk;
          setTimeout(doChunk, 0);
          void partial;
        };
        doChunk();
      });

    await runSearch();
    setRunning(false);
  };

  const applyBest = () => {
    if (!progress) return;
    onApply(progress.bestConfig);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="card p-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="section-title">Optimisation Lab</div>
          <div className="text-xs text-white/50">
            Random search over the cost-function weights, averaged over multiple
            seeds against the objective below.
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={running} onClick={run}>
            {running ? "Searching…" : `▶ Search ${iterations} configs`}
          </button>
          <button className="btn" disabled={!progress} onClick={applyBest}>
            Apply best to simulator
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-3">
          <div className="section-title mb-2">Search settings</div>
          <label className="text-[11px] text-white/60 block mb-2">
            Iterations
            <input
              type="number"
              className="input mt-1"
              min={5}
              max={200}
              value={iterations}
              onChange={(e) => setIterations(+e.target.value)}
            />
          </label>
          <label className="text-[11px] text-white/60 block">
            Seeds to average over
            <input
              type="number"
              className="input mt-1"
              min={1}
              max={5}
              value={seedCount}
              onChange={(e) => setSeedCount(+e.target.value)}
            />
          </label>
        </div>

        <div className="card p-3">
          <div className="section-title mb-2">Objective weights</div>
          <div className="grid grid-cols-2 gap-2">
            {(["avgWait", "p95Wait", "journey", "energy", "maxQueue"] as const).map((k) => (
              <label key={k} className="text-[11px] text-white/60">
                {k}
                <input
                  type="number"
                  className="input mt-1"
                  step={0.05}
                  min={0}
                  max={1}
                  value={objective[k]}
                  onChange={(e) =>
                    setObjective({ ...objective, [k]: +e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <div className="text-[10px] text-white/40 mt-2">
            Lower score = better.
          </div>
        </div>

        <div className="card p-3">
          <div className="section-title mb-2">Progress</div>
          {progress ? (
            <>
              <ProgressLine
                label="Iteration"
                value={`${progress.iteration}/${progress.totalIterations}`}
              />
              <ProgressLine
                label="Best score"
                value={fmtFloat(progress.bestScore, 3)}
              />
              <ProgressLine
                label="Latest score"
                value={fmtFloat(progress.currentScore, 3)}
              />
            </>
          ) : (
            <div className="text-[11px] text-white/40">
              Run to see progress.
            </div>
          )}
        </div>
      </div>

      {baseline && progress && (
        <div className="card p-3">
          <div className="section-title mb-2">Improvement vs Nearest baseline</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ImprovementCard label="Avg wait" bv={baseline.avgWait} nv={progress.bestMetrics.avgWait} unit="s" />
            <ImprovementCard label="P95 wait" bv={baseline.p95Wait} nv={progress.bestMetrics.p95Wait} unit="s" />
            <ImprovementCard label="Energy proxy" bv={baseline.energyProxy} nv={progress.bestMetrics.energyProxy} />
            <ImprovementCard label="Max queue" bv={baseline.maxQueue} nv={progress.bestMetrics.maxQueue} />
          </div>
        </div>
      )}

      {progress && (
        <div className="card p-3">
          <div className="section-title mb-2">Best configuration</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12px] font-mono">
            {(["wait", "detour", "onboardDelay", "capacityRisk", "energy", "cluster"] as const).map((k) => (
              <div key={k} className="flex justify-between">
                <span className="text-white/50">{k}</span>
                <span>{fmtFloat(progress.bestConfig.strategy.weights[k], 3)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-white/50">
            Idle parking floors:{" "}
            {progress.bestConfig.elevator.idleParkingFloors
              .map((f) => floorLabel(progress.bestConfig.building, f))
              .join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-white/50">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
function ImprovementCard({
  label,
  bv,
  nv,
  unit = "",
}: {
  label: string;
  bv: number;
  nv: number;
  unit?: string;
}) {
  const delta = bv > 0 ? ((nv - bv) / bv) * 100 : 0;
  const good = delta < 0;
  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-lg font-mono mt-1">
        {unit === "s" ? fmtSeconds(nv) : fmtFloat(nv, 0)}
      </div>
      <div
        className={good ? "text-accent-lime text-xs" : "text-accent-rose text-xs"}
      >
        {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs baseline
      </div>
    </div>
  );
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
  };
}
