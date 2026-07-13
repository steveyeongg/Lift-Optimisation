import React from "react";
import { StrategyMetrics } from "../types";
import { fmtSeconds, fmtInt, fmtPct, fmtFloat } from "../utils/format";

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}
function Kpi({ label, value, hint, accent }: KpiProps) {
  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">
        {label}
      </div>
      <div
        className="kpi-value text-lg mt-0.5"
        style={{ color: accent ?? "#e8edf5" }}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-white/40 mt-0.5">{hint}</div>}
    </div>
  );
}

interface Props {
  metrics: StrategyMetrics;
  simTime: number;
}
export function KpiCards({ metrics, simTime }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
      <Kpi label="Generated" value={fmtInt(metrics.passengersGenerated)} />
      <Kpi label="Completed" value={fmtInt(metrics.passengersCompleted)} accent="#8fd14f" />
      <Kpi label="Waiting" value={fmtInt(metrics.passengersWaiting)} accent="#f0b429" />
      <Kpi label="Avg Wait" value={fmtSeconds(metrics.avgWait)} accent="#38e0d6" />
      <Kpi label="P90 Wait" value={fmtSeconds(metrics.p90Wait)} />
      <Kpi label="P95 Wait" value={fmtSeconds(metrics.p95Wait)} accent="#ef4d6a" />
      <Kpi label="Median Wait" value={fmtSeconds(metrics.medianWait)} />
      <Kpi label="Max Wait" value={fmtSeconds(metrics.maxWait)} />
      <Kpi label="Avg Journey" value={fmtSeconds(metrics.avgJourney)} />
      <Kpi label="Avg Total" value={fmtSeconds(metrics.avgTotal)} />
      <Kpi label="Utilisation" value={fmtPct(metrics.utilisation)} />
      <Kpi label="Avg Load" value={fmtFloat(metrics.avgLoad)} />
      <Kpi label="Max Load" value={fmtInt(metrics.maxLoad)} />
      <Kpi label="Max Queue" value={fmtInt(metrics.maxQueue)} />
      <Kpi label="Floors Travelled" value={fmtFloat(metrics.floorsTravelled, 0)} />
      <Kpi label="Total Stops" value={fmtInt(metrics.totalStops)} />
      <Kpi label="Door Cycles" value={fmtInt(metrics.doorCycles)} />
      <Kpi
        label="Energy Proxy"
        value={fmtFloat(metrics.energyProxy, 0)}
        accent="#8b7cff"
      />
    </div>
  );
}
