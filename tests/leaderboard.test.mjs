import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildLeaderboard } = require("../leaderboard.js");

const history = [
  {
    endedAt: "2026-08-10T12:00:00",
    isBalanced: true,
    players: [
      { name: "Alice", profit: 100 },
      { name: "Bob", profit: -100 },
    ],
  },
  {
    endedAt: "2026-02-10T12:00:00",
    isBalanced: true,
    players: [
      { name: "Alice", profit: -50 },
      { name: "Carol", profit: 50 },
    ],
  },
  {
    endedAt: "2026-07-10T12:00:00",
    isBalanced: false,
    players: [{ name: "Ignored", profit: 999 }],
  },
  {
    endedAt: "2025-08-10T12:00:00",
    isBalanced: true,
    players: [{ name: "Last year", profit: 500 }],
  },
];

test("monthly leaderboard counts only balanced games in the current month", () => {
  const result = buildLeaderboard(history, "month", new Date("2026-08-13T12:00:00"));

  assert.equal(result.rangeGames.length, 1);
  assert.equal(result.balancedGames.length, 1);
  assert.deepEqual(result.rows, [
    { name: "Alice", profit: 100, games: 1 },
    { name: "Bob", profit: -100, games: 1 },
  ]);
});

test("yearly leaderboard aggregates all balanced games in the current year", () => {
  const result = buildLeaderboard(history, "year", new Date("2026-08-13T12:00:00"));

  assert.equal(result.rangeGames.length, 3);
  assert.equal(result.balancedGames.length, 2);
  assert.deepEqual(result.rows, [
    { name: "Alice", profit: 50, games: 2 },
    { name: "Carol", profit: 50, games: 1 },
    { name: "Bob", profit: -100, games: 1 },
  ]);
});
