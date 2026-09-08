import { pruneConnections } from './neighbor-links.js';
// Recompute derived tile state after construction or each month.
import { updateUtilities } from "./utilities.js";
import { updateServices } from "./services.js";
import { detectConnections } from "./neighbors.js";

export function refreshCity(city) {
  pruneConnections(city);
  city._connections = detectConnections(city);
  city._util = updateUtilities(city);
  city._svc = updateServices(city);
  return city;
}
