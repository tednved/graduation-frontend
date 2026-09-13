# FE-MVP-03 交接报告

## 基本信息

- 任务 ID：FE-MVP-03
- 目标：交易、评价与消息的前端闭环（下单、买入/卖出订单、状态操作、评价、消息与未读红点）
- 执行者：Claude
- 分支：`feat/FE-MVP-03-trade`
- PR：本分支的 Draft PR（见 PR 描述）
- 状态：REVIEW（代码与自动测试完成；真实联调与 GUI 冒烟待后端 BE-MVP-03 就绪后执行）

## 实现结果

### 新增 service（三个，全部只按 OpenAPI 第八节 8.8～8.10 编写）

| Service | 方法 | 契约路径 |
| --- | --- | --- |
| `services/order-api.js` | `create` / `getDetail` / `confirm` / `reject` / `cancel` / `deliver` / `receive` / `listMine` | `POST /orders`、`GET /orders/{id}`、`POST /orders/{id}/{confirm,reject,cancel,deliver,receive}`、`GET /users/me/orders` |
| `services/review-api.js` | `create` / `eligibility` / `listByUser` / `getCredit` | `POST /reviews`、`GET /orders/{id}/review-eligibility`、`GET /users/{id}/reviews`、`GET /users/{id}/credit` |
| `services/notification-api.js` | `list` / `unreadCount` / `markRead` / `markAllRead` | `GET /notifications`、`GET /notifications/unread-count`、`PUT /notifications/{id}/read`、`PUT /notifications/read-all` |

未新建第二套 request/session：全部沿用 `services/request.js` 与 `store/session-store.js`，测试期间未改动这两个文件。

### 新增页面

| 页面 | 说明 |
| --- | --- |
| `pages/orders/**` | 买入 / 卖出双视角 + 状态筛选（picker）+ 分页；未登录引导、空态、失败重试；切换视角或筛选即重置分页 |
| `pages/order-detail/**` | 商品快照、买卖双方、金额、事件时间线；按钮只由 `allowedActions` 驱动；写操作二次确认 + 防重复点击；成功用响应详情刷新 |
| `pages/review-create/**` | 先查 `review-eligibility`，`canReview` 为 true 才渲染表单；1～5 星 + ≤500 字内容；已评价 / 不可评价有独立状态 |
| `pages/user-reviews/**` | 信用摘要（平均分 + 1～5 分分布条形图）+ 公开评价分页 + 评分筛选；公开接口，匿名可看 |

### 重写与相邻修改

| 文件 | 改动 |
| --- | --- |
| `pages/messages/**` | 由 FE-01 占位页重写为真实消息列表：未读筛选、单条已读、全部已读、点击按 `bizType`/`bizId` 跳订单或商品详情；四个页面状态齐全 |
| `pages/item-detail/item-detail.js`、`.wxml` | 「我想要」接到真实创建订单；未登录跳登录、未认证跳认证、作者不能买自己商品；按钮处理中禁用 |
| `pages/profile/profile.js`、`.wxml` | 新增「我买到的 / 我卖出的 / 我收到的评价」三个入口 |
| `app.json` | 注册 4 个新页面；五项 Tab 顺序与文案不变（`check-shell` 校验通过） |
| `app.js` | 启动 / 回到前台刷新未读红点；登录态翻转时刷新或清除红点 |
| `constants/enums.js` | 新增 `TradeMode`/`OrderStatus`/`OrderAction`/`OrderSide`/`ReviewStatus`/`NotificationType` 及状态、按钮、事件、消息文案与色调，筛选下拉项 |
| `utils/order-view.js` | 新增：订单列表/详情、时间线事件、按钮（含二次确认文案与是否需要原因）、原因校验、路由生成 |
| `utils/review-view.js` | 新增：信用摘要与 1～5 分分布、评价条目星级映射 |
| `utils/notification-view.js` | 新增：消息类型文案、未读标记、`bizType`→路由映射、红点文案 |
| `utils/unread-badge.js` | 新增：消息 Tab 红点的唯一设置/清除入口 |
| `tests/helpers/wx-stub.js` | 扩展 `setTabBarBadge`/`removeTabBarBadge` 与调用记录，用于断言红点行为 |

## 关键实现约定

- **ID 一律十进制字符串**：所有 service 与 view 层用 `String(id)` 透传，无 `parseInt`/`Number`；测试用 `9007199254740993`（超过 `Number.MAX_SAFE_INTEGER`）断言消息 ID 与跳转地址未被数值化。
- **`clientRequestId` 复用**：在商品详情页用户点击「我想要」时生成一次并缓存在页面实例上；
  - 网络失败（响应未到达，服务端可能已建单）**保留同一个键**，重试即同键幂等重放；
  - HTTP 层拒绝（订单肯定未创建）才丢弃重来，避免同键换商品触发 `ORDER_DUPLICATE_REQUEST`；
  - 成功后才清空。`services/order-api.js` 不会自行替换调用方传入的键（有专项测试）。
- **写请求不自动重试**：沿用请求层既有行为（仅 GET 网络失败重试一次），订单/评价/消息的写操作测试逐条断言「失败后只发一次」。
- **订单按钮只由 `allowedActions` 驱动**：`utils/order-view.js` 只做翻译；未知动作被忽略而不是猜一个标签；空数组不渲染任何按钮。
- **操作成功后不追加 GET**：`POST /orders/{id}/{action}` 的响应与 `GET /orders/{id}` 同构，直接用它刷新页面；失败只提示错误，不改动本地数据。
- **未读红点不本地累加**：每次都向 `/notifications/unread-count` 取真实值；未登录一律清除；请求失败保留现状（不因一次网络失败把红点抹掉）。
- **消息点击顺序严格为「先标已读，再跳转」**：标记失败时提示错误、保留未读状态且不跳转，用户可以原地重试；不会出现「本地已读、服务端未读」的错位。
- **图片与头像**一律经 `utils/media-url.js` 转绝对地址（订单快照、双方头像、评价人头像、消息卡片），未绕开上一里程碑的修复。

## 修改文件

新增：`services/{order,review,notification}-api.js`、`utils/{order-view,review-view,notification-view,unread-badge}.js`、
`pages/orders/**`、`pages/order-detail/**`、`pages/review-create/**`、`pages/user-reviews/**`、
`tests/order/**`、`tests/review/**`、`tests/notification/**`、`docs/handoffs/FE-MVP-03.md`。

修改：`app.js`、`app.json`、`constants/enums.js`、`pages/messages/**`、`pages/item-detail/item-detail.js`、
`pages/item-detail/item-detail.wxml`、`pages/profile/profile.js`、`pages/profile/profile.wxml`、
`tests/helpers/wx-stub.js`、`DEVELOPMENT_LOG.md`。

只读未改：`services/request.js`、`store/session-store.js`、`utils/media-url.js`、`backend/openapi.yaml`、Flyway。

## 自动测试

| 命令 | 结果 |
| --- | --- |
| `node scripts/check-shell.cjs` | 6/6 项通过（15 个页面 × 4 = 60 个文件） |
| `node --test "tests/**/*.test.js"` | **123/123 通过**（既有 76 条全部保留且未弱化；本次新增 47 条） |
| `git diff --check origin/main...HEAD` | 通过，无空白错误 |
| `node --check <每个新增/修改的 .js>` | 全部通过 |

新增用例覆盖：order/review/notification 三个 service 的方法与路径、请求体字段、原因 2～200 校验、
评分 1～5 与内容 ≤500 校验、`clientRequestId` 复用与写请求不重试、订单状态/事件/allowedActions 映射、
`bizType`→路由跳转、未读红点设置与清除。

## 真实联调

**未执行。** 后端 BE-MVP-03（订单 BE-08、评价与消息 BE-09）尚未实现，本机 8080 未启动，
`/orders`、`/reviews`、`/notifications` 均无可用实现，因此本轮**没有**对真实后端跑过接口主链
（创建订单 → 接单 → 交付 → 收货 → 评价 → 消息读取）。**不伪造联调结果。**
待 BE-MVP-03 就绪后需要补跑：真实创建订单（含同键重放与 `ORDER_DUPLICATE_REQUEST`）、
状态机全链、`REVIEW_ALREADY_EXISTS`、消息已读幂等、未读数增减。

## GUI 冒烟

**未执行**（按约定微信开发者工具 GUI 由项目负责人执行，本轮不启动）。
待办冒烟路径：首页 → 商品详情 →「我想要」→ 订单详情 →（另一身份）接单/交付 → 收货 → 评价 → 消息页
→ 点击消息跳转 → 消息 Tab 红点。注意本地演示后端把 Mock 登录固定在单个 ADMIN 账号，
开发者工具里只有一个用户，**买家/卖家双角色链路在 GUI 无法完成**，需由后端多用户测试与真实接口脚本证明。

## 遗留与待确认

1. **真实联调与 GUI 冒烟未做**（原因见上），这是本任务唯一的阻塞项，PR 保持 Draft。
2. **`bizType` 取值表未冻结**：契约与总纲都只说「关联业务类型，用于前端跳转」，未给出字面量。
   前端按 `ORDER`/`ITEM` 归一化（大小写与复数形式容忍），未知类型不跳转并提示。
   待 BE-09 落地后收敛为固定表，必要时同步更新 `utils/notification-view.js` 与测试。
3. **消息点击的失败策略**：现按固定规则「先标已读，再跳转」，标记失败即不跳转。
   若负责人希望「标记失败也允许查看内容」，需调整 `pages/messages/messages.js` 的 `onTapItem`。
4. **订单详情的事件时间线**：`remark` 只在后端写入时才有值（拒单/取消原因），当前按契约展示；
   若后端在 `CREATE` 事件也写 remark，页面无需改动。
5. 双角色 GUI 场景（买家/卖家权限差异）仍只能由接口联调与后端多用户测试覆盖。

## 下一任务输入

- 可复用的 service / 工具：`services/order-api.js`（含 `newClientRequestId` 幂等键生成）、
  `utils/order-view.js`（路由生成 `orderDetailRoute` / `itemDetailRoute`）、
  `utils/unread-badge.js`（红点在 app.js 已接线，页面标记已读后调用 `refresh()` 即可）。
- 页面路由：`/pages/orders/orders?side=BUY|SELL`、`/pages/order-detail/order-detail?id=<orderId>`、
  `/pages/review-create/review-create?orderId=<orderId>`、`/pages/user-reviews/user-reviews?id=<userId>&nickname=<urlencoded>`。
- 注意：新增页面必须同时在 `app.json` 登记四件套，`check-shell` 会校验。
