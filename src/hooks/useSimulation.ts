import { useCallback, useEffect, useRef, useState } from "react";
import { Engine } from "../simulation/engine";
import { SimulationConfig, SimulationState } from "../types";

// A React-friendly wrapper around the Engine that supports play / pause /
// speed control without coupling simulation time to browser frame rate.
export function useSimulation(initialConfig: SimulationConfig) {
  const engineRef = useRef<Engine>(new Engine(initialConfig));
  const [state, setState] = useState<SimulationState>(engineRef.current.state);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(5); // simulated seconds per real second (0 = instant on start)
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const [tick, setTick] = useState(0); // force rerender counter

  const commit = useCallback(() => setTick((n) => n + 1), []);

  const start = useCallback(() => {
    setPlaying(true);
    lastFrameRef.current = performance.now();
  }, []);

  const pause = useCallback(() => {
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const restart = useCallback(
    (cfg?: SimulationConfig) => {
      pause();
      const nextCfg = cfg ?? engineRef.current.state.config;
      engineRef.current = new Engine(nextCfg);
      setState(engineRef.current.state);
      commit();
    },
    [pause, commit],
  );

  const runToCompletion = useCallback(() => {
    pause();
    engineRef.current.runToCompletion();
    setState(engineRef.current.state);
    commit();
  }, [pause, commit]);

  const setConfig = useCallback(
    (cfg: SimulationConfig) => {
      restart(cfg);
    },
    [restart],
  );

  // Main animation loop — decouples wall time from sim time using `speed`.
  useEffect(() => {
    if (!playing) return;
    const loop = (now: number) => {
      const wallDelta = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      // clamp huge jumps (e.g. tab switch) to a max sim step per frame
      const simDelta = Math.min(wallDelta * speed, 5);
      engineRef.current.advance(simDelta);
      if (engineRef.current.state.time >= engineRef.current.state.config.traffic.durationSeconds && engineRef.current.everyoneDone()) {
        setPlaying(false);
        setState(engineRef.current.state);
        commit();
        return;
      }
      commit();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, commit]);

  useEffect(() => {
    setState(engineRef.current.state);
  }, [tick]);

  return {
    engine: engineRef.current,
    state,
    playing,
    speed,
    setSpeed,
    start,
    pause,
    restart,
    runToCompletion,
    setConfig,
    tick,
  };
}
