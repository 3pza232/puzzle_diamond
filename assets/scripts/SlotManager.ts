import { _decorator, Component, Node, Prefab, UITransform, Vec3, v3, instantiate } from 'cc';
import { GRID_COLS, GRID_ROWS, SLOT_DATA } from './Config';
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

    readonly slots: SlotEntry[] = [];
    private _spriteUI: UITransform = null;

    onLoad() {
        if (SLOT_DATA.length === 0) {
            console.log('[SlotManager] SLOT_DATA 为空，跳过');
            return;
        }
        this._spriteUI = this.pineappleSprite.getComponent(UITransform);
        this.buildSlots();
        console.log('[SlotManager] 已创建 ' + this.slots.length + ' 个坑位');
        this.instantiateGems();
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
                gemUI.contentSize = { width: 24, height: 24 };
            }

            const gem = gemNode.getComponent(Gem);
            if (gem) gem.colorId = gemColor;

            entry.node = gemNode;
            entry.gem = gemNode;
            entry.gemColor = gemColor;
        }
        console.log('[SlotManager] 已实例化 ' + this.slots.length + ' 颗宝石');
    }

    // ── 三层打乱算法 ──

    private shuffleGems(colors: number[]) {
        const I = this.intensity;
        if (I <= 0) return;

        // 第1层：区域颜色交换（产生大块同色迁移）
        this.shuffleByRegion(colors, I);

        // 第2层：相邻水平带交换（产生跨区迁移）
        this.shuffleByBand(colors, I);

        // 第3层：带内局部交换（产生少量散落）
        this.shuffleLocal(colors, I);
    }

    // 区域颜色交换
    private shuffleByRegion(colors: number[], I: number) {
        const REGION_COLS = 3;
        const REGION_ROWS = 3;
        const regionW = Math.ceil(GRID_COLS / REGION_COLS);
        const regionH = Math.ceil(GRID_ROWS / REGION_ROWS);

        for (let r = 0; r < REGION_ROWS; r++) {
            for (let c = 0; c < REGION_COLS; c++) {
                if (Math.random() >= I * 0.6) continue;

                const minCol = c * regionW;
                const maxCol = Math.min((c + 1) * regionW, GRID_COLS);
                const minRow = r * regionH;
                const maxRow = Math.min((r + 1) * regionH, GRID_ROWS);

                const indices = this.slots
                    .map((s, i) => ({ s, i }))
                    .filter(x => x.s.col >= minCol && x.s.col < maxCol && x.s.row >= minRow && x.s.row < maxRow)
                    .map(x => x.i);

                if (indices.length < 4) continue;

                const colorSet = new Set(indices.map(i => this.slots[i].targetColor));
                const colorsInRegion = [...colorSet];

                if (colorsInRegion.length < 2) continue;

                const shuffledColors = [...colorsInRegion];
                this._shuffleArr(shuffledColors);

                const map = new Map<number, number>();
                for (let ci = 0; ci < colorsInRegion.length; ci++) {
                    const from = colorsInRegion[ci];
                    const to = shuffledColors[ci];
                    if (from !== to) {
                        map.set(from, to);
                    } else if (colorsInRegion.length > 1) {
                        const next = shuffledColors[(ci + 1) % shuffledColors.length];
                        map.set(from, next);
                    }
                }

                for (const idx of indices) {
                    const orig = this.slots[idx].targetColor;
                    if (map.has(orig)) {
                        colors[idx] = map.get(orig);
                    }
                }
            }
        }
    }

    // 相邻水平带交换
    private shuffleByBand(colors: number[], I: number) {
        const BAND_COUNT = 5;
        const rowsPerBand = Math.ceil(GRID_ROWS / BAND_COUNT);

        const bands: number[][] = [];
        for (let b = 0; b < BAND_COUNT; b++) {
            const minRow = b * rowsPerBand;
            const maxRow = Math.min((b + 1) * rowsPerBand, GRID_ROWS);
            bands[b] = [];
            for (let i = 0; i < this.slots.length; i++) {
                if (this.slots[i].row >= minRow && this.slots[i].row < maxRow) {
                    bands[b].push(i);
                }
            }
        }

        for (let b = 0; b < BAND_COUNT - 1; b++) {
            const poolA = [...bands[b]];
            const poolB = [...bands[b + 1]];
            this._shuffleArr(poolA);
            this._shuffleArr(poolB);

            const swapN = Math.floor(Math.min(poolA.length, poolB.length) * I * 0.35);
            for (let s = 0; s < swapN; s++) {
                const tmp = colors[poolA[s]];
                colors[poolA[s]] = colors[poolB[s]];
                colors[poolB[s]] = tmp;
            }
        }
    }

    // 带内局部交换
    private shuffleLocal(colors: number[], I: number) {
        const BAND_COUNT = 5;
        const rowsPerBand = Math.ceil(GRID_ROWS / BAND_COUNT);

        const bands: number[][] = [];
        for (let b = 0; b < BAND_COUNT; b++) {
            const minRow = b * rowsPerBand;
            const maxRow = Math.min((b + 1) * rowsPerBand, GRID_ROWS);
            bands[b] = [];
            for (let i = 0; i < this.slots.length; i++) {
                if (this.slots[i].row >= minRow && this.slots[i].row < maxRow) {
                    bands[b].push(i);
                }
            }
        }

        for (let b = 0; b < BAND_COUNT; b++) {
            const pool = [...bands[b]];
            this._shuffleArr(pool);

            const swapN = Math.floor(pool.length * I * 0.25);
            for (let s = 0; s + 1 < swapN; s += 2) {
                const tmp = colors[pool[s]];
                colors[pool[s]] = colors[pool[s + 1]];
                colors[pool[s + 1]] = tmp;
            }
        }
    }

    private _shuffleArr<T>(arr: T[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
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
