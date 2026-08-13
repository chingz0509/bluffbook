(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BluffBookQuickActionLock = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createQuickActionLock(options = {}) {
    const timeoutMs = options.timeoutMs ?? 30_000;
    const setTimer = options.setTimer ?? setTimeout;
    const clearTimer = options.clearTimer ?? clearTimeout;
    const onChange = options.onChange ?? (() => {});
    let locked = true;
    let timerId = null;

    function cancelTimer() {
      if (timerId === null) return;
      clearTimer(timerId);
      timerId = null;
    }

    function scheduleRelock() {
      cancelTimer();
      timerId = setTimer(() => {
        timerId = null;
        lock();
      }, timeoutMs);
    }

    function unlock() {
      if (locked) {
        locked = false;
        onChange(false);
      }
      scheduleRelock();
    }

    function lock() {
      cancelTimer();
      if (!locked) {
        locked = true;
        onChange(true);
      }
    }

    return {
      isLocked: () => locked,
      toggle: () => (locked ? unlock() : lock()),
      lock,
      recordAction: () => {
        if (!locked) scheduleRelock();
      },
    };
  }

  return { createQuickActionLock };
});
