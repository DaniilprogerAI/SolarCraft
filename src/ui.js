import { BLOCKS, HOTBAR } from './blocks.js';

export class Hotbar {
  constructor(root) {
    this.root = root;
    this.items = HOTBAR.slice();
    this.selected = 0;
    this.slots = [];
    this._build();
  }

  _build() {
    this.root.innerHTML = '';
    for (let i = 0; i < this.items.length; i++) {
      const id = this.items[i];
      const def = BLOCKS[id];
      const slot = document.createElement('div');
      slot.className = 'slot';
      const num = document.createElement('div');
      num.className = 'num';
      num.textContent = String(i + 1);
      slot.appendChild(num);
      const sw = document.createElement('div');
      sw.className = 'swatch';
      const topCol = def.faces[2]; // +Y face color
      sw.style.background = `rgb(${Math.round(topCol.r * 255)}, ${Math.round(
        topCol.g * 255,
      )}, ${Math.round(topCol.b * 255)})`;
      slot.appendChild(sw);
      const lbl = document.createElement('div');
      lbl.className = 'label';
      lbl.textContent = def.name;
      slot.appendChild(lbl);
      this.root.appendChild(slot);
      this.slots.push(slot);
    }
    this._refresh();
  }

  _refresh() {
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].classList.toggle('active', i === this.selected);
    }
  }

  select(i) {
    if (i < 0) i = 0;
    if (i >= this.items.length) i = this.items.length - 1;
    this.selected = i;
    this._refresh();
  }

  cycle(dir) {
    const n = this.items.length;
    this.selected = (this.selected + dir + n) % n;
    this._refresh();
  }

  currentBlock() {
    return this.items[this.selected];
  }
}
