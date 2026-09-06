// Deterministic building names for the query tool.
const SURNAMES = ["Alder", "Bennett", "Calder", "Dunbar", "Everly", "Fenwick", "Garrity", "Holloway", "Ingram", "Jarvis", "Kessler", "Lindqvist", "Marlowe", "Nakamura", "Okafor", "Pemberton", "Quintero", "Rasmussen", "Sato", "Thornbury", "Underhill", "Vasquez", "Whitfield", "Yamada", "Zielinski", "Abernathy", "Brightman", "Castellano", "Delacroix", "Esposito"];
const HOMES = [["Cottage", "Bungalow", "Homestead", "House"], ["Family Home", "Residence", "Villa", "Manor"]];
const APARTMENTS = ["Court", "Terrace", "Gardens", "Mews", "Lofts", "Apartments"];
const TOWERS = ["Towers", "Heights", "Point", "Residences", "Plaza Towers", "Skyline"];
const SHOPS = ["Bakery", "Diner", "Hardware", "Books", "Grocery", "Florist", "Barber", "Pharmacy", "Deli", "Café"];
const OFFICES = ["Insurance", "Realty", "Consulting", "Dental", "Legal", "Studio", "Media", "Logistics"];
const MALLS = ["Galleria", "Mall", "Arcade", "Emporium", "Market Hall"];
const CORPS = ["Holdings", "Financial", "Bancorp", "Technologies", "Group", "Trust", "Global"];
const WORKSHOPS = ["Auto Repair", "Cabinetry", "Print Shop", "Machine Shop", "Welding", "Upholstery"];
const FACTORIES = ["Manufacturing", "Textiles", "Foundry", "Packaging", "Plastics", "Electronics", "Bottling"];
const HEAVY = ["Steelworks", "Chemicals", "Refinery", "Smelter", "Petrochemical", "Heavy Industries"];

const pick = (list, n) => list[Math.floor(n * list.length) % list.length];
const roll = (t, k) => { const v = Math.sin(t.x * 91.7 + t.y * 47.3 + k * 13.1 + (t.variant || 0) * 977) * 43758.5453; return v - Math.floor(v); };

export function buildingName(t) {
  if (!t?.lot || !t.level) return null;
  const surname = pick(SURNAMES, roll(t, 1));
  const n = roll(t, 2);
  if (t.type === "residential") {
    if (t.density === 1) return `${surname} ${pick(HOMES[t.level >= 3 ? 1 : 0], n)}`;
    if (t.density === 2) return `${surname} ${pick(APARTMENTS, n)}`;
    return `${surname} ${pick(TOWERS, n)}`;
  }
  if (t.type === "commercial") {
    if (t.density === 1) return `${surname}'s ${pick(SHOPS, n)}`;
    if (t.density === 2) return t.level >= 3 ? `${surname} ${pick(MALLS, n)}` : `${surname} ${pick(OFFICES, n)}`;
    return `${surname} ${pick(CORPS, n)}`;
  }
  if (t.type === "industrial") {
    if (t.density === 1) return `${surname} ${pick(WORKSHOPS, n)}`;
    if (t.density === 2) return `${surname} ${pick(FACTORIES, n)}`;
    return `${surname} ${pick(HEAVY, n)}`;
  }
  return null;
}
