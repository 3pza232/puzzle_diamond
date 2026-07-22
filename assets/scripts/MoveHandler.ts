import { _decorator, Component, Node, Sprite, Button, UITransform, EventTouch, Vec3, v3, tween, instantiate, director } from 'cc';
import { SlotManager } from './SlotManager';
import { Selector } from './Selector';
import { Gem } from './Gem';
import { eventBus, GEM_TAP } from './events/GameEventBus';
const { ccclass, property } = _decorator;

@ccclass('MoveHandler')
export class MoveHandler extends Component {

    @property({ type: Node })
    pineappleNode: Node = null;

    @property({ type: Node })
    trayNode: Node = null;

    @property({ type: Node })
    winCanvas: Node = null;

    @property({ displayName: '移动动画时长(秒)', range: [0.05, 0.5, 0.05], slide: true })
    animDuration: number = 0.1;

    private _selector: Selector = null;
    private _slotManager: SlotManager = null;
    private _traySlots: Node[] = [];
    private _trayOccupied: Set<number> = new Set();
    private _traySelected: Gem[] = [];

    onLoad() {
        this._selector = this.node.getComponent(Selector);
        this._slotManager = this.pineappleNode.getComponent(SlotManager);
        if (!this._selector || !this._slotManager) return;

        this.cacheTraySlots();

        const ui = this.trayNode.getComponent(UITransform);
        if (ui) Object.assign(ui.contentSize, { width: 800, height: 300 });

        const slotsNode = this._slotManager.slotsNode;
        const sprite = this.pineappleNode.getComponentInChildren(Sprite);
        if (sprite) {
            const si = sprite.getComponent(UITransform);
            const sn = slotsNode.getComponent(UITransform);
            if (si && sn) {
                Object.assign(sn.contentSize, {
                    width: si.contentSize.width * sprite.node.scale.x,
                    height: si.contentSize.height * sprite.node.scale.y,
                });
            }
        }

        slotsNode.on(Node.EventType.TOUCH_START, this.onSlotTap, this);
        this.trayNode.on(Node.EventType.TOUCH_START, this.onTrayTap, this);
        eventBus.on(GEM_TAP, this.onGemTapped, this);
    }

    onDestroy() {
        if (this._slotManager?.slotsNode?.isValid) {
            this._slotManager.slotsNode.off(Node.EventType.TOUCH_START, this.onSlotTap, this);
        }
        if (this.trayNode?.isValid) {
            this.trayNode.off(Node.EventType.TOUCH_START, this.onTrayTap, this);
        }
        eventBus.off(GEM_TAP, this.onGemTapped, this);
    }

    private cacheTraySlots() {
        this._traySlots = this.trayNode.children
            .filter(n => n.name.startsWith('Node'))
            .sort((a, b) => {
                const d = a.position.y - b.position.y;
                return Math.abs(d) > 1 ? -d : a.position.x - b.position.x;
            });
    }

    private nextEmptyTrayIndex(): number {
        for (let i = 0; i < this._traySlots.length; i++) {
            if (!this._trayOccupied.has(i)) return i;
        }
        return -1;
    }

    private onGemTapped(gem: Gem) {
        if (!gem?.isValid) return;
        let idx = -1;
        for (let i = 0; i < this._traySlots.length; i++) {
            if (this._trayOccupied.has(i) && this._traySlots[i].children[0] === gem.node) {
                idx = i; break;
            }
        }

        // 非托盘宝石 → 清除托盘选中
        if (idx < 0) {
            if (this._traySelected.length > 0) this.clearTraySelection(this._traySelected.length);
            return;
        }

        if (this._traySelected.indexOf(gem) >= 0) {
            this.clearTraySelection(this._traySelected.length);
            return;
        }
        if (this._traySelected.length > 0) this.clearTraySelection(this._traySelected.length);

        if (this._selector.hasSelection) this._selector.clearSelection();

        const colorId = gem.colorId;
        const result: Gem[] = [];
        let l = idx;
        while (l >= 0 && this._trayOccupied.has(l)) {
            const g = this._traySlots[l].children[0]?.getComponent(Gem);
            if (g && g.colorId === colorId) { result.unshift(g); l--; } else break;
        }
        let r = idx + 1;
        while (r < this._traySlots.length && this._trayOccupied.has(r)) {
            const g = this._traySlots[r].children[0]?.getComponent(Gem);
            if (g && g.colorId === colorId) { result.push(g); r++; } else break;
        }

        for (const g of result) { g.select(); this._traySelected.push(g); }
    }

    private onSlotTap(event: EventTouch) {
        let n = event.target;
        while (n) { if (n.getComponent(Gem)) return; n = n.parent; }

        const uiPos = event.getUILocation();
        const grid = this._slotManager.worldToGrid(v3(uiPos.x, uiPos.y, 0));
        if (!grid) return;

        const target = this._slotManager.getSlotAt(grid.col, grid.row);
        if (!target || target.gem) return;

        const hasTraySel = this._traySelected.length > 0;
        if (!hasTraySel && !this._selector.hasSelection) return;

        const src = hasTraySel ? this._traySelected : this._selector.selectedGems as Gem[];
        const colorId = hasTraySel ? this._traySelected[0].colorId : this._selector.selectedColor;
        if (target.targetColor !== colorId) return;

        const emptySlots = this._slotManager.findEmptySlots(grid.col, grid.row, colorId);
        const toMove = Math.min(emptySlots.length, src.length);
        if (toMove === 0) return;

        for (let i = 0; i < toMove; i++) {
            const gc = src[i];
            if (!gc?.isValid) continue;

            if (hasTraySel) {
                for (let ti = 0; ti < this._traySlots.length; ti++) {
                    if (this._traySlots[ti].children[0] === gc.node) {
                        this._trayOccupied.delete(ti); break;
                    }
                }
                gc.node.destroy();
                const prefab = this._slotManager.gemPrefabs[colorId - 1];
                if (prefab) {
                    const node = instantiate(prefab);
                    const ui = node.getComponent(UITransform);
                    if (ui) Object.assign(ui.contentSize, { width: 24, height: 24 });
                    const g = node.getComponent(Gem);
                    if (g) g.colorId = colorId;
                    this._slotManager.placeGem(emptySlots[i], node, colorId);
                    this.popGem(node);
                }
            } else {
                const old = this._slotManager.getSlotByGem(gc.node);
                if (old) this._slotManager.clearSlot(old);
                gc.node.removeFromParent();
                this._slotManager.placeGem(emptySlots[i], gc.node, colorId);
            }
        }

        if (hasTraySel) {
            this.clearTraySelection(toMove);
            this.compactTray();
        } else {
            this._selector.deselectFirst(toMove);
        }
        this.tryWin();
    }

    private onTrayTap(_event: EventTouch) {
        if (!this._selector.hasSelection) return;
        this.moveGemsToTray();
    }

    private moveGemsToTray() {
        const gems = this._selector.selectedGems as Gem[];
        const colorId = this._selector.selectedColor;
        const toMove = Math.min(gems.length, this._traySlots.length - this._trayOccupied.size);
        if (toMove === 0) return;

        const prefabs = this._slotManager.gemPrefabs;
        let moved = 0;

        for (let i = 0; moved < toMove; i++) {
            const idx = this.nextEmptyTrayIndex();
            if (idx < 0) break;

            const gc = gems[moved];
            if (!gc?.isValid) { moved++; continue; }

            const old = this._slotManager.getSlotByGem(gc.node);
            if (old) this._slotManager.clearSlot(old);
            gc.node.destroy();

            const prefab = prefabs[colorId - 1];
            if (prefab) {
                const node = instantiate(prefab);
                node.position = v3(0, 0, 0);
                node.layer = this.trayNode.layer;
                const ui = node.getComponent(UITransform);
                if (ui) Object.assign(ui.contentSize, { width: 30, height: 30 });
                this._traySlots[idx].addChild(node);
                const g = node.getComponent(Gem);
                if (g) g.colorId = colorId;
                this.popGem(node);
            }

            this._trayOccupied.add(idx);
            moved++;
        }

        this._selector.deselectFirst(toMove);
        this.tryWin();
    }

    private popGem(node: Node) {
        node.setScale(v3(0.01, 0.01, 1));
        tween(node)
            .to(this.animDuration, { scale: v3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }

    private tryWin() {
        const won = this._slotManager.slots.every(e => e.gem !== null && e.gemColor === e.targetColor);
        if (won && this.winCanvas) {
            this.winCanvas.active = true;
            this.bindHomeButton();
        }
    }

    private bindHomeButton() {
        const home = this.winCanvas.getChildByPath('Panel/Home')?.getComponent(Button);
        if (home) home.node.on(Button.EventType.CLICK, this.goHome);
    }

    private goHome() {
        director.loadScene('start');
    }

    private clearTraySelection(count: number) {
        const n = Math.min(count, this._traySelected.length);
        for (let i = 0; i < n; i++) {
            if (this._traySelected[i]?.isValid) this._traySelected[i].deselect();
        }
        this._traySelected.splice(0, n);
    }

    private compactTray() {
        let write = 0;
        for (let read = 0; read < this._traySlots.length; read++) {
            if (this._trayOccupied.has(read)) {
                if (write !== read) {
                    const gem = this._traySlots[read].children[0];
                    if (gem?.isValid) {
                        gem.removeFromParent();
                        gem.position = v3(0, 0, 0);
                        this._traySlots[write].addChild(gem);
                    }
                    this._trayOccupied.delete(read);
                    this._trayOccupied.add(write);
                }
                write++;
            }
        }
    }
}
