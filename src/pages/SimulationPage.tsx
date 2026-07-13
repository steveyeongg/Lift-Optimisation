import React, { useState } from "react";
import { BuildingView } from "../components/BuildingView";
import { ElevatorDetail } from "../components/ElevatorDetail";
import { KpiCards } from "../components/KpiCards";
import { PlaybackBar } from "../components/PlaybackBar";
import { QueueByFloor, WaitingTimeTrend } from "../components/Charts";
import { SimulationState, StrategyId } from "../types";
import { ALL_STRATEGIES } from "../simulation/dispatch/all";

interface Props {
  state: SimulationState;
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSpeed: (n: number) => void;
  onRunToEnd: () => void;
  onStrategyChange: (id: StrategyId) => void;
  onModeChange: (mode: SimulationState["config"]["traffic"]["mode"]) => void;
  onDurationChange: (secs: number) => void;
  onSeedChange: (seed: number) => void;
  onIntensityChange: (v: number) => void;
  metrics: ReturnType<any>;
}

export function SimulationPage(props: Props) {
  const [selectedElevator, setSelectedElevator] = useState<number | null>(0);
  const { state } = props;
  const cfg = state.config;

  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-12 gap-3 items-center">
        <div className="col-span-12 lg:col-span-8">
          <PlaybackBar
            time={state.time}
            duration={cfg.traffic.durationSeconds}
            playing={props.playing}
            speed={props.speed}
            onPlay={props.onPlay}
            onPause={props.onPause}
            onRestart={props.onRestart}
            onSpeed={props.onSpeed}
            onRunToEnd={props.onRunToEnd}
          />
        </div>
        <div className="col-span-12 lg:col-span-4 flex gap-2">
          <div className="card px-3 py-2 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
              Strategy
            </div>
            <select
              className="select"
              value={cfg.strategy.id}
              onChange={(e) => props.onStrategyChange(e.target.value as StrategyId)}
            >
              {ALL_STRATEGIES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="card px-3 py-2 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
              Traffic Mode
            </div>
            <select
              className="select"
              value={cfg.traffic.mode}
              onChange={(e) => props.onModeChange(e.target.value as any)}
            >
              <option value="morning_down_peak">Morning Down Peak</option>
              <option value="evening_up_peak">Evening Up Peak</option>
              <option value="non_peak">Non-Peak / Interfloor</option>
              <option value="lunch_spike">Lunch Delivery Spike</option>
              <option value="weekend">Weekend</option>
              <option value="extreme">Extreme Congestion</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </div>

      <KpiCards metrics={props.metrics} simTime={state.time} />

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 xl:col-span-6">
          <BuildingView
            state={state}
            selectedElevator={selectedElevator}
            onSelectElevator={setSelectedElevator}
          />
        </div>
        <div className="col-span-12 xl:col-span-3">
          <ElevatorDetail state={state} index={selectedElevator} />
        </div>
        <div className="col-span-12 xl:col-span-3 space-y-3">
          <WaitingTimeTrend state={state} />
          <QueueByFloor state={state} />
        </div>
      </div>
    </div>
  );
}
