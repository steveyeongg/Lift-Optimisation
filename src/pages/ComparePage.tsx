import React, { useState } from "react";
import { SimulationConfig, StrategyId, StrategyMetrics } from "../types";
import { ALL_STRATEGIES } from "../simulation/dispatch/all";
import { Engine } from "../simulation/engine";
import { fmtSeconds, fmtInt, fmtFloat } from "../utils/format";
import { exportStrategiesCsv, download } from "../utils/csv";

interface Props {
  baseConfig: SimulationConfig;
  onApply: (id: StrategyId) => void;
}

const ALL_IDS: StrategyId[] = ALL_STRATEGIES.map((s) => s.id as StrategyId);

export function ComparePage({ baseConfig, onApply }: Props) {
  const [selected, setSelected] = useState<StrategyId[]>([
    "nearest",
    "directional",
    "eta",
    "loadAware",
    "adaptive",
    "cost",
  ]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<StrategyMetrics[]>([]);
  const [progress, setProgress] = useState<string>("");

  const toggle = (id: StrategyId) => {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  const run = async () => {
    setRunning(true);
    setResults([]);
    const out: StrategyMetrics[] = [];
    // Same seed & building + traffic → fair comparison.
    for (const id of selected) {
      setProgress(`Running ${id}…`);
      // yield to allow UI update
      await new Promise((r) => setTimeout(r, 0));
      const cfg: SimulationConfig = {
        ...baseConfig,
        strategy: { ...baseConfig.strategy, id },
      };
      const eng = new Engine(cfg);
      eng.runToCompletion();
      const m = eng.metrics(id);
      m.strategyLabel = ALL_STRATEGIES.find((s) => s.id === id)?.name ?? id;
      out.push(m);
      setResults([...out]);
    }
    setProgress("");
    setRunning(false);
  };

  const baseline = results.find((r) => r.strategyId === "nearest") ?? results[0];
  const improvement = (m: StrategyMetrics, key: keyof StrategyMetrics) => {
    if (!baseline || baseline === m) return "";
    const bv = baseline[key] as number;
    const v = m[key] as number;
    if (!isFinite(bv) || bv === 0) return "";
    const delta = ((v - bv) / bv) * 100;
    const good = delta < 0;
    return (
      <span
        className={good ? "text-accent-lime" : "text-accent-rose"}
        style={{ fontSize: 10 }}
      >
        {` ${good ? "↓" : "↑"}${Math.abs(delta).toFixed(1)}%`}
      </span>
    );
  };

  const bestBy = (key: keyof StrategyMetrics, higherIsBetter = false) => {
    if (results.length === 0) return null;
    return results.reduce((acc, m) => {
      const va = acc[key] as number;
      const vb = m[key] as number;
      return higherIsBetter ? (vb > va ? m : acc) : (vb < va ? m : acc);
    });
  };

  const bestWait = bestBy("avgWait");
  const bestP95 = bestBy("p95Wait");
  const bestEnergy = bestBy("energyProxy");
  const bestQueue = bestBy("maxQueue");
  const bestOverall = results.length
    ? results.reduce((acc, m) => {
        const scoreOf = (x: StrategyMetrics) =>
          0.4 * (x.avgWait / 60) +
          0.25 * (x.p95Wait / 180) +
          0.15 * (x.avgJourney / 120) +
          0.1 * (x.energyProxy / 20000) +
          0.1 * (x.maxQueue / 30);
        return scoreOf(m) < scoreOf(acc) ? m : acc;
      })
    : null;

  return (
    <div className="p-4 space-y-3">
      <div className="card p-3 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <div className="section-title">Compare Strategies</div>
          <div className="text-xs text-white/50">
            Every strategy runs against the SAME seeded passenger demand for an
            apples-to-apples benchmark.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-primary"
            onClick={run}
            disabled={running || selected.length === 0}
          >
            {running ? "Running…" : `▶ Run ${selected.length} strategies`}
          </button>
          <button
            className="btn"
            disabled={results.length === 0}
            onClick={() =>
              download("liftopt-strategies.csv", exportStrategiesCsv(results))
            }
          >
            ⤓ Export CSV
          </button>
        </div>
      </div>

      <div className="card p-3">
        <div className="section-title mb-2">Strategies to include</div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-2">
          {ALL_IDS.map((id) => {
            const meta = ALL_STRATEGIES.find((s) => s.id === id)!;
            const active = selected.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className={`text-left p-2 rounded-md border text-xs ${
                  active
                    ? "border-accent-cyan/60 bg-accent-cyan/[0.06]"
                    : "border-white/10 hover:border-white/25"
                }`}
              >
                {meta.name}
              </button>
            );
          })}
        </div>
        {progress && (
          <div className="mt-3 text-[11px] text-accent-amber">{progress}</div>
        )}
      </div>

      {results.length > 0 && (
        <>
          <div className="card overflow-x-auto scroll-area">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-white/50">
                  <Th>Strategy</Th>
                  <Th>Avg Wait</Th>
                  <Th>P95 Wait</Th>
                  <Th>Avg Journey</Th>
                  <Th>Max Queue</Th>
                  <Th>Floors</Th>
                  <Th>Energy</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const minOf = (key: keyof StrategyMetrics) =>
                    Math.min(...results.map((r) => r[key] as number));
                  const best = {
                    avgWait: minOf("avgWait"),
                    p95Wait: minOf("p95Wait"),
                    avgJourney: minOf("avgJourney"),
                    maxQueue: minOf("maxQueue"),
                    floorsTravelled: minOf("floorsTravelled"),
                    energyProxy: minOf("energyProxy"),
                  };
                  const isBest = (m: StrategyMetrics, key: keyof typeof best) =>
                    (m[key] as number) <= best[key] + 1e-9;
                  return results.map((m) => (
                    <tr key={m.strategyId} className="border-t border-white/[0.04]">
                      <Td accent>{m.strategyLabel}</Td>
                      <Td best={isBest(m, "avgWait")}>
                        {fmtSeconds(m.avgWait)}
                        {improvement(m, "avgWait")}
                      </Td>
                      <Td best={isBest(m, "p95Wait")}>
                        {fmtSeconds(m.p95Wait)}
                        {improvement(m, "p95Wait")}
                      </Td>
                      <Td best={isBest(m, "avgJourney")}>
                        {fmtSeconds(m.avgJourney)}
                        {improvement(m, "avgJourney")}
                      </Td>
                      <Td best={isBest(m, "maxQueue")}>
                        {fmtInt(m.maxQueue)}
                        {improvement(m, "maxQueue")}
                      </Td>
                      <Td best={isBest(m, "floorsTravelled")}>
                        {fmtInt(m.floorsTravelled)}
                        {improvement(m, "floorsTravelled")}
                      </Td>
                      <Td best={isBest(m, "energyProxy")}>
                        {fmtFloat(m.energyProxy, 0)}
                        {improvement(m, "energyProxy")}
                      </Td>
                      <Td>
                        <button className="btn" onClick={() => onApply(m.strategyId)}>
                          Apply
                        </button>
                      </Td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {bestOverall && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <BestCard label="Best Overall" name={bestOverall.strategyLabel} accent="#38e0d6" />
              <BestCard label="Best Waiting" name={bestWait?.strategyLabel ?? "—"} />
              <BestCard label="Best P95" name={bestP95?.strategyLabel ?? "—"} />
              <BestCard label="Best Queue Control" name={bestQueue?.strategyLabel ?? "—"} />
              <BestCard label="Best Energy Proxy" name={bestEnergy?.strategyLabel ?? "—"} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider font-medium">
      {children}
    </th>
  );
}
function Td({
  children,
  accent,
  best,
}: {
  children: React.ReactNode;
  accent?: boolean;
  best?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 ${accent ? "text-white" : "text-white/70"}`}
      style={
        best
          ? {
              background: "rgba(143, 209, 79, 0.10)",
              boxShadow: "inset 2px 0 0 #8fd14f",
            }
          : undefined
      }
      title={best ? "Best in this column" : undefined}
    >
      {best ? <span style={{ color: "#8fd14f" }}>{children}</span> : children}
    </td>
  );
}
function BestCard({
  label,
  name,
  accent,
}: {
  label: string;
  name: string;
  accent?: string;
}) {
  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">
        {label}
      </div>
      <div className="text-lg mt-1" style={{ color: accent ?? "#e8edf5" }}>
        {name}
      </div>
    </div>
  );
}
