import React, { useCallback, useMemo, useState } from "react";
import { Sidebar, PageId } from "./components/Sidebar";
import { defaultConfig } from "./simulation/defaults";
import { useSimulation } from "./hooks/useSimulation";
import { SimulationConfig, StrategyId, TrafficMode } from "./types";
import { SimulationPage } from "./pages/SimulationPage";
import { ControlRoom } from "./pages/ControlRoom";
import { AnalyticsPage } from "./pages/Analytics";
import { ComparePage } from "./pages/ComparePage";
import { OptimisationLab } from "./pages/OptimisationLab";
import { ConfigPage } from "./pages/ConfigPage";
import { MethodologyPage } from "./pages/MethodologyPage";
import { RecommendationCard } from "./components/RecommendationCard";
import { buildRecommendation } from "./simulation/recommend";

export default function App() {
  const [page, setPage] = useState<PageId>("sim");
  const [config, setConfig] = useState<SimulationConfig>(() => defaultConfig());
  const {
    state,
    playing,
    speed,
    setSpeed,
    start,
    pause,
    restart,
    runToCompletion,
    setConfig: setEngineConfig,
    engine,
  } = useSimulation(config);

  const applyConfig = useCallback(
    (next: SimulationConfig) => {
      setConfig(next);
      setEngineConfig(next);
    },
    [setEngineConfig],
  );

  const onStrategyChange = useCallback(
    (id: StrategyId) => {
      applyConfig({ ...config, strategy: { ...config.strategy, id } });
    },
    [applyConfig, config],
  );
  const onModeChange = useCallback(
    (mode: TrafficMode) => {
      applyConfig({ ...config, traffic: { ...config.traffic, mode } });
    },
    [applyConfig, config],
  );
  const onDurationChange = useCallback(
    (s: number) => {
      applyConfig({
        ...config,
        traffic: { ...config.traffic, durationSeconds: s },
      });
    },
    [applyConfig, config],
  );
  const onSeedChange = useCallback(
    (seed: number) => {
      applyConfig({ ...config, traffic: { ...config.traffic, seed } });
    },
    [applyConfig, config],
  );
  const onIntensityChange = useCallback(
    (v: number) => {
      applyConfig({ ...config, traffic: { ...config.traffic, intensity: v } });
    },
    [applyConfig, config],
  );

  const metrics = useMemo(() => engine.metrics(), [engine, state.time, state.generatedCount, state.completedPassengers.length]);

  const [rec, setRec] = useState<ReturnType<typeof buildRecommendation> | null>(null);
  const buildRec = useCallback(() => {
    setRec(buildRecommendation(config));
  }, [config]);

  return (
    <div className="h-screen flex bg-ink-950 text-white">
      <Sidebar page={page} onChange={setPage} />
      <main className="flex-1 h-screen overflow-y-auto scroll-area">
        {page === "sim" && (
          <>
            <SimulationPage
              state={state}
              playing={playing}
              speed={speed}
              onPlay={start}
              onPause={pause}
              onRestart={() => restart(config)}
              onSpeed={setSpeed}
              onRunToEnd={runToCompletion}
              onStrategyChange={onStrategyChange}
              onModeChange={onModeChange}
              onDurationChange={onDurationChange}
              onSeedChange={onSeedChange}
              onIntensityChange={onIntensityChange}
              metrics={metrics}
            />
            <div className="px-4 pb-4">
              <div className="card p-3 flex items-center justify-between">
                <div>
                  <div className="section-title">Recommendation Engine</div>
                  <div className="text-xs text-white/50">
                    Runs every strategy against the current seeded demand and
                    proposes an operational plan for the selected traffic mode.
                  </div>
                </div>
                <button className="btn btn-primary" onClick={buildRec}>
                  ✦ Generate Recommendation
                </button>
              </div>
              {rec && (
                <div className="mt-3">
                  <RecommendationCard block={rec.recommendation} />
                </div>
              )}
            </div>
          </>
        )}
        {page === "control" && <ControlRoom state={state} metrics={metrics} />}
        {page === "analytics" && (
          <AnalyticsPage state={state} metrics={metrics} />
        )}
        {page === "compare" && (
          <ComparePage
            baseConfig={config}
            onApply={(id) => {
              onStrategyChange(id);
              setPage("sim");
            }}
          />
        )}
        {page === "optimise" && (
          <OptimisationLab
            baseConfig={config}
            onApply={(cfg) => {
              applyConfig(cfg);
              setPage("sim");
            }}
          />
        )}
        {page === "config" && (
          <ConfigPage config={config} onChange={applyConfig} />
        )}
        {page === "method" && <MethodologyPage />}
      </main>
    </div>
  );
}
