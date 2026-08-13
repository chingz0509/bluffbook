import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createQuickActionLock } = require("../quick-action-lock.js");

function createFakeTimers() {
  let nextId = 1;
  const timers = new Map();

  return {
    setTimer(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    pending() {
      return [...timers.entries()];
    },
    run(id) {
      const timer = timers.get(id);
      if (!timer) return;
      timers.delete(id);
      timer.callback();
    },
  };
}

test("quick actions start locked", () => {
  const timers = createFakeTimers();
  const lock = createQuickActionLock(timers);

  assert.equal(lock.isLocked(), true);
  assert.equal(timers.pending().length, 0);
});

test("unlocking relocks after 30 seconds", () => {
  const timers = createFakeTimers();
  const changes = [];
  const lock = createQuickActionLock({ ...timers, onChange: (isLocked) => changes.push(isLocked) });

  lock.toggle();

  assert.equal(lock.isLocked(), false);
  assert.deepEqual(changes, [false]);
  assert.equal(timers.pending().length, 1);
  assert.equal(timers.pending()[0][1].delay, 30_000);

  timers.run(timers.pending()[0][0]);

  assert.equal(lock.isLocked(), true);
  assert.deepEqual(changes, [false, true]);
});

test("a successful quick action restarts the inactivity timer", () => {
  const timers = createFakeTimers();
  const lock = createQuickActionLock(timers);

  lock.toggle();
  const firstTimerId = timers.pending()[0][0];
  lock.recordAction();

  assert.equal(timers.pending().length, 1);
  assert.notEqual(timers.pending()[0][0], firstTimerId);

  timers.run(firstTimerId);
  assert.equal(lock.isLocked(), false);

  timers.run(timers.pending()[0][0]);
  assert.equal(lock.isLocked(), true);
});

test("explicit locking cancels the timer and locks immediately", () => {
  const timers = createFakeTimers();
  const changes = [];
  const lock = createQuickActionLock({ ...timers, onChange: (isLocked) => changes.push(isLocked) });

  lock.toggle();
  lock.lock();

  assert.equal(lock.isLocked(), true);
  assert.equal(timers.pending().length, 0);
  assert.deepEqual(changes, [false, true]);
});
