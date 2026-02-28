const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractStateData,
  buildStateEnvelope,
  validateStatePayload,
} = require("../server/lib/state-contract");

test("extractStateData supports envelope and direct object", () => {
  assert.deepEqual(extractStateData({ data: { a: 1 } }), { a: 1 });
  assert.deepEqual(extractStateData({ a: 1, b: 2 }), { a: 1, b: 2 });
});

test("buildStateEnvelope creates stable shape", () => {
  const out = buildStateEnvelope({ todoTasks: [] });
  assert.equal(out.version, 1);
  assert.ok(typeof out.updatedAt === "string" && out.updatedAt.length > 0);
  assert.deepEqual(out.data, { todoTasks: [] });
});

test("validateStatePayload rejects functions and accepts json-safe data", () => {
  const valid = validateStatePayload({ data: { key: ["x", 1, true, null] } });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.data, { key: ["x", 1, true, null] });

  const invalid = validateStatePayload({ data: { bad: () => {} } });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, "invalid_state_data");
});
