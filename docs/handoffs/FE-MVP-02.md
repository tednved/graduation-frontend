# FE-MVP-02 交接报告

## 基本信息

- 任务 ID：FE-MVP-02
- 目标：商品发布、列表、详情、搜索与收藏的前端闭环
- 执行者：Claude
- 分支：`feat/FE-MVP-02-item-favorite`
- PR：[#4](https://github.com/tednved/graduation-frontend/pull/4)（Draft）
- 状态：IN_PROGRESS（代码与本地验证完成；接口层真实联调 22/22 完成，见「联调结果」。仍待负责人在开发者工具验收；不得由 Agent 置 DONE）

## 实现结果

- 已完成：
  - 商品与收藏接口层：`services/item-api.js`（搜索/详情/创建/全量修改/上架/下架/删除/我的发布）、
    `services/favorite-api.js`（收藏/取消/状态/我的收藏）；`services/file-api.js` 增加 `uploadItemImage`。
  - 商品展示映射：`utils/item-view.js`（金额、原价、日期、卡片、详情、状态提示），
    金额与状态文案不再散落在各页面。
  - 首页 `pages/home/**`：搜索入口 + 一级分类快捷筛选 + 商品流，支持下拉刷新、触底分页、骨架屏、
    空态与失败重试（原 FE-01 占位页已替换）。
  - 搜索页 `pages/search/**`（新增）：关键词（300ms 防抖）、价格区间、成色、四种排序；
    筛选条件变化即重置分页；本地搜索历史（最多 10 条，可单条点击或清空）。
  - 详情页 `pages/item-detail/**`（新增）：图片轮播与预览、价格/成色/状态、描述、卖家、
    浏览量/收藏量；按钮完全由 `allowedActions` 驱动；收藏为即时反馈并在失败时回滚；
    作者操作编辑/上架/下架/删除；下单入口保留提示（订单属 MVP-03，本页不发任何订单请求）。
  - 发布页 `pages/publish/**`（重写）：图片多选与顺序调整（上移/下移/删除，首图为封面）、
    标题/描述/售价/原价/成色/二级分类、草稿保存与恢复、提交前校验、离开提醒、
    提交中禁用按钮；既是新建 Tab 页，也承接详情页发起的编辑（经本地存储传参）。
  - 收藏页 `pages/favorites/**`（新增）：分页收藏列表、列表内直接取消收藏（即时移除，失败回拉）、
    已下架/已删除商品的显式状态标注、未登录引导。
  - 「我的」页新增「我的收藏」入口（`pages/profile/**`，相邻文件改动，见「修改文件」）。
  - 常量：`constants/enums.js` 增补 `ItemStatus`/`ItemCondition`/`ItemSort` 及中文文案、色调、选项与取值函数。
  - 全局样式：`app.wxss` 增补商品卡片、状态标签与列表状态三类共用样式（首页/搜索/收藏共用，避免三处复制）。
  - 测试：新增 `tests/item/` 三个文件，覆盖接口方法路径与请求体、金额归一化、表单校验与请求体组装、
    枚举文案与卡片/详情映射。
- 未完成：
  - 微信开发者工具 GUI 验收（本执行者无法启动开发者工具，需项目负责人执行）。
- 已完成（本次补充）：
  - 与真实 BE-MVP-02 后端的接口层联调：发布 → 上架 → 搜索/分类命中 → 详情 → 收藏闭环，
    22 项通过、0 失败、1 项如实跳过（见「联调结果」）。

## 修改文件

| 文件 | 用途 |
| --- | --- |
| `app.json` | 追加 `pages/search/search`、`pages/item-detail/item-detail`、`pages/favorites/favorites`；五项 TabBar 顺序不变 |
| `app.wxss` | 新增 `.item-card*`、`.item-status*`、`.list-state*`、`.list-more` 共用样式 |
| `constants/enums.js` | 商品状态/成色/排序枚举与中文文案、色调、选项 |
| `utils/item-view.js` | 新增：金额、原价、日期格式化，卡片与详情视图映射、状态提示文案 |
| `services/item-api.js` | 新增：商品搜索、详情、创建、修改、上架、下架、删除、我的发布 |
| `services/favorite-api.js` | 新增：收藏、取消收藏、收藏状态、我的收藏 |
| `services/file-api.js` | 新增 `uploadItemImage`（`bizType=ITEM_IMAGE`） |
| `pages/home/**` | 商品流首页（原占位页重写） |
| `pages/search/**` | 新增：搜索与筛选 |
| `pages/item-detail/**` | 新增：商品详情与操作入口 |
| `pages/publish/**` | 重写：完整发布/编辑表单；新增纯函数模块 `item-form.js` |
| `pages/publish/item-form.js` | 新增：表单校验与请求体组装（纯函数，可直接单测） |
| `pages/favorites/**` | 新增：我的收藏 |
| `pages/profile/profile.js`、`pages/profile/profile.wxml` | 相邻改动：新增「我的收藏」入口与路由常量 |
| `tests/item/**` | 新增：`item-api.test.js`、`item-form.test.js`、`item-view.test.js` |
| `DEVELOPMENT_LOG.md` | 新增 FE-MVP-02 行 |

## 接口与配置变化

- 依赖后端任务：BE-MVP-02（同里程碑并行实施）
- OpenAPI 版本：API-01 `e15baa77`（单校区冻结版）；本任务未修改契约，也未使用契约外的字段
- 新增 service：`item-api`、`favorite-api`；`file-api` 增加一个方法
- 只读文件未改动：`services/request.js`、`store/session-store.js`
- `app.json`/env/constants 变化：`app.json` 追加三个非 Tab 页面；无新增配置项

## 页面规则

- 登录与权限：
  - 搜索与详情是公开接口，匿名可用；详情在无令牌时后端返回 `favorited: null`，页面按未收藏展示，点击收藏才引导登录。
  - 收藏页在无会话时只显示登录引导；发布页要求会话 + `certificationStatus === APPROVED`，未认证时表单不可用并引导去认证。
  - 按钮展示只依据后端 `allowedActions`，前端不推断权限；后端每次请求仍会重新校验。
- 加载/空态/错误态：首页有骨架屏、空态（还没有在售商品）、失败重试；搜索有未发起/加载中/无结果/失败四态；
  详情有加载中/已删除或不存在/失败三态；收藏有未登录/加载中/空/失败四态。
- 防重复操作与分页：收藏切换、下架、删除、提交表单均有进行中标记；列表统一 20 条/页、触底加载、到底提示；
  删除与下架前弹确认框。
- 金额：页面输入经 `itemApi.normalizeMoney` 收敛为两位小数字符串（`^[0-9]+\.[0-9]{2}$`）；
  拒绝 `1e3`、负数、三位小数与超出 `DECIMAL(10,2)` 的金额（提交前即拦截，不依赖后端报错）。
- 编辑传参：`publish` 是 TabBar 页，`wx.switchTab` 不能带参数，故详情页把商品 ID 写入本地存储 `item_edit_id`，
  由发布页 `onShow` 取走并清空。
- 单校区：不显示校区选择器，任何请求都不带 `campusId`（`tests/item/item-api.test.js` 有专项断言）。

## 验证证据

| 开发者工具场景 | 结果 |
| --- | --- |
| 首页/搜索/详情/发布/收藏的进入、成功、失败、空态 | 未运行（本执行者无法启动微信开发者工具，需项目负责人验收） |

可在本机复现的命令与结果：

| 命令 | 结果 |
| --- | --- |
| `node scripts/check-shell.cjs` | 6/6 项通过（11 个页面 × 4 = 44 个文件） |
| `node --test "tests/**/*.test.js"` | 73 个用例全部通过（FE-MVP-01 的 37 个用例保持通过，未弱化任何断言） |
| `node --check <每个新增/修改的 .js>` | 全部通过 |
| 全部新增 `.json` 严格解析 | 通过（`check-shell` 覆盖） |
| `IT_RUN=mvp02 node D:\tmp-integration\item-chain.js`（仓库外脚本，见「联调结果」） | 22 PASS / 0 FAIL / 1 SKIP，EXIT=0 |

## 联调结果

- 方式：仓库外脚本 `D:\tmp-integration\item-chain.js` 在 Node 里 `require` 本仓库的真实模块
  （`services/item-api.js`、`favorite-api.js`、`file-api.js`、`certification-api.js`、`category-api.js`、
  `store/session-store.js`、`constants/enums.js`，以及 `pages/publish/item-form.js`），
  用 `wx-real.js` 顶掉 `global.wx`，对 `127.0.0.1:8080` 打真实 HTTP（后端为 BE-MVP-02 的新 jar）。
  **这不是 GUI 验收**——页面渲染与交互仍未在开发者工具里跑过。
- 命令与结果：`IT_RUN=mvp02 node item-chain.js` → **22 PASS / 0 FAIL / 1 SKIP，EXIT=0**。
- 成功路径（真实往返，全部通过）：
  登录 → 认证前置 → 取二级分类（101）→ 上传 `ITEM_IMAGE` → 创建草稿（MAIN 校区、图片绑定、
  金额两位小数）→ 草稿公开搜索不可见 → 上架 → 上架响应 `version` 与详情回读一致 →
  下架 → **用下架响应的 `version` 立刻编辑成功且 `version` 增长** → 重新上架 →
  关键词搜索命中 → 二级分类筛选命中 → **只传一级分类展开到启用子类并命中** →
  匿名详情 `isOwner=false`/`favorited=null` → 浏览量自增 → 我的发布 → 下架后删除 204 → 删除后搜索不再命中。
- 失败路径（已核对真实响应）：收藏自己商品 409 `ITEM_SELF_OPERATION`；
  在 `ON_SALE` 状态编辑/删除 409 `ITEM_NOT_EDITABLE`。
- 尚未覆盖：
  - 跨用户收藏（收藏他人 → 出现在收藏列表 → 取消后消失、计数增减）：演示环境把 Mock 登录钉在单一
    管理员账号，两次登录是同一用户，且库中无其他卖家的在售商品，脚本如实打 SKIP。
    该场景由后端真实库用例 `FavoriteFlowTests` 覆盖。
  - GUI 层：页面渲染、图片轮播与预览、按钮随 `allowedActions` 的实际展示、本地搜索历史、
    草稿保存与恢复、`wx.enableAlertBeforeUnload` 离开提醒——仍需负责人在开发者工具验收。
- 联调暴露的问题：本次 3 次失败**全部出在联调脚本自身**（图片字段传了非 ID 值、用半截请求体调 `PUT`、
  在 `ON_SALE` 状态编辑/删除），后端每次都按契约正确拒绝，本仓库前端代码未发现缺陷。
- 需负责人裁决（本仓库服务层）：`services/item-api.js` 的 `buildWriteBody` 固定生成
  `title`/`description`/`price`/`condition`/`categoryId`/`imageFileIds` 全部键，因此经服务层
  **无法表达契约允许的「省略字段即保留原值」**——缺省会被补齐成 `price: null` 或 `imageFileIds: []`
  并被后端判为非法。真实页面始终提交完整表单（`validateItemForm` 先拦截），故当前不可见；
  是否改成「只发送调用方真正提供的字段」，请负责人决定。

## 风险与阻塞

- 已知风险：
  - 接口层真实联调已完成（22/22，见「联调结果」），但 **GUI 仍未验收**：页面渲染与交互属未验证状态，
    合并前建议在开发者工具跑一遍主链（发布 → 上架 → 首页/搜索命中 → 详情 → 收藏 → 取消收藏）。
  - `pages/publish/publish.js` 依赖 `wx.enableAlertBeforeUnload`，基础库不支持时静默跳过，不影响提交。
  - 首页分类筛选只传一级分类 ID，依赖后端「一级含启用子类」的实现——已联调验证通过
    （只传一级分类 1 命中其启用子类 101 下的商品）。
- 阻塞事项：无（接口层联调已不再依赖后端是否可用）。
- 需要负责人决定：
  - 详情页「我想要」当前只提示「下单功能将在下一阶段开放」，是否按 MVP-03 保留为入口。
  - GUI 验收是否使用一个已认证账号：作者侧（编辑/下架/删除）按钮只在
    `certificationStatus === APPROVED` 时出现；接口层联调已用该账号（自行提交认证并审核通过）
    覆盖这些动作，但账号未认证时 GUI 里看不到这些按钮。
  - `buildWriteBody` 是否支持真正的局部更新（见「联调结果」最后一条）。

## 下一任务输入

- 可复用组件或 service：`services/item-api.js`、`services/favorite-api.js`、`utils/item-view.js`、
  `pages/publish/item-form.js`（校验与请求体组装可被后续订单/编辑场景复用）、`app.wxss` 的 `.item-card*` 卡片样式。
- 页面路由与数据结构：
  - `/pages/search/search?id=<keyword>` 支持带关键词进入；`/pages/item-detail/item-detail?id=<itemId>` 为详情唯一入口。
  - 列表统一使用 `PageResponse`：`{ items, page, size, totalElements, totalPages, hasNext }`。
  - `ItemCard` 用于列表，`ItemDetail` 用于详情；详情额外依赖 `favorited`/`isOwner`/`canBuy`/`allowedActions`。
- 接入注意事项：
  - 新增页面必须同时补 `app.json` 的 `pages`，`check-shell` 会校验四件套。
  - 列表卡片复用 `app.wxss` 的 `.item-card*`，不要在三处各写一份样式。
  - MVP-03 下单入口已预留在详情页 `allowedActions` 的 `BUY` 分支，接入时替换该分支的提示即可。
  - 商品相关写请求一律经 `services/item-api.js`，不要在页面里直接调用 `request.js`。
