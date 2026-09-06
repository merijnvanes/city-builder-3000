// Recompute derived tile state after construction or each month.
import { updateUtilities } from "./utilities.js";
import { updateServices } from "./services.js";

export function refreshCity(city) {
  city._util = updateUtilities(city);
  city._svc = updateServices(city);
  return city;
}
