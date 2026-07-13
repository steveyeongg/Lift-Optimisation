import React, { useMemo } from "react";
import { SimulationState } from "../types";
import { floorLabel } from "../simulation/defaults";
import { totalFloorCount } from "../simulation/demand";

interface Props {
  state: SimulationState;
  selectedElevator: number | null;
  onSelectElevator: (i: number | null) => void;
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

export function BuildingView({
  state,
  selectedElevator,
  onSelectElevator,
}: Props) {
  const b = state.config.building;
  const total = totalFloorCount(b);
  const floors = useMemo(
    () => Array.from({ length: total }, (_, i) => total - 1 - i),
    [total],
  );

  const rowH = 22;
  const shaftWidth = 46;
  const N = state.elevators.length;
  const gutter = 90; // floor label + waiting count

  return (
    <div className="card p-4 overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="section-title">Live Building</div>
          <div className="text-xs text-white/50">
            {b.aboveGroundFloors} floors · {b.basementFloors} basement ·{" "}
            {state.elevators.length} elevators
          </div>
        </div>
        <div className="flex gap-2 text-[11px]">
          {state.elevators.map((e, i) => (
            <button
              key={e.id}
              onClick={() =>
                onSelectElevator(selectedElevator === i ? null : i)
              }
              className={`px-2 py-1 rounded-md border transition-colors ${
                selectedElevator === i
                  ? "border-white/40 bg-white/[0.06]"
                  : "border-white/10 hover:border-white/25"
              }`}
              style={{ color: CAR_COLORS[i % CAR_COLORS.length] }}
            >
              Lift {String.fromCharCode(65 + i)}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-area overflow-y-auto pr-1" style={{ maxHeight: "70vh" }}>
        <div
          className="relative grid-backdrop rounded-lg"
          style={{
            width: gutter + N * shaftWidth + 20,
            minWidth: "100%",
          }}
        >
          {/* Shaft backgrounds */}
          {state.elevators.map((_, i) => (
            <div
              key={`shaft-${i}`}
              className="absolute top-0 bottom-0"
              style={{
                left: gutter + i * shaftWidth + 6,
                width: shaftWidth - 12,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.005))",
                borderLeft: "1px solid rgba(255,255,255,0.05)",
                borderRight: "1px solid rgba(255,255,255,0.05)",
              }}
            />
          ))}

          {floors.map((f) => {
            const upWaiters = state.waitingByFloor[f]?.filter(
              (p) => p.direction === "up",
            ).length;
            const downWaiters = state.waitingByFloor[f]?.filter(
              (p) => p.direction === "down",
            ).length;
            const isGround = f === b.basementFloors;
            return (
              <div
                key={f}
                className="flex items-center border-t border-white/[0.03]"
                style={{ height: rowH }}
              >
                <div
                  className="w-16 pr-2 text-right font-mono text-[11px]"
                  style={{ color: isGround ? "#f0b429" : "rgba(255,255,255,0.5)" }}
                >
                  {floorLabel(b, f)}
                </div>
                <div className="w-[74px] flex items-center gap-1 pr-2 text-[10px]">
                  {upWaiters > 0 && (
                    <span className="chip" style={{ color: "#8fd14f" }}>
                      ↑ {upWaiters}
                    </span>
                  )}
                  {downWaiters > 0 && (
                    <span className="chip" style={{ color: "#ef4d6a" }}>
                      ↓ {downWaiters}
                    </span>
                  )}
                </div>
                <div className="relative flex-1 h-full" />
              </div>
            );
          })}

          {/* Elevator cars overlay */}
          {state.elevators.map((e, i) => {
            const yFromTop = (total - 1 - e.currentFloor) * rowH + 2;
            const color = CAR_COLORS[i % CAR_COLORS.length];
            const moving = e.state === "MOVING_UP" || e.state === "MOVING_DOWN";
            const loadPct = Math.min(
              1,
              e.passengers.length / state.config.elevator.capacity,
            );
            return (
              <div
                key={`car-${i}`}
                onClick={() =>
                  onSelectElevator(selectedElevator === i ? null : i)
                }
                title={`Lift ${String.fromCharCode(65 + i)} — ${e.state}`}
                className={`absolute rounded-md cursor-pointer transition-[top] duration-100 ease-linear ${
                  moving ? "car-moving" : ""
                }`}
                style={{
                  top: yFromTop,
                  left: gutter + i * shaftWidth + 8,
                  width: shaftWidth - 16,
                  height: rowH - 4,
                  background: `linear-gradient(180deg, ${color} 0%, ${color}bb 100%)`,
                  boxShadow: `0 0 12px ${color}66`,
                  border:
                    selectedElevator === i
                      ? "2px solid white"
                      : "1px solid rgba(0,0,0,0.4)",
                }}
              >
                <div className="flex items-center justify-between px-1 h-full">
                  <span className="text-[9px] font-mono text-ink-950 font-semibold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-[9px] font-mono text-ink-950">
                    {e.direction === "up" ? "▲" : e.direction === "down" ? "▼" : "·"}
                    {e.passengers.length}
                  </span>
                </div>
                {/* Load bar */}
                <div
                  className="absolute bottom-0 left-0 h-[2px]"
                  style={{
                    width: `${loadPct * 100}%`,
                    background: "rgba(0,0,0,0.7)",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
