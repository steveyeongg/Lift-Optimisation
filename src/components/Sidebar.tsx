import React from "react";

const NAV = [
  { id: "start", label: "Start Here", icon: "★" },
  { id: "sim", label: "Simulation", icon: "◨" },
  { id: "control", label: "Control Room", icon: "◉" },
  { id: "analytics", label: "Analytics", icon: "▦" },
  { id: "compare", label: "Compare Strategies", icon: "⇌" },
  { id: "optimise", label: "Optimisation Lab", icon: "✦" },
  { id: "config", label: "Configuration", icon: "⚙" },
  { id: "method", label: "Methodology", icon: "📘" },
] as const;

export type PageId = (typeof NAV)[number]["id"];

interface Props {
  page: PageId;
  onChange: (p: PageId) => void;
}

export function Sidebar({ page, onChange }: Props) {
  return (
    <aside className="w-56 shrink-0 h-screen border-r border-white/5 bg-ink-900/60 flex flex-col">
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, #38e0d6 0%, #22a49c 40%, #1c5f5a 100%)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 32 32"
              className="text-ink-950"
            >
              <path d="M8 8h6v16H8zM18 8h6v16h-6z" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">LiftOpt</div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">
              Elevator Traffic
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto scroll-area">
        {NAV.map((item) => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`w-full text-left px-5 py-2 text-sm flex items-center gap-3 transition-colors ${
                active
                  ? "bg-white/[0.06] text-accent-cyan"
                  : "text-white/70 hover:bg-white/[0.03]"
              }`}
            >
              <span className="w-4 text-center text-white/40">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-white/5 text-[11px] text-white/40">
        <div>Simulate. Optimise.</div>
        <div>Move Smarter.</div>
      </div>
    </aside>
  );
}
