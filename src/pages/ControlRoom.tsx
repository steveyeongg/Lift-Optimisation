import React from "react";
import { KpiCards } from "../components/KpiCards";
import { BuildingView } from "../components/BuildingView";
import { ElevatorDetail } from "../components/ElevatorDetail";
import { SimulationState, StrategyMetrics } from "../types";
import { QueueByFloor, WaitingTimeTrend, ElevatorUtilisation } from "../components/Charts";
import { fmtClock } from "../utils/format";

interface Props {
  state: SimulationState;
  metrics: StrategyMetrics;
}

export function ControlRoom({ state, metrics }: Props) {
  const [sel, setSel] = React.useState<number | null>(0);
  return (
    <div className="p-4 space-y-3">
      <div className="card p-3 flex items-center justify-between">
        <div>
          <div className="section-title">Operations Control Room</div>
          <div className="text-xs text-white/50">
            Live status · Sim clock {fmtClock(state.time)} · Strategy:{" "}
            <span className="text-accent-cyan">{state.config.strategy.id}</span>
          </div>
        </div>
        <div className="flex gap-4 text-xs">
          <Metric label="Utilisation" value={`${(metrics.utilisation * 100).toFixed(0)}%`} />
          <Metric label="Queued" value={`${metrics.passengersWaiting}`} />
          <Metric label="Waiting P95" value={`${metrics.p95Wait.toFixed(0)}s`} />
        </div>
      </div>

      <KpiCards metrics={metrics} simTime={state.time} />

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 xl:col-span-5">
          <BuildingView state={state} selectedElevator={sel} onSelectElevator={setSel} />
        </div>
        <div className="col-span-12 xl:col-span-3">
          <ElevatorDetail state={state} index={sel} />
        </div>
        <div className="col-span-12 xl:col-span-4 space-y-3">
          <WaitingTimeTrend state={state} />
          <ElevatorUtilisation state={state} />
          <QueueByFloor state={state} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="font-mono text-lg">{value}</div>
    </div>
  );
}
