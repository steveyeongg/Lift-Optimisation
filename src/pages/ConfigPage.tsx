import React from "react";
import { SimulationConfig, StrategyId, TrafficMode } from "../types";
import { buildZones } from "../simulation/dispatch/zoning";
import { population, populationScale, totalFloorCount } from "../simulation/demand";
import { ALL_STRATEGIES } from "../simulation/dispatch/all";
import { floorLabel } from "../simulation/defaults";

interface Props {
  config: SimulationConfig;
  onChange: (cfg: SimulationConfig) => void;
}

const PRESETS: {
  id: string;
  label: string;
  desc: string;
  patch: (c: SimulationConfig) => SimulationConfig;
}[] = [
  {
    id: "morning",
    label: "Morning Rush",
    desc: "High down-peak, residents → GF/basement",
    patch: (c) => ({
      ...c,
      traffic: { ...c.traffic, mode: "morning_down_peak", intensity: 1.1, durationSeconds: 7200 },
    }),
  },
  {
    id: "evening",
    label: "Evening Rush",
    desc: "High up-peak, GF/basement → residential",
    patch: (c) => ({
      ...c,
      traffic: { ...c.traffic, mode: "evening_up_peak", intensity: 1.0, durationSeconds: 7200 },
    }),
  },
  {
    id: "quiet",
    label: "Quiet Afternoon",
    desc: "Low random interfloor traffic",
    patch: (c) => ({
      ...c,
      traffic: { ...c.traffic, mode: "non_peak", intensity: 0.7, durationSeconds: 5400 },
    }),
  },
  {
    id: "lunch",
    label: "Lunch Spike",
    desc: "Short concentrated food-delivery surge",
    patch: (c) => ({
      ...c,
      traffic: { ...c.traffic, mode: "lunch_spike", intensity: 1.0, durationSeconds: 3600 },
    }),
  },
  {
    id: "weekend",
    label: "Weekend",
    desc: "Bi-modal + interfloor traffic",
    patch: (c) => ({
      ...c,
      traffic: { ...c.traffic, mode: "weekend", intensity: 0.9, durationSeconds: 10800 },
    }),
  },
  {
    id: "extreme",
    label: "Extreme Congestion",
    desc: "Stress-test elevator capacity",
    patch: (c) => ({
      ...c,
      traffic: { ...c.traffic, mode: "extreme", intensity: 1.4, durationSeconds: 3600 },
    }),
  },
];

export function ConfigPage({ config, onChange }: Props) {
  const b = config.building;
  const e = config.elevator;
  const t = config.traffic;

  const patchBuilding = (patch: Partial<typeof b>) => {
    const next = { ...b, ...patch };
    const total = totalFloorCount(next);
    onChange({
      ...config,
      building: next,
      strategy: {
        ...config.strategy,
        zones: buildZones(total, config.elevator.count),
      },
    });
  };
  const patchElevator = (patch: Partial<typeof e>) => {
    const nextE = { ...e, ...patch };
    onChange({
      ...config,
      elevator: nextE,
      strategy: {
        ...config.strategy,
        zones: buildZones(totalFloorCount(b), nextE.count),
      },
    });
  };
  const patchTraffic = (patch: Partial<typeof t>) =>
    onChange({ ...config, traffic: { ...t, ...patch } });
  const patchStrategy = (patch: Partial<typeof config.strategy>) =>
    onChange({ ...config, strategy: { ...config.strategy, ...patch } });

  return (
    <div className="p-4 space-y-4">
      <div className="card p-3">
        <div className="section-title mb-2">Scenario Presets</div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="card p-3 text-left hover:border-accent-cyan/40"
              onClick={() => onChange(p.patch(config))}
            >
              <div className="text-sm font-medium">{p.label}</div>
              <div className="text-[11px] text-white/50 mt-1">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Building">
          <Field label="Basement floors">
            <input
              type="number"
              className="input"
              min={0}
              max={6}
              value={b.basementFloors}
              onChange={(ev) => patchBuilding({ basementFloors: +ev.target.value })}
            />
          </Field>
          <Field label="Above-ground floors">
            <input
              type="number"
              className="input"
              min={4}
              max={80}
              value={b.aboveGroundFloors}
              onChange={(ev) => patchBuilding({ aboveGroundFloors: +ev.target.value })}
            />
          </Field>
          <Field label="Units per floor">
            <input
              type="number"
              className="input"
              min={1}
              max={40}
              value={b.unitsPerFloor}
              onChange={(ev) => patchBuilding({ unitsPerFloor: +ev.target.value })}
            />
          </Field>
          <Field label="Residents per unit">
            <input
              type="number"
              className="input"
              min={1}
              max={10}
              value={b.residentsPerUnit}
              onChange={(ev) => patchBuilding({ residentsPerUnit: +ev.target.value })}
            />
          </Field>
          <Field label="Car park top floor (Ln)">
            <input
              type="number"
              className="input"
              min={0}
              max={b.aboveGroundFloors}
              value={b.parkingTopFloor ?? 0}
              onChange={(ev) => patchBuilding({ parkingTopFloor: +ev.target.value })}
            />
          </Field>
          <Field label="Facility floors (e.g. 9, 20)">
            <input
              type="text"
              className="input"
              value={(b.facilityFloors ?? []).join(", ")}
              onChange={(ev) => {
                const list = ev.target.value
                  .split(",")
                  .map((s) => parseInt(s.trim(), 10))
                  .filter((n) => !isNaN(n) && n >= 1 && n <= b.aboveGroundFloors);
                patchBuilding({ facilityFloors: list });
              }}
            />
          </Field>
          <div className="col-span-2 mt-1 rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11px] font-mono text-white/70 leading-relaxed">
            <div>
              Floors:{" "}
              <span className="text-white">
                {floorLabel(b, 0)} → {floorLabel(b, totalFloorCount(b) - 1)}
              </span>{" "}
              ({totalFloorCount(b)} total)
            </div>
            <div>
              Population:{" "}
              <span className="text-white">{population(b).toLocaleString()}</span> residents ·{" "}
              <span className="text-white">
                {(populationScale(b) * 100).toFixed(0)}%
              </span>{" "}
              of the reference arrival rate
            </div>
          </div>
        </Panel>

        <Panel title="Elevators">
          <Field label="Number of elevators">
            <input
              type="number"
              className="input"
              min={1}
              max={8}
              value={e.count}
              onChange={(ev) => patchElevator({ count: +ev.target.value })}
            />
          </Field>
          <Field label="Capacity (persons)">
            <input type="number" className="input" min={4} max={30} value={e.capacity}
              onChange={(ev) => patchElevator({ capacity: +ev.target.value })} />
          </Field>
          <Field label="Floor travel (s)">
            <input type="number" className="input" step={0.1} min={0.5} max={5}
              value={e.floorTravelSeconds}
              onChange={(ev) => patchElevator({ floorTravelSeconds: +ev.target.value })} />
          </Field>
          <Field label="Door open (s)">
            <input type="number" className="input" step={0.1} value={e.doorOpenSeconds}
              onChange={(ev) => patchElevator({ doorOpenSeconds: +ev.target.value })} />
          </Field>
          <Field label="Door close (s)">
            <input type="number" className="input" step={0.1} value={e.doorCloseSeconds}
              onChange={(ev) => patchElevator({ doorCloseSeconds: +ev.target.value })} />
          </Field>
          <Field label="Board / passenger (s)">
            <input type="number" className="input" step={0.1} value={e.boardSecondsPerPassenger}
              onChange={(ev) => patchElevator({ boardSecondsPerPassenger: +ev.target.value })} />
          </Field>
          <Field label="Alight / passenger (s)">
            <input type="number" className="input" step={0.1} value={e.alightSecondsPerPassenger}
              onChange={(ev) => patchElevator({ alightSecondsPerPassenger: +ev.target.value })} />
          </Field>
        </Panel>

        <Panel title="Traffic">
          <Field label="Mode">
            <select
              className="select"
              value={t.mode}
              onChange={(ev) => patchTraffic({ mode: ev.target.value as TrafficMode })}
            >
              <option value="morning_down_peak">Morning Down Peak</option>
              <option value="evening_up_peak">Evening Up Peak</option>
              <option value="non_peak">Non-Peak / Interfloor</option>
              <option value="lunch_spike">Lunch Delivery Spike</option>
              <option value="weekend">Weekend</option>
              <option value="extreme">Extreme Congestion</option>
              <option value="custom">Custom</option>
            </select>
          </Field>
          <Field label="Duration (sec)">
            <input type="number" className="input" min={300} step={300}
              value={t.durationSeconds}
              onChange={(ev) => patchTraffic({ durationSeconds: +ev.target.value })} />
          </Field>
          <Field label="Intensity (× multiplier)">
            <input type="number" className="input" min={0.1} max={4} step={0.1}
              value={t.intensity}
              onChange={(ev) => patchTraffic({ intensity: +ev.target.value })} />
          </Field>
          <Field label="Random seed">
            <input type="number" className="input" value={t.seed}
              onChange={(ev) => patchTraffic({ seed: +ev.target.value })} />
          </Field>
          {t.mode === "custom" && (
            <>
              <Field label="Custom arrivals / hour">
                <input type="number" className="input" min={0}
                  value={t.customArrivalsPerHour ?? 300}
                  onChange={(ev) => patchTraffic({ customArrivalsPerHour: +ev.target.value })} />
              </Field>
              <Field label="Origin bias">
                <select className="select" value={t.customOriginBias ?? "residential"}
                  onChange={(ev) => patchTraffic({ customOriginBias: ev.target.value as any })}>
                  <option value="ground">Ground</option>
                  <option value="basement">Basement</option>
                  <option value="residential">Residential</option>
                  <option value="uniform">Uniform</option>
                </select>
              </Field>
              <Field label="Destination bias">
                <select className="select" value={t.customDestinationBias ?? "ground"}
                  onChange={(ev) => patchTraffic({ customDestinationBias: ev.target.value as any })}>
                  <option value="ground">Ground</option>
                  <option value="basement">Basement</option>
                  <option value="residential">Residential</option>
                  <option value="uniform">Uniform</option>
                </select>
              </Field>
            </>
          )}
        </Panel>
      </div>

      <Panel title="Dispatch Strategy">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ALL_STRATEGIES.map((s) => {
            const active = config.strategy.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => patchStrategy({ id: s.id as StrategyId })}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  active
                    ? "border-accent-cyan/60 bg-accent-cyan/[0.06]"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{s.name}</div>
                  {active && <span className="chip text-accent-cyan">Active</span>}
                </div>
                <div className="text-[11px] text-white/50 mt-1">{s.description}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      {config.strategy.id === "cost" && (
        <Panel title="Cost-Function Weights">
          {(["wait", "detour", "onboardDelay", "capacityRisk", "energy", "cluster"] as const).map((k) => (
            <Field label={k} key={k}>
              <input
                type="number"
                className="input"
                step={0.05}
                value={config.strategy.weights[k]}
                onChange={(ev) =>
                  patchStrategy({
                    weights: {
                      ...config.strategy.weights,
                      [k]: +ev.target.value,
                    },
                  })
                }
              />
            </Field>
          ))}
        </Panel>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="section-title mb-3">{title}</div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-[11px] text-white/60">
      <div className="mb-1">{label}</div>
      {children}
    </label>
  );
}
