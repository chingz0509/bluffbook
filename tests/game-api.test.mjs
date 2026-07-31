import test from "node:test";
import assert from "node:assert/strict";

import gameHandler from "../api/game.js";

function createRedisMock() {
  const values = new Map();
  return {
    values,
    fetch: async (_url, options) => {
      const [command, key, value] = JSON.parse(options.body);
      if (command === "GET") {
        return Response.json({ result: values.get(key) ?? null });
      }
      if (command === "SET") {
        values.set(key, value);
        return Response.json({ result: "OK" });
      }
      throw new Error(`Unexpected Redis command: ${command}`);
    },
  };
}

function request(method, body = {}, room = "test-room") {
  return { method, body, query: { room } };
}

function response() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(value) {
      this.body = JSON.parse(value);
    },
  };
}

async function call(method, body, room) {
  const res = response();
  await gameHandler(request(method, body, room), res);
  return res;
}

test("first recorder token claims the game and is hidden from public reads", async (t) => {
  const redis = createRedisMock();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = redis.fetch;
  process.env.KV_REST_API_URL = "https://redis.test";
  process.env.KV_REST_API_TOKEN = "test-token";
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const written = await call("PUT", {
    keeperToken: "keeper-a",
    game: {
      startedAt: "2026-07-31T12:00:00.000Z",
      players: [{ id: "p1", name: " xinqi ", buyIn: 200, buyInCount: 1, cashOut: 0 }],
    },
  });
  assert.equal(written.statusCode, 200);

  const read = await call("GET");
  assert.equal(read.statusCode, 200);
  assert.equal(read.body.game.players[0].name, "xinqi");
  assert.equal(JSON.stringify(read.body).includes("keeper-a"), false);

  const rejected = await call("PUT", {
    keeperToken: "keeper-b",
    game: { players: [] },
  });
  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.body.error, "只有记账员可以修改本局");
});
