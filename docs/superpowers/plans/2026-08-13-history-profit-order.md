# History Profit Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display players inside each historical game from highest net profit to lowest.

**Architecture:** Introduce a small pure sorting helper that returns a new array and preserves tie order. The history renderer calls the helper before building player detail rows, leaving saved data and all other ordering unchanged.

**Tech Stack:** Vanilla JavaScript, Node.js test runner, static HTML

---

### Task 1: Add and use the profit-order helper

**Files:**
- Create: `history-order.js`
- Create: `tests/history-order.test.mjs`
- Modify: `index.html`
- Modify: `app.js`

- [ ] **Step 1: Write the failing behavior test**

Test that profits `100`, `300`, `300`, and `-50` render in `300`, `300`, `100`, `-50` order, equal profits retain their original order, and the source array is unchanged.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/history-order.test.mjs`

Expected: FAIL because `history-order.js` does not exist.

- [ ] **Step 3: Implement the minimal helper and wire it into history rendering**

Create `sortPlayersByProfit(players)`, load it before `app.js`, and replace the historical detail renderer's direct `game.players.map(...)` call with `sortPlayersByProfit(game.players).map(...)`.

- [ ] **Step 4: Run focused and full verification**

Run: `node --test tests/history-order.test.mjs` and `node --test tests/*.test.mjs && git diff --check`.

Expected: all tests pass and the diff check emits no errors.

- [ ] **Step 5: Commit and deploy**

Commit the implementation and push `main` to trigger the existing Vercel deployment.

