import React from "react";
import { SimulationState } from "../types";
import { floorLabel } from "../simulation/defaults";
import { fmtSeconds, fmtInt } from "../utils/format";

interface Props {
  state: SimulationState;
  index: number | null;
}
export function ElevatorDetail({ state, index }: Props) {
  if (index === null) {
    return (
      <div className="card p-4 h-full">
        <div className="section-title mb-2">Elevator Detail</div>
        <div className="text-xs text-white/50">
          Select an elevator to inspect its route, load, and assignments.
        </div>
      </div>
    );
  }
  const e = state.elevators[index];
  const cap = state.config.elevator.capacity;
  const b = state.config.building;
  const loadPct = ((e.passengers.length / cap) * 100).toFixed(0);
  const upcoming = [...e.stopQueue].sort((a, z) => a - z);
  return (
    <div className="card p-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-title">Lift {String.fromCharCode(65 + index)}</div>
          <div className="text-xs text-white/50 mt-0.5">
            {e.state.replaceAll("_", " ")} · {floorLabel(b, Math.round(e.currentFloor))}
          </div>
        </div>
        <div className="text-right text-xs font-mono">
          <div className="text-accent-cyan">{loadPct}% load</div>
          <div className="text-white/40">
            {e.passengers.length}/{cap}
          </div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-white/70 space-y-1 font-mono">
        <div>Direction: <span className="text-white">{e.direction}</span></div>
        <div>Floors travelled: <span className="text-white">{fmtInt(e.floorsTravelled)}</span></div>
        <div>Stops: <span className="text-white">{fmtInt(e.stops)}</span></div>
        <div>Door cycles: <span className="text-white">{fmtInt(e.doorCycles)}</span></div>
        <div>Active: <span className="text-white">{fmtSeconds(e.activeSeconds)}</span></div>
        <div>Idle: <span className="text-white">{fmtSeconds(e.idleSeconds)}</span></div>
      </div>

      <div className="mt-3">
        <div className="section-title mb-1">Upcoming stops</div>
        <div className="flex gap-1 flex-wrap">
          {upcoming.length === 0 && (
            <span className="text-[11px] text-white/40">None</span>
          )}
          {upcoming.map((f, i) => (
            <span key={i} className="chip">
              {floorLabel(b, Math.round(f))}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="section-title mb-1">Onboard destinations</div>
        <div className="flex gap-1 flex-wrap">
          {Object.keys(e.destinationCounts).length === 0 && (
            <span className="text-[11px] text-white/40">Empty</span>
          )}
          {Object.entries(e.destinationCounts).map(([f, c]) => (
            <span key={f} className="chip">
              {floorLabel(b, Number(f))} · {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
