import { _decorator, Component, Node } from 'cc';
import { GRID_COLS, GRID_ROWS } from './Config';
import { SlotManager, SlotEntry } from './SlotManager';
import { Gem } from './Gem';
import { eventBus, GEM_TAP } from './events/GameEventBus';
const { ccclass, property } = _decorator;

const DIRS_8: [number, number][] = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],           [1,  0],
    [-1,  1], [0,  1], [1,  1],
];

@ccclass('Selector')
export class Selector extends Component {

    @property({ type: Node })
    pineappleNode: Node = null;

    private _slotManager: SlotManager = null;
    private _selected: Gem[] = [];
    private _selectedColor: number = 0;

    onLoad() {
        this._slotManager = this.pineappleNode.getComponent(SlotManager);
        if (!this._slotManager) return;
        eventBus.on(GEM_TAP, this.onGemTapped, this);
    }

    onDestroy() {
        eventBus.off(GEM_TAP, this.onGemTapped, this);
    }

    get selectedGems(): readonly Gem[] { return this._selected; }
    get selectedColor(): number { return this._selectedColor; }
    get hasSelection(): boolean { return this._selected.length > 0; }

    deselectFirst(count: number): void {
        if (count <= 0 || this._selected.length === 0) return;
        const n = Math.min(count, this._selected.length);
        for (let i = 0; i < n; i++) {
            if (this._selected[i]?.isValid) this._selected[i].deselect();
        }
        this._selected.splice(0, n);
        if (this._selected.length === 0) this._selectedColor = 0;
    }

    clearSelection() {
        for (const g of this._selected) {
            if (g?.isValid) g.deselect();
        }
        this._selected.length = 0;
        this._selectedColor = 0;
    }

    private onGemTapped(gem: Gem) {
        if (!gem?.isValid) return;
        const entry = this._slotManager.getSlotByGem(gem.node);
        if (!entry || this._slotManager.isGemCorrect(gem.node)) return;

        if (this._selected.length > 0) {
            if (this._selected.indexOf(gem) >= 0) { this.clearSelection(); return; }
            this.clearSelection();
        }

        this._selectedColor = gem.colorId;
        for (const e of this.floodFillGems(entry.col, entry.row, gem.colorId)) {
            const g = e.node.getComponent(Gem);
            if (g) { g.select(); this._selected.push(g); }
        }
    }

    private floodFillGems(col: number, row: number, colorId: number): SlotEntry[] {
        const result: SlotEntry[] = [];
        const visited = new Set<string>();
        const queue: { col: number; row: number }[] = [{ col, row }];

        while (queue.length > 0) {
            const { col: c, row: r } = queue.shift()!;
            const key = `${c},${r}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const entry = this._slotManager.getSlotAt(c, r);
            if (!entry || !entry.gem?.isValid) continue;
            if (entry.gemColor !== colorId || entry.gemColor === entry.targetColor) continue;

            result.push(entry);
            for (const [dc, dr] of DIRS_8) {
                const nc = c + dc, nr = r + dr;
                if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS && !visited.has(`${nc},${nr}`)) {
                    queue.push({ col: nc, row: nr });
                }
            }
        }
        return result;
    }
}
