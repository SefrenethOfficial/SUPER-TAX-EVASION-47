import { ITEMS, WEAPONS, LEARNABLE } from './items.js?v=49';
// number keys that use an item straight away, without opening the bag
export const QUICK = { herb: 1, salve: 2, tonic: 3, ember: 4 };
import { save, useItem, equip } from './save.js?v=49';

// ---------------------------------------------------------------------------
// The bag: press I (or Tab, or Select on a pad) while exploring. Shows your
// weapons (pick one to equip it), your items (Herbs and the like can be used
// here on yourself), the moves you know and who's in your party.
// Up / down (W / S, arrows) to choose; Space, Enter, E or a click on the
// button to equip / use; I, Tab, Esc or B to close. The mouse is freed while
// the bag is open so you can click.
// ---------------------------------------------------------------------------

export class Inventory {
  // getParty(): [{ name, hp, maxHp } or { name, role }]; onEquip(id): put the weapon in your hand
  constructor(el, input, { player, getParty, onEquip, baseMoves }) {
    this.el = el; this.input = input;
    this.player = player; this.getParty = getParty; this.onEquip = onEquip; this.baseMoves = baseMoves;
    this.open = false;
    this.sel = 0;
    this.note = '';
    // keyboard on PC: Enter / E picks, Esc closes
    addEventListener('keydown', (e) => {
      if (!this.open || this.lock > 0) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyE') { e.preventDefault(); this.pick(); }
      if (e.code === 'Escape') { e.preventDefault(); this.close(); }
      const step = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 }[e.code];
      if (step && this.list && this.list.length) { e.preventDefault(); this.sel = (this.sel + step + this.list.length) % this.list.length; this.render(); }
    });
  }

  toggle() { if (this.open) this.close(); else this.show(); }

  show() {
    this.open = true;
    this.sel = Math.max(0, this.sel);
    this.lock = 0.15;
    this.note = '';
    this.relock = !!document.pointerLockElement;
    document.exitPointerLock?.();          // free the mouse so you can click
    this.render();
    this.el.classList.add('on');
  }

  close() {
    this.open = false;
    this.el.classList.remove('on');
    if (this.relock) this.input.requestLock();   // back to mouse-look
  }

  rows() {
    const P = this.player();
    const rows = [];
    for (const id of save.weapons) {
      const w = WEAPONS[id];
      const on = save.equipped === id;
      rows.push({ kind: 'weapon', id, label: w.name, tag: on ? 'Equipped' : '', button: on ? (id === 'fists' ? '' : 'Unequip') : 'Equip', desc: w.desc,
        act: () => {
          if (on && id !== 'fists') { equip('fists'); this.onEquip('fists'); this.note = `Put away the ${w.name}.`; return; }
          if (on) { this.note = 'You already fight bare-handed.'; return; }
          equip(id); this.onEquip(id); this.note = `Equipped the ${w.name}.`;
        } });
    }
    for (const [id, n] of Object.entries(save.items)) {
      const it = ITEMS[id];
      if (!it || n <= 0) continue;
      const usable = !!(it.heal && P.health < 8) || !!(it.stamina && P.stamina < P.maxStamina);
      rows.push({ kind: 'item', id, label: it.name, tag: `x${n}`, button: it.damage ? '' : 'Use', desc: it.desc + (QUICK[id] ? ` (Quick use: key ${QUICK[id]}.)` : ''),
        dim: !usable,
        act: () => {
          if (it.damage) { this.note = `Press ${QUICK[id]} out in the world to throw one at the nearest enemy.`; return; }
          if (!usable) { this.note = it.heal ? "You're already at full Health." : "You've got all your Stamina."; return; }
          useItem(id);
          const before = [P.health, P.stamina];
          if (it.heal) P.health = Math.min(8, P.health + it.heal);
          if (it.stamina) P.stamina = Math.min(P.maxStamina, P.stamina + it.stamina);
          this.note = it.heal ? `Used a ${it.name}: +${P.health - before[0]} Health.` : `Used a ${it.name}: +${P.stamina - before[1]} Stamina.`;
        } });
    }
    return rows;
  }

  render() {
    const rows = this.rows();
    this.list = rows;
    if (this.sel >= rows.length) this.sel = rows.length - 1;
    const party = this.getParty();
    const moves = [...this.baseMoves, ...save.learned.map((id) => LEARNABLE[id] && LEARNABLE[id].name).filter(Boolean)];
    const sect = (title, kind) => {
      const rs = rows.map((r, i) => [r, i]).filter(([r]) => r.kind === kind);
      if (!rs.length) return `<h3>${title}</h3><div class="inone">Nothing yet.</div>`;
      return `<h3>${title}</h3>` + rs.map(([r, i]) => `<div class="irow${i === this.sel ? ' sel' : ''}${r.dim ? ' dim' : ''}" data-i="${i}"><span class="iname">${r.label}</span><span class="itag">${r.tag}</span>${r.button ? `<button class="iact" data-i="${i}">${r.button}</button>` : ''}</div>`).join('');
    };
    const cur = rows[this.sel];
    this.el.innerHTML = `
      <div class="ipanel">
        <div class="ititle">Bag</div>
        <div class="icols">
          <div class="icol">${sect('Weapons', 'weapon')}${sect('Items', 'item')}</div>
          <div class="icol">
            <h3>Moves</h3><div class="imoves">${moves.join(' &middot; ')}</div>
            <h3>Party</h3>${party.map((f) => `<div class="iparty"><span>${f.name}</span><span>${f.role || `${f.hp} / ${f.maxHp} Health`}</span></div>`).join('')}
          </div>
        </div>
        <div class="idesc">${this.note ? `<b>${this.note}</b><br>` : ''}${cur ? cur.desc : ''}</div>
        <div class="ihint">Click a button, or W / S and Space / Enter / E to equip or use &nbsp;&middot;&nbsp; I, Tab or Esc to close</div>
        <button class="iclose">Close</button>
      </div>`;
    this.el.querySelectorAll('.irow').forEach((b) => {
      const i = +b.dataset.i;
      // (mousemove, not mouseenter: re-drawing the list under a still mouse mustn't steal the selection)
      b.addEventListener('mousemove', () => { if (this.sel !== i) { this.sel = i; this.render(); } });
      b.addEventListener('click', (e) => { e.stopPropagation(); this.sel = i; this.render(); });
      b.addEventListener('dblclick', (e) => { e.stopPropagation(); this.sel = i; this.pick(); });
    });
    this.el.querySelectorAll('.iact').forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); this.sel = +b.dataset.i; this.pick(); });
    });
    const x = this.el.querySelector('.iclose');
    if (x) x.addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
  }

  pick() {
    const r = this.list[this.sel];
    if (r && r.act) { r.act(); this.render(); }
  }

  update(dt) {
    if (!this.open) return;
    this.lock -= dt;
    if (this.lock > 0) return;
    const inp = this.input, y = inp.usingGamepad ? inp.move.y : 0;   // (keys are handled as they're pressed)
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
