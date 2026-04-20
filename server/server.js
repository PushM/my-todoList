const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8787);
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const storePath = path.join(dataDir, "sync-store.json");
const backupDir = path.join(dataDir, "backups");
const maxBackupFiles = 30;
const QUADRANT_IDS = ["q1", "q2", "q3", "q4"];
const DEFAULT_QUADRANT_ID = "q1";

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({ docs: {} }, null, 2), "utf-8");
  }
}

function createBackupFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `sync-store-${stamp}.json`;
}

function pruneBackups() {
  if (!fs.existsSync(backupDir)) {
    return;
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((fileName) => fileName.startsWith("sync-store-") && fileName.endsWith(".json"))
    .sort()
    .reverse();

  for (const fileName of files.slice(maxBackupFiles)) {
    fs.unlinkSync(path.join(backupDir, fileName));
  }
}

function createStoreBackup() {
  if (!fs.existsSync(storePath)) {
    return;
  }

  ensureStore();
  fs.copyFileSync(storePath, path.join(backupDir, createBackupFileName()));
  pruneBackups();
}

function readLatestBackup() {
  ensureStore();
  const fileName = fs
    .readdirSync(backupDir)
    .filter((item) => item.startsWith("sync-store-") && item.endsWith(".json"))
    .sort()
    .reverse()[0];

  if (!fileName) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(path.join(backupDir, fileName), "utf-8"));
  } catch (error) {
    return null;
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf-8"));
  } catch (error) {
    const backupStore = readLatestBackup();
    if (backupStore) {
      fs.writeFileSync(storePath, JSON.stringify(backupStore, null, 2), "utf-8");
      return backupStore;
    }

    return { docs: {} };
  }
}

function writeStore(store) {
  ensureStore();
  createStoreBackup();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf-8");
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, PUT, OPTIONS",
    "access-control-allow-headers": "content-type, x-sync-key, x-device-name"
  });
  response.end(JSON.stringify(body));
}

function sendFile(response, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
  };

  if (!fs.existsSync(filePath)) {
    sendJson(response, 404, { error: "not_found" });
    return;
  }

  response.writeHead(200, {
    "content-type": typeMap[ext] || "application/octet-stream"
  });
  fs.createReadStream(filePath).pipe(response);
}

function getSyncKey(request) {
  return String(request.headers["x-sync-key"] || "").trim();
}

function normalizeQuadrantId(value) {
  return QUADRANT_IDS.includes(value) ? value : DEFAULT_QUADRANT_ID;
}

function normalizeTask(task, index) {
  const parsed = task && typeof task === "object" ? task : {};
  return {
    id: typeof parsed.id === "string" && parsed.id ? parsed.id : `task-${Date.now()}-${index}`,
    title: String(parsed.title || "").trim(),
    completed: parsed.completed === true,
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    completedAt: typeof parsed.completedAt === "string" ? parsed.completedAt : null,
    quadrantId: normalizeQuadrantId(parsed.quadrantId),
    quadrantOrder: Number.isFinite(Number(parsed.quadrantOrder)) ? Number(parsed.quadrantOrder) : index
  };
}

function sortTasksByQuadrantOrder(left, right) {
  if (left.quadrantOrder !== right.quadrantOrder) {
    return left.quadrantOrder - right.quadrantOrder;
  }

  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function normalizeTasks(tasks) {
  const normalized = (Array.isArray(tasks) ? tasks : []).map((task, index) => normalizeTask(task, index));

  for (const quadrantId of QUADRANT_IDS) {
    const pendingTasks = normalized
      .filter((task) => !task.completed && task.quadrantId === quadrantId)
      .sort(sortTasksByQuadrantOrder);

    pendingTasks.forEach((task, order) => {
      task.quadrantOrder = order;
    });
  }

  return normalized;
}

function normalizeState(value) {
  const parsed = value && typeof value === "object" ? value : {};
  return {
    tasks: normalizeTasks(parsed.tasks),
    completionLog: parsed.completionLog && typeof parsed.completionLog === "object" ? parsed.completionLog : {},
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
  };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error("payload_too_large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("invalid_json"));
      }
    });
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      serverTime: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === "/api/sync") {
    const syncKey = getSyncKey(request);
    if (!syncKey) {
      sendJson(response, 400, { error: "missing_sync_key" });
      return;
    }

    const store = readStore();
    store.docs = store.docs || {};

    if (request.method === "GET") {
      const doc = store.docs[syncKey];
      if (!doc) {
        sendJson(response, 404, { error: "not_found" });
        return;
      }

      sendJson(response, 200, {
        state: doc.state,
        updatedAt: doc.updatedAt,
        deviceName: doc.deviceName || null
      });
      return;
    }

    if (request.method === "PUT") {
      try {
        const body = await readRequestBody(request);
        const state = normalizeState(body.state);
        const deviceName = String(request.headers["x-device-name"] || "unknown-device");
        const updatedAt = state.updatedAt || new Date().toISOString();

        store.docs[syncKey] = {
          state: {
            ...state,
            updatedAt
          },
          updatedAt,
          deviceName
        };
        writeStore(store);

        sendJson(response, 200, {
          ok: true,
          state: store.docs[syncKey].state,
          updatedAt,
          deviceName
        });
      } catch (error) {
        sendJson(response, 400, { error: error.message || "invalid_request" });
      }
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    sendFile(response, path.join(publicDir, "index.html"));
    return;
  }

  if (url.pathname === "/mobile") {
    response.writeHead(302, {
      location: "/mobile/"
    });
    response.end();
    return;
  }

  if (url.pathname.startsWith("/mobile")) {
    const relativePath = url.pathname === "/mobile/" ? "index.html" : url.pathname.replace(/^\/mobile\//, "");
    sendFile(response, path.join(publicDir, "mobile", relativePath));
    return;
  }

  sendJson(response, 404, { error: "not_found" });
});

server.listen(port, host, () => {
  console.log(`Todo sync server listening on http://${host}:${port}`);
});
