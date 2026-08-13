# Yearly Leaderboard Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `本月 / 本年` switch that recalculates the profit leaderboard for the selected current-calendar range.

**Architecture:** Put date filtering and player aggregation in a browser-compatible pure module so the calendar rules can be tested without the DOM. Keep `month` as page-only state, render the leaderboard separately from the historical game list, and update a compact accessible segmented control without persisting the selection.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node.js test runner

---

### Task 1: Implement Calendar-Range Leaderboard Statistics

**Files:**
- Create: `leaderboard.js`
- Create: `tests/leaderboard.test.mjs`

- [ ] **Step 1: Write the failing range and aggregation test**

Create a fixture containing a balanced game in the current month, a balanced game in an earlier month of the current year, an unbalanced current-year game, and a balanced prior-year game. Assert that `month` counts only the current-month balanced result, while `year` aggregates both current-year balanced results and orders players by cumulative profit.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/leaderboard.test.mjs`

Expected: FAIL because `leaderboard.js` is not present.

- [ ] **Step 3: Add the pure statistics module**

Implement `buildLeaderboard(history, range, now)` to return `{ rangeGames, balancedGames, rows }`. Compare `endedAt` using local calendar year and month, exclude unbalanced games from rows, count each player appearance once, coerce invalid profit values to zero, and sort a copied row array by descending profit.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/leaderboard.test.mjs`

Expected: all leaderboard statistics tests pass.

### Task 2: Add The Segmented Control And Rendering State

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `tests/frontend-structure.test.mjs`

- [ ] **Step 1: Write failing structure and wiring assertions**

Assert that the page contains `本月` and `本年` buttons in a labelled group, `本月` begins pressed, `leaderboard.js` loads before `app.js`, the page state defaults to `month`, and range clicks call a leaderboard-only render function.

- [ ] **Step 2: Run the focused structure test and verify RED**

Run: `node --test tests/frontend-structure.test.mjs`

Expected: FAIL because the range control and wiring are absent.

- [ ] **Step 3: Add markup, state, and rendering**

Add the segmented control next to the leaderboard heading. Load `leaderboard.js` before `app.js`, initialize `leaderboardRange` to `month`, update it from `data-leaderboard-range` buttons, and extract `renderLeaderboard()` so switching ranges does not rebuild the history list. Use `2026年8月盈利榜` / `2026年盈利榜` style titles and range-specific summary and empty copy.

- [ ] **Step 4: Match the existing visual system**

Style the control with the existing panel, line, text, and accent tokens; use an 8px outer radius, stable 36px button height, visible keyboard focus, active state, and 160ms color/background transitions. Keep the heading and control on one responsive row down to 320px.

- [ ] **Step 5: Run full verification**

Run: `node --test tests/*.test.mjs && node --check app.js && node --check leaderboard.js && git diff --check`

Expected: all tests and syntax checks pass with no diff errors.

### Task 3: Publish

**Files:**
- Modify: no additional source files

- [ ] **Step 1: Review the final diff and working tree**

Run: `git diff --stat && git status --short`

Expected: only the design, plan, leaderboard module, UI integration, styles, and tests are present.

- [ ] **Step 2: Commit and push**

Commit the feature and push `main` to trigger the repository's existing Vercel deployment.

