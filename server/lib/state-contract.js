function toObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function extractStateData(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.data && typeof payload.data === "object") return payload.data;
  return toObject(payload);
}

function buildStateEnvelope(data) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    data: toObject(data),
  };
}

function isJsonSafe(value, depth = 0) {
  if (depth > 20) return false;
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return true;
  if (Array.isArray(value)) return value.every((item) => isJsonSafe(item, depth + 1));
  if (t === "object") {
    return Object.values(value).every((item) => isJsonSafe(item, depth + 1));
  }
  return false;
}

function validateStatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "invalid_payload" };
  }
  const data = extractStateData(payload);
  if (!isJsonSafe(data)) {
    return { ok: false, error: "invalid_state_data" };
  }
  return { ok: true, data: toObject(data) };
}

module.exports = {
  toObject,
  extractStateData,
  buildStateEnvelope,
  validateStatePayload,
};
