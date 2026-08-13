import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { sortPlayersByProfit } = require("../history-order.js");

test("historical players are ordered by profit without changing stored history", () => {
  const players = [
    { name: "A", profit: 100 },
    { name: "B", profit: 300 },
    { name: "C", profit: 300 },
    { name: "D", profit: -50 },
  ];

  const sorted = sortPlayersByProfit(players);

  assert.deepEqual(
    sorted.map((player) => player.name),
    ["B", "C", "A", "D"],
  );
  assert.deepEqual(
    players.map((player) => player.name),
    ["A", "B", "C", "D"],
  );
});

test("historical game details use profit ordering", async () => {
  const script = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(script, /sortPlayersByProfit\(game\.players\)\s*\.map/);
});
