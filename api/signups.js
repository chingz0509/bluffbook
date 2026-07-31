const roomPrefix = "bluffbook:signups";
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
  return `${roomPrefix}:${safeRoom || "main"}`;
}

function gameRoomKey(room) {
  const safeRoom = String(room || "main")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  return `${gameRoomPrefix}:${safeRoom || "main"}`;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `signup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

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
  if (!url || !token) {
    throw new Error("Redis environment variables are missing.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command, ...args]),
  });

  if (!response.ok) {
    throw new Error(`Redis request failed with ${response.status}.`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function getSignups(key) {
  const saved = await redis("GET", key);
  if (!saved) return [];

  try {
    const signups = JSON.parse(saved);
    return Array.isArray(signups)
      ? signups
          .map((signup) => ({
            id: signup.id || createId(),
            name: String(signup.name || "").trim(),
            joinedAt: signup.joinedAt || new Date().toISOString(),
            ownerToken: signup.ownerToken || "",
          }))
          .filter((signup) => signup.name)
      : [];
  } catch {
    return [];
  }
}

async function setSignups(key, signups) {
  await redis("SET", key, JSON.stringify(signups));
}

async function getKeeperToken(key) {
  const saved = await redis("GET", key);
  if (!saved) return "";

  try {
    return String(JSON.parse(saved).keeperToken || "");
  } catch {
    return "";
  }
}

function publicSignups(signups) {
  return signups.map(({ ownerToken, ...signup }) => signup);
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  const body = await readBody(req);
  const room = req.query?.room || body.room;
  const key = roomKey(room);

  try {
    if (req.method === "GET") {
      const signups = await getSignups(key);
      send(res, 200, { signups: publicSignups(signups) });
      return;
    }

    if (req.method === "POST") {
      const name = String(body.name || "").trim();
      if (!name) {
        send(res, 400, { error: "请输入名字" });
        return;
      }

      const signups = await getSignups(key);
      const alreadySigned = signups.some((signup) => signup.name.toLowerCase() === name.toLowerCase());
      if (alreadySigned) {
        send(res, 409, { error: "这个名字已经报名了", signups: publicSignups(signups) });
        return;
      }

      const nextSignups = [
        ...signups,
        {
          id: createId(),
          name,
          joinedAt: new Date().toISOString(),
          ownerToken: String(body.ownerToken || ""),
        },
      ];
      await setSignups(key, nextSignups);
      send(res, 201, { signups: publicSignups(nextSignups) });
      return;
    }

    if (req.method === "DELETE") {
      const signups = await getSignups(key);
      let nextSignups = [];

      if (body.all) {
        const keeperToken = await getKeeperToken(gameRoomKey(room));
        if (!keeperToken || keeperToken !== String(body.keeperToken || "")) {
          send(res, 403, { error: "只有记账员可以清空报名", signups: publicSignups(signups) });
          return;
        }
      } else {
        const ownerToken = String(body.ownerToken || "");
        const target = signups.find((signup) => signup.id === body.id || signup.name === body.name);

        if (!target) {
          send(res, 404, { error: "没有找到这条报名", signups: publicSignups(signups) });
          return;
        }

        if (!target.ownerToken || target.ownerToken !== ownerToken) {
          send(res, 403, { error: "只能取消自己的报名", signups: publicSignups(signups) });
          return;
        }

        nextSignups = signups.filter((signup) => signup.id !== target.id);
      }

      await setSignups(key, nextSignups);
      send(res, 200, { signups: publicSignups(nextSignups) });
      return;
    }

    send(res, 405, { error: "Method not allowed" });
  } catch (error) {
    send(res, 500, { error: "报名服务暂时不可用", detail: error.message });
  }
}
