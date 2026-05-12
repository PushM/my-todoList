const storageKeys = {
  state: "todo-mobile-state",
  stateBackup: "todo-mobile-state-backup",
  config: "todo-mobile-config",
  configBackup: "todo-mobile-config-backup"
};

const QUADRANTS = [
  {
    id: "q1",
    title: "既紧急又重要",
    description: "旧的进行中任务会默认落在这里，优先完成最关键的事。",
    accentClass: "urgent-important"
  },
  {
    id: "q2",
    title: "重要但不紧急",
    description: "适合前置规划、长期推进和提前准备。",
    accentClass: "important"
  },
  {
    id: "q3",
    title: "紧急但不重要",
    description: "尽快清掉干扰项，别让它们持续打断主线。",
    accentClass: "urgent"
  },
  {
    id: "q4",
    title: "既不紧急也不重要",
    description: "放这里做缓冲，空下来再看也来得及。",
    accentClass: "backlog"
  }
];

const DEFAULT_QUADRANT_ID = "q1";
const DEVICE_NAME = "desktop-web";
const calendarPreviewSettings = {
  maxCharsPerItem: 12
};

function writeStorageWithBackup(primaryKey, backupKey, value) {
  const currentValue = localStorage.getItem(primaryKey);
  if (currentValue) {
    localStorage.setItem(backupKey, currentValue);
  }

  localStorage.setItem(primaryKey, value);
}

function readStorageWithBackup(primaryKey, backupKey) {
  const primaryValue = localStorage.getItem(primaryKey);
  if (primaryValue) {
    try {
      return JSON.parse(primaryValue);
    } catch (error) {
      // Fall through to backup.
    }
  }

  const backupValue = localStorage.getItem(backupKey);
  if (!backupValue) {
    return null;
  }

  try {
    return JSON.parse(backupValue);
  } catch (error) {
    return null;
  }
}

const appState = {
  tab: "todo",
  data: loadState(),
  config: loadConfig(),
  currentMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDateKey: formatDateKey(new Date()),
  syncMessage: "未配置同步"
};

const dragState = {
  taskId: null,
  sourceCard: null,
  placeholder: null,
  ghost: null,
  offsetX: 0,
  offsetY: 0,
  draggingProgress: null,
  draggingPanel: null,
  draggingCard: null
};

const refs = {
  serverUrlInput: document.getElementById("serverUrlInput"),
  syncKeyInput: document.getElementById("syncKeyInput"),
  saveConfigButton: document.getElementById("saveConfigButton"),
  syncNowButton: document.getElementById("syncNowButton"),
  syncStatusText: document.getElementById("syncStatusText"),
  pendingStat: document.getElementById("pendingStat"),
  completedStat: document.getElementById("completedStat"),
  todayStat: document.getElementById("todayStat"),
  taskForm: document.getElementById("taskForm"),
  taskInput: document.getElementById("taskInput"),
  pendingCount: document.getElementById("pendingCount"),
  quadrantBoard: document.getElementById("quadrantBoard"),
  monthLabel: document.getElementById("monthLabel"),
  prevMonthButton: document.getElementById("prevMonthButton"),
  nextMonthButton: document.getElementById("nextMonthButton"),
  calendarGrid: document.getElementById("calendarGrid"),
  selectedDateTitle: document.getElementById("selectedDateTitle"),
  selectedDateCount: document.getElementById("selectedDateCount"),
  selectedDateLog: document.getElementById("selectedDateLog"),
  dayAddForm: document.getElementById("dayAddForm"),
  dayAddInput: document.getElementById("dayAddInput"),
  tabTodo: document.getElementById("tabTodo"),
  tabProjects: document.getElementById("tabProjects"),
  todoView: document.getElementById("todoView"),
  projectsView: document.getElementById("projectsView"),
  projectList: document.getElementById("projectList"),
  addProjectButton: document.getElementById("addProjectButton")
};

function createDefaultState() {
  return {
    tasks: [],
    completionLog: {},
    updatedAt: new Date().toISOString(),
    projects: [],
    panelOrder: ["board", "calendar", "projects"]
  };
}

function toFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeQuadrantId(value) {
  return QUADRANTS.some((quadrant) => quadrant.id === value) ? value : DEFAULT_QUADRANT_ID;
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
    id: typeof parsed.id === "string" && parsed.id ? parsed.id : createTaskId(),
    title: String(parsed.title || "").trim(),
    completed: parsed.completed === true,
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    completedAt: typeof parsed.completedAt === "string" ? parsed.completedAt : null,
    quadrantId: normalizeQuadrantId(parsed.quadrantId),
    quadrantOrder: Number.isFinite(Number(parsed.quadrantOrder)) ? Number(parsed.quadrantOrder) : index
  };
}

function sortPendingTasks(left, right) {
  if (left.quadrantOrder !== right.quadrantOrder) {
    return left.quadrantOrder - right.quadrantOrder;
  }

  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function normalizeTasks(tasks) {
  const normalized = (Array.isArray(tasks) ? tasks : []).map((task, index) => normalizeTask(task, index));

  for (const quadrant of QUADRANTS) {
    const pendingTasks = normalized
      .filter((task) => !task.completed && task.quadrantId === quadrant.id)
      .sort(sortPendingTasks);

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
    id: typeof parsed.id === "string" && parsed.id ? parsed.id : createProjectTaskId(),
    projectId: typeof parsed.projectId === "string" && parsed.projectId ? parsed.projectId : "",
    taskName: String(parsed.taskName || "").trim(),
    startDate: typeof parsed.startDate === "string" && parsed.startDate ? parsed.startDate : "",
    endDate: typeof parsed.endDate === "string" && parsed.endDate ? parsed.endDate : "",
    progress,
    priority: normalizeProjectPriority(parsed.priority),
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    order: toFiniteNumber(Number(parsed.order), index)
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
    id: typeof parsed.id === "string" && parsed.id ? parsed.id : createProjectId(),
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

function loadState() {
  try {
    return normalizeState(readStorageWithBackup(storageKeys.state, storageKeys.stateBackup));
  } catch (error) {
    return createDefaultState();
  }
}

function saveState() {
  writeStorageWithBackup(storageKeys.state, storageKeys.stateBackup, JSON.stringify(appState.data));
}

function loadConfig() {
  try {
    const parsed = readStorageWithBackup(storageKeys.config, storageKeys.configBackup) || {};
    return {
      serverUrl: String(parsed.serverUrl || "").trim(),
      syncKey: String(parsed.syncKey || "").trim()
    };
  } catch (error) {
    return {
      serverUrl: "",
      syncKey: ""
    };
  }
}

function saveConfig() {
  writeStorageWithBackup(storageKeys.config, storageKeys.configBackup, JSON.stringify(appState.config));
}

function getServerUrl() {
  return appState.config.serverUrl || window.location.origin;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return false;
  }

  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function requestDateKey(defaultDateKey, message) {
  if (!document.body) {
    const input = window.prompt(message, defaultDateKey);
    if (input === null) {
      return null;
    }

    const trimmed = input.trim();
    return isValidDateKey(trimmed) ? trimmed : null;
  }

  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "date-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "date-modal";

    const title = document.createElement("p");
    title.className = "date-modal-title";
    title.textContent = message;

    const input = document.createElement("input");
    input.className = "date-modal-input";
    input.type = "date";
    input.value = isValidDateKey(defaultDateKey) ? defaultDateKey : formatDateKey(new Date());

    const actions = document.createElement("div");
    actions.className = "date-modal-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "date-modal-button neutral";
    cancelButton.textContent = "取消";

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "date-modal-button primary";
    confirmButton.textContent = "确定";

    actions.append(cancelButton, confirmButton);
    modal.append(title, input, actions);
    backdrop.append(modal);

    const finish = (value) => {
      document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
      resolve(value);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        finish(null);
      } else if (event.key === "Enter") {
        const picked = input.value.trim();
        if (isValidDateKey(picked)) {
          finish(picked);
        }
      }
    };

    cancelButton.addEventListener("click", () => finish(null));
    confirmButton.addEventListener("click", () => {
      const picked = input.value.trim();
      if (!isValidDateKey(picked)) {
        window.alert("日期格式应为 YYYY-MM-DD");
        return;
      }

      finish(picked);
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        finish(null);
      }
    });
    document.addEventListener("keydown", onKeyDown);

    document.body.append(backdrop);
    input.focus();
    if (typeof input.showPicker === "function") {
      input.showPicker();
    }
  });
}

function requestTaskTitle(defaultTitle, message) {
  if (!document.body) {
    const input = window.prompt(message, defaultTitle);
    if (input === null) {
      return null;
    }

    const trimmed = input.trim();
    return trimmed || null;
  }

  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "date-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "date-modal";

    const title = document.createElement("p");
    title.className = "date-modal-title";
    title.textContent = message;

    const input = document.createElement("input");
    input.className = "date-modal-input";
    input.type = "text";
    input.maxLength = 120;
    input.value = String(defaultTitle || "");
    input.placeholder = "输入任务内容";

    const actions = document.createElement("div");
    actions.className = "date-modal-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "date-modal-button neutral";
    cancelButton.textContent = "取消";

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "date-modal-button primary";
    confirmButton.textContent = "保存";

    actions.append(cancelButton, confirmButton);
    modal.append(title, input, actions);
    backdrop.append(modal);

    const finish = (value) => {
      document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
      resolve(value);
    };

    const tryConfirm = () => {
      const nextTitle = input.value.trim();
      if (!nextTitle) {
        window.alert("任务内容不能为空");
        return;
      }

      finish(nextTitle);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        finish(null);
      } else if (event.key === "Enter") {
        tryConfirm();
      }
    };

    cancelButton.addEventListener("click", () => finish(null));
    confirmButton.addEventListener("click", tryConfirm);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        finish(null);
      }
    });
    document.addEventListener("keydown", onKeyDown);

    document.body.append(backdrop);
    input.focus();
    input.select();
  });
}

function buildCompletedAt(dateKey, baseIso = null) {
  if (!isValidDateKey(dateKey)) {
    return null;
  }

  const [year, month, day] = String(dateKey).split("-").map(Number);
  const base = baseIso ? new Date(baseIso) : new Date();
  const localDate = new Date(year, month - 1, day, base.getHours(), base.getMinutes(), base.getSeconds(), 0);
  return Number.isNaN(localDate.getTime()) ? null : localDate.toISOString();
}

function createTaskId() {
  return `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createProjectId() {
  return `proj-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createProjectTaskId() {
  return `ptask-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function touchState() {
  appState.data = normalizeState({
    ...appState.data,
    updatedAt: new Date().toISOString()
  });
  saveState();
}

function stateHasContent(state) {
  const normalized = normalizeState(state);
  if (normalized.tasks.length > 0) {
    return true;
  }
  if (normalized.projects.length > 0) {
    return true;
  }

  return Object.values(normalized.completionLog).some((items) => Array.isArray(items) && items.length > 0);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long"
  }).format(date);
}

function formatTime(isoString) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoString));
}

function formatTaskCreatedAt(isoString) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoString));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncateText(value, maxChars) {
  const text = String(value || "").trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}...`;
}

function getTaskById(taskId) {
  return appState.data.tasks.find((task) => task.id === taskId) || null;
}

function getQuadrantTaskMap() {
  const grouped = Object.fromEntries(QUADRANTS.map((quadrant) => [quadrant.id, []]));

  appState.data.tasks
    .filter((task) => !task.completed)
    .forEach((task) => {
      grouped[normalizeQuadrantId(task.quadrantId)].push(task);
    });

  for (const quadrant of QUADRANTS) {
    grouped[quadrant.id].sort(sortPendingTasks);
  }

  return grouped;
}

function renderTasks() {
  const pending = appState.data.tasks.filter((task) => !task.completed);
  const completed = appState.data.tasks.filter((task) => task.completed);
  const todayKey = formatDateKey(new Date());
  const todayLogs = Array.isArray(appState.data.completionLog[todayKey]) ? appState.data.completionLog[todayKey] : [];
  const grouped = getQuadrantTaskMap();

  refs.pendingCount.textContent = `${pending.length} 项`;
  refs.pendingStat.textContent = String(pending.length);
  refs.completedStat.textContent = String(completed.length);
  refs.todayStat.textContent = String(todayLogs.length);
  refs.quadrantBoard.innerHTML = QUADRANTS.map((quadrant) => createQuadrantColumn(quadrant, grouped[quadrant.id])).join("");
}

function createQuadrantColumn(quadrant, tasks) {
  const listContent = tasks.length
    ? tasks.map((task) => createPendingTaskCard(task)).join("")
    : '<div class="quadrant-empty">把任务拖到这里，或者继续在上面添加。</div>';

  return `
    <section class="quadrant-column ${quadrant.accentClass}" data-quadrant-id="${quadrant.id}">
      <div class="quadrant-header">
        <div>
          <p class="quadrant-tag">${quadrant.id.toUpperCase()}</p>
          <h3>${quadrant.title}</h3>
          <p class="quadrant-description">${quadrant.description}</p>
        </div>
        <span class="mini-chip">${tasks.length} 项</span>
      </div>
      <div class="quadrant-list" data-drop-zone="quadrant" data-quadrant-id="${quadrant.id}">
        ${listContent}
      </div>
    </section>
  `;
}

function createPendingTaskCard(task) {
  return `
    <article class="task-card pending-card" data-task-id="${task.id}">
      <div class="task-main">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-time">创建于 ${formatTaskCreatedAt(task.createdAt)}</div>
      </div>
      <div class="task-actions">
        <button class="task-action edit-date" data-action="edit-task">编辑</button>
        <button class="task-action complete" data-action="toggle">完成</button>
        <button class="task-action delete" data-action="delete">删除</button>
        <button class="drag-handle" type="button" data-drag-handle title="拖动排序">::</button>
      </div>
    </article>
  `;
}

function createCompletionLogItem(item) {
  const task = getTaskById(item.taskId);
  const actions = task
    ? `
        <div class="task-actions">
          <button class="task-action undo" data-action="toggle">撤销</button>
          <button class="task-action edit-date" data-action="edit-date">改日期</button>
          <button class="task-action delete" data-action="delete">删除</button>
        </div>
      `
    : "";

  return `
    <div class="log-item" data-task-id="${escapeHtml(item.taskId)}">
      <div class="task-title">${escapeHtml(item.title)}</div>
      <div class="task-time">完成时间 ${formatTime(item.completedAt)}</div>
      ${actions}
    </div>
  `;
}

function renderCalendar() {
  refs.monthLabel.textContent = formatMonth(appState.currentMonth);
  const firstDay = new Date(appState.currentMonth.getFullYear(), appState.currentMonth.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(appState.currentMonth.getFullYear(), appState.currentMonth.getMonth(), 1 - startOffset);
  const todayKey = formatDateKey(new Date());
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = formatDateKey(date);
    const logs = Array.isArray(appState.data.completionLog[dateKey]) ? appState.data.completionLog[dateKey] : [];
    const isCurrentMonth = date.getMonth() === appState.currentMonth.getMonth();
    const classes = [
      "calendar-day",
      isCurrentMonth ? "" : "muted",
      dateKey === todayKey ? "today" : "",
      dateKey === appState.selectedDateKey ? "selected" : ""
    ]
      .filter(Boolean)
      .join(" ");

    const previewHtml = logs.length
      ? logs
          .map(
            (item) =>
              `<div class="day-preview-item">${escapeHtml(
                truncateText(item.title, calendarPreviewSettings.maxCharsPerItem)
              )}</div>`
          )
          .join("")
      : "";

    cells.push(`
      <button type="button" class="${classes}" data-date-key="${dateKey}">
        <div class="day-top">
          <span>${date.getDate()}</span>
          ${logs.length ? `<span class="day-badge">${logs.length}</span>` : ""}
        </div>
        <div class="day-preview">${previewHtml}</div>
      </button>
    `);
  }

  refs.calendarGrid.innerHTML = cells.join("");
}

function renderSelectedDateLog() {
  const selected = new Date(`${appState.selectedDateKey}T00:00:00`);
  const logs = Array.isArray(appState.data.completionLog[appState.selectedDateKey])
    ? appState.data.completionLog[appState.selectedDateKey]
    : [];

  refs.selectedDateTitle.textContent = formatDate(selected).replace("星期", "周");
  refs.selectedDateCount.textContent = `${logs.length} 条`;
  refs.selectedDateLog.innerHTML = logs.length
    ? logs.map((item) => createCompletionLogItem(item)).join("")
    : '<div class="empty-state">这一天还没有完成记录。</div>';
}

function renderSyncFields() {
  refs.serverUrlInput.value = appState.config.serverUrl;
  refs.syncKeyInput.value = appState.config.syncKey;
  refs.syncStatusText.textContent = appState.syncMessage;
}

function renderTabBar() {
  const isProjects = appState.tab === "projects";
  refs.tabTodo.classList.toggle("active", !isProjects);
  refs.tabProjects.classList.toggle("active", isProjects);
}

function renderViewVisibility() {
  const isProjects = appState.tab === "projects";
  refs.todoView.style.display = isProjects ? "none" : "";
  refs.projectsView.style.display = isProjects ? "" : "none";
}

const WEB_PRIORITY_LABELS = { p0: "P0", p1: "P1", p2: "P2" };

function createProjectTaskRow(ptask) {
  return `
    <div class="schedule-row" data-ptask-id="${escapeHtml(ptask.id)}">
      <div class="schedule-cell name">${escapeHtml(ptask.taskName)}</div>
      <div class="schedule-cell">${escapeHtml(ptask.startDate || "-")}</div>
      <div class="schedule-cell">${escapeHtml(ptask.endDate || "-")}</div>
      <div class="schedule-cell">
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${ptask.progress}%"></div></div>
        <span style="font-size:10px;color:var(--muted)">${ptask.progress}%</span>
      </div>
      <div class="schedule-cell"><span class="priority-tag ${escapeHtml(ptask.priority)}">${WEB_PRIORITY_LABELS[ptask.priority] || ptask.priority}</span></div>
      <div class="schedule-cell schedule-cell-actions">
        <button data-action="edit-ptask" data-ptask-id="${escapeHtml(ptask.id)}" type="button">编辑</button>
        <button data-action="delete-ptask" data-ptask-id="${escapeHtml(ptask.id)}" type="button">删除</button>
      </div>
    </div>`;
}

function createAddProjectTaskForm(projectId) {
  return `
    <form class="add-ptask-form" data-form="add-ptask" data-project-id="${escapeHtml(projectId)}">
      <input type="text" maxlength="80" placeholder="任务名称" required />
      <input type="date" />
      <input type="date" />
      <select>
        <option value="p0">P0</option>
        <option value="p1">P1</option>
        <option value="p2" selected>P2</option>
      </select>
      <button type="submit">添加任务</button>
    </form>`;
}

function createProjectCard(project) {
  const rows = project.tasks.map(createProjectTaskRow).join("");
  return `
    <div class="project-card" data-project-id="${escapeHtml(project.id)}">
      <div class="project-card-header">
        <span class="project-card-drag-handle" data-card-handle="${escapeHtml(project.id)}" title="拖动排序">⋮⋮</span>
        <span class="project-card-name">${escapeHtml(project.name)}</span>
        <div class="project-card-actions">
          <button class="project-btn-edit" data-action="edit-project" data-project-id="${escapeHtml(project.id)}" type="button">改名</button>
          <button class="project-btn-delete" data-action="delete-project" data-project-id="${escapeHtml(project.id)}" type="button">删除项目</button>
        </div>
      </div>
      <div class="schedule-table">
        <div class="schedule-table-header">
          <span>任务名称</span><span>开始日期</span><span>结束日期</span><span>进度</span><span>优先级</span><span>操作</span>
        </div>
        ${rows || '<div class="project-empty" style="padding:16px">暂无任务，在下方添加</div>'}
      </div>
      ${createAddProjectTaskForm(project.id)}
    </div>`;
}

function renderProjectList() {
  const projects = appState.data.projects || [];
  if (!projects.length) {
    refs.projectList.innerHTML = '<div class="project-empty">暂无项目，点击右上角"新建项目"开始</div>';
    return;
  }
  refs.projectList.innerHTML = projects.map(createProjectCard).join("");
}

function render() {
  renderSyncFields();
  renderTabBar();
  renderViewVisibility();
  if (appState.tab === "projects") {
    renderProjectList();
    return;
  }
  renderTasks();
  renderCalendar();
  renderSelectedDateLog();
}

function setSyncMessage(message) {
  appState.syncMessage = message;
  refs.syncStatusText.textContent = message;
}

function getNextQuadrantOrder(quadrantId) {
  return appState.data.tasks.filter((task) => !task.completed && task.quadrantId === quadrantId).length;
}

function movePendingTask(taskId, targetQuadrantId, targetIndex) {
  const nextQuadrantId = normalizeQuadrantId(targetQuadrantId);
  const target = getTaskById(taskId);

  if (!target || target.completed) {
    return;
  }

  const quadrants = Object.fromEntries(
    QUADRANTS.map((quadrant) => [
      quadrant.id,
      appState.data.tasks
        .filter((task) => !task.completed && task.quadrantId === quadrant.id)
        .sort(sortPendingTasks)
    ])
  );

  quadrants[target.quadrantId] = quadrants[target.quadrantId].filter((task) => task.id !== taskId);
  target.quadrantId = nextQuadrantId;

  const destination = quadrants[nextQuadrantId].slice();
  const safeIndex = Math.max(0, Math.min(Number(targetIndex) || 0, destination.length));
  destination.splice(safeIndex, 0, target);
  quadrants[nextQuadrantId] = destination;

  for (const quadrant of QUADRANTS) {
    quadrants[quadrant.id].forEach((task, index) => {
      task.quadrantOrder = index;
    });
  }

  touchState();
  render();
  runSync("task-move");
}

async function runSync(reason = "manual") {
  if (!appState.config.syncKey) {
    setSyncMessage("请先填写同步码");
    return;
  }

  const serverUrl = getServerUrl();
  setSyncMessage(`正在同步${reason === "manual" ? "" : "..."}`);

  try {
    const localProjects = appState.data.projects || [];
    const response = await fetch(`${serverUrl}/api/sync`, {
      method: "GET",
      headers: {
        "x-sync-key": appState.config.syncKey,
        "x-device-name": DEVICE_NAME
      }
    });

    if (response.status === 404) {
      const pushResponse = await fetch(`${serverUrl}/api/sync`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-sync-key": appState.config.syncKey,
          "x-device-name": DEVICE_NAME
        },
        body: JSON.stringify({ state: appState.data })
      });

      if (!pushResponse.ok) {
        throw new Error(`上传失败 ${pushResponse.status}`);
      }

      const payload = await pushResponse.json();
      appState.data = normalizeState(payload.state);
      if (localProjects.length > 0 && (appState.data.projects || []).length === 0) {
        appState.data.projects = localProjects;
      }
      saveState();
      setSyncMessage("首次同步完成，已上传到云端");
      render();
      return;
    }

    if (!response.ok) {
      throw new Error(`同步失败 ${response.status}`);
    }

    const remotePayload = await response.json();
    const remoteState = normalizeState(remotePayload.state);
    const localHasContent = stateHasContent(appState.data);
    const remoteHasContent = stateHasContent(remoteState);
    const localTime = Date.parse(appState.data.updatedAt || 0);
    const remoteTime = Date.parse(remoteState.updatedAt || 0);

    if (remoteHasContent && !localHasContent) {
      appState.data = remoteState;
      if (localProjects.length > 0 && (appState.data.projects || []).length === 0) {
        appState.data.projects = localProjects;
      }
      saveState();
      setSyncMessage("检测到本地为空，已恢复云端数据");
    } else if (localHasContent && !remoteHasContent) {
      const pushResponse = await fetch(`${serverUrl}/api/sync`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-sync-key": appState.config.syncKey,
          "x-device-name": DEVICE_NAME
        },
        body: JSON.stringify({ state: appState.data })
      });

      if (!pushResponse.ok) {
        throw new Error(`上传失败 ${pushResponse.status}`);
      }

      const payload = await pushResponse.json();
      appState.data = normalizeState(payload.state);
      if (localProjects.length > 0 && (appState.data.projects || []).length === 0) {
        appState.data.projects = localProjects;
      }
      saveState();
      setSyncMessage("云端为空，已用本地数据恢复");
    } else if (remoteTime > localTime) {
      appState.data = remoteState;
      if (localProjects.length > 0 && (appState.data.projects || []).length === 0) {
        appState.data.projects = localProjects;
      }
      saveState();
      setSyncMessage("已拉取云端最新数据");
    } else if (localTime > remoteTime) {
      const pushResponse = await fetch(`${serverUrl}/api/sync`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-sync-key": appState.config.syncKey,
          "x-device-name": DEVICE_NAME
        },
        body: JSON.stringify({ state: appState.data })
      });

      if (!pushResponse.ok) {
        throw new Error(`上传失败 ${pushResponse.status}`);
      }

      const payload = await pushResponse.json();
      appState.data = normalizeState(payload.state);
      if (localProjects.length > 0 && (appState.data.projects || []).length === 0) {
        appState.data.projects = localProjects;
      }
      saveState();
      setSyncMessage("本地改动已上传");
    } else {
      setSyncMessage("已同步，无更新");
    }

    render();
  } catch (error) {
    setSyncMessage(`同步失败: ${error.message}`);
  }
}

function addTask(title) {
  appState.data.tasks.unshift({
    id: createTaskId(),
    title,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    quadrantId: DEFAULT_QUADRANT_ID,
    quadrantOrder: getNextQuadrantOrder(DEFAULT_QUADRANT_ID)
  });
  touchState();
  render();
  runSync("task-add");
}

function updateTaskTitle(taskId, nextTitle) {
  const target = getTaskById(taskId);
  const trimmedTitle = String(nextTitle || "").trim();

  if (!target || target.completed || !trimmedTitle) {
    return;
  }

  target.title = trimmedTitle;
  touchState();
  render();
  runSync("task-update-title");
}

function removeTaskFromCompletionLog(taskId) {
  for (const dateKey of Object.keys(appState.data.completionLog)) {
    if (!Array.isArray(appState.data.completionLog[dateKey])) {
      continue;
    }

    appState.data.completionLog[dateKey] = appState.data.completionLog[dateKey].filter(
      (item) => item.taskId !== taskId
    );

    if (appState.data.completionLog[dateKey].length === 0) {
      delete appState.data.completionLog[dateKey];
    }
  }
}

function addTaskToCompletionLog(task, completedAt) {
  const dateKey = formatDateKey(new Date(completedAt));
  const items = Array.isArray(appState.data.completionLog[dateKey]) ? appState.data.completionLog[dateKey] : [];
  items.unshift({
    taskId: task.id,
    title: task.title,
    completedAt
  });
  appState.data.completionLog[dateKey] = items;
}

function toggleTask(taskId, completionDateKey = null) {
  const target = getTaskById(taskId);
  if (!target) {
    return;
  }

  if (!target.completed) {
    const completedAt = buildCompletedAt(completionDateKey) || new Date().toISOString();
    target.completed = true;
    target.completedAt = completedAt;
    addTaskToCompletionLog(target, completedAt);
    const selectedDateKey = formatDateKey(new Date(completedAt));
    appState.selectedDateKey = selectedDateKey;
    appState.currentMonth = new Date(new Date(completedAt).getFullYear(), new Date(completedAt).getMonth(), 1);
  } else {
    target.completed = false;
    target.completedAt = null;
    removeTaskFromCompletionLog(taskId);
  }

  touchState();
  render();
  runSync("task-toggle");
}

function updateCompletedDate(taskId, dateKey) {
  const target = getTaskById(taskId);
  if (!target || !target.completed) {
    return;
  }

  const nextCompletedAt = buildCompletedAt(dateKey, target.completedAt);
  if (!nextCompletedAt) {
    return;
  }

  removeTaskFromCompletionLog(taskId);
  target.completedAt = nextCompletedAt;
  addTaskToCompletionLog(target, nextCompletedAt);
  appState.selectedDateKey = dateKey;
  const [year, month] = dateKey.split("-").map(Number);
  appState.currentMonth = new Date(year, month - 1, 1);
  touchState();
  render();
  runSync("task-update-completed-date");
}

function addCompletedTaskForDate(title, dateKey) {
  if (!title || !isValidDateKey(dateKey)) {
    return;
  }

  const completedAt = buildCompletedAt(dateKey) || new Date().toISOString();
  const task = {
    id: createTaskId(),
    title,
    completed: true,
    createdAt: new Date().toISOString(),
    completedAt,
    quadrantId: DEFAULT_QUADRANT_ID,
    quadrantOrder: getNextQuadrantOrder(DEFAULT_QUADRANT_ID)
  };
  appState.data.tasks.unshift(task);
  addTaskToCompletionLog(task, completedAt);
  touchState();
  render();
  runSync("task-add-completed");
}

function deleteTask(taskId) {
  appState.data.tasks = appState.data.tasks.filter((task) => task.id !== taskId);
  removeTaskFromCompletionLog(taskId);
  touchState();
  render();
  runSync("task-delete");
}

function addProject(name) {
  const project = {
    id: createProjectId(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: []
  };
  appState.data.projects.push(project);
  touchState();
  render();
  runSync("project-add");
}

function updateProjectName(projectId, nextName) {
  const project = appState.data.projects.find((p) => p.id === projectId);
  if (project && nextName) {
    project.name = nextName;
    project.updatedAt = new Date().toISOString();
  }
  touchState();
  render();
  runSync("project-update-name");
}

function deleteProject(projectId) {
  appState.data.projects = appState.data.projects.filter((p) => p.id !== projectId);
  touchState();
  render();
  runSync("project-delete");
}

function reorderPanels(orderedIds) {
  appState.data.panelOrder = normalizePanelOrder(orderedIds);
  touchState();
  render();
  runSync("panel-reorder");
}

function reorderProjects(orderedIds) {
  const idSet = new Set(orderedIds);
  appState.data.projects.forEach((p) => {
    const idx = orderedIds.indexOf(p.id);
    p.order = idx >= 0 ? idx : orderedIds.length;
  });
  appState.data.projects.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  touchState();
  render();
  runSync("project-reorder");
}

function addProjectTask(projectId, taskData) {
  const project = appState.data.projects.find((p) => p.id === projectId);
  if (!project) return;
  const maxOrder = project.tasks.reduce((max, t) => Math.max(max, t.order || 0), -1);
  const ptask = {
    id: createProjectTaskId(),
    projectId,
    taskName: taskData.taskName || "",
    startDate: taskData.startDate || "",
    endDate: taskData.endDate || "",
    progress: 0,
    priority: normalizeProjectPriority(taskData.priority),
    createdAt: new Date().toISOString(),
    order: maxOrder + 1
  };
  project.tasks.push(ptask);
  project.updatedAt = new Date().toISOString();
  touchState();
  render();
  runSync("project-task-add");
}

function updateProjectTask(projectId, taskId, fields) {
  const project = appState.data.projects.find((p) => p.id === projectId);
  if (!project) return;
  const ptask = project.tasks.find((t) => t.id === taskId);
  if (!ptask) return;
  if (fields.taskName !== undefined) ptask.taskName = fields.taskName;
  if (fields.startDate !== undefined) ptask.startDate = fields.startDate;
  if (fields.endDate !== undefined) ptask.endDate = fields.endDate;
  if (fields.progress !== undefined) {
    const num = Number(fields.progress);
    ptask.progress = Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0;
  }
  if (fields.priority !== undefined) ptask.priority = normalizeProjectPriority(fields.priority);
  project.updatedAt = new Date().toISOString();
  touchState();
  render();
  runSync("project-task-update");
}

function deleteProjectTask(projectId, taskId) {
  const project = appState.data.projects.find((p) => p.id === projectId);
  if (project) {
    project.tasks = project.tasks.filter((t) => t.id !== taskId);
    project.updatedAt = new Date().toISOString();
  }
  touchState();
  render();
  runSync("project-task-delete");
}

function createDragPlaceholder(height) {
  const placeholder = document.createElement("div");
  placeholder.className = "task-placeholder";
  placeholder.style.height = `${height}px`;
  return placeholder;
}

function updateDragGhostPosition(clientX, clientY) {
  if (!dragState.ghost) {
    return;
  }

  dragState.ghost.style.left = `${clientX - dragState.offsetX}px`;
  dragState.ghost.style.top = `${clientY - dragState.offsetY}px`;
}

function movePlaceholderToZone(clientX, clientY) {
  if (!dragState.placeholder) {
    return;
  }

  const hovered = document.elementFromPoint(clientX, clientY);
  const zone = hovered?.closest("[data-drop-zone='quadrant']");
  if (!zone) {
    return;
  }

  const cards = Array.from(zone.querySelectorAll(".pending-card")).filter((card) => card !== dragState.sourceCard);
  const targetCard = cards.find((card) => {
    const rect = card.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2;
  });

  if (targetCard) {
    zone.insertBefore(dragState.placeholder, targetCard);
  } else {
    zone.append(dragState.placeholder);
  }
}

function cleanupDragState() {
  dragState.sourceCard?.classList.remove("drag-source");
  dragState.placeholder?.remove();
  dragState.ghost?.remove();
  document.body.classList.remove("dragging-active");

  dragState.taskId = null;
  dragState.sourceCard = null;
  dragState.placeholder = null;
  dragState.ghost = null;
  dragState.offsetX = 0;
  dragState.offsetY = 0;
}

function beginTaskDrag(event, handle) {
  if (dragState.taskId) {
    cleanupDragState();
  }

  const card = handle.closest("[data-task-id]");
  const taskId = card?.dataset.taskId;
  const task = getTaskById(taskId);

  if (!card || !task || task.completed) {
    return;
  }

  const rect = card.getBoundingClientRect();
  const placeholder = createDragPlaceholder(rect.height);
  card.parentElement?.insertBefore(placeholder, card.nextSibling);
  card.classList.add("drag-source");

  const ghost = card.cloneNode(true);
  ghost.classList.add("drag-ghost");
  ghost.style.width = `${rect.width}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  document.body.append(ghost);

  dragState.taskId = taskId;
  dragState.sourceCard = card;
  dragState.placeholder = placeholder;
  dragState.ghost = ghost;
  dragState.offsetX = event.clientX - rect.left;
  dragState.offsetY = event.clientY - rect.top;

  document.body.classList.add("dragging-active");
  updateDragGhostPosition(event.clientX, event.clientY);
  movePlaceholderToZone(event.clientX, event.clientY);
}

function getPlaceholderDropResult() {
  const zone = dragState.placeholder?.closest("[data-drop-zone='quadrant']");
  if (!zone || !dragState.placeholder) {
    return null;
  }

  const items = Array.from(zone.children).filter(
    (child) =>
      child !== dragState.sourceCard &&
      (child.classList.contains("pending-card") || child.classList.contains("task-placeholder"))
  );

  return {
    targetQuadrantId: normalizeQuadrantId(zone.dataset.quadrantId),
    targetIndex: items.indexOf(dragState.placeholder)
  };
}

function finalizeTaskDrag() {
  if (!dragState.taskId) {
    cleanupDragState();
    return;
  }

  const dropResult = getPlaceholderDropResult();
  const taskId = dragState.taskId;
  cleanupDragState();

  if (!dropResult || dropResult.targetIndex < 0) {
    return;
  }

  movePendingTask(taskId, dropResult.targetQuadrantId, dropResult.targetIndex);
}

refs.saveConfigButton.addEventListener("click", async () => {
  appState.config.serverUrl = refs.serverUrlInput.value.trim();
  appState.config.syncKey = refs.syncKeyInput.value.trim();
  saveConfig();
  await runSync("config-saved");
});

refs.syncNowButton.addEventListener("click", async () => {
  await runSync("manual");
});

refs.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = refs.taskInput.value.trim();
  if (!title) {
    return;
  }

  addTask(title);
  refs.taskInput.value = "";
});

document.body.addEventListener("pointerdown", (event) => {
  const panelHandle = event.target.closest("[data-panel-handle]");
  if (panelHandle) {
    event.preventDefault();
    const panel = panelHandle.closest("[data-panel]");
    if (!panel) return;
    const panelId = panel.dataset.panel;
    dragState.draggingPanel = { panelId, panel };
    panel.classList.add("dragging");
    return;
  }

  const cardHandle = event.target.closest("[data-card-handle]");
  if (cardHandle) {
    event.preventDefault();
    const card = cardHandle.closest(".project-card");
    if (!card) return;
    const projectId = card.dataset.projectId;
    dragState.draggingCard = { projectId, card };
    card.classList.add("dragging");
    return;
  }

  const handle = event.target.closest("[data-drag-handle]");
  const progressBar = event.target.closest(".progress-bar");

  if (progressBar && !handle) {
    event.preventDefault();
    const row = progressBar.closest(".schedule-row");
    const card = progressBar.closest(".project-card");
    if (!row || !card) return;
    const ptaskId = row.dataset.ptaskId;
    const projectId = card.dataset.projectId;
    const rect = progressBar.getBoundingClientRect();
    const newProgress = Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)));
    const fill = progressBar.querySelector(".progress-bar-fill");
    if (fill) fill.style.width = `${newProgress}%`;
    const label = progressBar.nextElementSibling;
    if (label) label.textContent = `${newProgress}%`;
    dragState.draggingProgress = { projectId, taskId: ptaskId, barElement: progressBar, labelElement: label || null };
    return;
  }

  if (!handle) {
    return;
  }

  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  event.preventDefault();
  beginTaskDrag(event, handle);
});

window.addEventListener("pointermove", (event) => {
  if (dragState.draggingPanel) {
    event.preventDefault();
    const panels = Array.from(document.querySelectorAll("[data-panel]:not(.dragging)"));
    for (const p of panels) p.classList.remove("drop-above", "drop-below");
    if (panels.length === 0) return;
    let closest = panels[0];
    let minDist = Infinity;
    for (const p of panels) {
      const rect = p.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const dist = Math.abs(event.clientY - midY);
      if (dist < minDist) { minDist = dist; closest = p; }
    }
    const rect = closest.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) {
      closest.classList.add("drop-above");
    } else {
      closest.classList.add("drop-below");
    }
    return;
  }

  if (dragState.draggingCard) {
    event.preventDefault();
    const cards = Array.from(document.querySelectorAll(".project-card:not(.dragging)"));
    for (const c of cards) c.classList.remove("drop-above", "drop-below");
    if (cards.length === 0) return;
    let closestCard = cards[0];
    let minDistCard = Infinity;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const d = Math.abs(event.clientY - mid);
      if (d < minDistCard) { minDistCard = d; closestCard = c; }
    }
    const cr = closestCard.getBoundingClientRect();
    if (event.clientY < cr.top + cr.height / 2) {
      closestCard.classList.add("drop-above");
    } else {
      closestCard.classList.add("drop-below");
    }
    return;
  }

  if (dragState.draggingProgress) {
    event.preventDefault();
    const { barElement, labelElement } = dragState.draggingProgress;
    const rect = barElement.getBoundingClientRect();
    const newProgress = Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)));
    const fill = barElement.querySelector(".progress-bar-fill");
    if (fill) fill.style.width = `${newProgress}%`;
    if (labelElement) labelElement.textContent = `${newProgress}%`;
    return;
  }

  if (!dragState.taskId) {
    return;
  }

  event.preventDefault();
  updateDragGhostPosition(event.clientX, event.clientY);
  movePlaceholderToZone(event.clientX, event.clientY);
});

window.addEventListener("pointerup", () => {
  if (dragState.draggingPanel) {
    const { panelId, panel } = dragState.draggingPanel;
    panel.classList.remove("dragging");
    const dropAbove = document.querySelector("[data-panel].drop-above");
    const dropBelow = document.querySelector("[data-panel].drop-below");
    const allPanels = Array.from(document.querySelectorAll("[data-panel]")).map((p) => p.dataset.panel);
    let insertIndex = allPanels.length;
    if (dropAbove) {
      insertIndex = allPanels.indexOf(dropAbove.dataset.panel);
      dropAbove.classList.remove("drop-above");
    } else if (dropBelow) {
      insertIndex = allPanels.indexOf(dropBelow.dataset.panel) + 1;
      dropBelow.classList.remove("drop-below");
    }
    const newOrder = allPanels.filter((id) => id !== panelId);
    newOrder.splice(Math.min(insertIndex, newOrder.length), 0, panelId);
    dragState.draggingPanel = null;
    reorderPanels(newOrder);
    return;
  }

  if (dragState.draggingCard) {
    const { projectId, card } = dragState.draggingCard;
    card.classList.remove("dragging");
    const dropAbove = document.querySelector(".project-card.drop-above");
    const dropBelow = document.querySelector(".project-card.drop-below");
    const allCards = Array.from(document.querySelectorAll(".project-card"));
    const allIds = allCards.map((c) => c.dataset.projectId);
    let insertIndex = allIds.length;
    if (dropAbove) {
      insertIndex = allIds.indexOf(dropAbove.dataset.projectId);
      dropAbove.classList.remove("drop-above");
    } else if (dropBelow) {
      insertIndex = allIds.indexOf(dropBelow.dataset.projectId) + 1;
      dropBelow.classList.remove("drop-below");
    }
    const newOrder = allIds.filter((id) => id !== projectId);
    newOrder.splice(Math.min(insertIndex, newOrder.length), 0, projectId);
    dragState.draggingCard = null;
    reorderProjects(newOrder);
    return;
  }

  if (dragState.draggingProgress) {
    const { projectId, taskId, barElement } = dragState.draggingProgress;
    const fill = barElement.querySelector(".progress-bar-fill");
    const progress = fill ? Math.round(parseFloat(fill.style.width) || 0) : 0;
    dragState.draggingProgress = null;
    updateProjectTask(projectId, taskId, { progress });
    return;
  }

  if (dragState.taskId) {
    finalizeTaskDrag();
  }
});

window.addEventListener("pointercancel", () => {
  if (dragState.draggingPanel) {
    dragState.draggingPanel.panel.classList.remove("dragging");
    dragState.draggingPanel = null;
    document.querySelectorAll("[data-panel].drop-above, [data-panel].drop-below").forEach((p) => {
      p.classList.remove("drop-above", "drop-below");
    });
  }
  if (dragState.draggingCard) {
    dragState.draggingCard.card.classList.remove("dragging");
    dragState.draggingCard = null;
    document.querySelectorAll(".project-card.drop-above, .project-card.drop-below").forEach((c) => {
      c.classList.remove("drop-above", "drop-below");
    });
  }
  if (dragState.draggingProgress) {
    dragState.draggingProgress = null;
    render();
  }
  if (dragState.taskId) {
    cleanupDragState();
  }
});

document.body.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const card = actionButton.closest("[data-task-id]");
    const taskId = card?.dataset.taskId;
    if (!taskId) {
      return;
    }

    const action = actionButton.dataset.action;
    const currentTask = getTaskById(taskId);

    if (action === "delete") {
      deleteTask(taskId);
    } else if (action === "edit-task") {
      if (!currentTask || currentTask.completed) {
        return;
      }

      const nextTitle = await requestTaskTitle(currentTask.title, "编辑进行中的任务");
      if (!nextTitle || nextTitle === currentTask.title) {
        return;
      }

      updateTaskTitle(taskId, nextTitle);
    } else if (action === "edit-date") {
      if (!currentTask?.completedAt) {
        return;
      }

      const defaultDateKey = formatDateKey(new Date(currentTask.completedAt));
      const chosenDateKey = await requestDateKey(
        defaultDateKey,
        `修改“${currentTask.title}”的完成日期（YYYY-MM-DD）`
      );

      if (!chosenDateKey) {
        return;
      }

      updateCompletedDate(taskId, chosenDateKey);
    } else {
      let completionDateKey = null;
      if (!currentTask?.completed) {
        completionDateKey = await requestDateKey(
          formatDateKey(new Date()),
          `填写“${currentTask?.title || "任务"}”的完成日期（YYYY-MM-DD）`
        );

        if (!completionDateKey) {
          return;
        }
      }

      toggleTask(taskId, completionDateKey);
    }

    return;
  }

  const dayButton = event.target.closest("[data-date-key]");
  if (dayButton) {
    const dateKey = dayButton.dataset.dateKey;
    appState.selectedDateKey = dateKey;
    const [year, month] = dateKey.split("-").map(Number);
    appState.currentMonth = new Date(year, month - 1, 1);
    render();
  }
});

refs.dayAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = refs.dayAddInput.value.trim();
  if (!title) {
    return;
  }

  addCompletedTaskForDate(title, appState.selectedDateKey);
  refs.dayAddInput.value = "";
});

refs.prevMonthButton.addEventListener("click", () => {
  appState.currentMonth = new Date(appState.currentMonth.getFullYear(), appState.currentMonth.getMonth() - 1, 1);
  renderCalendar();
});

refs.nextMonthButton.addEventListener("click", () => {
  appState.currentMonth = new Date(appState.currentMonth.getFullYear(), appState.currentMonth.getMonth() + 1, 1);
  renderCalendar();
});

refs.tabTodo.addEventListener("click", () => { appState.tab = "todo"; render(); });
refs.tabProjects.addEventListener("click", () => { appState.tab = "projects"; render(); });

refs.addProjectButton.addEventListener("click", async () => {
  const name = await requestTaskTitle("", "输入项目名称");
  if (!name) return;
  addProject(name);
});

refs.projectList.addEventListener("click", async (event) => {
  const actionBtn = event.target.closest("[data-action]");
  if (!actionBtn) return;
  const action = actionBtn.dataset.action;
  const projectId = actionBtn.dataset.projectId || actionBtn.closest("[data-project-id]")?.dataset.projectId;
  const ptaskId = actionBtn.dataset.ptaskId || actionBtn.closest("[data-ptask-id]")?.dataset.ptaskId;

  if (action === "edit-project") {
    const project = appState.data.projects.find((p) => p.id === projectId);
    if (!project) return;
    const name = await requestTaskTitle(project.name, "修改项目名称");
    if (!name || name === project.name) return;
    updateProjectName(projectId, name);
  } else if (action === "delete-project") {
    deleteProject(projectId);
  } else if (action === "edit-ptask") {
    const project = appState.data.projects.find((p) => p.id === projectId);
    if (!project) return;
    const ptask = project.tasks.find((t) => t.id === ptaskId);
    if (!ptask) return;
    const modal = document.createElement("div");
    modal.className = "date-modal-backdrop";
    modal.innerHTML = `
      <div class="date-modal" style="width:420px">
        <p class="date-modal-title">编辑项目任务</p>
        <label style="display:block;margin-bottom:8px">任务名称 <input id="webEditPtaskName" type="text" value="${escapeHtml(ptask.taskName)}" class="date-modal-input" style="width:100%" /></label>
        <label style="display:block;margin-bottom:8px">开始日期 <input id="webEditPtaskStart" type="date" value="${escapeHtml(ptask.startDate)}" class="date-modal-input" style="width:100%" /></label>
        <label style="display:block;margin-bottom:8px">结束日期 <input id="webEditPtaskEnd" type="date" value="${escapeHtml(ptask.endDate)}" class="date-modal-input" style="width:100%" /></label>
        <label style="display:block;margin-bottom:8px">进度 (0-100) <input id="webEditPtaskProgress" type="number" min="0" max="100" value="${ptask.progress}" class="date-modal-input" style="width:100%" /></label>
        <label style="display:block;margin-bottom:8px">优先级
          <select id="webEditPtaskPriority" class="date-modal-input" style="width:100%">
            <option value="p0" ${ptask.priority === "p0" ? "selected" : ""}>P0</option>
            <option value="p1" ${ptask.priority === "p1" ? "selected" : ""}>P1</option>
            <option value="p2" ${ptask.priority === "p2" ? "selected" : ""}>P2</option>
          </select>
        </label>
        <div class="date-modal-actions">
          <button id="webPtaskEditCancel" class="date-modal-button neutral" type="button">取消</button>
          <button id="webPtaskEditSave" class="date-modal-button primary" type="button">保存</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector("#webPtaskEditCancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#webPtaskEditSave").addEventListener("click", () => {
      const fields = {
        taskName: modal.querySelector("#webEditPtaskName").value.trim(),
        startDate: modal.querySelector("#webEditPtaskStart").value,
        endDate: modal.querySelector("#webEditPtaskEnd").value,
        progress: Number(modal.querySelector("#webEditPtaskProgress").value),
        priority: modal.querySelector("#webEditPtaskPriority").value
      };
      modal.remove();
      updateProjectTask(projectId, ptaskId, fields);
    });
  } else if (action === "delete-ptask") {
    deleteProjectTask(projectId, ptaskId);
  }
});

refs.projectList.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-form='add-ptask']");
  if (!form) return;
  event.preventDefault();
  const projectId = form.dataset.projectId;
  const inputs = form.querySelectorAll("input, select");
  const taskData = {
    taskName: inputs[0].value.trim(),
    startDate: inputs[1].value,
    endDate: inputs[2].value,
    priority: inputs[3].value
  };
  if (!taskData.taskName) return;
  addProjectTask(projectId, taskData);
});

render();

if (appState.config.syncKey) {
  runSync("startup");
}

setInterval(() => {
  if (appState.config.syncKey) {
    runSync("timer");
  }
}, 30000);
