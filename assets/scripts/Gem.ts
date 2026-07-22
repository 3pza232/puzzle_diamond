import { _decorator, Component, Node, tween, v3, EventTouch } from 'cc';
import { eventBus, GEM_TAP } from './events/GameEventBus';
const { ccclass } = _decorator;

@ccclass('Gem')
export class Gem extends Component {
    colorId: number = 0;

    private _tween: any = null;

    onLoad() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouch, this);
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_START, this.onTouch, this);
    }

    private onTouch(event: EventTouch) {
        event.propagationStopped = true;
        eventBus.emit(GEM_TAP, this);
    }

    select() {
        if (this._tween) return;
        this.node.setScale(v3(1, 1, 1));
        this._tween = tween(this.node)
            .to(0.5, { scale: v3(1.1, 1.1, 1) }, { easing: 'sineInOut' })
            .to(0.5, { scale: v3(0.8, 0.8, 1) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    deselect() {
        if (this._tween) {
            this._tween.stop();
            this._tween = null;
        }
        this.node.setScale(v3(1, 1, 1));
    }
}
