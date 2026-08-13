import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("the active game is the default view and signup UI is absent", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /class="tab active" data-tab="table"/);
  assert.match(html, /class="tab-view active" id="tableView"/);
  assert.doesNotMatch(html, /data-tab="signup"|id="signupView"/);
  assert.doesNotMatch(html, /报名|我要报名/);
});

test("the client has no signup state or network integration", async () => {
  const script = await readFile(new URL("app.js", root), "utf8");

  assert.doesNotMatch(script, /\/api\/signups/);
  assert.doesNotMatch(script, /signup/i);
  assert.doesNotMatch(script, /报名/);
});

test("signup styles and endpoint are absent", async () => {
  const styles = await readFile(new URL("styles.css", root), "utf8");

  assert.match(styles, /\.tabs\s*\{[^}]*grid-template-columns: repeat\(4, 1fr\)/s);
  assert.match(styles, /\.card-stage\s*\{[^}]*grid-template-columns: repeat\(5, 1fr\)/s);
  assert.doesNotMatch(styles, /\.signup(?:-|\b)/);
  await assert.rejects(access(new URL("api/signups.js", root)));
});

test("the settlement shortcut is keeper-only", async () => {
  const script = await readFile(new URL("app.js", root), "utf8");

  assert.match(script, /els\.goSettle\.hidden = !keeperMode;/);
});

test("history expansion survives shared refresh re-renders", async () => {
  const script = await readFile(new URL("app.js", root), "utf8");

  assert.match(script, /const openHistoryIds = new Set\(\);/);
  assert.match(script, /openHistoryIds\.add\(row\.dataset\.historyId\)/);
  assert.match(script, /openHistoryIds\.has\(game\.id\)/);
});
