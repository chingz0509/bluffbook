# Remove Signup Feature Design

## Goal

Remove the signup feature completely. BluffBook should open on the active-game view, where the keeper adds players directly.

## Scope

- Remove the signup tab and signup view from the page.
- Remove signup state, DOM bindings, event handlers, polling, persistence, ownership tokens, rendering, and API calls from the client.
- Remove the signup API endpoint and its tests.
- Remove signup-specific styles.
- Update the README so the described workflow, storage model, and file tree match the application.

## Resulting Flow

The default tab is `本局`. A keeper enters keeper mode, adds each player by name, and then records buy-ins, cash-outs, settlement, and history through the existing game flow. Read-only visitors can continue to view shared game state.

## Visitor Controls

Read-only visitors see the current total buy-in but do not see the `去结账` shortcut in the table footer. The shortcut remains available in keeper mode. Visitors can still use the `结账` tab to inspect settlement records, and the existing keeper-login control remains available.

## Data And Compatibility

Existing signup data in Redis will not be deleted. Once the endpoint and client integration are removed, the old keys are unreachable and harmless. No migration or compatibility endpoint is needed for this personal application.

Existing saved client state may still contain a `signups` field or signup-owner local-storage entry. The new client ignores those values. No destructive browser-data cleanup is required.

## Error Handling

Removing signup polling also removes its fallback and error messages. Existing shared-game errors and local fallback behavior remain unchanged.

## Verification

- Run the remaining Node test suite.
- Check `app.js` syntax.
- Search the repository for stale signup and Chinese signup-copy references.
- Open the application and confirm `本局` is the initial active view and the remaining tabs work.
- Confirm `去结账` is hidden for visitors and visible for keepers.
