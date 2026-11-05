// ---------------------------------------------------------------------------
// What you're carrying and what you've done, across areas, kept in the
// browser's storage: items, weapons, the moves you've learned, who's joined
// your party, pickups taken and story flags.
// ---------------------------------------------------------------------------

const KEY = 'ste47-save';

function fresh() {
  return { items: {}, weapons: ['fists'], equipped: 'fists', learned: [], recruits: [], taken: [], flags: {} };
}

export const save = (() => {
  try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { return fresh(); }
})();

export function store() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (_) { /* no storage */ } }

export function addItem(id, n = 1) { save.items[id] = (save.items[id] || 0) + n; store(); }
export function useItem(id) { if (!save.items[id]) return false; save.items[id]--; if (!save.items[id]) delete save.items[id]; store(); return true; }
export function addWeapon(id) { if (!save.weapons.includes(id)) save.weapons.push(id); store(); }
export function equip(id) { if (save.weapons.includes(id)) { save.equipped = id; store(); } }
export function learn(id) { if (!save.learned.includes(id)) save.learned.push(id); store(); }
export function flag(name, v = true) { save.flags[name] = v; store(); }
