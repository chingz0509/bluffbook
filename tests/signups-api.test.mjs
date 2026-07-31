import test from "node:test";
import assert from "node:assert/strict";

import signupHandler from "../api/signups.js";

function createRedisMock() {
  const values = new Map();
  return {
    values,
    fetch: async (_url, options) => {
      const [command, key, value] = JSON.parse(options.body);
      if (command === "GET") return Response.json({ result: values.get(key) ?? null });
      if (command === "SET") {
        values.set(key, value);
        return Response.json({ result: "OK" });
      }
      throw new Error(`Unexpected Redis command: ${command}`);
    },
  };
}

function response() {
  return {
    statusCode: 0,
    setHeader() {},
    end(value) {
      this.body = JSON.parse(value);
    },
  };
}

async function call(method, body, room = "test-room") {
  const res = response();
  await signupHandler({ method, body, query: { room } }, res);
  return res;
}

test("clearing all signups requires the current game recorder token", async (t) => {
  const redis = createRedisMock();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = redis.fetch;
  process.env.KV_REST_API_URL = "https://redis.test";
  process.env.KV_REST_API_TOKEN = "test-token";
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  redis.values.set(
    "bluffbook:game:test-room",
    JSON.stringify({ keeperToken: "keeper-a", game: { players: [] } }),
  );
  redis.values.set(
    "bluffbook:signups:test-room",
    JSON.stringify([{ id: "s1", name: "xinqi", ownerToken: "owner-a" }]),
  );

  const rejected = await call("DELETE", { all: true, keeperToken: "keeper-b" });
  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.body.signups.length, 1);

  const cleared = await call("DELETE", { all: true, keeperToken: "keeper-a" });
  assert.equal(cleared.statusCode, 200);
  assert.deepEqual(cleared.body.signups, []);
});
