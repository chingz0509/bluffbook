# Shared Live Game Design

## Goal

Let everyone opening the public BluffBook URL see the same current game within a few seconds, while only the designated recorder device can start or edit the game.

## Scope

- Keep the familiar-group model and the single shared table. There is no room code.
- Keep signup public and let each person cancel only their own signup.
- Share current players, buy-ins, early cash-outs, and settlement values through Upstash Redis.
- Keep completed history and the monthly leaderboard on the recorder device for this iteration.

## Access Model

- The normal URL opens read-only viewer mode.
- Opening `?keeper=1` enables recorder mode on that browser and stores the mode locally.
- The recorder browser creates a private random token. The first shared-game write claims recorder ownership in Redis.
- Later writes and whole-list signup clearing require that token. Public game responses never include it.
- `?keeper=0` leaves recorder mode on that browser without deleting the saved ownership token.

## Data Flow

- Viewers fetch `/api/game` on load, when returning to the tab, and every four seconds.
- Recorder actions update the local screen immediately and then send the current game to `/api/game`.
- Starting from signups saves the shared game first, then clears signups with the same recorder token.
- Completing a balanced game stores history locally and publishes an empty current game.

## Failure Handling

- A failed background refresh keeps the last visible game and does not erase local data.
- A failed recorder write shows a short error and refreshes from the server so the screen does not pretend the change was saved.
- A device with the wrong token receives a permission error and remains read-only in practice.

## Verification

- API tests cover recorder-token claiming, read sanitization, rejected foreign writes, and protected signup clearing.
- Syntax checks cover all browser and API JavaScript.
- The deployed test uses a non-default internal room key so production data is not changed.
