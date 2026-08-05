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
