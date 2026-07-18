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
      <Kpi label="Generated" value={fmtInt(metrics.passengersGenerated)} hint="Residents who called a lift" />
      <Kpi label="Completed" value={fmtInt(metrics.passengersCompleted)} accent="#8fd14f" hint="Reached their floor" />
      <Kpi label="Waiting" value={fmtInt(metrics.passengersWaiting)} accent="#f0b429" hint="Still standing at a lift lobby" />
      <Kpi label="Avg Wait" value={fmtSeconds(metrics.avgWait)} accent="#38e0d6" hint="Typical wait for a lift" />
      <Kpi label="P90 Wait" value={fmtSeconds(metrics.p90Wait)} hint="9 in 10 wait less than this" />
      <Kpi label="P95 Wait" value={fmtSeconds(metrics.p95Wait)} accent="#ef4d6a" hint="19 in 20 wait less than this" />
      <Kpi label="Median Wait" value={fmtSeconds(metrics.medianWait)} hint="Half wait less than this" />
      <Kpi label="Max Wait" value={fmtSeconds(metrics.maxWait)} hint="Single worst wait recorded" />
      <Kpi label="Avg Journey" value={fmtSeconds(metrics.avgJourney)} hint="Time spent inside the lift" />
      <Kpi label="Avg Total" value={fmtSeconds(metrics.avgTotal)} hint="Wait + ride, door to door" />
      <Kpi label="Utilisation" value={fmtPct(metrics.utilisation)} hint="Share of time lifts are busy" />
      <Kpi label="Avg Load" value={fmtFloat(metrics.avgLoad)} hint="People aboard right now (avg)" />
      <Kpi label="Max Load" value={fmtInt(metrics.maxLoad)} hint="Fullest a lift got" />
      <Kpi label="Max Queue" value={fmtInt(metrics.maxQueue)} hint="Biggest crowd on one floor" />
      <Kpi label="Floors Travelled" value={fmtFloat(metrics.floorsTravelled, 0)} hint="Total lift movement (wear)" />
      <Kpi label="Total Stops" value={fmtInt(metrics.totalStops)} hint="Times any lift stopped" />
      <Kpi label="Door Cycles" value={fmtInt(metrics.doorCycles)} hint="Open/close events (wear)" />
      <Kpi
        label="Energy Proxy"
        value={fmtFloat(metrics.energyProxy, 0)}
        accent="#8b7cff"
        hint="Relative running cost (lower = better)"
      />
    </div>
  );
}
