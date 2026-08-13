# Quick Action Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keeper-only safety lock that prevents accidental `+200`, `+400`, and `-200` taps and automatically relocks after 30 seconds or when the page is backgrounded.

**Architecture:** Put the timer and lock transitions in a small dependency-injected controller that works in both the browser and Node tests. Wire that controller into the existing single-page renderer so UI state remains local and never enters shared game data.

**Tech Stack:** Vanilla HTML, CSS, JavaScript, Node test runner

---

### Task 1: Lock state controller

**Files:**
- Create: `quick-action-lock.js`
- Create: `tests/quick-action-lock.test.mjs`

- [x] **Step 1: Write failing controller tests**

Cover the locked default, unlock timeout, successful-action timer reset, and immediate explicit relock using an injected fake timer.

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/quick-action-lock.test.mjs`

Expected: FAIL because `quick-action-lock.js` does not exist.

- [x] **Step 3: Implement the minimal controller**

Expose `createQuickActionLock({ timeoutMs, setTimer, clearTimer, onChange })` for the browser and CommonJS tests. Keep state only in memory and expose `isLocked`, `toggle`, `lock`, and `recordAction`.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/quick-action-lock.test.mjs`

Expected: all controller tests pass.

### Task 2: Keeper interface and lifecycle

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Modify: `tests/frontend-structure.test.mjs`

- [x] **Step 1: Write failing integration structure tests**

Require the controller script and accessible footer control, keeper-only visibility, disabled buy-in shortcuts while locked, successful-action timer reset, and relocking on background/logout/permission loss.

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/frontend-structure.test.mjs`

Expected: FAIL because the page is not wired to the lock.

- [x] **Step 3: Add the lock control and styles**

Add a compact lock icon button beside `去结账`, with stable dimensions, tooltip text, visible focus treatment, and distinct locked/unlocked states.

- [x] **Step 4: Wire lock behavior into the app**

Start locked, guard and disable only the three buy-in shortcuts, reset the timer after successful shortcuts, and relock on background, logout, and authorization failure. Keep `离桌` enabled and hide the control from visitors.

- [x] **Step 5: Run focused and full automated tests**

Run: `node --test tests/frontend-structure.test.mjs tests/quick-action-lock.test.mjs`

Run: `node --test`

Expected: all tests pass.

### Task 3: Browser verification and deployment

**Files:**
- Modify: `README.md`

- [x] **Step 1: Document the keeper workflow**

Explain that the shortcuts start locked and relock after 30 seconds or when the page is backgrounded.

- [x] **Step 2: Verify desktop and mobile browser behavior**

Confirm default locked state, manual unlock/relock, shortcut operation, `离桌` availability, background relock, visitor hiding, and responsive layout.

- [x] **Step 3: Review and run final verification**

Review the completed diff against the design, run `node --test`, and confirm the browser has no console errors.

- [x] **Step 4: Commit, merge to main, and deploy**

Commit the implementation, merge it into `main`, rerun tests, push `main`, and verify the production URL serves the lock assets.
