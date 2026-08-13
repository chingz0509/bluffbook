# History Profit Order Design

## Goal

When a historical game is expanded, show its players from highest single-game net profit to lowest.

## Behavior

- Sort only the player rows inside each expanded historical game.
- Use each player's existing `profit` value in descending numeric order.
- Preserve the original order when two players have the same profit.
- Do not change stored history, historical game order, or the monthly leaderboard.

## Implementation

Add a small browser-compatible helper that returns a sorted copy of a player list. Load it before `app.js`, use it only when rendering historical player details, and unit test ordering, tie stability, and input immutability.

