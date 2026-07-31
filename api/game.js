const gameRoomPrefix = "bluffbook:game";

function getRedisConfig() {
  const url =
    process.env.STORAGE_KV_REST_API_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.STORAGE_KV_REST_API_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  return { url, token };
}

function roomKey(room) {
  const safeRoom = String(room || "main")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  return `${gameRoomPrefix}:${safeRoom || "main"}`;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function redis(command, ...args) {
  const { url, token } = getRedisConfig();
  if (!url || !token) throw new Error("Redis environment variables are missing.");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command, ...args]),
  });

  if (!response.ok) throw new Error(`Redis request failed with ${response.status}.`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

function finiteNumber(value, minimum = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : minimum;
}

function normalizePlayer(player, index) {
  const name = String(player?.name || "").trim().slice(0, 40);
  if (!name) return null;

  return {
    id: String(player.id || `player-${index}`).slice(0, 100),
    name,
    buyIn: finiteNumber(player.buyIn),
    buyInCount: finiteNumber(player.buyInCount),
    cashOut: finiteNumber(player.cashOut),
    isAway: Boolean(player.isAway),
    leftAt: player.isAway && player.leftAt ? String(player.leftAt) : null,
  };
}

function emptyGame() {
  return {
    startedAt: null,
    players: [],
    updatedAt: null,
  };
}

function normalizeGame(game) {
  const players = Array.isArray(game?.players)
    ? game.players.slice(0, 40).map(normalizePlayer).filter(Boolean)
    : [];

  return {
    startedAt: game?.startedAt ? String(game.startedAt) : null,
    players,
    updatedAt: new Date().toISOString(),
  };
}

async function getEnvelope(key) {
  const saved = await redis("GET", key);
  if (!saved) return { keeperToken: "", game: emptyGame() };

  try {
    const parsed = JSON.parse(saved);
    return {
      keeperToken: String(parsed.keeperToken || ""),
      game: {
        ...emptyGame(),
        ...(parsed.game || {}),
        players: Array.isArray(parsed.game?.players) ? parsed.game.players : [],
      },
    };
  } catch {
    return { keeperToken: "", game: emptyGame() };
  }
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  const body = await readBody(req);
  const key = roomKey(req.query?.room || body.room);

  try {
    if (req.method === "GET") {
      const envelope = await getEnvelope(key);
      send(res, 200, { game: envelope.game });
      return;
    }

    if (req.method === "PUT") {
      const keeperToken = String(body.keeperToken || "");
      if (!keeperToken) {
        send(res, 403, { error: "只有记账员可以修改本局" });
        return;
      }

      const current = await getEnvelope(key);
      if (current.keeperToken && current.keeperToken !== keeperToken) {
        send(res, 403, { error: "只有记账员可以修改本局" });
        return;
      }

      const game = normalizeGame(body.game);
      await redis("SET", key, JSON.stringify({ keeperToken, game }));
      send(res, 200, { game });
      return;
    }

    send(res, 405, { error: "Method not allowed" });
  } catch (error) {
    send(res, 500, { error: "本局同步暂时不可用", detail: error.message });
  }
}
