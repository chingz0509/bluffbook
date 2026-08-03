# 记账员登录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有人使用同一个网址，并通过服务端口令验证进入记账员模式，同时保持公开报名和本人取消报名不受影响。

**Architecture:** 在现有 `/api/game` 中增加独立登录动作，服务端使用 Vercel 环境变量验证口令并轮换记账员 token。前端以原生 `<dialog>` 承载登录表单，登录成功后沿用现有 token 写入机制，退出时仅清理当前浏览器凭证。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Vercel Functions、Upstash Redis、Node.js `node:test`

---

### Task 1: 服务端记账员登录

**Files:**
- Modify: `tests/game-api.test.mjs`
- Modify: `api/game.js`

- [ ] **Step 1: 写登录 API 失败测试**

在 `tests/game-api.test.mjs` 增加用例，设置测试专用的 `process.env.KEEPER_PASSWORD`，验证错误口令的 `POST` 请求返回 `403`，并且 Redis 中原有 envelope 保持不变。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/game-api.test.mjs`

Expected: 新增用例失败，因为当前 `POST /api/game` 返回 `405`。

- [ ] **Step 3: 写正确口令和 token 轮换测试**

增加正确口令用例：Redis 预置正在进行的牌局和旧 token，提交：

```js
{
  action: "login",
  password: "测试口令",
  keeperToken: "keeper-new",
}
```

断言响应为 `200`、返回原牌局、Redis envelope 中 token 变为 `keeper-new`，响应正文不包含口令或 token。

- [ ] **Step 4: 实现登录 API**

在 `api/game.js` 增加常量时间友好的字符串比较函数，并处理 `POST`：

```js
if (req.method === "POST" && body.action === "login") {
  const configuredPassword = String(process.env.KEEPER_PASSWORD || "");
  const keeperToken = String(body.keeperToken || "");
  if (!configuredPassword || !keeperToken || !safeEqual(body.password, configuredPassword)) {
    send(res, 403, { error: "记账员口令不正确" });
    return;
  }
  const current = await getEnvelope(key);
  await redis("SET", key, JSON.stringify({ keeperToken, game: current.game }));
  send(res, 200, { game: current.game });
  return;
}
```

比较函数必须在长度不同和内容不同时都返回 `false`，且不把配置值写入日志或响应。

- [ ] **Step 5: 运行 API 测试**

Run: `node --test tests/game-api.test.mjs tests/signups-api.test.mjs`

Expected: 全部测试通过。

- [ ] **Step 6: 提交服务端改动**

```bash
git add api/game.js tests/game-api.test.mjs
git commit -m "Add keeper password login API"
```

### Task 2: 单链接登录交互

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

- [ ] **Step 1: 增加可访问的登录弹窗结构**

将 `#modeChip` 改为按钮，并在 `index.html` 增加原生 `<dialog id="keeperDialog">`，内部包含标题、说明、密码输入框、错误文本、取消按钮和“进入记账模式”提交按钮。密码不得以任何形式写入 HTML。

- [ ] **Step 2: 增加弹窗和模式按钮样式**

在 `styles.css` 中为模式按钮补齐 44px 触控区域、聚焦样式，为 dialog、遮罩、表单错误、加载状态和底部操作区添加与现有黑金界面一致的样式。宽度使用 `min(100% - 32px, 400px)`，保证 375px 手机视口不横向溢出。

- [ ] **Step 3: 移除特殊网址激活逻辑**

将 `resolveKeeperMode()` 改为仅检查本地模式标记和 token；线上环境不再读取 `?keeper=1`。`file:` 本地预览仍可保持记账模式，避免破坏离线演示。

- [ ] **Step 4: 实现登录和退出流程**

在 `app.js` 中实现：

```js
async function loginKeeper(password) {
  const keeperToken = createOwnerToken();
  const payload = await gameRequest("POST", {
    action: "login",
    password,
    keeperToken,
  });
  localStorage.setItem(keeperTokenKey, keeperToken);
  localStorage.setItem(keeperModeKey, "1");
  keeperMode = true;
  applySharedGame(payload.game || {});
}
```

普通模式点击 `#modeChip` 打开弹窗；记账员模式点击后确认退出。退出时删除 mode 和 token、重新渲染并刷新共享牌局。登录失败时保留弹窗并显示 API 返回的中文错误。

- [ ] **Step 5: 修正旧凭证和写入失败处理**

`getKeeperToken()` 不再在缺少 token 时静默生成凭证。`handleGameSyncError()` 在 `403` 时同时删除 mode 和 token，并提示“记账权限已失效，请重新登录”。

- [ ] **Step 6: 保持报名公开**

确认 `#signupForm` 在两种模式都显示，`canCancelSignup()` 仍只依据报名 owner token；记账员登录逻辑不得更改 `addSharedSignup()`、`removeSharedSignup()` 或报名 API。

- [ ] **Step 7: 运行静态检查和 API 测试**

Run: `node --check app.js && node --check api/game.js && node --test tests/*.test.mjs && git diff --check`

Expected: JavaScript 语法检查通过、全部测试通过、无空白错误。

- [ ] **Step 8: 本地手机视口验证**

启动 `python3 -m http.server 4173`，用 Playwright 或浏览器在 375x812 与 430x932 视口检查：模式按钮不溢出、弹窗完整可见、输入框不会遮挡按钮、报名表单始终可用、普通模式不显示记账控件。

- [ ] **Step 9: 提交前端改动**

```bash
git add index.html styles.css app.js
git commit -m "Add in-app keeper login"
```

### Task 3: 文档、配置和线上验证

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新使用说明**

README 只保留 `https://bluff.chengzhuo.work/`，说明报名无需登录、顶部模式按钮可以进入或退出记账员模式、实际口令不会写入仓库。

- [ ] **Step 2: 提交文档**

```bash
git add README.md
git commit -m "Document keeper login"
```

- [ ] **Step 3: 配置 Vercel 环境变量**

通过 Vercel 已登录浏览器为 `bluffbook` 项目的 Production 和 Preview 添加：

```text
KEEPER_PASSWORD=<由项目管理员单独配置>
```

不得把该值提交到 Git、README 或客户端代码。

- [ ] **Step 4: 推送并重新部署**

Push: `git push origin main`

确认 Vercel 生产部署完成，并保留自定义域名 `https://bluff.chengzhuo.work/`。

- [ ] **Step 5: 验证线上权限**

验证公开 GET、报名和本人取消仍可用；错误口令返回 `403`；正确口令返回 `200` 并进入记账员模式；普通模式直接调用无 token 的 `PUT /api/game` 返回 `403`。

- [ ] **Step 6: 验证数据未被破坏**

部署前后分别读取 `/api/signups` 和 `/api/game`，确认报名及当前牌局内容一致。测试登录允许轮换 token，但不得清空或改写玩家列表。
