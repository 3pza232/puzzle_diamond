import { _decorator, Component, Node, Label, input, Input, EventTouch,
    UITransform, Graphics, Color, v3,
    EventKeyboard, KeyCode } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PositionRecorder')
export class PositionRecorder extends Component {

    @property({ type: Node, displayName: '菠萝图 Sprite 节点' })
    pineappleSprite: Node = null;

    @property({ type: Label, displayName: '数字显示 Label' })
    numberLabel: Label = null;

    @property({ type: Node, displayName: '数字容器 Number 节点' })
    numberNode: Node = null;

    @property({ displayName: '列数' })
    columns: number = 14;

    @property({ displayName: '行数' })
    rows: number = 12;

    @property({ displayName: '颜色种类数' })
    colorCount: number = 7;

    @property({ displayName: '启用标记工具' })
    enable: boolean = true;

    @property({ displayName: '显示网格线' })
    showGrid: boolean = true;

    private _currentColor: number = 1;
    private _markers: Map<string, { color: number; labelNode: Node }> = new Map();
    private _graphics: Graphics = null;
    private _spriteUI: UITransform = null;
    private _listening: boolean = false;

    onEnable() {
        if (!this.enable || !this.pineappleSprite || !this.numberLabel || !this.numberNode || this._listening) {
            return;
        }
        this._listening = true;

        this._spriteUI = this.pineappleSprite.getComponent(UITransform);
        if (!this._spriteUI) { this._listening = false; return; }

        const gNode = new Node('GridOverlay');
        this._graphics = gNode.addComponent(Graphics);
        gNode.setParent(this.pineappleSprite);

        this.drawGridLines();

        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        this.pineappleSprite.on(Node.EventType.TOUCH_START, this.onSpriteTouch, this);
    }

    onDisable() {
        if (!this._listening) return;
        this._listening = false;

        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        if (this.pineappleSprite?.isValid) {
            this.pineappleSprite.off(Node.EventType.TOUCH_START, this.onSpriteTouch, this);
        }
        if (this._graphics) {
            this._graphics.node.destroy();
            this._graphics = null;
        }
        for (const [, marker] of this._markers) {
            if (marker.labelNode?.isValid) marker.labelNode.destroy();
        }
        this._markers.clear();
    }

    onDestroy() {
        this.onDisable();
    }

    private drawGridLines() {
        if (!this.showGrid || !this._graphics) return;

        const w = this._spriteUI.contentSize.width;
        const h = this._spriteUI.contentSize.height;
        const halfW = w / 2;
        const halfH = h / 2;
        const cellW = w / this.columns;
        const cellH = h / this.rows;

        this._graphics.clear();
        this._graphics.strokeColor = new Color(150, 150, 150, 180);
        this._graphics.lineWidth = 1;

        for (let c = 0; c <= this.columns; c++) {
            const x = -halfW + c * cellW;
            this._graphics.moveTo(x, halfH);
            this._graphics.lineTo(x, -halfH);
        }

        for (let r = 0; r <= this.rows; r++) {
            const y = halfH - r * cellH;
            this._graphics.moveTo(-halfW, y);
            this._graphics.lineTo(halfW, y);
        }

        this._graphics.stroke();
    }

    private onKeyDown(event: EventKeyboard) {
        if (!this.enable) return;
        const key = event.keyCode;

        if (key >= KeyCode.DIGIT_1 && key <= KeyCode.DIGIT_9) {
            const num = key - KeyCode.DIGIT_1 + 1;
            if (num <= this.colorCount) {
                this._currentColor = num;
                this.numberNode.active = true;
                this.numberLabel.string = num.toString();
            }
            return;
        }

        if (key === KeyCode.KEY_D) {
            this.exportData();
        }
    }

    private onSpriteTouch(event: EventTouch) {
        if (!this.enable) return;

        const worldPos = event.getUILocation();
        const localPos = this._spriteUI.convertToNodeSpaceAR(v3(worldPos.x, worldPos.y, 0));

        const w = this._spriteUI.contentSize.width;
        const h = this._spriteUI.contentSize.height;
        const halfW = w / 2;
        const halfH = h / 2;

        if (Math.abs(localPos.x) > halfW || Math.abs(localPos.y) > halfH) return;

        const col = Math.floor((localPos.x + halfW) / (w / this.columns));
        const row = Math.floor((halfH - localPos.y) / (h / this.rows));

        if (col < 0 || col >= this.columns || row < 0 || row >= this.rows) return;

        const key = `${col},${row}`;
        const existing = this._markers.get(key);

        if (existing) {
            if (existing.color === this._currentColor) {
                existing.labelNode.destroy();
                this._markers.delete(key);
            } else {
                existing.color = this._currentColor;
                existing.labelNode.getComponent(Label).string = this._currentColor.toString();
            }
        } else {
            const labelNode = this.createCellLabel(col, row);
            this._markers.set(key, { color: this._currentColor, labelNode });
        }
    }

    private createCellLabel(col: number, row: number): Node {
        const labelNode = new Node('GridLabel');

        const spriteW = this._spriteUI.contentSize.width * this.pineappleSprite.scale.x;
        const spriteH = this._spriteUI.contentSize.height * this.pineappleSprite.scale.y;
        const cellW = spriteW / this.columns;
        const cellH = spriteH / this.rows;

        const spriteCenter = this.pineappleSprite.worldPosition;
        const topLeftX = spriteCenter.x - spriteW / 2;
        const topLeftY = spriteCenter.y + spriteH / 2;

        const worldX = topLeftX + (col + 0.5) * cellW;
        const worldY = topLeftY - (row + 0.5) * cellH;

        const numberUI = this.numberNode.getComponent(UITransform);
        const localPos = numberUI.convertToNodeSpaceAR(v3(worldX, worldY, 0));

        labelNode.position = localPos;
        labelNode.layer = this.numberNode.layer;

        const label = labelNode.addComponent(Label);
        label.string = this._currentColor.toString();
        label.fontSize = 18;
        label.color = new Color(51, 153, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        this.numberNode.addChild(labelNode);
        return labelNode;
    }

    private exportData() {
        interface SlotEntry { col: number; row: number; color: number }

        const entries: SlotEntry[] = [];
        for (const [key, value] of this._markers) {
            const parts = key.split(',');
            entries.push({ col: parseInt(parts[0]), row: parseInt(parts[1]), color: value.color });
        }

        entries.sort((a, b) => a.row - b.row || a.col - b.col);

        let code = 'export const SLOT_DATA: { col: number; row: number; color: number }[] = [\n';
        for (const e of entries) {
            code += `    { col: ${e.col}, row: ${e.row}, color: ${e.color} },\n`;
        }
        code += '];';

        console.log('===== SLOT_DATA (copy below) =====');
        console.log(code);
        console.log(`===== Total: ${entries.length} slots =====`);
    }
}
