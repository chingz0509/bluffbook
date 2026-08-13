(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BluffBookLeaderboard = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isInRange(game, range, now) {
    const endedAt = new Date(game.endedAt);
    if (Number.isNaN(endedAt.getTime()) || endedAt.getFullYear() !== now.getFullYear()) return false;
    return range === "year" || endedAt.getMonth() === now.getMonth();
  }

  function buildLeaderboard(history, range, now = new Date()) {
    const rangeGames = history.filter((game) => isInRange(game, range, now));
    const balancedGames = rangeGames.filter((game) => game.isBalanced);
    const totalsByPlayer = new Map();

    balancedGames.forEach((game) => {
      game.players.forEach((player) => {
        const previous = totalsByPlayer.get(player.name) || { name: player.name, profit: 0, games: 0 };
        previous.profit += number(player.profit);
        previous.games += 1;
        totalsByPlayer.set(player.name, previous);
      });
    });

    const rows = [...totalsByPlayer.values()].sort((a, b) => b.profit - a.profit);
    return { rangeGames, balancedGames, rows };
  }

  return { buildLeaderboard };
});
