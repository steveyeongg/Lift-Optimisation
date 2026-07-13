import { DispatchStrategy, registerStrategy } from "./index";
import { nearest } from "./nearest";
import { directional } from "./directional";
import { etaStrategy } from "./eta";
import { loadAware } from "./loadAware";
import { zoning } from "./zoning";
import { adaptive } from "./adaptive";
import { costFunction } from "./costFunction";

registerStrategy(nearest);
registerStrategy(directional);
registerStrategy(etaStrategy);
registerStrategy(loadAware);
registerStrategy(zoning);
registerStrategy(adaptive);
registerStrategy(costFunction);

export const ALL_STRATEGIES: DispatchStrategy[] = [
  nearest,
  directional,
  etaStrategy,
  loadAware,
  zoning,
  adaptive,
  costFunction,
];

export { strategyRegistry } from "./index";
