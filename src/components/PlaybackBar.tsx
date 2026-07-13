import React from "react";
import { fmtClock } from "../utils/format";

interface Props {
  time: number;
  duration: number;
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSpeed: (n: number) => void;
  onRunToEnd: () => void;
}

const SPEEDS = [1, 5, 20, 100, 500];

export function PlaybackBar({
  time,
  duration,
  playing,
  speed,
  onPlay,
  onPause,
  onRestart,
  onSpeed,
  onRunToEnd,
}: Props) {
  const pct = Math.min(100, (time / Math.max(duration, 1)) * 100);
  return (
    <div className="card px-3 py-2 flex items-center gap-3">
      <div className="flex gap-1">
        {playing ? (
          <button className="btn" onClick={onPause}>
            ❚❚ Pause
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onPlay}>
            ▶ Play
          </button>
        )}
        <button className="btn" onClick={onRestart} title="Restart from t=0">
          ↻
        </button>
        <button
          className="btn"
          onClick={onRunToEnd}
          title="Skip to end (instant)"
        >
          ⏭ Run to End
        </button>
      </div>

      <div className="flex items-center gap-1 text-[11px] text-white/60">
        <span className="mr-1">Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeed(s)}
            className={`px-2 py-1 rounded-md border text-[11px] ${
              speed === s
                ? "border-accent-cyan text-accent-cyan"
                : "border-white/10 text-white/60 hover:border-white/25"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="flex-1 mx-3">
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, #22a49c 0%, #38e0d6 60%, #f0b429 100%)",
            }}
          />
        </div>
      </div>

      <div className="font-mono text-xs text-white/70 min-w-[100px] text-right">
        {fmtClock(time)} / {fmtClock(duration)}
      </div>
    </div>
  );
}
