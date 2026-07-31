const storageKey = "texas-ledger-v1";
const signupOwnerKey = "bluffbook-signup-owners-v1";
const signupsApiPath = "/api/signups";
let sharedSignupsEnabled = window.location.protocol !== "file:";

const defaultState = {
  startedAt: new Date().toISOString(),
  players: [],
  signups: [],
  history: [],
};

let state = loadState();
let signupOwners = loadSignupOwners();

const els = {
  fxCanvas: document.querySelector("#fxCanvas"),
  addPlayerForm: document.querySelector("#addPlayerForm"),
  playerName: document.querySelector("#playerName"),
  signupForm: document.querySelector("#signupForm"),
  signupName: document.querySelector("#signupName"),
  signupTitle: document.querySelector("#signupTitle"),
  signupCopy: document.querySelector("#signupCopy"),
  signupCount: document.querySelector("#signupCount"),
  signupList: document.querySelector("#signupList"),
  startFromSignup: document.querySelector("#startFromSignup"),
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

startBoardParticles();
refreshSharedSignups();
window.setInterval(() => {
  refreshSharedSignups({ silent: true });
}, 8000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshSharedSignups({ silent: true });
});

els.addPlayerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = els.playerName.value.trim();
  if (!name) return;

  state.players.push(createPlayer(name));
  els.playerName.value = "";
  saveAndRender();
});

els.goSettle.addEventListener("click", () => {
  activateTab("settle");
});

els.signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = els.signupName.value.trim();
  if (!name) return;

  if (sharedSignupsEnabled) {
    await addSharedSignup(name);
    return;
  }

  const alreadySigned = state.signups.some((signup) => signup.name.toLowerCase() === name.toLowerCase());
  if (alreadySigned) {
    showToast("这个名字已经报名了");
    return;
  }

  state.signups.push({
    id: createId(),
    name,
    joinedAt: new Date().toISOString(),
  });
  els.signupName.value = "";
  saveAndRender();
});

els.startFromSignup.addEventListener("click", async () => {
  if (sharedSignupsEnabled) {
    await refreshSharedSignups({ silent: true });
  }

  if (state.signups.length < 5) {
    showToast("凑够 5 人再开局");
    return;
  }

  if (state.players.length > 0) {
    const confirmed = window.confirm("本局已有玩家，开局会替换为当前报名名单。继续吗？");
    if (!confirmed) return;
  }

  state.players = state.signups.map((signup) => createPlayer(signup.name));
  if (sharedSignupsEnabled) {
    await clearSharedSignups();
  } else {
    state.signups = [];
  }
  state.startedAt = new Date().toISOString();
  saveAndRender();
  activateTab("table");
  showToast("已按报名名单开局");
});

els.completeGame.addEventListener("click", () => {
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

  state = {
    ...defaultState,
    startedAt: new Date().toISOString(),
    players: [],
    signups: state.signups,
    history: [createHistoryGame(), ...state.history],
  };
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
      signups: (saved.signups || []).map(normalizeSignup).filter((signup) => signup.name),
      history: Array.isArray(saved.history) ? saved.history : [],
    };
  } catch {
    return defaultState;
  }
}

function saveAndRender() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  render();
}

async function signupRequest(method, data) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };
  if (data) options.body = JSON.stringify(data);

  const response = await fetch(signupsApiPath, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "报名服务暂时不可用");
  }
  return payload;
}

async function refreshSharedSignups(options = {}) {
  if (!sharedSignupsEnabled) return;

  try {
    const payload = await signupRequest("GET");
    state.signups = (payload.signups || []).map(normalizeSignup).filter((signup) => signup.name);
    saveAndRender();
  } catch {
    sharedSignupsEnabled = false;
    if (!options.silent) showToast("暂时使用本机报名");
    renderSignups();
  }
}

async function addSharedSignup(name) {
  const ownerToken = createOwnerToken();
  try {
    const payload = await signupRequest("POST", { name, ownerToken });
    state.signups = (payload.signups || []).map(normalizeSignup).filter((signup) => signup.name);
    rememberSignupOwner(name, ownerToken);
    els.signupName.value = "";
    saveAndRender();
  } catch (error) {
    showToast(error.message);
  }
}

async function removeSharedSignup(signup) {
  try {
    const ownerToken = getSignupOwnerToken(signup);
    const payload = await signupRequest("DELETE", { id: signup.id, name: signup.name, ownerToken });
    state.signups = (payload.signups || []).map(normalizeSignup).filter((item) => item.name);
    forgetSignupOwner(signup);
    saveAndRender();
  } catch (error) {
    showToast(error.message);
  }
}

async function clearSharedSignups() {
  try {
    const payload = await signupRequest("DELETE", { all: true });
    state.signups = (payload.signups || []).map(normalizeSignup).filter((signup) => signup.name);
  } catch (error) {
    showToast(error.message);
  }
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

function normalizeSignup(signup) {
  return {
    id: signup.id || createId(),
    name: String(signup.name || "").trim(),
    joinedAt: signup.joinedAt || new Date().toISOString(),
  };
}

function loadSignupOwners() {
  try {
    const saved = JSON.parse(localStorage.getItem(signupOwnerKey));
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveSignupOwners() {
  localStorage.setItem(signupOwnerKey, JSON.stringify(signupOwners));
}

function signupOwnerNameKey(name) {
  return String(name || "").trim().toLowerCase();
}

function createOwnerToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `owner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function rememberSignupOwner(name, ownerToken) {
  signupOwners[signupOwnerNameKey(name)] = ownerToken;
  saveSignupOwners();
}

function getSignupOwnerToken(signup) {
  return signupOwners[signupOwnerNameKey(signup?.name)];
}

function forgetSignupOwner(signup) {
  delete signupOwners[signupOwnerNameKey(signup?.name)];
  saveSignupOwners();
}

function canCancelSignup(signup) {
  return !sharedSignupsEnabled || Boolean(getSignupOwnerToken(signup));
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

  els.tableFooter.hidden = state.players.length === 0;
  els.totalBuyIn.textContent = formatMoney(totalBuyIn);

  renderPlayers();
  renderSignups();
  renderSettlement();
  renderHistory();
}

function renderPlayers() {
  if (state.players.length === 0) {
    els.playerList.innerHTML = `<div class="empty">还没有玩家。添加姓名后会自动记一手 200。</div>`;
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
      const actions = player.isAway
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
          <button class="swipe-delete" type="button" data-remove>删除</button>
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
    const id = row.dataset.id;
    const card = row.querySelector(".swipe-card");

    row.querySelectorAll("[data-add]").forEach((button) => {
      button.addEventListener("click", () => {
        const player = state.players.find((item) => item.id === id);
        if (player.isAway) return;
        const delta = number(button.dataset.add);
        player.buyIn = Math.max(0, number(player.buyIn) + delta);
        player.buyInCount = Math.max(0, number(player.buyInCount) + delta / 200);
        saveAndRender();
      });
    });

    const leaveButton = row.querySelector("[data-leave]");
    if (leaveButton) {
      leaveButton.addEventListener("click", () => {
        const player = state.players.find((item) => item.id === id);
        const cashOut = askCashOut(player, "输入离桌时剩余筹码");
        if (cashOut === null) return;
        player.cashOut = cashOut;
        player.isAway = true;
        player.leftAt = new Date().toISOString();
        saveAndRender();
        showToast(`${player.name} 已离桌`);
      });
    }

    const editAwayButton = row.querySelector("[data-edit-away]");
    if (editAwayButton) {
      editAwayButton.addEventListener("click", () => {
        const player = state.players.find((item) => item.id === id);
        const cashOut = askCashOut(player, "修改离桌剩余筹码");
        if (cashOut === null) return;
        player.cashOut = cashOut;
        saveAndRender();
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
        saveAndRender();
      });
    }

    row.querySelector("[data-remove]").addEventListener("click", () => {
      const player = state.players.find((item) => item.id === id);
      const confirmed = window.confirm(`删除 ${player.name}？`);
      if (!confirmed) return;
      state.players = state.players.filter((player) => player.id !== id);
      saveAndRender();
    });

    attachSwipeDelete(row, card);
  });
}

function renderSignups() {
  const ready = state.signups.length >= 5;
  const missing = Math.max(0, 5 - state.signups.length);

  els.signupTitle.textContent = ready ? "可以开局了" : "等待报名";
  els.signupCopy.textContent = ready
    ? `已报名 ${state.signups.length} 人，由记账员确认后开局。`
    : `已报名 ${state.signups.length} 人，还差 ${missing} 人开局。`;
  els.signupCount.textContent = `${state.signups.length}/5`;
  els.signupCount.classList.toggle("is-ready", ready);
  els.startFromSignup.disabled = !ready;

  els.signupList.innerHTML = state.signups.length
    ? state.signups
        .map(
          (signup, index) => {
            const canCancel = canCancelSignup(signup);
            return `
            <article class="signup-row" data-id="${signup.id}">
              <span class="rank-badge">${index + 1}</span>
              <div>
                <strong>${escapeHtml(signup.name)}</strong>
                <small>${canCancel ? "你已报名" : formatSignupTime(new Date(signup.joinedAt))}</small>
              </div>
              ${
                canCancel
                  ? `<button type="button" data-cancel-signup>取消</button>`
                  : `<span class="signup-status">已报名</span>`
              }
            </article>
          `;
          },
        )
        .join("")
    : `<div class="empty">还没有人报名。输入名字后点“我要报名”。</div>`;

  els.signupList.querySelectorAll("[data-cancel-signup]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest(".signup-row");
      const signup = state.signups.find((item) => item.id === row.dataset.id);
      const confirmed = window.confirm(`取消 ${signup.name} 的报名？`);
      if (!confirmed) return;
      if (sharedSignupsEnabled) {
        removeSharedSignup(signup);
        return;
      }
      state.signups = state.signups.filter((item) => item.id !== row.dataset.id);
      saveAndRender();
    });
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
                <input inputmode="decimal" data-field="cashOut" value="${player.cashOut}" ${player.isAway ? "disabled" : ""} />
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
      saveAndRender();
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

function formatSignupTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} 报名`;
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
  const value = window.prompt(`${title}：${player.name}`, defaultValue);
  if (value === null) return null;

  const amount = number(value);
  if (!Number.isFinite(Number(value)) || amount < 0) {
    showToast("请输入有效的筹码数");
    return null;
  }
  return amount;
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
