import { _decorator, Component, Node, Prefab, UITransform, Vec3, v3, instantiate } from 'cc';
import { GRID_COLS, GRID_ROWS, SLOT_DATA } from './Config';
import { difficulty as gDifficulty } from './GameData';
import { Gem } from './Gem';
const { ccclass, property } = _decorator;

export interface SlotEntry {
    node: Node;
    col: number;
    row: number;
    targetColor: number;
    gem: Node | null;
    gemColor: number;
}

@ccclass('SlotManager')
export class SlotManager extends Component {

    @property({ type: [Prefab], displayName: '宝石预制体（序号1~7）' })
    gemPrefabs: Prefab[] = [];

    @property({ type: Node, displayName: 'Slots 容器节点' })
    slotsNode: Node = null;

    @property({ type: Node, displayName: '菠萝图 Sprite 节点' })
    pineappleSprite: Node = null;

    @property({ displayName: '打乱程度', range: [0, 1, 0.05], slide: true })
    intensity: number = 0.6;

    @property({ displayName: '难度（0全对→1全乱）', range: [0, 1, 0.05], slide: true })
    difficulty: number = 1.0;

    readonly slots: SlotEntry[] = [];
    private _spriteUI: UITransform = null;

    onLoad() {
        if (gDifficulty !== undefined) this.difficulty = gDifficulty;

        if (SLOT_DATA.length === 0) {
            console.log('[SlotManager] SLOT_DATA 为空，跳过');
            return;
        }
        this._spriteUI = this.pineappleSprite.getComponent(UITransform);
        this.buildSlots();
        this.expandSlotsTouchArea();
        console.log('[SlotManager] 已创建 ' + this.slots.length + ' 个坑位');
        this.instantiateGems();
    }

    private expandSlotsTouchArea() {
        const spriteW = this._spriteUI.contentSize.width * this.pineappleSprite.scale.x;
        const spriteH = this._spriteUI.contentSize.height * this.pineappleSprite.scale.y;
        const ui = this.slotsNode.getComponent(UITransform);
        if (ui) {
            Object.assign(ui.contentSize, { width: spriteW, height: spriteH });
        }
    }

    private instantiateGems() {
        if (this.gemPrefabs.length === 0) {
            console.warn('[SlotManager] gemPrefabs 数组为空，请在 Inspector 中拖入预制体');
            return;
        }

        const gemColors = this.slots.map(e => e.targetColor);
        this.shuffleGems(gemColors);

        for (let i = 0; i < this.slots.length; i++) {
            const entry = this.slots[i];
            const gemColor = gemColors[i];

            const prefab = this.gemPrefabs[gemColor - 1];
            if (!prefab) {
                console.warn('[SlotManager] 缺少预制体: color=' + gemColor);
                continue;
            }

            const gemNode = instantiate(prefab);
            gemNode.position = this.calcSlotLocalPos(entry.col, entry.row);
            gemNode.layer = this.slotsNode.layer;
            this.slotsNode.addChild(gemNode);

            const gemUI = gemNode.getComponent(UITransform);
            if (gemUI) {
                Object.assign(gemUI.contentSize, { width: 24, height: 24 });
            }

            const gem = gemNode.getComponent(Gem);
            if (gem) gem.colorId = gemColor;

            entry.node = gemNode;
            entry.gem = gemNode;
            entry.gemColor = gemColor;
        }
        console.log('[SlotManager] 已实例化 ' + this.slots.length + ' 颗宝石');
    }

    // ── FY 洗牌 + 美化（保证各色总数不变、自然成块）──

    private shuffleGems(colors: number[]) {
        const D = this.difficulty;
        if (D <= 0) return;

        this.partialShuffle(colors, D);

        if (this.intensity < 1) {
            this.beautify(colors, this.intensity);
        }
    }

    private partialShuffle(colors: number[], D: number) {
        const n = colors.length;
        const count = Math.floor(n * D);
        const indices = [...Array(n).keys()];
        this.fyShuffle(indices);
        const pick = indices.slice(0, count);
        const vals = pick.map(i => colors[i]);
        this.fyShuffle(vals);
        for (let i = 0; i < count; i++) colors[pick[i]] = vals[i];
    }

    private fyShuffle(arr: number[]) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    private beautify(colors: number[], I: number) {
        const neigh = this.buildNeighbors();
        const passes = Math.floor(4 + (1 - I) * 16);

        for (let p = 0; p < passes; p++) {
            let anySwap = false;
            for (let i = 0; i < colors.length; i++) {
                const myC = colors[i];
                let same = 0;
                for (const k of neigh[i]) { if (colors[k] === myC) same++; }
                if (same >= 2) continue;

                for (const j of neigh[i]) {
                    if (colors[j] === myC) continue;
                    const jC = colors[j];

                    let iGain = 0, jGain = 0;
                    for (const k of neigh[i]) {
                        const c = k === j ? myC : colors[k];
                        if (c === jC) iGain++;
                    }
                    for (const k of neigh[j]) {
                        const c = k === i ? jC : colors[k];
                        if (c === myC) jGain++;
                    }

                    let jSame = 0;
                    for (const k of neigh[j]) { if (colors[k] === jC) jSame++; }

                    if (iGain + jGain > same + jSame) {
                        [colors[i], colors[j]] = [colors[j], colors[i]];
                        anySwap = true;
                        break;
                    }
                }
            }
            if (!anySwap) break;
        }
    }

    private buildNeighbors(): number[][] {
        return this.slots.map((s, i) => {
            const ns: number[] = [];
            for (let j = 0; j < this.slots.length; j++) {
                if (i === j) continue;
                if (Math.abs(this.slots[j].col - s.col) <= 1 &&
                    Math.abs(this.slots[j].row - s.row) <= 1) {
                    ns.push(j);
                }
            }
            return ns;
        });
    }

    // ── 查询接口 ──

    getSlotByIndex(index: number): SlotEntry {
        return this.slots[index];
    }

    getSlotByGem(gemNode: Node): SlotEntry {
        return this.slots.find(s => s.gem === gemNode);
    }

    isGemCorrect(gemNode: Node): boolean {
        const entry = this.getSlotByGem(gemNode);
        return entry !== null && entry.gemColor === entry.targetColor;
    }

    getSlotAt(col: number, row: number): SlotEntry {
        return this.slots.find(s => s.col === col && s.row === row);
    }

    // 将世界坐标转换为格子行列
    worldToGrid(worldPos: Vec3): { col: number; row: number } | null {
        const localPos = this._spriteUI.convertToNodeSpaceAR(worldPos);
        const w = this._spriteUI.contentSize.width;
        const h = this._spriteUI.contentSize.height;
        const halfW = w / 2;
        const halfH = h / 2;

        if (Math.abs(localPos.x) > halfW || Math.abs(localPos.y) > halfH) return null;

        const col = Math.floor((localPos.x + halfW) / (w / GRID_COLS));
        const row = Math.floor((halfH - localPos.y) / (h / GRID_ROWS));
        if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
        return { col, row };
    }

    // 按颜色统计坑位数
    getColorCount(colorId: number): number {
        return this.slots.filter(s => s.targetColor === colorId).length;
    }

    // 查找相连的空坑位（同目标色的空位 floodFill）
    findEmptySlots(col: number, row: number, colorId: number): SlotEntry[] {
        const result: SlotEntry[] = [];
        const visited = new Set<string>();
        const queue: { col: number; row: number }[] = [{ col, row }];

        while (queue.length > 0) {
            const { col: c, row: r } = queue.shift()!;
            const key = `${c},${r}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const entry = this.getSlotAt(c, r);
            if (!entry) continue;
            if (entry.targetColor !== colorId) continue;
            if (entry.gem !== null) continue;

            result.push(entry);

            for (const [dc, dr] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
                const nc = c + dc;
                const nr = r + dr;
                if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
                    if (!visited.has(`${nc},${nr}`)) {
                        queue.push({ col: nc, row: nr });
                    }
                }
            }
        }

        result.sort((a, b) => a.row - b.row || a.col - b.col);
        return result;
    }

    // 将宝石放入坑位
    placeGem(entry: SlotEntry, gemNode: Node, gemColor: number): void {
        entry.gem = gemNode;
        entry.gemColor = gemColor;
        entry.node = gemNode;
        gemNode.position = this.calcSlotLocalPos(entry.col, entry.row);
        gemNode.setParent(this.slotsNode);
    }

    // 从坑位移除宝石
    clearSlot(entry: SlotEntry): void {
        entry.gem = null;
        entry.gemColor = 0;
        entry.node = null;
    }

    private calcSlotLocalPos(col: number, row: number): Vec3 {
        const spriteW = this._spriteUI.contentSize.width * this.pineappleSprite.scale.x;
        const spriteH = this._spriteUI.contentSize.height * this.pineappleSprite.scale.y;
        const cellW = spriteW / GRID_COLS;
        const cellH = spriteH / GRID_ROWS;

        const topLeftX = -spriteW / 2;
        const topLeftY = spriteH / 2;

        return v3(
            topLeftX + (col + 0.5) * cellW,
            topLeftY - (row + 0.5) * cellH,
            0
        );
    }

    getSlotWorldPos(col: number, row: number): Vec3 {
        const localPos = this.calcSlotLocalPos(col, row);
        return this.slotsNode.getComponent(UITransform).convertToWorldSpaceAR(localPos);
    }

    private buildSlots() {
        for (const data of SLOT_DATA) {
            this.slots.push({
                node: null,
                col: data.col,
                row: data.row,
                targetColor: data.color,
                gem: null,
                gemColor: 0,
            });
        }
    }
}
