const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const dataFileName = "todo-data.json";
const syncConfigFileName = "sync-config.json";
const syncIntervalMs = 30 * 1000;
const backupDirName = "backups";
const maxBackupFiles = 20;
const QUADRANT_IDS = ["q1", "q2", "q3", "q4"];
const DEFAULT_QUADRANT_ID = "q1";

let mainWindow = null;
let stickyWindow = null;
let syncTimer = null;
let syncInFlight = false;

function getDataFilePath() {
  return path.join(app.getPath("userData"), dataFileName);
}

function getSyncConfigPath() {
  return path.join(app.getPath("userData"), syncConfigFileName);
}

function getBackupDirPath() {
  return path.join(app.getPath("userData"), backupDirName);
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function createBackupFileName(prefix) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${stamp}.json`;
}

function pruneBackups(prefix) {
  const backupDir = getBackupDirPath();
  if (!fs.existsSync(backupDir)) {
    return;
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((fileName) => fileName.startsWith(`${prefix}-`) && fileName.endsWith(".json"))
    .sort()
    .reverse();

  for (const fileName of files.slice(maxBackupFiles)) {
    fs.unlinkSync(path.join(backupDir, fileName));
  }
}

function createFileBackup(filePath, prefix) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const backupDir = getBackupDirPath();
  ensureDirectory(backupDir);
  fs.copyFileSync(filePath, path.join(backupDir, createBackupFileName(prefix)));
  pruneBackups(prefix);
}

function readLatestBackup(prefix) {
  const backupDir = getBackupDirPath();
  if (!fs.existsSync(backupDir)) {
    return null;
  }

  const fileName = fs
    .readdirSync(backupDir)
    .filter((item) => item.startsWith(`${prefix}-`) && item.endsWith(".json"))
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

function createDefaultState() {
  return {
    tasks: [],
    completionLog: {},
    updatedAt: new Date().toISOString()
  };
}

function normalizeQuadrantId(value) {
  return QUADRANT_IDS.includes(value) ? value : DEFAULT_QUADRANT_ID;
}

function toFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeTask(task, index) {
  const parsed = task && typeof task === "object" ? task : {};
  return {
    id: typeof parsed.id === "string" && parsed.id ? parsed.id : createTaskId(),
    title: String(parsed.title || "").trim(),
    completed: parsed.completed === true,
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    completedAt: typeof parsed.completedAt === "string" ? parsed.completedAt : null,
    quadrantId: normalizeQuadrantId(parsed.quadrantId),
    quadrantOrder: toFiniteNumber(Number(parsed.quadrantOrder), index)
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

function getNextQuadrantOrder(state, quadrantId) {
  return state.tasks.filter((task) => !task.completed && task.quadrantId === quadrantId).length;
}

function reorderPendingTask(state, taskId, targetQuadrantId, targetIndex) {
  const nextQuadrantId = normalizeQuadrantId(targetQuadrantId);
  const target = state.tasks.find((task) => task.id === taskId);

  if (!target || target.completed) {
    return state;
  }

  const quadrants = Object.fromEntries(
    QUADRANT_IDS.map((quadrantId) => [
      quadrantId,
      state.tasks
        .filter((task) => !task.completed && task.quadrantId === quadrantId)
        .sort(sortTasksByQuadrantOrder)
    ])
  );

  quadrants[target.quadrantId] = quadrants[target.quadrantId].filter((task) => task.id !== taskId);
  target.quadrantId = nextQuadrantId;

  const destination = quadrants[nextQuadrantId].slice();
  const safeIndex = Math.max(0, Math.min(Number(targetIndex) || 0, destination.length));
  destination.splice(safeIndex, 0, target);
  quadrants[nextQuadrantId] = destination;

  for (const quadrantId of QUADRANT_IDS) {
    quadrants[quadrantId].forEach((task, index) => {
      task.quadrantOrder = index;
    });
  }

  return state;
}

function readState() {
  const dataPath = getDataFilePath();

  if (!fs.existsSync(dataPath)) {
    return createDefaultState();
  }

  try {
    const raw = fs.readFileSync(dataPath, "utf-8");
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    const backupState = readLatestBackup("todo-data");
    if (backupState) {
      const restored = normalizeState(backupState);
      fs.writeFileSync(dataPath, JSON.stringify(restored, null, 2), "utf-8");
      return restored;
    }

    return createDefaultState();
  }
}

function writeState(state) {
  const dataPath = getDataFilePath();
  ensureDirectory(path.dirname(dataPath));
  createFileBackup(dataPath, "todo-data");
  fs.writeFileSync(dataPath, JSON.stringify(normalizeState(state), null, 2), "utf-8");
}

function createDefaultSyncConfig() {
  return {
    serverUrl: "",
    syncKey: "",
    deviceName: `${os.hostname()}-desktop`,
    autoSync: true,
    lastSyncedAt: null,
    lastSyncMessage: "未配置同步"
  };
}

function normalizeServerUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function normalizeSyncConfig(value) {
  const parsed = value && typeof value === "object" ? value : {};
  const defaults = createDefaultSyncConfig();
  return {
    serverUrl: normalizeServerUrl(parsed.serverUrl ?? defaults.serverUrl),
    syncKey: String(parsed.syncKey ?? defaults.syncKey).trim(),
    deviceName: String(parsed.deviceName ?? defaults.deviceName).trim() || defaults.deviceName,
    autoSync: parsed.autoSync !== false,
    lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
    lastSyncMessage: typeof parsed.lastSyncMessage === "string" ? parsed.lastSyncMessage : defaults.lastSyncMessage
  };
}

function readSyncConfig() {
  const configPath = getSyncConfigPath();

  if (!fs.existsSync(configPath)) {
    return createDefaultSyncConfig();
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return normalizeSyncConfig(JSON.parse(raw));
  } catch (error) {
    const backupConfig = readLatestBackup("sync-config");
    if (backupConfig) {
      const restored = normalizeSyncConfig(backupConfig);
      fs.writeFileSync(configPath, JSON.stringify(restored, null, 2), "utf-8");
      return restored;
    }

    return createDefaultSyncConfig();
  }
}

function writeSyncConfig(config) {
  const configPath = getSyncConfigPath();
  ensureDirectory(path.dirname(configPath));
  createFileBackup(configPath, "sync-config");
  fs.writeFileSync(configPath, JSON.stringify(normalizeSyncConfig(config), null, 2), "utf-8");
}

function formatDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) {
    return false;
  }

  const [year, month, day] = String(dateKey).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function buildCompletedAt(dateKey, baseIso = null) {
  if (!isValidDateKey(dateKey)) {
    return null;
  }

  const [year, month, day] = String(dateKey).split("-").map(Number);
  const base = baseIso ? new Date(baseIso) : new Date();
  const localDate = new Date(
    year,
    month - 1,
    day,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    0
  );

  if (Number.isNaN(localDate.getTime())) {
    return null;
  }

  return localDate.toISOString();
}

function removeTaskFromCompletionLog(state, taskId) {
  for (const dateKey of Object.keys(state.completionLog)) {
    if (!Array.isArray(state.completionLog[dateKey])) {
      continue;
    }

    state.completionLog[dateKey] = state.completionLog[dateKey].filter(
      (item) => item.taskId !== taskId
    );

    if (state.completionLog[dateKey].length === 0) {
      delete state.completionLog[dateKey];
    }
  }
}

function addTaskToCompletionLog(state, task, completedAt) {
  const dateKey = formatDateKey(new Date(completedAt));
  const items = Array.isArray(state.completionLog[dateKey])
    ? state.completionLog[dateKey]
    : [];
  items.unshift({
    taskId: task.id,
    title: task.title,
    completedAt
  });
  state.completionLog[dateKey] = items;
}

function syncTaskTitleInCompletionLog(state, taskId, nextTitle) {
  for (const dateKey of Object.keys(state.completionLog)) {
    if (!Array.isArray(state.completionLog[dateKey])) {
      continue;
    }

    state.completionLog[dateKey] = state.completionLog[dateKey].map((item) =>
      item.taskId === taskId
        ? {
            ...item,
            title: nextTitle
          }
        : item
    );
  }
}

function markStateUpdated(state) {
  return {
    ...normalizeState(state),
    updatedAt: new Date().toISOString()
  };
}

function stateHasContent(state) {
  const normalized = normalizeState(state);
  if (normalized.tasks.length > 0) {
    return true;
  }

  return Object.values(normalized.completionLog).some((items) => Array.isArray(items) && items.length > 0);
}

function createTaskId() {
  return `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function sendStateToWindows(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("state:changed", state);
  }

  if (stickyWindow && !stickyWindow.isDestroyed()) {
    stickyWindow.webContents.send("state:changed", state);
  }
}

function sendStickyStatus() {
  const payload = {
    isOpen: Boolean(stickyWindow && !stickyWindow.isDestroyed())
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("sticky:status", payload);
  }
}

function sendSyncStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("sync:status", status);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    autoHideMenuBar: true,
    title: "Todo Sticky Calendar",
    backgroundColor: "#f5eadb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function getStickyBounds() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const width = 300;
  const height = 460;
  const margin = 18;

  return {
    width,
    height,
    x: workArea.x + workArea.width - width - margin,
    y: workArea.y + margin
  };
}

function createStickyWindow() {
  if (stickyWindow && !stickyWindow.isDestroyed()) {
    stickyWindow.focus();
    sendStickyStatus();
    return stickyWindow;
  }

  const bounds = getStickyBounds();

  stickyWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 240,
    minHeight: 320,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: "Todo Sticky Note",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  stickyWindow.loadFile(path.join(__dirname, "renderer", "sticky.html"));
  stickyWindow.on("closed", () => {
    stickyWindow = null;
    sendStickyStatus();
  });

  sendStickyStatus();
  return stickyWindow;
}

function getSyncHeaders(config) {
  return {
    "content-type": "application/json",
    "x-sync-key": config.syncKey,
    "x-device-name": config.deviceName
  };
}

async function fetchRemoteState(config) {
  const response = await fetch(`${config.serverUrl}/api/sync`, {
    method: "GET",
    headers: getSyncHeaders(config)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`云端返回 ${response.status}`);
  }

  const payload = await response.json();
  return normalizeState(payload.state);
}

async function pushRemoteState(config, state) {
  const response = await fetch(`${config.serverUrl}/api/sync`, {
    method: "PUT",
    headers: getSyncHeaders(config),
    body: JSON.stringify({
      state: normalizeState(state)
    })
  });

  if (!response.ok) {
    throw new Error(`上传失败 ${response.status}`);
  }

  const payload = await response.json();
  return normalizeState(payload.state);
}

async function runSync(reason = "manual") {
  if (syncInFlight) {
    return {
      ok: false,
      skipped: true,
      message: "同步进行中"
    };
  }

  const config = readSyncConfig();
  if (!config.serverUrl || !config.syncKey) {
    const status = {
      phase: "idle",
      ok: false,
      message: "请先配置服务器地址和同步码",
      updatedAt: new Date().toISOString(),
      reason
    };
    sendSyncStatus(status);
    return status;
  }

  syncInFlight = true;
  sendSyncStatus({
    phase: "syncing",
    ok: true,
    message: "正在同步",
    updatedAt: new Date().toISOString(),
    reason
  });

  try {
    const localState = readState();
    const remoteState = await fetchRemoteState(config);
    let nextState = localState;
    let message = "已同步，无更新";

    if (!remoteState) {
      nextState = await pushRemoteState(config, localState);
      writeState(nextState);
      sendStateToWindows(nextState);
      message = "首次同步完成，已上传到云端";
    } else {
      const localHasContent = stateHasContent(localState);
      const remoteHasContent = stateHasContent(remoteState);
      const localTime = Date.parse(localState.updatedAt || 0);
      const remoteTime = Date.parse(remoteState.updatedAt || 0);

      if (remoteHasContent && !localHasContent) {
        nextState = remoteState;
        writeState(nextState);
        sendStateToWindows(nextState);
        message = "检测到本地为空，已恢复云端数据";
      } else if (localHasContent && !remoteHasContent) {
        nextState = await pushRemoteState(config, localState);
        writeState(nextState);
        sendStateToWindows(nextState);
        message = "云端为空，已用本地数据恢复";
      } else if (remoteTime > localTime) {
        nextState = remoteState;
        writeState(nextState);
        sendStateToWindows(nextState);
        message = "已拉取云端最新数据";
      } else if (localTime > remoteTime) {
        nextState = await pushRemoteState(config, localState);
        writeState(nextState);
        sendStateToWindows(nextState);
        message = "本地改动已上传";
      }
    }

    const nextConfig = {
      ...config,
      lastSyncedAt: new Date().toISOString(),
      lastSyncMessage: message
    };
    writeSyncConfig(nextConfig);

    const status = {
      phase: "idle",
      ok: true,
      message,
      updatedAt: nextConfig.lastSyncedAt,
      reason
    };
    sendSyncStatus(status);
    return status;
  } catch (error) {
    const nextConfig = {
      ...config,
      lastSyncMessage: `同步失败: ${error.message}`
    };
    writeSyncConfig(nextConfig);

    const status = {
      phase: "error",
      ok: false,
      message: nextConfig.lastSyncMessage,
      updatedAt: new Date().toISOString(),
      reason
    };
    sendSyncStatus(status);
    return status;
  } finally {
    syncInFlight = false;
  }
}

function scheduleAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
  }

  syncTimer = setInterval(() => {
    const config = readSyncConfig();
    if (config.autoSync && config.serverUrl && config.syncKey) {
      runSync("timer");
    }
  }, syncIntervalMs);
}

function saveStateAndBroadcast(state, syncReason = "local-change") {
  const nextState = markStateUpdated(state);
  writeState(nextState);
  sendStateToWindows(nextState);

  const config = readSyncConfig();
  if (config.autoSync && config.serverUrl && config.syncKey) {
    runSync(syncReason);
  }

  return nextState;
}

app.whenReady().then(() => {
  scheduleAutoSync();

  ipcMain.handle("state:load", () => readState());
  ipcMain.handle("sync:config:get", () => readSyncConfig());
  ipcMain.handle("sync:config:save", async (_, payload) => {
    const nextConfig = normalizeSyncConfig({
      ...readSyncConfig(),
      ...payload
    });
    writeSyncConfig(nextConfig);
    const status = await runSync("config-saved");
    return {
      config: readSyncConfig(),
      status
    };
  });
  ipcMain.handle("sync:run", async (_, reason = "manual") => runSync(reason));
  ipcMain.handle("sticky:status", () => ({
    isOpen: Boolean(stickyWindow && !stickyWindow.isDestroyed())
  }));
  ipcMain.handle("sticky:toggle", () => {
    if (stickyWindow && !stickyWindow.isDestroyed()) {
      stickyWindow.close();
    } else {
      createStickyWindow();
    }

    return {
      isOpen: Boolean(stickyWindow && !stickyWindow.isDestroyed())
    };
  });
  ipcMain.handle("sticky:close", () => {
    if (stickyWindow && !stickyWindow.isDestroyed()) {
      stickyWindow.close();
    }

    return {
      isOpen: false
    };
  });
  ipcMain.handle("window:minimizeSticky", () => {
    if (stickyWindow && !stickyWindow.isDestroyed()) {
      stickyWindow.minimize();
    }
  });

  ipcMain.handle("task:add", (_, title) => {
    const state = readState();
    const task = {
      id: createTaskId(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      quadrantId: DEFAULT_QUADRANT_ID,
      quadrantOrder: getNextQuadrantOrder(state, DEFAULT_QUADRANT_ID)
    };

    state.tasks.unshift(task);
    return saveStateAndBroadcast(state, "task-add");
  });

  ipcMain.handle("task:move", (_, taskId, targetQuadrantId, targetIndex) => {
    const state = readState();
    reorderPendingTask(state, taskId, targetQuadrantId, targetIndex);
    return saveStateAndBroadcast(state, "task-move");
  });

  ipcMain.handle("task:updateTitle", (_, taskId, nextTitle) => {
    const state = readState();
    const target = state.tasks.find((task) => task.id === taskId);
    const trimmedTitle = String(nextTitle || "").trim();

    if (!target || !trimmedTitle) {
      return state;
    }

    target.title = trimmedTitle;
    syncTaskTitleInCompletionLog(state, taskId, trimmedTitle);
    return saveStateAndBroadcast(state, "task-update-title");
  });

  ipcMain.handle("task:toggle", (_, taskId, completionDateKey = null) => {
    const state = readState();
    const target = state.tasks.find((task) => task.id === taskId);

    if (!target) {
      return state;
    }

    if (!target.completed) {
      const completedAt =
        buildCompletedAt(completionDateKey) || new Date().toISOString();
      target.completed = true;
      target.completedAt = completedAt;
      addTaskToCompletionLog(state, target, completedAt);
    } else {
      target.completed = false;
      target.completedAt = null;
      removeTaskFromCompletionLog(state, taskId);
    }

    return saveStateAndBroadcast(state, "task-toggle");
  });

  ipcMain.handle("task:updateCompletedDate", (_, taskId, completionDateKey) => {
    const state = readState();
    const target = state.tasks.find((task) => task.id === taskId);

    if (!target || !target.completed) {
      return state;
    }

    const nextCompletedAt = buildCompletedAt(completionDateKey, target.completedAt);
    if (!nextCompletedAt) {
      return state;
    }

    removeTaskFromCompletionLog(state, taskId);
    target.completedAt = nextCompletedAt;
    addTaskToCompletionLog(state, target, nextCompletedAt);
    return saveStateAndBroadcast(state, "task-update-completed-date");
  });

  ipcMain.handle("task:addCompleted", (_, payload) => {
    const state = readState();
    const title = String(payload?.title || "").trim();
    const dateKey = String(payload?.dateKey || "").trim();

    if (!title || !isValidDateKey(dateKey)) {
      return state;
    }

    const completedAt = buildCompletedAt(dateKey) || new Date().toISOString();
    const task = {
      id: createTaskId(),
      title,
      completed: true,
      createdAt: new Date().toISOString(),
      completedAt,
      quadrantId: DEFAULT_QUADRANT_ID,
      quadrantOrder: getNextQuadrantOrder(state, DEFAULT_QUADRANT_ID)
    };

    state.tasks.unshift(task);
    addTaskToCompletionLog(state, task, completedAt);
    return saveStateAndBroadcast(state, "task-add-completed");
  });

  ipcMain.handle("task:delete", (_, taskId) => {
    const state = readState();

    state.tasks = state.tasks.filter((task) => task.id !== taskId);
    removeTaskFromCompletionLog(state, taskId);

    return saveStateAndBroadcast(state, "task-delete");
  });

  createWindow();
  const config = readSyncConfig();
  if (config.autoSync && config.serverUrl && config.syncKey) {
    runSync("startup");
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});



