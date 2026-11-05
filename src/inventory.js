import { ITEMS, WEAPONS, LEARNABLE } from './items.js?v=42';
import { save, useItem, equip } from './save.js?v=42';

// ---------------------------------------------------------------------------
// The bag: press I (or Tab, or Select on a pad) while exploring. Shows your
// weapons (pick one to equip it), your items (Herbs and the like can be used
// here on yourself), the moves you know and who's in your party.
// Up / down to choose, A (Space) or a click to equip / use, B or I to close.
// ---------------------------------------------------------------------------

export class Inventory {
  // getParty(): [{ name, hp, maxHp }]; onEquip(id): put the weapon in your hand
  constructor(el, input, { player, getParty, onEquip, baseMoves }) {
    this.el = el; this.input = input;
    this.player = player; this.getParty = getParty; this.onEquip = onEquip; this.baseMoves = baseMoves;
    this.open = false;
    this.sel = 0;
  }

  toggle() { if (this.open) this.close(); else this.show(); }

  show() {
    this.open = true;
    this.sel = Math.max(0, this.sel);
    this.lock = 0.15;
    this.render();
    this.el.classList.add('on');
  }

  close() { this.open = false; this.el.classList.remove('on'); }

  rows() {
    const P = this.player();
    const rows = [];
    for (const id of save.weapons) {
      const w = WEAPONS[id];
      rows.push({ kind: 'weapon', id, label: w.name, tag: save.equipped === id ? 'Equipped' : '', desc: w.desc, act: () => { equip(id); this.onEquip(id); } });
    }
    for (const [id, n] of Object.entries(save.items)) {
      const it = ITEMS[id];
      if (!it || n <= 0) continue;
      const usable = !!(it.heal && P.health < 8) || !!(it.stamina && P.stamina < P.maxStamina);
      rows.push({ kind: 'item', id, label: it.name, tag: `x${n}`, desc: it.desc + (it.damage ? ' (Only in battle.)' : ''),
        act: usable ? () => {
          useItem(id);
          if (it.heal) P.health = Math.min(8, P.health + it.heal);
          if (it.stamina) P.stamina = Math.min(P.maxStamina, P.stamina + it.stamina);
        } : null });
    }
    return rows;
  }

  render() {
    const rows = this.rows();
    this.list = rows;
    if (this.sel >= rows.length) this.sel = rows.length - 1;
    const party = this.getParty();
    const moves = [...this.baseMoves.map((m) => m.name), ...save.learned.map((id) => LEARNABLE[id] && LEARNABLE[id].name).filter(Boolean)];
    const sect = (title, kind) => {
      const rs = rows.map((r, i) => [r, i]).filter(([r]) => r.kind === kind);
      if (!rs.length) return `<h3>${title}</h3><div class="inone">Nothing yet.</div>`;
      return `<h3>${title}</h3>` + rs.map(([r, i]) => `<button class="irow${i === this.sel ? ' sel' : ''}${r.act ? '' : ' dim'}" data-i="${i}"><span>${r.label}</span><span class="itag">${r.tag}</span></button>`).join('');
    };
    const cur = rows[this.sel];
    this.el.innerHTML = `
      <div class="ipanel">
        <div class="ititle">Bag</div>
        <div class="icols">
          <div class="icol">${sect('Weapons', 'weapon')}${sect('Items', 'item')}</div>
          <div class="icol">
            <h3>Moves</h3><div class="imoves">${moves.join(' &middot; ')}</div>
            <h3>Party</h3>${party.map((f) => `<div class="iparty"><span>${f.name}</span><span>${f.hp} / ${f.maxHp} Health</span></div>`).join('')}
          </div>
        </div>
        <div class="idesc">${cur ? cur.desc : ''}</div>
        <div class="ihint">A — equip / use &nbsp;&nbsp; B or I — close</div>
      </div>`;
    this.el.querySelectorAll('.irow').forEach((b) => {
      const i = +b.dataset.i;
      b.addEventListener('mouseenter', () => { this.sel = i; this.render(); });
      b.addEventListener('click', (e) => { e.stopPropagation(); this.sel = i; this.pick(); });
    });
  }

  pick() {
    const r = this.list[this.sel];
    if (r && r.act) { r.act(); this.render(); }
  }

  update(dt) {
    if (!this.open) return;
    this.lock -= dt;
    if (this.lock > 0) return;
    const inp = this.input, y = inp.move.y;
    if (Math.abs(y) > 0.5 && !this.held && this.list.length) {
      this.held = true;
      this.sel = (this.sel + (y > 0 ? -1 : 1) + this.list.length) % this.list.length;
      this.render();
    }
    if (Math.abs(y) < 0.3) this.held = false;
    if (inp.pressed.A) this.pick();
    else if (inp.pressed.B) { inp.pressed.B = false; this.close(); }
  }
}
