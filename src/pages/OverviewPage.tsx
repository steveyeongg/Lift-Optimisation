import React, { useState } from "react";
import { SimulationConfig, StrategyId, StrategyMetrics, TrafficMode } from "../types";
import { ALL_STRATEGIES } from "../simulation/dispatch/all";
import { Engine } from "../simulation/engine";
import { fmtSeconds } from "../utils/format";

// ─── One-click analysis: every strategy × three traffic scenarios ───────────
// Designed for building managers with no vendor data: uses only the building
// shape configured in the app, and produces a plain-English verdict.

interface ScenarioResult {
  mode: TrafficMode;
  label: string;
  results: StrategyMetrics[]; // sorted best → worst
}

interface Analysis {
  scenarios: ScenarioResult[];
  overallWinner: { id: StrategyId; label: string; wins: number };
  baselineAvgWait: number; // averaged across scenarios (Nearest)
  winnerAvgWait: number;   // averaged across scenarios (winner)
}

const SCENARIOS: { mode: TrafficMode; label: string; duration: number }[] = [
  { mode: "morning_down_peak", label: "Morning Peak (going to work)", duration: 5400 },
  { mode: "evening_up_peak", label: "Evening Peak (coming home)", duration: 5400 },
  { mode: "non_peak", label: "Non-Peak (daytime)", duration: 5400 },
];

function scoreOf(m: StrategyMetrics) {
  return (
    0.4 * (m.avgWait / 60) +
    0.25 * (m.p95Wait / 180) +
    0.15 * (m.avgJourney / 120) +
    0.1 * (m.energyProxy / 20000) +
    0.1 * (m.maxQueue / 30)
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function OverviewPage({ config }: { config: SimulationConfig }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const run = async () => {
    setRunning(true);
    setAnalysis(null);
    const scenarios: ScenarioResult[] = [];
    const winCount: Record<string, number> = {};

    for (const sc of SCENARIOS) {
      const results: StrategyMetrics[] = [];
      for (const strat of ALL_STRATEGIES) {
        setProgress(`${sc.label} — testing "${strat.name}"…`);
        await new Promise((r) => setTimeout(r, 0)); // let the UI paint
        const eng = new Engine({
          ...config,
          traffic: { ...config.traffic, mode: sc.mode, durationSeconds: sc.duration },
          strategy: { ...config.strategy, id: strat.id },
        });
        eng.runToCompletion();
        const m = eng.metrics(strat.id);
        m.strategyLabel = strat.name;
        results.push(m);
      }
      results.sort((a, z) => scoreOf(a) - scoreOf(z));
      winCount[results[0].strategyId] = (winCount[results[0].strategyId] ?? 0) + 1;
      scenarios.push({ mode: sc.mode, label: sc.label, results });
    }

    // Overall winner = most scenario wins; tie-break by total score.
    const totals: Record<string, number> = {};
    for (const sc of scenarios)
      for (const m of sc.results) totals[m.strategyId] = (totals[m.strategyId] ?? 0) + scoreOf(m);
    const winnerId = (Object.keys(winCount).sort(
      (a, b) => (winCount[b] - winCount[a]) || (totals[a] - totals[b]),
    )[0] ?? scenarios[0].results[0].strategyId) as StrategyId;
    const winnerLabel =
      ALL_STRATEGIES.find((s) => s.id === winnerId)?.name ?? winnerId;

    const avgOf = (id: string) =>
      scenarios.reduce((sum, sc) => {
        const m = sc.results.find((r) => r.strategyId === id)!;
        return sum + m.avgWait;
      }, 0) / scenarios.length;

    setAnalysis({
      scenarios,
      overallWinner: { id: winnerId, label: winnerLabel, wins: winCount[winnerId] ?? 0 },
      baselineAvgWait: avgOf("nearest"),
      winnerAvgWait: avgOf(winnerId),
    });
    setProgress("");
    setRunning(false);
  };

  const improvementPct = analysis
    ? ((analysis.baselineAvgWait - analysis.winnerAvgWait) / Math.max(analysis.baselineAvgWait, 0.001)) * 100
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Hero */}
      <div className="card p-6">
        <h1 className="text-xl font-semibold text-white">
          Which lift setting is best for my building?
        </h1>
        <p className="text-sm text-white/60 mt-2 leading-relaxed max-w-3xl">
          This tool simulates a full day of resident traffic in your building —
          morning rush, evening rush, and quiet hours — and tests{" "}
          <span className="text-white">7 different lift dispatch settings</span>{" "}
          against the exact same residents. You don't need any data from your
          lift vendor: just set your building shape in{" "}
          <span className="text-accent-cyan">Configuration</span> (floors, car
          park levels, facility floor) and press the button below.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn btn-primary text-base px-6 py-3" onClick={run} disabled={running}>
            {running ? "Analysing…" : "▶ Analyse My Building"}
          </button>
          {progress && <span className="text-xs text-accent-amber">{progress}</span>}
          {!running && !analysis && (
            <span className="text-xs text-white/40">Takes about 30–60 seconds.</span>
          )}
        </div>
      </div>

      {/* Verdict */}
      {analysis && (
        <>
          <div className="card p-6 border border-accent-cyan/30">
            <div className="section-title mb-1">Verdict</div>
            <div className="text-lg text-white">
              Best overall setting:{" "}
              <span className="text-accent-cyan font-semibold">
                {analysis.overallWinner.label}
              </span>{" "}
              <span className="text-white/50 text-sm">
                (won {analysis.overallWinner.wins} of {analysis.scenarios.length} scenarios)
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <VerdictStat
                label="Today's typical wait (Nearest-lift logic)"
                value={fmtSeconds(analysis.baselineAvgWait)}
                tone="bad"
              />
              <VerdictStat
                label={`Wait with ${analysis.overallWinner.label}`}
                value={fmtSeconds(analysis.winnerAvgWait)}
                tone="good"
              />
              <VerdictStat
                label="Improvement"
                value={`${improvementPct >= 0 ? "−" : "+"}${Math.abs(improvementPct).toFixed(0)}% waiting time`}
                tone={improvementPct >= 0 ? "good" : "bad"}
              />
            </div>
            <p className="text-xs text-white/50 mt-4 leading-relaxed">
              Both numbers come from the same simulated residents — the only thing
              that changed is the dispatch rule. This is a controller software
              setting, not a hardware change: no new lifts, no construction.
              Figures are simulated estimates based on your configured building
              shape and standard traffic patterns.
            </p>
          </div>

          {/* Per-scenario podium */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {analysis.scenarios.map((sc) => (
              <div key={sc.mode} className="card p-4">
                <div className="section-title mb-3">{sc.label}</div>
                <div className="space-y-2">
                  {sc.results.slice(0, 3).map((m, i) => (
                    <div
                      key={m.strategyId}
                      className={`flex items-center justify-between rounded-md px-2 py-1.5 ${
                        i === 0 ? "bg-accent-cyan/[0.08] border border-accent-cyan/25" : "bg-white/[0.02]"
                      }`}
                    >
                      <span className="text-xs">
                        {MEDALS[i]} {m.strategyLabel}
                      </span>
                      <span className="text-xs font-mono text-white/70">
                        wait {fmtSeconds(m.avgWait)}
                      </span>
                    </div>
                  ))}
                  {(() => {
                    const worst = sc.results[sc.results.length - 1];
                    return (
                      <div className="flex items-center justify-between rounded-md px-2 py-1.5 opacity-60">
                        <span className="text-xs">⚠ Worst: {worst.strategyLabel}</span>
                        <span className="text-xs font-mono">{fmtSeconds(worst.avgWait)}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>

          {/* What to do next */}
          <div className="card p-5">
            <div className="section-title mb-2">What to do with this result</div>
            <ol className="text-sm text-white/70 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Open <span className="text-accent-cyan">Compare Strategies</span> and run the full
                benchmark — it shows the detailed numbers behind this verdict, exportable to CSV.
              </li>
              <li>
                Open <span className="text-accent-cyan">Simulation</span>, pick the winning strategy,
                and press Play — you can visually show management the difference in queue build-up.
              </li>
              <li>
                Present the improvement number to management. The change being requested is a{" "}
                <em>dispatch-logic configuration</em> in the lift controller — the kind of setting a
                maintenance contractor can review during the next scheduled service, with no new
                hardware.
              </li>
            </ol>
          </div>
        </>
      )}

      {/* Plain-English strategy guide */}
      <div className="card p-5">
        <div className="section-title mb-3">The 7 settings, in plain English</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STRATEGY_GUIDE.map((s) => (
            <div key={s.name} className="rounded-lg border border-white/[0.07] p-3">
              <div className="text-sm text-white font-medium">{s.name}</div>
              <div className="text-xs text-white/55 mt-1 leading-relaxed">{s.plain}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const STRATEGY_GUIDE = [
  {
    name: "Nearest Elevator (baseline)",
    plain:
      "Sends whichever lift is physically closest — even if it's busy going the other way. This is why a 'near' lift sometimes sails past you. Most likely what a poorly-configured building runs today.",
  },
  {
    name: "Direction-Aware Collective",
    plain:
      "Classic lift logic: prefer a lift already heading your way, then an idle lift, then anything else. The standard in most well-set-up buildings.",
  },
  {
    name: "Estimated Time of Arrival",
    plain:
      "Instead of distance, it calculates which lift will actually reach you soonest — counting its queued stops and door time. Fixes the 'nearest but never arrives' problem.",
  },
  {
    name: "Load-Aware ETA",
    plain:
      "Same as ETA, but avoids sending a lift that's already almost full — so it doesn't arrive with no space and leave you waiting again.",
  },
  {
    name: "Soft Zoning",
    plain:
      "Each lift 'owns' a band of floors (like express vs local). Simple to explain to residents, but rigid when traffic is uneven.",
  },
  {
    name: "Peak-Hour Adaptive",
    plain:
      "Changes behaviour by time of day: parks lifts high before the morning rush, keeps one at the lobby in the evening, spreads out at quiet times. What premium buildings run.",
  },
  {
    name: "Cost-Function Optimised",
    plain:
      "A tunable formula balancing waiting time, detours, crowding, and energy. The Optimisation Lab can auto-tune it. The most advanced option.",
  },
];

function VerdictStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] p-3">
      <div className="text-[11px] text-white/50">{label}</div>
      <div
        className="text-xl font-mono mt-1"
        style={{ color: tone === "good" ? "#8fd14f" : "#ef4d6a" }}
      >
        {value}
      </div>
    </div>
  );
}
