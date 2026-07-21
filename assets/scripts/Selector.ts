import { _decorator, Component, Node } from 'cc';
import { GRID_COLS, GRID_ROWS } from './Config';
import { SlotManager, SlotEntry } from './SlotManager';
import { Gem } from './Gem';
import { eventBus, GEM_TAP } from './events/GameEventBus';
const { ccclass, property } = _decorator;

const DIRECTIONS_8: [number, number][] = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],           [1,  0],
    [-1,  1], [0,  1], [1,  1],
];

@ccclass('Selector')
export class Selector extends Component {

    @property({ type: Node, displayName: 'Pineapple 容器节点' })
    pineappleNode: Node = null;

    private _slotManager: SlotManager = null;
    private _selected: Gem[] = [];

    onLoad() {
        this._slotManager = this.pineappleNode.getComponent(SlotManager);
        if (!this._slotManager) {
            console.warn('[Selector] 未找到 SlotManager');
            return;
        }
        eventBus.on(GEM_TAP, this.onGemTapped, this);
    }

    onDestroy() {
        eventBus.off(GEM_TAP, this.onGemTapped, this);
    }

    private onGemTapped(gem: Gem) {
        if (!gem?.isValid) return;

        const entry = this._slotManager.getSlotByGem(gem.node);
        if (!entry) return;
        if (this._slotManager.isGemCorrect(gem.node)) return;

        if (this._selected.length > 0) {
            if (this._selected.includes(gem)) {
                this.clearSelection();
            }
            return;
        }

        const group = this.floodFill(entry.col, entry.row, gem.colorId);
        for (const e of group) {
            const g = e.node.getComponent(Gem);
            if (g) {
                g.select();
                this._selected.push(g);
            }
        }
    }

    private floodFill(startCol: number, startRow: number, colorId: number): SlotEntry[] {
        const result: SlotEntry[] = [];
        const visited = new Set<string>();
        const queue: { col: number; row: number }[] = [{ col: startCol, row: startRow }];

        while (queue.length > 0) {
            const { col, row } = queue.shift()!;
            const key = `${col},${row}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const entry = this._slotManager.getSlotAt(col, row);
            if (!entry || !entry.gem || !entry.gem.isValid) continue;
            if (entry.gemColor !== colorId) continue;
            if (entry.gemColor === entry.targetColor) continue; // 已归位不选

            result.push(entry);

            for (const [dc, dr] of DIRECTIONS_8) {
                const nc = col + dc;
                const nr = row + dr;
                if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
                    if (!visited.has(`${nc},${nr}`)) {
                        queue.push({ col: nc, row: nr });
                    }
                }
            }
        }

        return result;
    }

    clearSelection() {
        for (const g of this._selected) {
            if (g?.isValid) {
                g.deselect();
            }
        }
        this._selected.length = 0;
    }
}
