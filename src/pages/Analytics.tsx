import React from "react";
import {
  ElevatorTimeline,
  ElevatorUtilisation,
  OdHeatmap,
  QueueByFloor,
  WaitingDistribution,
  WaitingTimeTrend,
} from "../components/Charts";
import { SimulationState, StrategyMetrics } from "../types";
import { KpiCards } from "../components/KpiCards";
import { exportPassengersCsv, exportElevatorsCsv, download } from "../utils/csv";

interface Props {
  state: SimulationState;
  metrics: StrategyMetrics;
}
export function AnalyticsPage({ state, metrics }: Props) {
  return (
    <div className="p-4 space-y-3">
      <div className="card p-3 flex items-center justify-between">
        <div>
          <div className="section-title">Analytics</div>
          <div className="text-xs text-white/50">
            All values are computed from the live simulation state.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn"
            onClick={() =>
              download("liftopt-passengers.csv", exportPassengersCsv(state))
            }
          >
            ⤓ Passengers CSV
          </button>
          <button
            className="btn"
            onClick={() =>
              download("liftopt-elevators.csv", exportElevatorsCsv(state))
            }
          >
            ⤓ Elevators CSV
          </button>
        </div>
      </div>

      <KpiCards metrics={metrics} simTime={state.time} />

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 xl:col-span-6">
          <WaitingTimeTrend state={state} />
        </div>
        <div className="col-span-12 xl:col-span-6">
          <WaitingDistribution state={state} />
        </div>
        <div className="col-span-12 xl:col-span-6">
          <ElevatorUtilisation state={state} />
        </div>
        <div className="col-span-12 xl:col-span-6">
          <QueueByFloor state={state} />
        </div>
        <div className="col-span-12">
          <ElevatorTimeline state={state} />
        </div>
        <div className="col-span-12">
          <OdHeatmap state={state} />
        </div>
      </div>
    </div>
  );
}
