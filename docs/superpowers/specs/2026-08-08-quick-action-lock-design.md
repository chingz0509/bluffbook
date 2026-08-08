# Quick Action Lock Design

## Goal

Prevent accidental keeper taps on the `+200`, `+400`, and `-200` buy-in shortcuts without slowing down read-only viewing or adding confirmation dialogs to every action.

## Scope

- Add one global quick-action lock to the active-game view.
- Apply the lock only to `+200`, `+400`, and `-200`.
- Keep add-player, leave, restore, delete, settlement, and completion behavior unchanged.
- Keep all visitor behavior unchanged.

## Interface

The sticky table footer shows a lock control only in keeper mode and only while the footer is visible. The control uses a familiar lock symbol with an accessible label and tooltip.

The lock starts engaged. While engaged, the three buy-in shortcuts remain visible but disabled and visually muted. The `离桌` action stays enabled because it already requires a separate cash-out entry.

Tapping the lock control unlocks the buy-in shortcuts. Tapping it again locks them immediately.

## Lock Lifecycle

The lock state is local, in-memory UI state. It is never included in local storage or shared game payloads.

Unlocking starts a 30-second inactivity timer. Every successful `+200`, `+400`, or `-200` action restarts that timer. The shortcuts lock immediately when any of these events occurs:

- The inactivity timer expires.
- The page becomes hidden or moves to the background.
- Keeper mode ends or keeper authorization expires.
- The page reloads.

Entering keeper mode does not automatically unlock the shortcuts.

## Data Flow

A single client-side boolean controls the lock button state and the disabled state of every rendered buy-in shortcut. One timer owns automatic relocking. Lock and unlock transitions rerender the active game without writing game data or starting network synchronization.

A successful buy-in shortcut still updates the player and uses the existing shared-game save path. It also restarts the inactivity timer.

## Error Handling

The lock does not depend on the network. Shared-game write failures keep their existing behavior and do not unlock the controls. Permission loss and logout force the controls back to locked before the UI rerenders.

## Verification

- Confirm the shortcuts are locked on initial load and after entering keeper mode.
- Confirm the lock control unlocks and relocks all three shortcuts.
- Confirm a successful shortcut action restarts the 30-second timer.
- Confirm inactivity and backgrounding relock the shortcuts.
- Confirm logout and permission loss relock the shortcuts.
- Confirm `离桌` remains usable while buy-in shortcuts are locked.
- Confirm visitors do not see the lock control and retain read-only behavior.
- Run the existing game API and frontend structure tests.

