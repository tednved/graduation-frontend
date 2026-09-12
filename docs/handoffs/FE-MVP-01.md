# FE-MVP-01 交接报告

## 基本信息

- 任务 ID：FE-MVP-01
- 目标：一次完成请求会话、登录资料、MANUAL 认证与分类页面，形成可运行闭环
- 执行者：Claude
- 分支：`feat/FE-MVP-01-core`
- PR：[#3](https://github.com/tednved/graduation-frontend/pull/3)（已合并为 `83bcf67b`）
- 状态：DONE（代码审查与 Node 测试通过，PR #3 已合并；整包 GUI 验收由项目负责人在合并版 `main` 上执行）

## 实现结果

- 已完成：
  - 请求会话层：`services/request.js` 统一令牌注入、`X-Request-Id`、ApiResponse 拆包、204、错误归一化；
    401 单飞刷新并最多重放一次；网络失败仅 GET 重试一次，写请求不重试。
  - 会话存储：`store/session-store.js` 单一存储键 `session_v1`，损坏内容一律返回 null，`clearSession()` 推进 generation。
  - 五个接口模块：`auth-api`、`user-api`、`file-api`、`certification-api`、`category-api`。
  - 页面：登录、我的（资料）、编辑资料、校园认证、分类（两级树）五个页面全部实现，含卸载守卫与防重复点击。
  - 常量与工具：`constants/enums.js`、`constants/error-codes.js`（§7.2 全 25 个错误码）、`utils/id.js`、
    `utils/page-guard.js`、`utils/error-handler.js`、`config/index.js`。
  - 测试：`tests/` 4 个测试文件共 37 个用例，`node --test` 全通过。
  - `scripts/check-shell.cjs` 由「固定 20 个页面文件」改为「每个声明页面均有四件套 + 五个 Tab 页仍在 pages 中」。
- 审查修正（审核者复查时发现并修复）：`services/auth-api.js` 的 `logout()` 原以 `auth: false` 发出，
  与契约 `POST /auth/logout` 的 `security: bearerAuth` 冲突——服务端会 401，刷新令牌永远不会被撤销，
  只清空了本地会话。已改为携带 Bearer 并保留标准的「401 刷新一次后重放」，
  同时新增回归用例锁定「退出带令牌、登录与刷新不带令牌」。提交 `705b7a7`。
- 未完成：
  - 微信开发者工具 GUI 主链验收（本执行者无法运行开发者工具，需项目负责人执行）。
  - 与真实 BE-MVP-01 后端的联调；当前仅按已合并 OpenAPI 做契约级校验与本地替身测试。

## 修改文件

| 文件 | 用途 |
| --- | --- |
| `app.js` | 启动时恢复会话并订阅会话变化，不自动登录 |
| `app.json` | 新增 `pages/login`、`pages/profile-edit`、`pages/certification`，五项 TabBar 顺序不变 |
| `config/index.js` | 后端基础路径、请求/上传超时、GET 网络重试次数 |
| `constants/enums.js` | §4 枚举前端副本与认证状态中文文案 |
| `constants/error-codes.js` | §7.2 全部 25 个错误码的文案与处理动作 |
| `utils/id.js` | `X-Request-Id` 与设备标识生成、持久化、格式校验 |
| `utils/page-guard.js` | 页面存活守卫，卸载后丢弃 setData |
| `utils/error-handler.js` | 统一的错误出口：提示、引导登录、会话失效重开登录页 |
| `store/session-store.js` | 会话唯一来源，持久化与 generation 版本号 |
| `services/request.js` | 请求与上传核心层：单飞刷新、重放、重试策略 |
| `services/auth-api.js` | `wx.login` 登录、刷新、退出 |
| `services/user-api.js` | 查询与更新当前用户资料 |
| `services/file-api.js` | 图片上传（字段名 `file`），头像封装 |
| `services/certification-api.js` | 提交 MANUAL 认证与查询最近一次申请 |
| `services/category-api.js` | 分类树查询 |
| `pages/login/**` | 登录页 |
| `pages/profile/**` | 我的页：资料、认证状态、编辑与认证入口、退出登录 |
| `pages/profile-edit/**` | 编辑资料页：昵称、头像、手机号 |
| `pages/certification/**` | 校园认证页：提交、审核中、驳回原因与重新提交 |
| `pages/category/**` | 两级分类树 |
| `tests/**` | Node 内置测试运行器用例与替身 |
| `scripts/check-shell.cjs` | 页面四件套校验规则调整 |
| `DEVELOPMENT_LOG.md` | 新增 FE-MVP-01 行 |

## 接口与配置变化

- 依赖后端任务：BE-MVP-01（尚未合并，接口契约以已合并 API-01 为准）
- OpenAPI 版本：API-01 `e15baa77`（单校区冻结版）
- 新增或修改 service：新增 `request`、`auth-api`、`user-api`、`file-api`、`certification-api`、`category-api`
- app.json/env/constants 变化：`app.json` 新增三个非 Tab 页面；`config/index.js` 引入 `baseUrl`（默认 `http://127.0.0.1:8080/api/v1`）

## 页面规则

- 登录与权限：未登录时「我的」页只显示登录引导，不自动跳转；受保护页面在无会话时引导登录；
  `AUTH_REFRESH_INVALID` 与 `USER_DISABLED` 清空会话并重开登录页。退出登录无论服务端是否成功都清空本地会话。
- 加载/空态/错误态：分类与认证页有加载中、加载失败（带重试）、空数据三种状态；「我的」页未登录与已登录两态。
- 防重复操作与分页：登录、保存资料、提交认证、退出登录均有提交中标记与按钮禁用；页面卸载后不再 setData。
- 单校区：不显示校区选择器，任何请求都不带 `campusId`（`tests/api-contract.test.js` 有专项断言）。

## 验证证据

| 开发者工具场景 | 结果 |
| --- | --- |
| 冷启动/页面进入/接口成功/接口失败 | 未运行（本执行者无法启动微信开发者工具，需项目负责人验收） |

可在本机复现的命令与结果：

| 命令 | 结果 |
| --- | --- |
| `node scripts/check-shell.cjs` | 6/6 项通过（8 个页面 × 4 = 32 个文件） |
| `node --test "tests/**/*.test.js"` | 37 个用例全部通过 |
| `node --check <每个新增/修改的 .js>` | 全部通过 |
| 全部新增 `.json` 严格解析 | 通过（`check-shell` 覆盖） |

## 联调结果

- 后端环境：未联调（BE-MVP-01 尚在实施中）
- 成功路径：未联调；契约级断言已覆盖登录、查询/更新资料、提交认证、查询认证、分类树的方法/路径/请求体
- 失败路径：未联调；替身测试已覆盖 401 刷新与重放、刷新失败清会话、退出竞态、USER_DISABLED、
  网络失败重试策略、204、`CERTIFICATION_PENDING_EXISTS` 处理分支
- 尚未联调内容：全部真实 HTTP 往返、文件上传、管理员审核后的状态刷新

## 风险与阻塞

- 已知风险：
  - `config/index.js` 的 `baseUrl` 指向本机 `127.0.0.1:8080`，真机预览需改为可访问地址，
    且微信开发者工具需勾选「不校验合法域名」。
  - `pages/**` 与 `services/**` 在 FE-01 中属于受保护文件，本任务包已授权写入，但 FE-01 的 PR 若尚未合并，
    合并顺序需要项目负责人确认。
- 阻塞事项：真实联调依赖 BE-MVP-01 可用。
- 需要负责人决定：是否需要在本 PR 内先完成一次带 stub 的开发者工具演示，还是等后端合并后一次联调。

## 下一任务输入

- 可复用组件或 service：`services/request.js`（含上传与刷新队列）、`store/session-store.js`、
  `utils/error-handler.js`、`utils/page-guard.js`、`constants/enums.js`、`constants/error-codes.js`。
- 页面路由与数据结构：`/pages/login/login`、`/pages/profile/profile`、`/pages/profile-edit/profile-edit`、
  `/pages/certification/certification`、`/pages/category/category`；
  分类树为 `{ categories: [{ id, name, sortNo, status, children? }] }`，二级节点不含 `children`。
- 接入注意事项：
  - 新增页面必须同时补 `app.json` 的 `pages`，`check-shell` 会校验四件套。
  - 写请求不要调用 `services/request.js` 之外的自定义请求，否则会绕过刷新与错误归一化。
  - 认证当前仅 `MANUAL`；`CERTIFICATION_EVIDENCE` 上传不在 MVP 范围内。
  - 商品列表、发布、消息不在本任务范围，分类页二级分类点击仅给出说明提示。
