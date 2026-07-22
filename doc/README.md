# Puzzle Diamond

基于 Cocos Creator 3.8.8 开发的钻石拼图益智游戏（Ads 广告小游戏）。

---

## 技术选型理由

| 方向 | 选型 | 理由 |
|------|------|------|
| 引擎 | Cocos Creator 3.8.8 | 2D/3D 混合支持、小游戏生态成熟、跨平台构建（Web/iOS/Android） |
| 语言 | TypeScript | 类型安全、编辑器智能提示、大型项目可维护性 |
| 渲染 | 2D UI（Canvas + Sprite） | 纯 2D 拼图玩法，无需 3D 渲染管线 |
| 布局 | Widget + 固定设计分辨率 | 720×1280 设计稿，适配主流移动设备 |
| 脚本 | Component 组合模式 | 每个功能拆独立脚本（SlotManager / Selector / MoveHandler），低耦合 |
| 事件 | EventBus（自建） | 避免组件间直接引用导致的循环依赖 |
| 动画 | Tween 系统 | 替代已废弃的 Action 系统，链式调用、支持 easing |
| 数据 | 模块级常量（Config.ts） | 纯数据层，无引擎依赖，便于关卡编辑 |

### 为什么不用其他方案

- **不用 Prefab 嵌套布局**：坑位全部在代码中根据 Config 数据动态生成，避免在编辑器中手工排列 500+ 节点
- **不用物理引擎**：拼图交互是点击 → 选中 → 移动，无碰撞/刚体需求
- **不用 Asset Bundle**：资源量小（50+ 纹理，<60MB），单 bundle 足够

---

## 关键实现思路

### 1. 坑位系统（SlotManager）

```
Config.SLOT_DATA（526 条坑位定义）
  ↓
SlotManager.onLoad()
  ├─ buildSlots() → 创建 SlotEntry[]（纯内存数据，无节点）
  └─ instantiateGems() → 实例化预制体 + 打乱 + 放置
```

- 坑位数据由 `PositionRecorder` 开发工具在编辑器中点击导出
- 运行时所有坑位以 `SlotEntry[]` 数组形式管理，无中间节点
- 提供 `findEmptySlots()` / `placeGem()` / `clearSlot()` 等接口供其他组件使用

### 2. 选中系统（Selector + GEM_TAP 事件）

```
手指点击宝石
  → Gem.onTouch() 捕获点击
  → event.propagationStopped = true（阻止冒泡）
  → eventBus.emit(GEM_TAP, this)

Selector.onGemTapped()
  → 查 SlotManager 确认是菠萝图宝石
  → 8 方向洪水填充同色未归位宝石
  → 选中 → 脉冲缩放动画
```

- 8 方向连通性保证玩家选中一整块"颜色区域"
- 脉冲动画使用 Tween 在 1.1↔0.8 倍率间循环
- 点击异色宝石自动切换选中，无需先取消

### 3. 移动系统（MoveHandler）

```
选中宝石（有选中组）
  → 点击目标（空坑位 / 托盘）
  → MoveHandler 处理

点击菠萝图空坑位
  → floodFill 相连同色空位
  → 逐宝石移入（最左端优先，保持连续）

点击托盘区域
  → 从第一空位顺序填入
  → 销毁旧宝石 → 在新位置生成
  → 自动 compact（移走后前移）

从托盘移回菠萝图
  → 选中托盘宝石 → 点击菠萝图空坑位
  → 销毁托盘宝石 → 在坑位生成新宝石
```

- 移动后自动调用 `tryWin()`，全部归位时激活胜利面板
- 难度参数（`difficulty`）控制初始打乱比例

### 4. 打乱算法

```
partialShuffle(difficulty)
  → 按 difficulty 比例抽选下标
  → Fisher-Yates 洗牌选取的部分
  → 各色计数精确不变（仅 swap，不 rename）

beautify(intensity)
  → 多次遍历所有孤立宝石（≤1 同色邻居）
  → 与邻居交换以获得更高连通性
  → 自然成块，非机械的整行/整块
```

保证：
- 各色宝石总数 = 各色坑位数（数学精确）
- 错位宝石自然聚集，减少零散单颗
- difficulty=0 → 全对（调试用）

### 5. 托盘宝石选中

```
点击托盘宝石
  → Gem.onTouch → eventBus.emit(GEM_TAP)
  → MoveHandler.onGemTapped() 捕获
  → 查 _traySlots 找到对应索引
  → 左右线性扫描同色
  → 选中（和菠萝图一致的脉冲效果）
```

- 托盘宝石用线性扫描（一维）而非 8 方向（二维）
- 选中托盘宝石后可移到菠萝图空坑位
- 移走后自动 compact 前移

---

## 对参考 Playable 的拆解与还原说明

### 拆解分析

参考 Playable 的拼图机制可拆为：

1. **视图层**：卡通图 + 宝石 Sprite + 托盘
2. **交互层**：点击 → 选中连通同色 → 移动
3. **逻辑层**：坑位匹配 → 归位检测 → 胜利条件
4. **数值层**：初始乱序程度 = 难度

### 还原实现

| 原版特征 | 实现方式 |
|---------|---------|
| 宝石全在图上但位置不对 | `partialShuffle(difficulty)` 控制打乱比例 |
| 同色连通选中 | 8 方向 BFS floodFill |
| 托盘临时寄放 | `MoveHandler` → `_traySlots` 管理 |
| 正确坑位永久放置 | `gemColor === targetColor` 判定 |
| 全部归位即胜利 | `slots.every()` 检测 |
| 动画反馈 | `popGem()` 弹入效果 + `select()` 脉冲 |

### 与原版差异

| 维度 | 原版 | 本实现 |
|------|------|--------|
| 选中切换 | 需手动取消 | 点异色自动切换选中 |
| 托盘占用 | 点击到具体坑位 | 点击托盘区域自动取最早空位 |
| 坑位填充 | 点击到哪填到哪 | floodFill 相连空位，单端连续填充 |
| 难度 | 固定 | 0~1 可调，支持从 start 场景传入 |
| 数据分析 | 无 | `difficulty` + `intensity` 双参数控制初始布局和聚集度 |

---

## 设计稿落地中的取舍

### 做的

- **坑位自动生成**：PositionRecorder 工具在预览中点击标记，一键导出 Config
- **托盘坐标修正**：通过 MCP 将 Ctrl+D 复制导致的乱序 Node1~Node70 重新按 14×5 网格排列
- **预制体 Gem 组件预挂**：手动在预制体根节点挂载 Gem.ts，避免运行时 `addComponent`

### 舍的

- **逐颗飞行动画**：原计划宝石移动时做世界坐标 tween，但因 Node 生命周期管理复杂（destroy → create 时序），改为 `popGem` 弹入效果
- **浮动手型跨场景**：简化为本场景内跟随，不做 `game.addPersistRootNode` 持久化
- **多 Canvas 相机**：仅用单 Canvas + 单 Camera（UI_2D layer），未做双相机分离
- **3D 转场/粒子**：纯 2D 拼图，无 3D 元素

### 待优化

- 宝石移动动画可改为更流畅的"飞行"效果（需在 destroy 前完成 tween）
- 手型跨场景持久化（当前仅 game1 场景内生效）
- 托盘宝石选中后的操作反馈（目前选中后只能移到菠萝图）

---

## 优化方向

### 性能

- 526 颗宝石在手机上可能卡顿 → 考虑对象池 + frustum culling
- `beautify` 算法的 `buildNeighbors()` 是 O(n²)=27 万次循环 → 移到子线程或 onlyOnce
- 当前 6 个脚本合计约 700 行 → 对广告小游戏而言偏大，可精简

### 体验

- 添加拖拽移动（而非点击+点击），缩短操作路径
- 选中后添加音效反馈（AudioSource）
- 胜利后显示步数和用时
- 添加关卡进度存储（LocalStorage）

### 工程

- Config.ts 数据格式可扩展为 JSON 外部加载，支持服务端下发关卡
- 打乱算法可抽为独立模块，方便单元测试
- 添加 CI 构建脚本（GitHub Actions）

---

## 对上下游协作的需求思考

### 与设计师协作

| 需求 | 原因 |
|------|------|
| 坑位坐标需设计师在 Figma 标注导出 | PositionRecorder 可自动采集，但前提是设计师已排好坑位网格 |
| 宝石纹理按颜色编号命名（1_~7_） | 脚本通过 `colorId - 1` 索引预制体数组，命名即约定 |
| 提供 2× 和 3× 分辨率素材 | 小游戏需适配高低端设备，单分辨率放大后模糊 |

### 与美术协作

| 需求 | 原因 |
|------|------|
| 菠萝卡通图 + 背景图分离 | 方便后续换主题（圣诞、万圣节等） |
| 宝石纹理间距统一（22px 网格） | 代码硬编码了格子间距，图不对应需改参数 |
| 手型图标需抠图 + 透明通道 | 浮动手型跟随鼠标，需无白底 |

### 与策划协作

| 需求 | 原因 |
|------|------|
| 提供"可通关性"测试数据 | `difficulty` 参数影响初始布局，需策划调出"卡点"曲线 |
| 定义"太难/太简单"的量化标准 | 目前凭感觉调 0.1~1.0 的滑块 |
| 关卡表（可选） | 如需服务端下发关卡，需策划维护 JSON 配表 |

### 通用建议

- **命名即 API**：预制体名、纹理名、节点名全都对齐 `序号_颜色` 格式，减少沟通成本
- **参数外化**：`intensity`、`difficulty`、`animDuration` 等游戏参数全部暴露为 Inspector 可调的 @property，策划可在编辑器中直接调参，不需开发介入
- **可测试性**：`difficulty=0` 即全对，用于回归测试；`intensity=0` 即纯随机，用于压力测试

---

## 项目结构

```
assets/
├── scenes/
│   ├── start.scene          # 主菜单（难度选择）
│   └── game1.scene          # 游戏主场景
├── prefabs/
│   ├── 1_Black_Prefab.prefab
│   ├── 2_Blue_Prefab.prefab
│   └── ...（7 色宝石预制体，已预挂 Gem.ts）
├── scripts/
│   ├── Config.ts             # 纯数据（网格 + 坑位表）
│   ├── Gem.ts                # 宝石组件（点击发射 GEM_TAP + 选中动画）
│   ├── Selector.ts           # 菠萝图宝石选中（8 方向 floodFill）
│   ├── SlotManager.ts        # 坑位管理 + 打乱算法
│   ├── MoveHandler.ts        # 移动逻辑（菠萝图 ↔ 托盘）
│   ├── StartScene.ts         # 主菜单按钮逻辑
│   ├── FloatingHand.ts       # 浮动手型（跟随鼠标/触摸）
│   ├── PositionRecorder.ts   # 开发工具（点格子导出 Config）
│   ├── GameData.ts           # 跨场景难度传参
│   └── events/
│       └── GameEventBus.ts   # 事件总线
├── textures/
│   └── 材质/                  # 43 张宝石纹理
└── resources/                # 背景/菠萝图/托盘等图片资源
```
