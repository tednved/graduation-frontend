# FE-MVP-03 交接报告

## 基本信息

- 任务 ID：FE-MVP-03
- 目标：交易、评价与消息的前端闭环（下单、买入/卖出订单、状态操作、评价、消息与未读红点、管理员控制台）
- 执行者：Claude
- 分支：`feat/FE-MVP-03-trade`
- PR：[#5](https://github.com/tednved/graduation-frontend/pull/5)（Draft）
- 状态：REVIEW（代码与自动测试完成；审查意见 1 已修复，见「审查意见修复」；真实联调与 GUI 冒烟待授权启动后端后执行）

## 实现结果

### 新增 service（四个，全部只按 OpenAPI 第八节 8.8～8.11 编写）

| Service | 方法 | 契约路径 |
| --- | --- | --- |
| `services/order-api.js` | `create` / `getDetail` / `confirm` / `reject` / `cancel` / `deliver` / `receive` / `listMine` | `POST /orders`、`GET /orders/{id}`、`POST /orders/{id}/{confirm,reject,cancel,deliver,receive}`、`GET /users/me/orders` |
| `services/review-api.js` | `create` / `eligibility` / `listByUser` / `getCredit` | `POST /reviews`、`GET /orders/{id}/review-eligibility`、`GET /users/{id}/reviews`、`GET /users/{id}/credit` |
| `services/notification-api.js` | `list` / `unreadCount` / `markRead` / `markAllRead` | `GET /notifications`、`GET /notifications/unread-count`、`PUT /notifications/{id}/read`、`PUT /notifications/read-all` |
| `services/admin-api.js` | `listCertifications` / `approveCertification` / `rejectCertification` / `listUsers` / `disableUser` / `enableUser` / `listItems` / `offShelfItem` / `listAuditLogs` | `GET /admin/certifications`、`POST /admin/certifications/{id}/{approve,reject}`、`GET /admin/users`、`POST /admin/users/{id}/{disable,enable}`、`GET /admin/items`、`POST /admin/items/{id}/off-shelf`、`GET /admin/audit-logs` |

未新建第二套 request/session：全部沿用 `services/request.js` 与 `store/session-store.js`，测试期间未改动这两个文件。

### 新增页面

| 页面 | 说明 |
| --- | --- |
| `pages/orders/**` | 买入 / 卖出双视角 + 状态筛选（picker）+ 分页；未登录引导、空态、失败重试；切换视角或筛选即重置分页 |
| `pages/order-detail/**` | 商品快照、买卖双方、金额、事件时间线；按钮只由 `allowedActions` 驱动；写操作二次确认 + 防重复点击；成功用响应详情刷新 |
| `pages/review-create/**` | 先查 `review-eligibility`，`canReview` 为 true 才渲染表单；1～5 星 + ≤500 字内容；已评价 / 不可评价有独立状态 |
| `pages/user-reviews/**` | 信用摘要（平均分 + 1～5 分分布条形图）+ 公开评价分页 + 评分筛选；公开接口，匿名可看 |
| `pages/admin/**` | 管理员控制台，四个区域（认证审核 / 用户 / 商品 / 审计）共用一个列表骨架；入口在「我的」页仅 ADMIN 可见；页内再查一次角色，非 ADMIN 提示并退出；原因类操作统一用可输入模态框并复用 service 的长度校验 |

### 重写与相邻修改

| 文件 | 改动 |
| --- | --- |
| `pages/messages/**` | 由 FE-01 占位页重写为真实消息列表：未读筛选、单条已读、全部已读、点击按 `bizType`/`bizId` 跳订单或商品详情；四个页面状态齐全 |
| `pages/item-detail/item-detail.js`、`.wxml` | 「我想要」接到真实创建订单；未登录跳登录、未认证跳认证、作者不能买自己商品；按钮处理中禁用 |
| `pages/profile/profile.js`、`.wxml` | 新增「我买到的 / 我卖出的 / 我收到的评价」三个入口 |
| `pages/profile/profile.js`、`.wxml` | 新增「管理台」入口，**仅 `role === ADMIN` 时渲染**（审查意见 1 的入口部分） |
| `app.json` | 注册 5 个新页面；五项 Tab 顺序与文案不变（`check-shell` 校验通过） |
| `app.js` | 启动 / 回到前台刷新未读红点；登录态翻转时刷新或清除红点 |
| `constants/enums.js` | 新增 `TradeMode`/`OrderStatus`/`OrderAction`/`OrderSide`/`ReviewStatus`/`NotificationType` 及状态、按钮、事件、消息文案与色调，筛选下拉项；另新增 `UserStatus`/`UserRole`/`CertificationStatus`/`AuditAction`/`AuditTargetType` 的文案、色调与管理台筛选下拉项 |
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

新增：`services/{order,review,notification,admin}-api.js`、`utils/{order-view,review-view,notification-view,admin-view,unread-badge}.js`、
`pages/orders/**`、`pages/order-detail/**`、`pages/review-create/**`、`pages/user-reviews/**`、`pages/admin/**`、
`tests/order/**`、`tests/review/**`、`tests/notification/**`、`tests/admin/**`、`docs/handoffs/FE-MVP-03.md`。

修改：`app.js`、`app.json`、`constants/enums.js`、`pages/messages/**`、`pages/item-detail/item-detail.js`、
`pages/item-detail/item-detail.wxml`、`pages/profile/profile.js`、`pages/profile/profile.wxml`、
`tests/helpers/wx-stub.js`、`DEVELOPMENT_LOG.md`。

只读未改：`services/request.js`、`store/session-store.js`、`utils/media-url.js`、`backend/openapi.yaml`、Flyway。

## 自动测试

| 命令 | 结果 |
| --- | --- |
| `node scripts/check-shell.cjs` | 6/6 项通过（16 个页面 × 4 = 64 个文件） |
| `node --test "tests/**/*.test.js"` | **137/137 通过**（既有 76 条全部保留且未弱化；本次新增 61 条） |
| `git diff --check origin/main...HEAD` | 通过，无空白错误 |
| `node --check <每个新增/修改的 .js>` | 全部通过 |

新增用例覆盖：order/review/notification/admin 四个 service 的方法与路径、请求体字段、原因 2～200 校验、
评分 1～5 与内容 ≤500 校验、`clientRequestId` 复用与写请求不重试、订单状态/事件/allowedActions 映射、
`bizType`→路由跳转、未读红点设置与清除、四个管理台视图映射（含 ID 不数值化、媒体转绝对地址、
平均值 `null` → `—`）、管理端筛选参数（含「单个 status 值、不发数组」与空白关键字不下发）。

## 真实联调

**未执行。** 后端 BE-MVP-03 的实现已在 `feat/BE-MVP-03-trade` 分支完成（订单 / 评价 / 消息 / 管理端全部落地，
真实 MySQL 60/60，见 `backend/docs/handoffs/BE-MVP-03.md`），但**本机 8080 当前无监听进程**
（`/actuator/health` 返回 000）。按仓库约定启动 8080 需项目负责人授权，因此本轮**没有**对真实后端跑过接口主链
（创建订单 → 接单 → 交付 → 收货 → 评价 → 消息读取 → 管理台四区域）。**不伪造联调结果。**

授权后需要补跑的清单：

1. 订单主链：创建（201）→ 同键重放（200，同订单 ID）→ 同键换商品（409 `ORDER_DUPLICATE_REQUEST`）→ 接单 → 交付 → 收货 → 商品转 `SOLD`。
2. 权限与状态分流：非参与方 403（含对已完成订单调接单，须为 403 而非 409）；状态不符 409。
3. 评价：`review-eligibility` → 创建（201）→ 重复（409 `REVIEW_ALREADY_EXISTS`）→ 信用汇总重算。
4. 消息：订单各状态变化生成消息、未读数增减、单条已读幂等、`read-all` 的 `updatedCount`。
5. 管理台四个区域：认证通过与驳回（原因 2～200）、用户禁用（连带旧令牌 403 `USER_DISABLED`）与恢复、商品强制下架（含商品状态与卖家消息）、审计记录可查。
6. 分页与筛选：`page`/`size`、`hasNext`、单个 `status` 值、空白关键字不下发。

## GUI 冒烟

**未执行**（按约定微信开发者工具 GUI 由项目负责人执行，本轮不启动）。
待办冒烟路径：首页 → 商品详情 →「我想要」→ 订单详情 →（另一身份）接单/交付 → 收货 → 评价 → 消息页
→ 点击消息跳转 → 消息 Tab 红点 →「我的」→ 管理台四区域。

注意：本地演示后端把 Mock 登录固定在单个 ADMIN 账号，开发者工具里只有一个用户，
**买家/卖家双角色链路在 GUI 无法完成**，需由后端多用户测试与真实接口脚本证明；
管理台的四个区域则可以用这个 ADMIN 账号在 GUI 内完整走一遍。

## 遗留与待确认

1. **真实联调与 GUI 冒烟未做**（原因见上），这是本任务唯一的阻塞项，PR 保持 Draft。
2. **`bizType` 取值表未冻结**：契约与总纲都只说「关联业务类型，用于前端跳转」，未给出字面量。
   前端按 `ORDER`/`ITEM` 归一化（大小写与复数形式容忍），未知类型不跳转并提示。
   待 BE-09 落地后收敛为固定表，必要时同步更新 `utils/notification-view.js` 与测试。
3. **消息点击的失败策略**：现按固定规则「先标已读，再跳转」，标记失败即不跳转。
   若负责人希望「标记失败也允许查看内容」，需调整 `pages/messages/messages.js` 的 `onTapItem`。
4. **订单详情的事件时间线**：`remark` 只在后端写入时才有值（拒单/取消原因），当前按契约展示；
   若后端在 `CREATE` 事件也写 remark，页面无需改动。
5. **管理端商品筛选只发单个 `status` 值**：`services/request.js` 的 `buildQuery` 用 `encodeURIComponent(String(value))`，
   数组会被拼成 `A,B` 而不是重复参数，故管理台的商品状态筛选做成单值下拉。若后续需要多状态，
   需先改请求层的查询序列化（属跨页面影响，未在本任务擅动）。
6. 双角色 GUI 场景（买家/卖家权限差异）仍只能由接口联调与后端多用户测试覆盖。

## 审查意见修复（2026-09-13）

负责人审查共 6 项，其中第 1 项（缺少管理员 GUI）属前端范围，本节记录；第 5 项（真实联调 + GUI 冒烟）
受 8080 授权阻塞，见上；其余 4 项由 `backend/docs/handoffs/BE-MVP-03.md` §11 记录。

### 管理员 GUI（审查意见 1）

任务包 `任务包/FE-MVP-03.md:60` 要求「我的页，仅 ADMIN 可见：认证审核、用户启停、商品下架、审计查询的紧凑管理台」，
本轮之前只有后端接口、没有前端页面。补齐内容：

| 新增 | 说明 |
| --- | --- |
| `services/admin-api.js` | 九个管理端操作全部接上；原因长度 2～200 的校验在此处实现一次，页面复用 `normalizeReason` / `reasonError`，不重复写第二份规则；关键字先 `trim`，空白等价于「不筛选」 |
| `utils/admin-view.js` | 四个区域的视图映射：ID 一律 `String()`（不数值化）、头像与图片走 `utils/media-url.js`、时间复用订单模块的 `formatDateTime`、`detail` 对象格式化为 `k=v` |
| `pages/admin/**` | 四件套齐备：四个区域共用一个列表骨架（分页、下拉刷新、触底加载、空态、失败重试），各区域自己的筛选控件；原因类操作统一用可输入模态框 |

权限是两层的，且**前端不推断权限**：

- 入口：`pages/profile/profile.js` 在 `refresh()` 里读 `userApi.getMe()` 的 `profile.role`，
  `role === ADMIN` 才把 `isAdmin` 置真、才渲染「管理台」按钮。角色只存在于 `GET /users/me`
  （登录返回的用户摘要 `UserSummaryResponse` 是 `{id, nickname, avatarUrl}`，**没有 role**），
  所以入口不能从会话里读。
- 页内：`pages/admin/admin.js` 的 `checkRole()` 在加载时**再查一次** `GET /users/me`，
  非 ADMIN 立即 toast 提示并退出（`navigateBack`，无返回栈时退回「我的」页），
  且在确认角色之前**不发任何管理端请求**。
- 真正的门禁仍只在服务端：每个管理请求在事务内 `UserService.requireAdmin` 重新判权，降权即时生效。
  前端的两次判断只是体验，不是安全边界——这一点写在了 `services/admin-api.js` 的文件头注释里。

页面侧的两处本地约束（服务端同样会拒绝，前端提前给出更好懂的提示）：
禁用自己（`isSelf` 比对会话用户 ID）不发请求；商品已 `OFF_SHELF`/`DELETED` 时不渲染「强制下架」按钮。

验证方式：`tests/admin/admin-api.test.js` 锁死九个方法的路径 / 查询串 / 请求体与原因长度边界；
`tests/admin/admin-view.test.js` 锁死四个映射（含 ID 不数值化、媒体转绝对地址、`averageRating: null` → `—`）。
另有一次性 Node 冒烟脚手架（已删除）在 stubbed `Page`/`wx` 下驱动了角色门禁与四个区域的全部写操作，
确认非管理员只会发出 `GET /users/me` 一次请求、403 时 toast + 退出、禁用自己零请求、
商品状态下拉第 4 项映射为 `status=OFF_SHELF`。

## 下一任务输入

- 可复用的 service / 工具：`services/order-api.js`（含 `newClientRequestId` 幂等键生成）、
  `utils/order-view.js`（路由生成 `orderDetailRoute` / `itemDetailRoute`）、
  `utils/unread-badge.js`（红点在 app.js 已接线，页面标记已读后调用 `refresh()` 即可）、
  `services/admin-api.js`（管理端九个操作 + 原因校验，后续管理类页面直接复用）。
- 页面路由：`/pages/orders/orders?side=BUY|SELL`、`/pages/order-detail/order-detail?id=<orderId>`、
  `/pages/review-create/review-create?orderId=<orderId>`、`/pages/user-reviews/user-reviews?id=<userId>&nickname=<urlencoded>`、
  `/pages/admin/admin`（入口只在「我的」页对 ADMIN 显示，但页内自查角色，直接导航也安全）。
- 注意：新增页面必须同时在 `app.json` 登记四件套，`check-shell` 会校验。
- 注意：`services/request.js` 的 `buildQuery` 不支持数组参数（会被拼成 `A,B`），
  需要多值筛选时要先改请求层，不要在各页面临时拼接查询串。
