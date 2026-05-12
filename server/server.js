const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const host = process.env.HOST || "127.0.0.1";
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

function resolveSafePath(baseDir, relativePath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, relativePath);

  if (resolvedTarget === resolvedBase || resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
    return resolvedTarget;
  }

  return null;
}

function getSyncKey(request) {
  return String(request.headers["x-sync-key"] || "").trim();
}

function normalizeQuadrantId(value) {
  return QUADRANT_IDS.includes(value) ? value : DEFAULT_QUADRANT_ID;
}

function normalizeProjectPriority(value) {
  const PROJECT_PRIORITY_IDS = ["p0", "p1", "p2"];
  if (PROJECT_PRIORITY_IDS.includes(value)) return value;
  if (value === "q1") return "p0";
  if (value === "q2") return "p1";
  return "p2";
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

function normalizeProjectTask(ptask, index) {
  const parsed = ptask && typeof ptask === "object" ? ptask : {};
  const progress = Number.isFinite(Number(parsed.progress))
    ? Math.max(0, Math.min(100, Number(parsed.progress)))
    : 0;
  return {
    id: typeof parsed.id === "string" && parsed.id ? parsed.id : `ptask-${Date.now()}-${index}`,
    projectId: typeof parsed.projectId === "string" && parsed.projectId ? parsed.projectId : "",
    taskName: String(parsed.taskName || "").trim(),
    startDate: typeof parsed.startDate === "string" && parsed.startDate ? parsed.startDate : "",
    endDate: typeof parsed.endDate === "string" && parsed.endDate ? parsed.endDate : "",
    progress,
    priority: normalizeProjectPriority(parsed.priority),
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    order: Number.isFinite(Number(parsed.order)) ? Number(parsed.order) : index
  };
}

function normalizeProjectTasks(ptasks) {
  return (Array.isArray(ptasks) ? ptasks : [])
    .map((ptask, index) => normalizeProjectTask(ptask, index))
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function normalizeProject(project, index) {
  const parsed = project && typeof project === "object" ? project : {};
  return {
    id: typeof parsed.id === "string" && parsed.id ? parsed.id : `proj-${Date.now()}-${index}`,
    name: String(parsed.name || "").trim(),
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    tasks: normalizeProjectTasks(parsed.tasks)
  };
}

function normalizeProjects(projects) {
  return (Array.isArray(projects) ? projects : []).map((project, index) => normalizeProject(project, index));
}

function normalizePanelOrder(order) {
  const VALID_PANELS = ["board", "calendar", "projects"];
  if (!Array.isArray(order)) return ["board", "calendar", "projects"];
  const filtered = order.filter((id) => VALID_PANELS.includes(id));
  for (const id of VALID_PANELS) {
    if (!filtered.includes(id)) filtered.push(id);
  }
  return filtered;
}

function normalizeState(value) {
  const parsed = value && typeof value === "object" ? value : {};
  return {
    tasks: normalizeTasks(parsed.tasks),
    completionLog: parsed.completionLog && typeof parsed.completionLog === "object" ? parsed.completionLog : {},
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    projects: normalizeProjects(parsed.projects),
    panelOrder: normalizePanelOrder(parsed.panelOrder)
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

  if (url.pathname === "/favicon.ico") {
    response.writeHead(204);
    response.end();
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
    const filePath = resolveSafePath(path.join(publicDir, "mobile"), relativePath);
    if (!filePath) {
      sendJson(response, 404, { error: "not_found" });
      return;
    }
    sendFile(response, filePath);
    return;
  }

  if (request.method === "GET") {
    const relativePath = url.pathname.replace(/^\/+/, "");
    const filePath = resolveSafePath(publicDir, relativePath);

    if (!filePath) {
      sendJson(response, 404, { error: "not_found" });
      return;
    }

    sendFile(response, filePath);
    return;
  }

  sendJson(response, 404, { error: "not_found" });
});

server.listen(port, host, () => {
  console.log(`Todo sync server listening on http://${host}:${port}`);
});
