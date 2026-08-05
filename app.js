const storageKey = "texas-ledger-v1";
const keeperModeKey = "bluffbook-keeper-mode-v1";
const keeperTokenKey = "bluffbook-keeper-token-v1";
const gameApiPath = "/api/game";
let sharedGameEnabled = window.location.protocol !== "file:";
let keeperMode = resolveKeeperMode();

const defaultState = {
  startedAt: new Date().toISOString(),
  players: [],
  history: [],
};

let state = loadState();
let gameWriteQueue = Promise.resolve();
let cashOutRequest = null;

const els = {
  fxCanvas: document.querySelector("#fxCanvas"),
  modeChip: document.querySelector("#modeChip"),
  keeperDialog: document.querySelector("#keeperDialog"),
  keeperLoginForm: document.querySelector("#keeperLoginForm"),
  keeperPassword: document.querySelector("#keeperPassword"),
  keeperLoginError: document.querySelector("#keeperLoginError"),
  keeperLoginSubmit: document.querySelector("#keeperLoginSubmit"),
  keeperCancel: document.querySelector("#keeperCancel"),
  cashOutDialog: document.querySelector("#cashOutDialog"),
  cashOutForm: document.querySelector("#cashOutForm"),
  cashOutDialogTitle: document.querySelector("#cashOutDialogTitle"),
  cashOutPlayer: document.querySelector("#cashOutPlayer"),
  cashOutInput: document.querySelector("#cashOutInput"),
  cashOutError: document.querySelector("#cashOutError"),
  cashOutCancel: document.querySelector("#cashOutCancel"),
  addPlayerForm: document.querySelector("#addPlayerForm"),
  playerName: document.querySelector("#playerName"),
  tableFooter: document.querySelector("#tableFooter"),
  totalBuyIn: document.querySelector("#totalBuyIn"),
  goSettle: document.querySelector("#goSettle"),
  playerList: document.querySelector("#playerList"),
  settleStatusTitle: document.querySelector("#settleStatusTitle"),
  settleStatusCopy: document.querySelector("#settleStatusCopy"),
  completeGame: document.querySelector("#completeGame"),
  resultList: document.querySelector("#resultList"),
  transferPanel: document.querySelector("#transferPanel"),
  transferList: document.querySelector("#transferList"),
  historyMonthTitle: document.querySelector("#historyMonthTitle"),
  historyMeta: document.querySelector("#historyMeta"),
  leaderboardList: document.querySelector("#leaderboardList"),
  historyList: document.querySelector("#historyList"),
  toast: document.querySelector("#toast"),
};

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    activateTab(tab.dataset.tab);
  });
});

els.modeChip.addEventListener("click", () => {
  if (!keeperMode) {
    els.keeperDialog.showModal();
    window.requestAnimationFrame(() => els.keeperPassword.focus());
    return;
  }

  const confirmed = window.confirm("退出记账员模式，恢复为实时查看？");
  if (confirmed) logoutKeeper();
});

els.keeperCancel.addEventListener("click", () => {
  els.keeperDialog.close();
});

els.keeperDialog.addEventListener("close", resetKeeperLoginForm);

els.cashOutCancel.addEventListener("click", () => resolveCashOut(null));

els.cashOutDialog.addEventListener("close", () => {
  if (cashOutRequest) resolveCashOut(null, { close: false });
});

els.cashOutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = els.cashOutInput.value;
  const amount = Number(value);
  if (value === "" || !Number.isFinite(amount) || amount < 0) {
    showCashOutError("请输入有效的筹码数");
    return;
  }
  resolveCashOut(amount);
});

els.keeperLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = els.keeperPassword.value;
  if (!password) return;

  setKeeperLoginPending(true);
  showKeeperLoginError("");
  try {
    await loginKeeper(password);
    els.keeperDialog.close();
    showToast("已进入记账员模式");
  } catch (error) {
    showKeeperLoginError(error.message);
    els.keeperPassword.select();
  } finally {
    setKeeperLoginPending(false);
  }
});

startBoardParticles();
initializeSharedGame();
window.setInterval(() => {
  if (!keeperMode) refreshSharedGame({ silent: true });
}, 4000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshSharedGame({ silent: true });
  }
});

els.addPlayerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!keeperMode) return;

  const name = els.playerName.value.trim();
  if (!name) return;

  state.players.push(createPlayer(name));
  els.playerName.value = "";
  saveAndRender({ syncGame: true });
});

els.goSettle.addEventListener("click", () => {
  activateTab("settle");
});

els.completeGame.addEventListener("click", async () => {
  if (!keeperMode) return;
  const { delta } = totals();
  if (state.players.length === 0) {
    showToast("还没有可结清的牌局");
    return;
  }
  if (delta !== 0) {
    showToast("还没平账，先核对剩余筹码");
    return;
  }

  const confirmed = window.confirm("确认账目结清并存入历史吗？");
  if (!confirmed) return;

  const previousState = state;
  const completedGame = createHistoryGame();
  state = {
    ...defaultState,
    startedAt: new Date().toISOString(),
    players: [],
    history: [completedGame, ...state.history],
  };

  try {
    await saveSharedGame();
  } catch (error) {
    state = previousState;
    saveAndRender();
    handleGameSyncError(error);
    return;
  }

  saveAndRender();
  activateTab("history");
  showToast("已结清并存入历史");
});

function activateTab(tabName) {
  const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  const view = document.querySelector(`#${tabName}View`);
  if (!tab || !view) return;
  document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".tab-view").forEach((item) => item.classList.remove("active"));
  tab.classList.add("active");
  view.classList.add("active");
}

function startBoardParticles() {
  const canvas = els.fxCanvas;
  if (!canvas) return;

  const context = canvas.getContext("2d");
  const particles = Array.from({ length: 42 }, () => createParticle(canvas));
  let frameId = 0;
  let lastTime = performance.now();

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw(now) {
    const rect = canvas.getBoundingClientRect();
    const elapsed = Math.min(32, now - lastTime);
    lastTime = now;
    context.clearRect(0, 0, rect.width, rect.height);

    particles.forEach((particle) => {
      particle.x += particle.vx * elapsed;
      particle.y += particle.vy * elapsed;
      particle.life -= elapsed;

      if (particle.life <= 0 || particle.x < -20 || particle.x > rect.width + 20 || particle.y < -20) {
        Object.assign(particle, createParticle(canvas, true));
      }

      context.globalAlpha = particle.alpha * Math.max(0, Math.min(1, particle.life / 900));
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    });

    context.globalAlpha = 1;
    if (!document.hidden) frameId = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(frameId);
      return;
    }
    lastTime = performance.now();
    frameId = requestAnimationFrame(draw);
  });
  frameId = requestAnimationFrame(draw);
}

function createParticle(canvas, fromBottom = false) {
  const rect = canvas.getBoundingClientRect();
  const gold = Math.random() > 0.22;
  return {
    x: Math.random() * Math.max(rect.width, 1),
    y: fromBottom ? rect.height + Math.random() * 18 : Math.random() * Math.max(rect.height, 1),
    vx: (Math.random() - 0.5) * 0.018,
    vy: -0.012 - Math.random() * 0.034,
    size: 0.7 + Math.random() * 1.9,
    alpha: 0.28 + Math.random() * 0.5,
    life: 1200 + Math.random() * 2600,
    color: gold ? "rgb(226, 193, 126)" : "rgb(160, 60, 64)",
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved?.players) return defaultState;
    return {
      startedAt: saved.startedAt || new Date().toISOString(),
      players: (saved.players || []).map(normalizePlayer),
      history: Array.isArray(saved.history) ? saved.history : [],
    };
  } catch {
    return defaultState;
  }
}

function saveAndRender(options = {}) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  render();
  if (options.syncGame && keeperMode) {
    saveSharedGame().catch(handleGameSyncError);
  }
}

function resolveKeeperMode() {
  if (window.location.protocol === "file:") return true;
  return Boolean(localStorage.getItem(keeperModeKey) === "1" && localStorage.getItem(keeperTokenKey));
}

function getKeeperToken() {
  return localStorage.getItem(keeperTokenKey) || "";
}

async function loginKeeper(password) {
  const keeperToken = createOwnerToken();
  const payload = await gameRequest("POST", {
    action: "login",
    password,
    keeperToken,
  });
  localStorage.setItem(keeperTokenKey, keeperToken);
  localStorage.setItem(keeperModeKey, "1");
  keeperMode = true;
  sharedGameEnabled = true;
  applySharedGame(payload.game || {});
}

function logoutKeeper() {
  keeperMode = false;
  localStorage.removeItem(keeperModeKey);
  localStorage.removeItem(keeperTokenKey);
  render();
  refreshSharedGame({ silent: true });
  showToast("已退出记账员模式");
}

function setKeeperLoginPending(pending) {
  els.keeperPassword.disabled = pending;
  els.keeperCancel.disabled = pending;
  els.keeperLoginSubmit.disabled = pending;
  els.keeperLoginSubmit.textContent = pending ? "验证中..." : "进入记账模式";
}

function showKeeperLoginError(message) {
  els.keeperLoginError.textContent = message;
  els.keeperLoginError.hidden = !message;
}

function resetKeeperLoginForm() {
  els.keeperLoginForm.reset();
  showKeeperLoginError("");
  setKeeperLoginPending(false);
}

function sharedGamePayload() {
  return {
    startedAt: state.startedAt,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      buyIn: number(player.buyIn),
      buyInCount: number(player.buyInCount),
      cashOut: number(player.cashOut),
      isAway: Boolean(player.isAway),
      leftAt: player.leftAt || null,
    })),
    history: state.history.slice(0, 120).map((game) => ({
      id: game.id,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      totalBuyIn: number(game.totalBuyIn),
      totalCashOut: number(game.totalCashOut),
      delta: number(game.delta),
      isBalanced: Boolean(game.isBalanced),
      players: (game.players || []).map((player) => ({
        name: player.name,
        buyIn: number(player.buyIn),
        cashOut: number(player.cashOut),
        profit: number(player.profit),
        isAway: Boolean(player.isAway),
      })),
    })),
  };
}

async function gameRequest(method, data) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (data) options.body = JSON.stringify(data);

  const response = await fetch(gameApiPath, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "本局同步暂时不可用");
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function initializeSharedGame() {
  if (!sharedGameEnabled) return;

  try {
    const payload = await gameRequest("GET");
    const sharedGame = payload.game || {};
    const hasSharedState = Boolean(sharedGame.updatedAt);
    if (keeperMode) {
      if (!hasSharedState && state.players.length > 0) {
        await saveSharedGame();
        return;
      }
      applySharedGame(sharedGame);
      await saveSharedGame();
      return;
    }
    applySharedGame(sharedGame);
  } catch (error) {
    if (error.status === 403) {
      handleGameSyncError(error);
      return;
    }
    sharedGameEnabled = false;
    showToast(error.message);
  }
}

async function refreshSharedGame(options = {}) {
  if (!sharedGameEnabled) return;

  try {
    const payload = await gameRequest("GET");
    applySharedGame(payload.game || {});
  } catch (error) {
    if (!options.silent) showToast(error.message);
  }
}

function applySharedGame(game) {
  state.startedAt = game.startedAt || new Date().toISOString();
  state.players = (game.players || []).map(normalizePlayer).filter((player) => player.name);
  if (Array.isArray(game.history)) {
    const sharedHistory = game.history.map(normalizeHistoryGame).filter(Boolean);
    if (sharedHistory.length > 0 || state.history.length === 0) {
      state.history = sharedHistory;
    }
  }
  saveAndRender();
}

async function saveSharedGame() {
  if (!sharedGameEnabled || !keeperMode) return;
  const requestData = {
    keeperToken: getKeeperToken(),
    game: sharedGamePayload(),
  };
  gameWriteQueue = gameWriteQueue.catch(() => {}).then(() => gameRequest("PUT", requestData));
  return gameWriteQueue;
}

function handleGameSyncError(error) {
  if (error.status === 403) {
    keeperMode = false;
    localStorage.removeItem(keeperModeKey);
    localStorage.removeItem(keeperTokenKey);
    showToast("记账权限已失效，请重新登录");
    render();
    refreshSharedGame({ silent: true });
    return;
  }
  showToast("本局同步失败，请稍后重试");
  refreshSharedGame({ silent: true });
}

function normalizePlayer(player) {
  const buyIn = number(player.buyIn);
  const isAway = Boolean(player.isAway);
  return {
    ...player,
    buyIn,
    buyInCount: Number.isFinite(Number(player.buyInCount))
      ? Math.max(0, Number(player.buyInCount))
      : Math.max(0, Math.round(buyIn / 200)),
    cashOut: player.cashOut ?? 0,
    isAway,
    leftAt: isAway ? player.leftAt || new Date().toISOString() : null,
  };
}

function normalizeHistoryGame(game) {
  if (!game || !game.endedAt || !Array.isArray(game.players)) return null;
  return {
    id: game.id || createId(),
    startedAt: game.startedAt || game.endedAt,
    endedAt: game.endedAt,
    totalBuyIn: number(game.totalBuyIn),
    totalCashOut: number(game.totalCashOut),
    delta: number(game.delta),
    isBalanced: Boolean(game.isBalanced),
    players: game.players
      .map((player) => ({
        name: String(player?.name || "").trim(),
        buyIn: number(player?.buyIn),
        cashOut: number(player?.cashOut),
        profit: number(player?.profit),
        isAway: Boolean(player?.isAway),
      }))
      .filter((player) => player.name),
  };
}

function createOwnerToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `owner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createPlayer(name) {
  return {
    id: createId(),
    name,
    buyIn: 200,
    buyInCount: 1,
    cashOut: 0,
    isAway: false,
    leftAt: null,
  };
}

function totals() {
  const totalBuyIn = state.players.reduce((sum, player) => sum + number(player.buyIn), 0);
  const totalCashOut = state.players.reduce((sum, player) => sum + number(player.cashOut), 0);
  return {
    totalBuyIn,
    totalCashOut,
    delta: totalCashOut - totalBuyIn,
  };
}

function render() {
  const { totalBuyIn } = totals();

  document.body.classList.toggle("is-keeper", keeperMode);
  els.modeChip.textContent = keeperMode ? "记账员模式" : "进入记账";
  els.modeChip.classList.toggle("is-keeper", keeperMode);
  els.addPlayerForm.hidden = !keeperMode;
  els.goSettle.hidden = !keeperMode;
  els.completeGame.hidden = !keeperMode;
  els.tableFooter.hidden = state.players.length === 0;
  els.totalBuyIn.textContent = formatMoney(totalBuyIn);

  renderPlayers();
  renderSettlement();
  renderHistory();
}

function renderPlayers() {
  if (state.players.length === 0) {
    els.playerList.innerHTML = `<div class="empty">${keeperMode ? "还没有玩家。添加姓名后会自动记一手 200。" : "还没有进行中的牌局。"}</div>`;
    return;
  }

  els.playerList.innerHTML = state.players
    .map((player) => {
      const profit = number(player.cashOut) - number(player.buyIn);
      const awaySummary = player.isAway
        ? `
            <div class="player-status">
              <span>已离桌</span>
              <strong class="${profitClass(profit)}">剩余 ${formatMoney(player.cashOut)} / ${signedMoney(profit)}</strong>
            </div>
          `
        : "";
      const actions = !keeperMode
        ? ""
        : player.isAway
        ? `
            <div class="away-actions">
              <button type="button" data-edit-away>修改剩余</button>
              <button type="button" data-restore>恢复在桌</button>
            </div>
          `
        : `
            <div class="quick-actions">
              <button type="button" data-add="200">+200</button>
              <button type="button" data-add="400">+400</button>
              <button type="button" data-add="-200">-200</button>
              <button type="button" data-leave>离桌</button>
            </div>
          `;
      return `
        <div class="swipe-row" data-id="${player.id}">
          ${keeperMode ? `<button class="swipe-delete" type="button" data-remove>删除</button>` : ""}
          <article class="player-card swipe-card ${player.isAway ? "is-away" : ""}">
            <div class="player-head">
              <div>
                <h3 class="player-name">${escapeHtml(player.name)}</h3>
                ${awaySummary}
              </div>
              <div class="buyin-stack">
                <strong class="player-profit">累计买入：${formatMoney(player.buyIn)}/${number(player.buyInCount)} 次</strong>
              </div>
            </div>
            ${actions}
          </article>
        </div>
      `;
    })
    .join("");

  els.playerList.querySelectorAll(".swipe-row").forEach((row) => {
    if (!keeperMode) return;
    const id = row.dataset.id;
    const card = row.querySelector(".swipe-card");

    row.querySelectorAll("[data-add]").forEach((button) => {
      button.addEventListener("click", () => {
        const player = state.players.find((item) => item.id === id);
        if (player.isAway) return;
        const delta = number(button.dataset.add);
        player.buyIn = Math.max(0, number(player.buyIn) + delta);
        player.buyInCount = Math.max(0, number(player.buyInCount) + delta / 200);
        saveAndRender({ syncGame: true });
      });
    });

    const leaveButton = row.querySelector("[data-leave]");
    if (leaveButton) {
      leaveButton.addEventListener("click", async () => {
        const player = state.players.find((item) => item.id === id);
        const cashOut = await askCashOut(player, "输入离桌时剩余筹码");
        if (cashOut === null) return;
        player.cashOut = cashOut;
        player.isAway = true;
        player.leftAt = new Date().toISOString();
        saveAndRender({ syncGame: true });
        showToast(`${player.name} 已离桌`);
      });
    }

    const editAwayButton = row.querySelector("[data-edit-away]");
    if (editAwayButton) {
      editAwayButton.addEventListener("click", async () => {
        const player = state.players.find((item) => item.id === id);
        const cashOut = await askCashOut(player, "修改离桌剩余筹码");
        if (cashOut === null) return;
        player.cashOut = cashOut;
        saveAndRender({ syncGame: true });
      });
    }

    const restoreButton = row.querySelector("[data-restore]");
    if (restoreButton) {
      restoreButton.addEventListener("click", () => {
        const player = state.players.find((item) => item.id === id);
        const confirmed = window.confirm(`${player.name} 恢复在桌？结账时需要重新录入最终剩余。`);
        if (!confirmed) return;
        player.isAway = false;
        player.leftAt = null;
        player.cashOut = 0;
        saveAndRender({ syncGame: true });
      });
    }

    row.querySelector("[data-remove]").addEventListener("click", () => {
      const player = state.players.find((item) => item.id === id);
      const confirmed = window.confirm(`删除 ${player.name}？`);
      if (!confirmed) return;
      state.players = state.players.filter((player) => player.id !== id);
      saveAndRender({ syncGame: true });
    });

    attachSwipeDelete(row, card);
  });
}

function attachSwipeDelete(row, card) {
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  card.addEventListener(
    "touchstart",
    (event) => {
      startX = event.touches[0].clientX;
      currentX = row.classList.contains("is-open") ? -86 : 0;
      isDragging = true;
    },
    { passive: true },
  );

  card.addEventListener(
    "touchmove",
    (event) => {
      if (!isDragging) return;
      const delta = event.touches[0].clientX - startX;
      const nextX = Math.min(0, Math.max(-86, currentX + delta));
      card.style.transform = `translateX(${nextX}px)`;
    },
    { passive: true },
  );

  card.addEventListener("touchend", () => {
    if (!isDragging) return;
    isDragging = false;
    const matrix = new DOMMatrixReadOnly(window.getComputedStyle(card).transform);
    const shouldOpen = matrix.m41 < -44;
    row.classList.toggle("is-open", shouldOpen);
    card.style.transform = "";
  });
}

function renderSettlement() {
  const { totalBuyIn, totalCashOut, delta } = totals();
  const hasPlayers = state.players.length > 0;
  const isBalanced = hasPlayers && delta === 0;
  const awayCount = state.players.filter((player) => player.isAway).length;

  els.settleStatusTitle.textContent = !hasPlayers
    ? "等待玩家数据"
    : isBalanced
      ? "已平账"
      : `差额 ${signedMoney(delta)}`;
  els.settleStatusCopy.textContent = !hasPlayers
    ? "添加玩家并记录买入后，结账时在这里录入剩余筹码。"
    : isBalanced
      ? `总买入和已清点剩余均为 ${formatMoney(totalBuyIn)}。`
      : `已清点 ${formatMoney(totalCashOut)}，总买入 ${formatMoney(totalBuyIn)}，${awayCount ? `${awayCount} 人已离桌，` : ""}请继续核对最终筹码。`;
  els.settleStatusTitle.parentElement.classList.toggle("is-balanced", isBalanced);
  els.settleStatusTitle.parentElement.classList.toggle("has-gap", hasPlayers && !isBalanced);
  els.completeGame.disabled = !isBalanced;
  els.completeGame.textContent = isBalanced ? "账目结清" : "等待平账";
  els.transferPanel.hidden = !isBalanced;

  els.resultList.innerHTML = hasPlayers
    ? state.players
        .map((player) => {
          const profit = number(player.cashOut) - number(player.buyIn);
          return `
            <div class="result-row settle-row ${player.isAway ? "is-away" : ""}" data-id="${player.id}">
              <div>
                <span>${escapeHtml(player.name)}</span>
                <small>买入 ${formatMoney(player.buyIn)}${player.isAway ? " / 已离桌" : ""}</small>
              </div>
              <label>
                <span>${player.isAway ? "离桌剩余" : "剩余"}</span>
                <input inputmode="decimal" data-field="cashOut" value="${player.cashOut}" ${player.isAway || !keeperMode ? "disabled" : ""} />
              </label>
              <strong class="${profitClass(profit)}">${signedMoney(profit)}</strong>
            </div>
          `;
        })
        .join("")
    : `<div class="empty">暂无结算结果</div>`;

  const transfers = isBalanced ? calculateTransfers() : [];
  els.transferList.innerHTML =
    transfers.length > 0
      ? transfers
          .map(
            (transfer) => `
              <div class="transfer-row">
                <span>${escapeHtml(transfer.from)} → ${escapeHtml(transfer.to)}</span>
                <strong>${formatMoney(transfer.amount)}</strong>
              </div>
            `,
          )
          .join("")
      : `<div class="empty">${isBalanced ? "所有人刚好打平，无需转账。" : "平账后会显示转账建议。"}</div>`;

  els.resultList.querySelectorAll(".settle-row").forEach((row) => {
    const id = row.dataset.id;
    const input = row.querySelector("input");
    if (input.disabled) return;
    input.addEventListener("focus", () => input.select());
    input.addEventListener("change", (event) => {
      const player = state.players.find((item) => item.id === id);
      player.cashOut = event.target.value;
      saveAndRender({ syncGame: true });
    });
  });
}

function calculateTransfers() {
  const creditors = [];
  const debtors = [];

  state.players.forEach((player) => {
    const amount = number(player.cashOut) - number(player.buyIn);
    if (amount > 0) creditors.push({ name: player.name, amount });
    if (amount < 0) debtors.push({ name: player.name, amount: Math.abs(amount) });
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0) {
      transfers.push({ from: debtor.name, to: creditor.name, amount });
      creditor.amount -= amount;
      debtor.amount -= amount;
    }

    if (creditor.amount === 0) creditorIndex += 1;
    if (debtor.amount === 0) debtorIndex += 1;
  }

  return transfers;
}

function createHistoryGame() {
  const { totalBuyIn, totalCashOut, delta } = totals();
  return {
    id: createId(),
    startedAt: state.startedAt || new Date().toISOString(),
    endedAt: new Date().toISOString(),
    totalBuyIn,
    totalCashOut,
    delta,
    isBalanced: delta === 0,
    players: state.players.map((player) => ({
      name: player.name,
      buyIn: number(player.buyIn),
      cashOut: number(player.cashOut),
      profit: number(player.cashOut) - number(player.buyIn),
      isAway: Boolean(player.isAway),
    })),
  };
}

function renderHistory() {
  const monthKey = monthKeyOf(new Date());
  const monthGames = state.history.filter((game) => monthKeyOf(new Date(game.endedAt)) === monthKey);
  const balancedGames = monthGames.filter((game) => game.isBalanced);
  const totalsByPlayer = new Map();

  balancedGames.forEach((game) => {
    game.players.forEach((player) => {
      const previous = totalsByPlayer.get(player.name) || { name: player.name, profit: 0, games: 0 };
      previous.profit += number(player.profit);
      previous.games += 1;
      totalsByPlayer.set(player.name, previous);
    });
  });

  const leaderboard = [...totalsByPlayer.values()].sort((a, b) => b.profit - a.profit);
  els.historyMonthTitle.textContent = `${formatMonth(new Date())} 盈利榜`;
  els.historyMeta.textContent = `本月已存 ${monthGames.length} 局，平账 ${balancedGames.length} 局计入排行榜。`;

  els.leaderboardList.innerHTML = leaderboard.length
    ? leaderboard
        .map(
          (row, index) => `
            <div class="leaderboard-row">
              <span class="rank-badge">${index + 1}</span>
              <span class="row-title">
                <strong>${escapeHtml(row.name)}</strong>
                <small>${row.games} 局</small>
              </span>
              <strong class="${profitClass(row.profit)}">${signedMoney(row.profit)}</strong>
            </div>
          `,
        )
        .join("")
    : `<div class="empty">本月还没有可计入排行的平账牌局。</div>`;

  els.historyList.innerHTML = state.history.length
    ? state.history
        .slice(0, 12)
        .map((game) => {
          return `
            <div class="history-item">
              <button class="history-row" type="button" data-history-id="${game.id}">
                <span class="rank-badge">${game.isBalanced ? "✓" : "!"}</span>
                <span class="row-title">
                  <strong>${formatGameDate(new Date(game.endedAt))}</strong>
                  <small>${game.players.length} 人 / 买入 ${formatMoney(game.totalBuyIn)}</small>
                </span>
                <strong class="${game.isBalanced ? "positive" : "negative"}">${game.isBalanced ? "平账" : "未平账"}</strong>
              </button>
              <div class="history-detail" hidden>
                ${game.players
                  .map(
                    (player) => `
                      <div class="detail-row">
                        <span>${escapeHtml(player.name)}</span>
                        <small>买入 ${formatMoney(player.buyIn)} / 剩余 ${formatMoney(player.cashOut)}${player.isAway ? " / 提前离桌" : ""}</small>
                        <strong class="${profitClass(player.profit)}">${signedMoney(player.profit)}</strong>
                      </div>
                    `,
                  )
                  .join("")}
              </div>
            </div>
          `;
        })
        .join("")
    : `<div class="empty">暂无历史记录。账目结清后会自动存入这里。</div>`;

  els.historyList.querySelectorAll(".history-row").forEach((row) => {
    row.addEventListener("click", () => {
      const item = row.closest(".history-item");
      const detail = item.querySelector(".history-detail");
      const isOpen = item.classList.toggle("is-open");
      detail.hidden = !isOpen;
    });
  });
}

function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatGameDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
  });
}

function signedMoney(value) {
  const amount = number(value);
  if (amount === 0) return "0";
  return `${amount > 0 ? "+" : "-"}${formatMoney(Math.abs(amount))}`;
}

function profitClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function askCashOut(player, title) {
  const defaultValue = player.cashOut ? player.cashOut : player.buyIn;
  if (cashOutRequest) resolveCashOut(null);

  els.cashOutDialogTitle.textContent = title;
  els.cashOutPlayer.textContent = `${player.name} · 买入 ${formatMoney(player.buyIn)}`;
  els.cashOutInput.value = defaultValue;
  showCashOutError("");
  els.cashOutDialog.showModal();
  window.requestAnimationFrame(() => {
    els.cashOutInput.focus();
    els.cashOutInput.select();
  });

  return new Promise((resolve) => {
    cashOutRequest = resolve;
  });
}

function resolveCashOut(value, options = {}) {
  const resolve = cashOutRequest;
  cashOutRequest = null;
  if (options.close !== false && els.cashOutDialog.open) els.cashOutDialog.close();
  if (resolve) resolve(value);
}

function showCashOutError(message) {
  els.cashOutError.textContent = message;
  els.cashOutError.hidden = !message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1800);
}

render();
