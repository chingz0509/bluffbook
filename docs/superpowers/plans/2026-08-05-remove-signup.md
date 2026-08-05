# Remove Signup Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the signup feature completely and make the active-game view the application's default screen.

**Architecture:** Keep the existing static frontend and shared game API unchanged. Remove the signup HTML, client state and network path, CSS, serverless endpoint, and endpoint test; add a small source-structure regression test that protects the new default navigation and prevents signup integration from returning.

**Tech Stack:** HTML, CSS, browser JavaScript, Vercel serverless JavaScript, Node.js built-in test runner

---

## File Map

- Create `tests/frontend-structure.test.mjs`: source-level regression checks for the default tab and absence of signup integration.
- Modify `index.html`: remove the signup tab/view and activate `本局` by default.
- Modify `app.js`: remove signup state, polling, handlers, helpers, and rendering.
- Modify `styles.css`: remove signup-only selectors while preserving shared list layout.
- Delete `api/signups.js`: retire the signup endpoint.
- Delete `tests/signups-api.test.mjs`: retire tests for the deleted endpoint.
- Modify `README.md`: describe the direct keeper-managed game flow and current storage/file structure.

### Task 1: Make The Active Game The Default View

**Files:**
- Create: `tests/frontend-structure.test.mjs`
- Modify: `index.html:34-84`

- [ ] **Step 1: Write the failing navigation test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("the active game is the default view and signup UI is absent", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /class="tab active" data-tab="table"/);
  assert.match(html, /class="tab-view active" id="tableView"/);
  assert.doesNotMatch(html, /data-tab="signup"|id="signupView"/);
  assert.doesNotMatch(html, /报名|我要报名/);
});
```

- [ ] **Step 2: Run the test and verify the old signup-first page fails it**

Run: `node --test tests/frontend-structure.test.mjs`

Expected: FAIL because `signup` is active and `table` is not.

- [ ] **Step 3: Remove the signup markup and activate the table**

In `index.html`, replace the first two tab buttons with:

```html
<button class="tab active" data-tab="table" type="button">本局</button>
```

Change the table section opening tag to:

```html
<section class="tab-view active" id="tableView">
```

Delete the complete `<section class="tab-view active" id="signupView">...</section>` block.

- [ ] **Step 4: Run the navigation test**

Run: `node --test tests/frontend-structure.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the default-view change**

```bash
git add index.html tests/frontend-structure.test.mjs
git commit -m "Remove signup view"
```

### Task 2: Remove Signup Client Behavior

**Files:**
- Modify: `tests/frontend-structure.test.mjs`
- Modify: `app.js:1-254,353-695,728-909,1164-1166`

- [ ] **Step 1: Extend the regression test with client checks**

Add this test:

```js
test("the client has no signup state or network integration", async () => {
  const script = await readFile(new URL("app.js", root), "utf8");

  assert.doesNotMatch(script, /\/api\/signups/);
  assert.doesNotMatch(script, /signup/i);
  assert.doesNotMatch(script, /报名/);
});
```

- [ ] **Step 2: Run the test and verify signup client code fails it**

Run: `node --test tests/frontend-structure.test.mjs`

Expected: one PASS and one FAIL because `app.js` still contains signup integration.

- [ ] **Step 3: Remove signup state and startup work**

Delete `signupOwnerKey`, `signupsApiPath`, `sharedSignupsEnabled`, `defaultState.signups`, `signupOwners`, `startingGame`, and signup DOM entries. Delete initial and visibility-triggered calls to `refreshSharedSignups` plus its eight-second interval.

- [ ] **Step 4: Remove signup event handlers and state carry-over**

Delete the `signupForm` submit handler and `startFromSignup` click handler. When completing a game, retain only the fields required by the new state:

```js
state = {
  ...defaultState,
  startedAt: new Date().toISOString(),
  players: [],
  history: [completedGame, ...state.history],
};
```

- [ ] **Step 5: Remove signup loading, API, ownership, and rendering helpers**

In `loadState`, remove signup normalization so the returned object contains only `startedAt`, `players`, and `history`. Delete `signupRequest`, `refreshSharedSignups`, `addSharedSignup`, `removeSharedSignup`, `clearSharedSignups`, `normalizeSignup`, all signup-owner storage helpers, `canCancelSignup`, `renderSignups`, and `formatSignupTime`. Remove the `renderSignups()` call from `render()`.

- [ ] **Step 6: Run syntax and regression tests**

Run: `node --check app.js && node --test tests/frontend-structure.test.mjs`

Expected: syntax check exits 0 and both tests PASS.

- [ ] **Step 7: Commit the client cleanup**

```bash
git add app.js tests/frontend-structure.test.mjs
git commit -m "Remove signup client logic"
```

### Task 3: Retire Signup Styles And API

**Files:**
- Modify: `tests/frontend-structure.test.mjs`
- Modify: `styles.css:495-583`
- Delete: `api/signups.js`
- Delete: `tests/signups-api.test.mjs`

- [ ] **Step 1: Add source and endpoint absence checks**

Update the import and add the test below:

```js
import { access, readFile } from "node:fs/promises";

test("signup styles and endpoint are absent", async () => {
  const styles = await readFile(new URL("styles.css", root), "utf8");

  assert.match(styles, /\.tabs\s*\{[^}]*grid-template-columns: repeat\(4, 1fr\)/s);
  assert.match(styles, /\.card-stage\s*\{[^}]*grid-template-columns: repeat\(5, 1fr\)/s);
  assert.doesNotMatch(styles, /\.signup(?:-|\b)/);
  await assert.rejects(access(new URL("api/signups.js", root)));
});
```

- [ ] **Step 2: Run the test and verify retained styles and endpoint fail it**

Run: `node --test tests/frontend-structure.test.mjs`

Expected: two PASS and one FAIL because signup CSS and `api/signups.js` still exist.

- [ ] **Step 3: Remove signup-only CSS while preserving shared list layout**

Delete `.signup-hero`, `.signup-panel`, `.signup-row`, and `.signup-status` rules. Change the shared list selector from:

```css
.player-list,
.signup-list,
.settlement-list,
```

Change `.tabs` from five equal columns to four equal columns. Keep `.card-stage` at five columns for the five community cards.

to:

```css
.player-list,
.settlement-list,
```

- [ ] **Step 4: Delete the endpoint and its obsolete test**

Delete `api/signups.js` and `tests/signups-api.test.mjs`. Do not issue Redis deletion commands; old signup keys remain untouched.

- [ ] **Step 5: Run the complete test suite**

Run: `node --test tests/*.test.mjs`

Expected: all remaining game API and frontend structure tests PASS.

- [ ] **Step 6: Commit the API and style removal**

```bash
git add styles.css api/signups.js tests/signups-api.test.mjs tests/frontend-structure.test.mjs
git commit -m "Retire signup API and styles"
```

### Task 4: Align Documentation And Verify The Application

**Files:**
- Modify: `README.md:7-98`

- [ ] **Step 1: Rewrite the public workflow**

Replace the online-access paragraph with:

```markdown
所有人都可以实时查看本局。记账员点击页面顶部的“进入记账”，输入管理员单独配置的口令后进入记账员模式并添加玩家；再次点击顶部状态可以退出。
```

Remove the three signup feature bullets. Rewrite the usage flow so it begins with keeper login and direct player addition, then continues through buy-ins, settlement, history, and leaderboard updates.

- [ ] **Step 2: Rewrite storage and file-tree documentation**

Describe only `本局 / 结账` and `历史 / 月度排行` storage. Remove signup credential and signup authorization claims. Show only `api/game.js` under `api`.

- [ ] **Step 3: Search for stale feature references**

Run:

```bash
rg -n -i 'signup|signups|报名|我要报名' --glob '!docs/superpowers/**' --glob '!tests/frontend-structure.test.mjs' .
```

Expected: no matches.

- [ ] **Step 4: Run automated verification**

Run:

```bash
node --check app.js
node --test tests/*.test.mjs
git diff --check
```

Expected: all commands exit 0 and all tests PASS.

- [ ] **Step 5: Verify the rendered page**

Start a local server with `python3 -m http.server 4173`, open `http://127.0.0.1:4173`, and verify that `本局` is initially visible, the remaining four tabs switch views, and no signup UI appears at desktop and mobile widths.

- [ ] **Step 6: Commit documentation**

```bash
git add README.md
git commit -m "Update documentation after signup removal"
```
