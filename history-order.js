(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BluffBookHistoryOrder = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function sortPlayersByProfit(players) {
    return [...players].sort((a, b) => Number(b.profit) - Number(a.profit));
  }

  return { sortPlayersByProfit };
});
