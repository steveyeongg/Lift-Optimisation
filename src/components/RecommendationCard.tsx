import React from "react";
import { RecommendationBlock } from "../types";

export function RecommendationCard({ block }: { block: RecommendationBlock }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-title">{block.title}</div>
          <div className="text-xs text-white/50 mt-0.5">{block.window}</div>
        </div>
        <div className="chip text-accent-cyan">Simulated recommendation</div>
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <div className="section-title mb-1">Dispatch Mode</div>
          <div className="text-sm text-accent-cyan font-medium">
            {block.dispatchMode}
          </div>

          <div className="section-title mt-4 mb-1">Initial Lift Positions</div>
          <ul className="text-xs font-mono space-y-1">
            {block.initialPositions.map((p) => (
              <li key={p.elevator} className="flex justify-between">
                <span className="text-white/60">{p.elevator}</span>
                <span>{p.floor}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="section-title mb-1">Operational Logic</div>
          <ul className="text-xs list-disc list-inside text-white/70 space-y-1">
            {block.operationalLogic.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>

        <div>
          <div className="section-title mb-1">Expected Impact vs Nearest baseline</div>
          <ul className="text-xs font-mono space-y-1">
            {block.expectedImpact.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <div className="text-[10px] text-white/40 mt-3">
            Values are simulated estimates from the current configuration and
            random seed. Real-world deployment requires integration with, and
            approval from, the elevator OEM and building management.
          </div>
        </div>
      </div>
    </div>
  );
}
