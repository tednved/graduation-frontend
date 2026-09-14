# graduation-frontend

校园二手物品交易系统的微信小程序前端（原生小程序，JavaScript + WXML + WXSS）。覆盖登录、校园认证、商品发布/搜索/详情/收藏、订单全流程、双方互评、站内消息，以及管理员认证审核、用户、商品、订单监管和审计查看。

前端只做展示与交互，所有业务规则（权限、事务、状态机、金额与时间）以后端为准。上游入口见仓库根目录 `AGENTS.md` 与 `PROJECT_MEMORY.md`。

## 1. 环境要求

| 项 | 说明 |
| --- | --- |
| 微信开发者工具 | 稳定版即可，本项目在 `project.private.config.json` 里锁定 `libVersion` 3.17.2 |
| AppID | `wxd0c863de19c75f48`（已写入 `project.config.json`） |
| Node.js | 20 及以上（`node --test` 与 glob 参数需要），当前验证环境为 v24 |
| 后端 | 必须先在本机 `127.0.0.1:8080` 运行 |

## 2. 导入与运行

1. 打开微信开发者工具 → 导入项目。
2. **目录选择 `frontend/` 本身**（`app.json`、`project.config.json` 都在这一层，不要再往下嵌套）。
3. AppID 会自动带出 `wxd0c863de19c75f48`；用自己的测试号也可以，但需与后端 Mock 登录配合（见第 5 节）。
4. 确保后端已在 `127.0.0.1:8080` 启动（见 `../backend/README.md`），再点「编译」。

### 本地联调必须关闭域名校验

`config/index.js` 里 `baseUrl` 固定为 `http://127.0.0.1:8080/api/v1`，这是 HTTP 且带端口，开发者工具默认会拦截。项目已在 `project.private.config.json` 中设置：

```json
"setting": { "urlCheck": false }
```

该文件是开发者工具的**私有配置**（本机路径、窗口状态等），仓库内的这份只包含 `urlCheck=false` 等联调必需项，**不要**把带个人信息的开发者工具私有配置提交上来。

预览、真机调试入口在工具右上角；本项目演示统一在开发者工具的同机模拟器中完成。

## 3. 测试

无需后端即可运行：

```bash
cd frontend

# 小程序结构检查：页面四件套齐全、tabBar 顺序、路由无残留
node scripts/check-shell.cjs
# → 6/6 项通过，17 个页面 × 4 = 68 个文件

# 单元与契约测试
node --test "tests/**/*.test.js"
# → 138 个用例全部通过
```

`tests/` 覆盖请求层与重试策略、错误码映射、会话存储、媒体地址拼接，以及各业务域的视图映射（商品、订单、评价、通知、管理台）。这些断言的是「字段映射与边界处理」，不能替代后端集成测试与真实联调。

## 4. 目录结构

| 目录 | 内容 |
| --- | --- |
| `pages/` | 17 个页面，每个页面四件套（`.js` / `.json` / `.wxml` / `.wxss`） |
| `services/` | 按域拆分的接口封装，统一走 `services/request.js` |
| `utils/` | 视图映射、错误处理、媒体地址、未读角标、页面守卫等 |
| `store/` | 会话存储（登录态、用户摘要） |
| `config/` | 运行时配置（`baseUrl`、超时、重试次数），不含任何密钥 |
| `constants/` | 枚举与文案常量 |
| `tests/` | Node 测试，含 `tests/helpers/` |
| `scripts/check-shell.cjs` | 小程序结构静态检查 |

页面与接口的对应关系集中在 `services/`：`auth-api`、`user-api`、`certification-api`、`category-api`、`item-api`、`favorite-api`、`order-api`、`review-api`、`notification-api`、`file-api`、`admin-api`，另加底层的 `request.js`。

### 页面入口

- 五个 Tab：首页 `pages/home/home`、分类 `pages/category/category`、发布 `pages/publish/publish`、消息 `pages/messages/messages`、我的 `pages/profile/profile`。
- 其余页面：登录 `login`、资料编辑 `profile-edit`、认证 `certification`、搜索 `search`、商品详情 `item-detail`、收藏 `favorites`、订单列表 `orders`、订单详情 `order-detail`、发表评价 `review-create`、用户评价 `user-reviews`、管理台 `admin`、管理台订单详情 `admin-order-detail`。

## 5. 账号与演示数据

### 单账号限制

后端联调模式把 `app.wechat.mock-openid` 固定成一个值，**无论传什么 code 都登录到同一个用户**。因此在默认配置下，开发者工具里同时只能有「一个」账号——要演示买卖双方，必须在后端切到多账号模式。

### 准备双角色演示数据

1. 后端启动时清空固定 openid，让它按 code 区分账号：

   ```bash
   APP_WECHAT_MOCK_OPENID=' ' ./mvnw spring-boot:run
   ```

2. 在开发者工具里每次登录前，改 `pages/login` 提交的 code（或清缓存后重新登录），即可得到不同的用户；分别造出**买家**和**卖家**两个账号。
3. 演示管理员：按 `../backend/README.md` 第 8.2 节把某个账号 `role` 改为 `ADMIN`，再重新登录，管理台入口才会出现在「我的」页。
4. 认证态：演示前按后端 README 直接改库置 `certification_status='APPROVED'`（管理员不能审核自己的认证）。

> Mock 登录只在后端 `app.wechat.mode=mock` 时生效；真实微信登录需要小程序 AppID 与后端 `session_key` 交换，不属于本地演示路径。

## 6. 媒体图片

后端返回的是 `/media/{fileId}` 形式的**相对地址**，前端由 `utils/media-url.js` 统一拼成绝对地址（与 `config/index.js` 的 `baseUrl` 同源）。

- 该函数处理了后端返回相对/绝对两种形式的情况，是图片能正常显示的关键，不要在页面里手工拼 URL。
- 真机预览时 `127.0.0.1` 指向手机自己，接口与图片都会失败——见 `KNOWN_ISSUES.md` KI-02，演示统一用开发者工具同机运行。

## 7. 管理台

管理台入口在「我的」页，仅管理员可见，包含**五个区域**：

| 区域 | 内容 |
| --- | --- |
| 认证 | 待审认证列表，通过 / 驳回，可查看脱敏后的申请信息 |
| 用户 | 用户列表与状态管理（禁用 / 启用） |
| 商品 | 商品列表与**强制下架** |
| 订单 | 全站订单监管列表，支持状态、订单号/商品标题筛选与分页 |
| 审计 | 管理操作审计日志 |

**订单监管详情** `pages/admin-order-detail/admin-order-detail` 是**只读**视图：展示买卖双方与商品快照、订单时间线，不渲染任何接单/拒单/取消/收货按钮，也不提供评价入口。订单状态必须由真实的买卖双方处理。

**强制下架**按钮只在商品处于「在售 / 草稿」时渲染：若商品已有进行中的订单或已售出，后端会返回 `409 ITEM_NOT_EDITABLE`，前端按下架能力过滤按钮，页面数据过期时按 409 提示处理。服务端是唯一判据。

订单数据的域划分：个人订单走 `services/order-api.js`（只认当前账号的买卖身份），全站监管走 `services/admin-api.js`（`/admin/orders`、`/admin/orders/{id}`）。两者不可混用。

## 8. 已知问题

非阻断问题见 `KNOWN_ISSUES.md`，当前两条：

- **KI-01** 分类页二级分类点不进去（商品列表未按分类接通），演示走首页/搜索路径。
- **KI-02** 真机预览时接口与图片不可达（`baseUrl` 固定同机地址），演示用开发者工具同机运行。

两条都不影响 10 分钟答辩演示。
