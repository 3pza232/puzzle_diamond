import { _decorator, Component, Node, UITransform, EventTouch, v3 } from 'cc';
import { Gem } from './Gem';
const { ccclass, property } = _decorator;

@ccclass('TrayManager')
export class TrayManager extends Component {

    @property({ type: Node })
    trayNode: Node = null;

    private _slots: Node[] = [];
    private _occupied: Set<number> = new Set();
    private _selected: Gem[] = [];

    onLoad() {
        const ui = this.trayNode.getComponent(UITransform);
        if (ui) Object.assign(ui.contentSize, { width: 800, height: 300 });

        this.cacheSlots();
        this.trayNode.on(Node.EventType.TOUCH_START, this.onTrayTap, this);
    }

    onDestroy() {
        if (this.trayNode?.isValid) {
            this.trayNode.off(Node.EventType.TOUCH_START, this.onTrayTap, this);
        }
    }

    // ── 公开接口 ──

    get selectedGems(): readonly Gem[] { return this._selected; }
    get selectedColor(): number { return this._selected[0]?.colorId || 0; }
    get hasSelection(): boolean { return this._selected.length > 0; }
    get slotCount(): number { return this._slots.length; }
    get freeCount(): number { return this._slots.length - this._occupied.size; }

    deselectFirst(count: number): void {
        if (count <= 0) return;
        const n = Math.min(count, this._selected.length);
        for (let i = 0; i < n; i++) {
            if (this._selected[i]?.isValid) this._selected[i].deselect();
        }
        this._selected.splice(0, n);
    }

    clearSelection() {
        for (const g of this._selected) {
            if (g?.isValid) g.deselect();
        }
        this._selected.length = 0;
    }

    occupySlot(index: number) { this._occupied.add(index); }
    freeSlot(index: number) { this._occupied.delete(index); }
    isOccupied(index: number): boolean { return this._occupied.has(index); }
    getSlotNode(index: number): Node { return this._slots[index]; }

    getNextEmptyIndex(): number {
        for (let i = 0; i < this._slots.length; i++) {
            if (!this._occupied.has(i)) return i;
        }
        return -1;
    }

    compact() {
        let write = 0;
        for (let read = 0; read < this._slots.length; read++) {
            if (this._occupied.has(read)) {
                if (write !== read) {
                    const gem = this._slots[read].children[0];
                    if (gem?.isValid) {
                        gem.removeFromParent();
                        gem.position = v3(0, 0, 0);
                        this._slots[write].addChild(gem);
                    }
                    this._occupied.delete(read);
                    this._occupied.add(write);
                }
                write++;
            }
        }
    }

    // ── 内部 ──

    private cacheSlots() {
        this._slots = this.trayNode.children
            .filter(n => n.name.startsWith('Node'))
            .sort((a, b) => {
                const d = a.position.y - b.position.y;
                return Math.abs(d) > 1 ? -d : a.position.x - b.position.x;
            });
    }

    private onTrayTap(event: EventTouch) {
        let n = event.target;
        let tapped: Gem = null;
        while (n) {
            const g = n.getComponent(Gem);
            if (g) { tapped = g; break; }
            n = n.parent;
        }
        if (!tapped?.isValid) return;

        let idx = -1;
        for (let i = 0; i < this._slots.length; i++) {
            if (this._occupied.has(i) && this._slots[i].children[0] === tapped.node) {
                idx = i;
                break;
            }
        }
        if (idx < 0) return;

        if (this._selected.length > 0) {
            if (this._selected.indexOf(tapped) >= 0) this.clearSelection();
            return;
        }

        const colorId = tapped.colorId;
        const result: Gem[] = [];
        let l = idx;
        while (l >= 0 && this._occupied.has(l)) {
            const g = this._slots[l].children[0]?.getComponent(Gem);
            if (g && g.colorId === colorId) { result.unshift(g); l--; }
            else break;
        }
        let r = idx + 1;
        while (r < this._slots.length && this._occupied.has(r)) {
            const g = this._slots[r].children[0]?.getComponent(Gem);
            if (g && g.colorId === colorId) { result.push(g); r++; }
            else break;
        }

        for (const g of result) { g.select(); this._selected.push(g); }
    }
}
