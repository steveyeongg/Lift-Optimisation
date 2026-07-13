import { SimulationState, StrategyMetrics } from "../types";

function csvRow(fields: (string | number)[]) {
  return fields
    .map((f) => {
      const s = String(f ?? "");
      if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
      return s;
    })
    .join(",");
}

export function exportPassengersCsv(state: SimulationState): string {
  const header = [
    "passenger_id",
    "arrival_time",
    "origin_floor",
    "destination_floor",
    "direction",
    "assigned_elevator",
    "boarding_time",
    "destination_arrival_time",
    "waiting_time_seconds",
    "journey_time_seconds",
    "total_time_seconds",
  ];
  const rows = [csvRow(header)];
  for (const p of state.completedPassengers) {
    const wait = (p.boardingTime ?? p.arrivalTime) - p.arrivalTime;
    const journey =
      (p.arrivalAtDestinationTime ?? 0) - (p.boardingTime ?? p.arrivalTime);
    const total = (p.arrivalAtDestinationTime ?? 0) - p.arrivalTime;
    rows.push(
      csvRow([
        p.id,
        p.arrivalTime.toFixed(2),
        p.originFloor,
        p.destinationFloor,
        p.direction,
        p.assignedElevator ?? "",
        (p.boardingTime ?? 0).toFixed(2),
        (p.arrivalAtDestinationTime ?? 0).toFixed(2),
        wait.toFixed(2),
        journey.toFixed(2),
        total.toFixed(2),
      ]),
    );
  }
  return rows.join("\n");
}

export function exportElevatorsCsv(state: SimulationState): string {
  const totalTime = Math.max(state.time, 1);
  const header = [
    "elevator_id",
    "floors_travelled",
    "total_stops",
    "door_cycles",
    "active_time",
    "idle_time",
    "utilisation",
    "average_load",
    "maximum_load",
    "empty_travel_floors",
    "energy_proxy_score",
  ];
  const rows = [csvRow(header)];
  for (const e of state.elevators) {
    const energy =
      e.floorsTravelled * 1.0 +
      e.stops * 2.5 +
      e.doorCycles * 1.5 +
      e.emptyTravelFloors * 1.2;
    rows.push(
      csvRow([
        e.id,
        e.floorsTravelled.toFixed(2),
        e.stops,
        e.doorCycles,
        e.activeSeconds.toFixed(1),
        e.idleSeconds.toFixed(1),
        (e.activeSeconds / totalTime).toFixed(3),
        e.passengers.length,
        e.passengers.length,
        e.emptyTravelFloors.toFixed(2),
        energy.toFixed(1),
      ]),
    );
  }
  return rows.join("\n");
}

export function exportStrategiesCsv(list: StrategyMetrics[]): string {
  const header = [
    "strategy",
    "avg_wait",
    "median_wait",
    "p90_wait",
    "p95_wait",
    "max_wait",
    "avg_journey",
    "avg_total",
    "utilisation",
    "avg_load",
    "max_queue",
    "floors_travelled",
    "total_stops",
    "door_cycles",
    "energy_proxy",
  ];
  const rows = [csvRow(header)];
  for (const m of list) {
    rows.push(
      csvRow([
        m.strategyLabel,
        m.avgWait.toFixed(2),
        m.medianWait.toFixed(2),
        m.p90Wait.toFixed(2),
        m.p95Wait.toFixed(2),
        m.maxWait.toFixed(2),
        m.avgJourney.toFixed(2),
        m.avgTotal.toFixed(2),
        m.utilisation.toFixed(3),
        m.avgLoad.toFixed(2),
        m.maxQueue,
        m.floorsTravelled.toFixed(2),
        m.totalStops,
        m.doorCycles,
        m.energyProxy.toFixed(1),
      ]),
    );
  }
  return rows.join("\n");
}

export function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
