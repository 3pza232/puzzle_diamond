import { _decorator, Component, Sprite, SpriteFrame, UITransform, Node, input, Input, EventTouch, v3, v2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FloatingHand')
export class FloatingHand extends Component {

    @property({ type: Node })
    handRoot: Node = null;

    @property({ type: SpriteFrame })
    handTexture: SpriteFrame = null;

    private _onInput: (e: any) => void = null;

    onLoad() {
        if (!this.handRoot || !this.handTexture) return;

        const hand = new Node('Hand');
        const sprite = hand.addComponent(Sprite);
        sprite.spriteFrame = this.handTexture;

        const ui = hand.getComponent(UITransform);
        if (ui) {
            ui.anchorPoint = v2(0, 1);
            ui.contentSize = this.handTexture.originalSize;
        }
        hand.setScale(v3(0.4, 0.4, 1));
        hand.layer = this.handRoot.layer;
        this.handRoot.addChild(hand);

        this._onInput = (e: EventTouch) => {
            const p = e.getUILocation();
            hand.setWorldPosition(v3(p.x, p.y, 0));
        };
        input.on(Input.EventType.TOUCH_START, this._onInput);
        input.on(Input.EventType.TOUCH_MOVE, this._onInput);
        input.on(Input.EventType.MOUSE_MOVE, this._onInput);
    }

    onDestroy() {
        if (this._onInput) {
            input.off(Input.EventType.TOUCH_START, this._onInput);
            input.off(Input.EventType.TOUCH_MOVE, this._onInput);
            input.off(Input.EventType.MOUSE_MOVE, this._onInput);
        }
    }
}
