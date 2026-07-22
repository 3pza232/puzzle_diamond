import { _decorator, Component, Node, Button, director } from 'cc';
import { setDifficulty } from './GameData';
const { ccclass, property } = _decorator;

@ccclass('StartScene')
export class StartScene extends Component {

    @property({ type: Node })
    panelDiff1: Node = null;

    @property({ type: Node })
    panelDiff2: Node = null;

    onLoad() {
        this.bindButton('Select_Diff', () => {
            this.panelDiff1.active = false;
            this.panelDiff2.active = true;
        });

        this.bindButtonFrom(this.panelDiff2, 'Easy', () => this.startGame(0.1));
        this.bindButtonFrom(this.panelDiff2, 'Normal', () => this.startGame(0.3));
        this.bindButtonFrom(this.panelDiff2, 'Difficulty', () => this.startGame(0.6));
    }

    private bindButton(name: string, cb: () => void) {
        const btn = this.node.getChildByPath(`Panel_Diff_1/${name}`)?.getComponent(Button);
        if (btn) btn.node.on(Button.EventType.CLICK, cb);
    }

    private bindButtonFrom(parent: Node, name: string, cb: () => void) {
        const btn = parent.getChildByName(name)?.getComponent(Button);
        if (btn) btn.node.on(Button.EventType.CLICK, cb);
    }

    private startGame(diff: number) {
        setDifficulty(diff);
        director.loadScene('game1');
    }
}
