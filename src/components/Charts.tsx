import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SimulationState } from "../types";
import { totalFloorCount } from "../simulation/demand";
import { floorLabel } from "../simulation/defaults";
import { fmtClock } from "../utils/format";

const AXIS = { stroke: "rgba(255,255,255,0.25)", tick: { fill: "rgba(255,255,255,0.5)", fontSize: 10 } };
const GRID = { stroke: "rgba(255,255,255,0.06)" };
const TOOLTIP_STYLE = {
  background: "#141a24",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
  color: "#e8edf5",
};

export function WaitingTimeTrend({ state }: { state: SimulationState }) {
  const data = state.timeline.map((t) => ({
    t: fmtClock(t.time),
    avgWait: Number(t.avgWait.toFixed(1)),
    waiting: t.waiting,
  }));
  return (
    <div className="card p-3 h-64">
      <div className="section-title mb-2">Waiting Time Trend</div>
      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gWait" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38e0d6" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#38e0d6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="t" {...AXIS} minTickGap={40} />
          <YAxis {...AXIS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#7c8798" }} />
          <Area type="monotone" dataKey="avgWait" stroke="#38e0d6" fill="url(#gWait)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WaitingDistribution({ state }: { state: SimulationState }) {
  const buckets = useMemo(() => {
    const bins = new Array<number>(24).fill(0); // 0-2s, 2-4s, ..., up to 46-48s
    const step = 5; // 5-second bins → covers 0..120s
    const b = new Array<number>(25).fill(0);
    const waits = state.completedPassengers.map(
      (p) => (p.boardingTime ?? p.arrivalTime) - p.arrivalTime,
    );
    for (const w of waits) {
      const idx = Math.min(Math.floor(w / step), b.length - 1);
      b[idx] += 1;
    }
    return b.map((count, i) => ({
      bucket: `${i * step}-${(i + 1) * step}s`,
      count,
    }));
  }, [state.completedPassengers.length]);
  return (
    <div className="card p-3 h-64">
      <div className="section-title mb-2">Waiting Time Distribution</div>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={buckets} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="bucket" {...AXIS} interval={2} />
          <YAxis {...AXIS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" fill="#8b7cff" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ElevatorUtilisation({ state }: { state: SimulationState }) {
  const totalTime = Math.max(state.time, 1);
  const data = state.elevators.map((e, i) => ({
    name: `Lift ${String.fromCharCode(65 + i)}`,
    utilisation: (e.activeSeconds / totalTime) * 100,
    load: e.passengers.length,
  }));
  return (
    <div className="card p-3 h-64">
      <div className="section-title mb-2">Elevator Utilisation (%)</div>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="name" {...AXIS} />
          <YAxis {...AXIS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="utilisation" fill="#f0b429" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function QueueByFloor({ state }: { state: SimulationState }) {
  const b = state.config.building;
  const total = totalFloorCount(b);
  const data: { label: string; waiting: number; floor: number }[] = [];
  for (let f = 0; f < total; f++) {
    const w = state.waitingByFloor[f]?.length ?? 0;
    if (w > 0 || f === b.basementFloors) {
      data.push({ label: floorLabel(b, f), waiting: w, floor: f });
    }
  }
  return (
    <div className="card p-3 h-64">
      <div className="section-title mb-2">Queue Length by Floor (live)</div>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} interval={2} />
          <YAxis {...AXIS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="waiting" fill="#ef4d6a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const CAR_COLORS = [
  "#38e0d6",
  "#f0b429",
  "#8b7cff",
  "#8fd14f",
  "#ef4d6a",
  "#5aa9ff",
  "#f47ec2",
  "#7cd6c8",
];

export function ElevatorTimeline({ state }: { state: SimulationState }) {
  const trace = state.elevatorTrace;
  const data = trace.map((t) => {
    const row: Record<string, number | string> = { t: fmtClock(t.time) };
    t.floors.forEach((f, i) => (row[`E${i}`] = Number(f.toFixed(1))));
    return row;
  });
  return (
    <div className="card p-3 h-72">
      <div className="section-title mb-2">Elevator Movement Timeline</div>
      <ResponsiveContainer width="100%" height="88%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="t" {...AXIS} minTickGap={40} />
          <YAxis {...AXIS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {state.elevators.map((_, i) => (
            <Line
              key={i}
              type="monotone"
              dataKey={`E${i}`}
              name={`Lift ${String.fromCharCode(65 + i)}`}
              stroke={CAR_COLORS[i % CAR_COLORS.length]}
              dot={false}
              strokeWidth={1.6}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OdHeatmap({ state }: { state: SimulationState }) {
  const b = state.config.building;
  const total = totalFloorCount(b);
  const mat = state.odMatrix;
  let max = 1;
  for (let i = 0; i < total; i++)
    for (let j = 0; j < total; j++) if (mat[i][j] > max) max = mat[i][j];
  const cellSize = 12;
  return (
    <div className="card p-3">
      <div className="section-title mb-2">Origin → Destination Heatmap</div>
      <div className="text-[10px] text-white/40 mb-2">
        Rows = origin (bottom→top). Columns = destination (left→right).
      </div>
      <div className="overflow-x-auto scroll-area">
        <svg
          width={cellSize * total + 40}
          height={cellSize * total + 30}
          style={{ minWidth: cellSize * total + 40 }}
        >
          {Array.from({ length: total }).map((_, ii) => {
            const i = total - 1 - ii;
            return (
              <text
                key={`ry${ii}`}
                x={0}
                y={ii * cellSize + cellSize - 2}
                fontSize={8}
                fill="rgba(255,255,255,0.4)"
              >
                {floorLabel(b, i)}
              </text>
            );
          })}
          {Array.from({ length: total }).map((_, j) => (
            <text
              key={`cx${j}`}
              x={30 + j * cellSize + 1}
              y={cellSize * total + 12}
              fontSize={7}
              fill="rgba(255,255,255,0.4)"
              transform={`rotate(-60, ${30 + j * cellSize + 2}, ${cellSize * total + 12})`}
            >
              {floorLabel(b, j)}
            </text>
          ))}
          {Array.from({ length: total }).map((_, ii) => {
            const i = total - 1 - ii;
            return Array.from({ length: total }).map((_, j) => {
              const v = mat[i][j];
              const intensity = Math.pow(v / max, 0.6);
              const color = `rgba(56,224,214,${intensity.toFixed(3)})`;
              return (
                <rect
                  key={`c${ii}-${j}`}
                  x={30 + j * cellSize}
                  y={ii * cellSize}
                  width={cellSize - 1}
                  height={cellSize - 1}
                  fill={color}
                >
                  <title>
                    {floorLabel(b, i)} → {floorLabel(b, j)}: {v}
                  </title>
                </rect>
              );
            });
          })}
        </svg>
      </div>
    </div>
  );
}
