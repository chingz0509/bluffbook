# Yearly Leaderboard Toggle Design

## Goal

Let users switch the history leaderboard between the current month and the current calendar year without changing historical game data.

## Interface

- Add a compact segmented control to the leaderboard panel with `本月` and `本年` buttons.
- Default to `本月` whenever the page loads.
- Show the selected button as active and expose the selection through `aria-pressed`.
- Keep the existing leaderboard rows: rank, player name, counted games, and cumulative net profit.
- Update the heading, summary, and empty-state copy to match the selected range.

## Statistics

- `本月` includes balanced games whose `endedAt` falls in the current local calendar month.
- `本年` includes balanced games whose `endedAt` falls in the current local calendar year.
- A player's profit is the sum of their existing `profit` values in the selected games.
- A player's game count increases once for each selected game in which they appear.
- Rank players by cumulative profit from highest to lowest. Equal totals retain first-seen order.
- Unbalanced games remain visible in history but never count toward either leaderboard.

## State And Data Flow

Keep the selected range in a page-level in-memory variable initialized to `month`. Clicking a range button updates that variable and calls the leaderboard render path. Do not store the selection in local storage or send it to the API, so a full reload returns to `本月` as agreed.

The history list keeps its existing chronological order, expansion behavior, and player profit ordering. Shared-game refreshes recalculate the selected leaderboard from the latest history while preserving the current in-page range selection.

## Testing

- Unit test range filtering for current month, earlier months in the current year, prior years, and unbalanced games.
- Unit test player aggregation and descending profit order.
- Structure-test both range buttons, their default accessibility state, and the application wiring.
- Run the full existing test suite to cover history expansion, shared history, and quick-action locking.

