import React from "react";

export function MethodologyPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-sm text-white/80 leading-relaxed">
      <h1 className="text-2xl font-semibold text-white">LiftOpt — Methodology</h1>
      <p className="text-white/60">
        This page describes the models, assumptions, and calculations that produce every
        number shown in the LiftOpt dashboard. Business teams can read the top of each
        section; engineers can drill into the technical detail underneath.
      </p>

      <Section title="1. What is elevator traffic simulation?">
        <p>
          A residential elevator system is a queueing network. Passengers arrive at a
          floor with an intended destination and a required direction; a bank of shared
          elevators services them subject to capacity, direction constraints, door
          cycles, and boarding/alighting time. Simulating this system lets us evaluate
          dispatch strategies without touching real hardware.
        </p>
      </Section>

      <Section title="1b. Building configuration and its effect on arrivals">
        <p>
          The building panel controls the floor plan: number of basement floors
          (labelled <code>SB1, SB2, SB3…</code>), the ground floor <code>G</code>,
          the number of above-ground residential floors (labelled <code>1, 2, …</code>),
          units per floor, and residents per unit. Floors × units × residents is the
          building's <em>population</em>. The reference building is 40 floors × 8 units
          × 3 residents = 960 residents; the profile arrival rates below are quoted for
          this reference. When you change the config, the arrival rate is scaled linearly
          by <code>population / 960</code> (clamped to a sensible range) so a smaller
          building sees proportionally less traffic and a larger one sees more.
        </p>
      </Section>

      <Section title="2. Passenger arrival modelling">
        <p>
          Arrivals follow a <em>non-homogeneous Poisson process</em>. The rate λ(t) is
          derived from the selected traffic profile (morning down-peak, evening up-peak,
          non-peak interfloor, lunch spike, weekend, or extreme). During each simulation
          tick (0.5s) we sample the expected number of arrivals as λ(t)·Δt·intensity,
          then round via a Bernoulli tail — this preserves fractional expected arrivals
          across ticks and reproduces the classic Poisson variance.
        </p>
        <p>
          For each arrival we sample an (origin, destination) pair from the profile's
          own OD distribution — e.g. morning peak biases 70% of destinations to the
          Ground Floor and 25% to basement parking.
        </p>
      </Section>

      <Section title="3. Random seeds and reproducibility">
        <p>
          The engine uses a small seedable PRNG (mulberry32). Given the same
          <code className="mx-1 text-accent-cyan">seed</code>, the sequence of arrivals
          is identical, so strategy comparisons operate against exactly the same
          passengers. This is critical for fair benchmarking — the Compare Strategies
          page always re-uses the current seed.
        </p>
      </Section>

      <Section title="4. Elevator state machine">
        <p>
          Each elevator lives in one of six states: <code>IDLE</code>,
          <code> MOVING_UP</code>, <code>MOVING_DOWN</code>, <code>DOOR_OPENING</code>,
          <code> BOARDING</code>, <code>DOOR_CLOSING</code>. Timers per state consume
          the configured floor-travel, door, boarding, alighting, and acceleration
          seconds. Stops are picked <em>collectively</em> — while going up, continue
          servicing the next stop above; only reverse when there's none.
        </p>
      </Section>

      <Section title="5. Dispatch strategies">
        <p>Seven strategies are implemented (all share a single interface):</p>
        <ul className="list-disc list-inside space-y-1 text-white/70">
          <li><strong className="text-white">Nearest Elevator</strong> — baseline; closest by floor distance.</li>
          <li><strong className="text-white">Direction-Aware Collective</strong> — prefer en-route, then idle, then reverse.</li>
          <li><strong className="text-white">ETA</strong> — full estimated pickup time incorporating existing stops, doors and boarding.</li>
          <li><strong className="text-white">Load-Aware ETA</strong> — ETA + cubic capacity penalty and stop-congestion term.</li>
          <li><strong className="text-white">Soft Zoning</strong> — floors are assigned to elevators as owning zones with overflow.</li>
          <li><strong className="text-white">Peak-Hour Adaptive</strong> — switches behaviour based on the run's traffic mode and repositions idle cars.</li>
          <li><strong className="text-white">Cost-Function Optimised</strong> — weighted sum: wait · detour · onboard delay · capacity risk · energy · clustering.</li>
        </ul>
      </Section>

      <Section title="6. ETA calculation">
        <p>Given an elevator's current position, direction, and stop queue, the ETA to
          floor <em>f</em> is computed as either:</p>
        <ul className="list-disc list-inside space-y-1 text-white/70">
          <li>
            <em>En-route case:</em> if the elevator is travelling in the same direction
            as the call and <em>f</em> lies ahead, ETA = |f − pos|·τ_floor + s·τ_stop + door,
            where <em>s</em> is the number of queued intermediate stops.
          </li>
          <li>
            <em>Detour case:</em> otherwise the elevator finishes its queue then travels
            direct: ETA = Σ(existing stops) + |f − last|·τ_floor + door.
          </li>
        </ul>
      </Section>

      <Section title="7. Peak-hour adaptive control">
        <p>
          During down-peak, the strategy penalises elevator clustering and rewards
          already-descending cars. During up-peak / lunch spike, it reserves a
          lobby-adjacent car and rewards ascending cars. Non-peak biases toward idle
          nearest-suitable dispatch and spreads parking floors so no request is far
          from a car.
        </p>
      </Section>

      <Section title="8. Cost-function objective">
        <p className="font-mono text-xs bg-black/40 p-3 rounded-md border border-white/5">
          cost(elevator, call) =<br />
          &nbsp;&nbsp;w<sub>wait</sub>·ETA<br />
          + w<sub>detour</sub>·routeDeviation<br />
          + w<sub>onboard</sub>·onboardDelay<br />
          + w<sub>capacity</sub>·load³<br />
          + w<sub>energy</sub>·energyDelta<br />
          + w<sub>cluster</sub>·nearbyElevators
        </p>
        <p className="mt-2">
          Weights are user-configurable. The Optimisation Lab runs random search over
          these weights to minimise a normalised objective:{" "}
          <span className="font-mono">0.4·avgWait + 0.25·P95 + 0.15·journey + 0.1·energy + 0.1·maxQueue</span>.
        </p>
      </Section>

      <Section title="9. Energy proxy">
        <p className="font-mono text-xs bg-black/40 p-3 rounded-md border border-white/5">
          energyProxy = 1.0·floorsTravelled + 2.5·stops + 1.5·doorCycles + 1.2·emptyTravelFloors
        </p>
        <p className="mt-2 text-white/60">
          This is a comparison metric, <em>not</em> a kilowatt-hour estimate. It captures
          the relative operational cost of a strategy — cars that stop more often, cycle
          doors more, and cover empty floors are penalised. Absolute kWh figures require
          engineering specs from the elevator OEM which LiftOpt intentionally does not model.
        </p>
      </Section>

      <Section title="10. Limitations">
        <ul className="list-disc list-inside space-y-1 text-white/70">
          <li>Passengers do not switch elevators mid-journey.</li>
          <li>Hall calls do not currently support destination-dispatch keypads.</li>
          <li>Elevator capacity is a hard cap; there is no re-routing of a full car.</li>
          <li>Passenger walking / decision time is not modelled.</li>
          <li>The energy proxy is dimensionless; use only for strategy comparison.</li>
          <li>No sabbath / freight modes.</li>
        </ul>
      </Section>

      <Section title="11. Real-world deployment">
        <p>
          LiftOpt is an operations-research digital twin — it does <strong>not</strong> control
          real hardware. Deploying any strategy to a live elevator requires close
          integration with the elevator OEM, building management, and the relevant
          safety-certification bodies. The recommendations produced here are decision
          support, not operating instructions.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-white text-lg font-semibold mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
