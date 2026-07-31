# Shared Live Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Share the current BluffBook game across devices while restricting edits to one recorder browser.

**Architecture:** Add a Vercel game endpoint backed by the existing Upstash Redis connection. The browser keeps local history but replaces current-game fields from the shared endpoint for viewers; a recorder token stored only on the recorder browser authorizes all shared writes.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Vercel Functions, Upstash Redis, Node.js test runner

---

### Task 1: Protect the shared data APIs

**Files:**
- Create: `api/game.js`
- Create: `tests/game-api.test.mjs`
- Modify: `api/signups.js`
- Create: `tests/signups-api.test.mjs`

- [x] Write API tests proving that the first recorder token can claim the game, public reads omit the token, foreign writes receive 403, and signup clearing requires the same token.
- [x] Run `node --test tests/*.test.mjs` and verify the tests fail because the behavior is missing.
- [x] Implement Redis-backed current-game GET/PUT and recorder authorization, then protect whole-list signup deletion.
- [x] Run the tests again and verify they pass.

### Task 2: Add recorder and viewer modes

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

- [x] Add a compact mode badge and viewer-only empty-state copy.
- [x] Parse `?keeper=1` and `?keeper=0`, persist recorder mode and its private token locally, and never include the token in rendered HTML.
- [x] Hide all current-game write controls for viewers while leaving signup and current-game views available.
- [x] Fetch shared game state every four seconds for viewers and on page visibility changes.
- [x] Send recorder changes after add, buy-in adjustment, leave, restore, settlement, start, and completion actions.
- [x] Run browser JavaScript syntax checks.

### Task 3: Document and deploy

**Files:**
- Modify: `README.md`

- [x] Document the normal viewer URL, recorder URL, synchronization boundary, and recorder-device recovery limitation.
- [x] Run the full test and syntax-check commands.
- [x] Commit and push to `main` so Vercel deploys the feature.
- [x] Verify the online API with an isolated internal room key, then remove the test player data.
