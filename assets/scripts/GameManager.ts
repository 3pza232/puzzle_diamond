import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GemManager')
export class GemManager extends Component {

    @property({ type: Node, displayName: 'Pineapple 容器节点' })
    pineappleNode: Node = null;

    @property({ type: Node, displayName: 'Tray 节点' })
    trayNode: Node = null;

    onLoad() {
        console.log('[GemManager] 已就绪（玩法逻辑待实现）');
    }
}
