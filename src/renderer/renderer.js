const QUADRANTS = [
  {
    id: "q1",
    title: "既紧急又重要",
    description: "先处理，当前进行中的老任务默认都放在这里。",
    accentClass: "urgent-important"
  },
  {
    id: "q2",
    title: "重要不紧急",
    description: "适合规划、沉淀和提前推进。",
    accentClass: "important"
  },
  {
    id: "q3",
    title: "紧急不重要",
    description: "能快速处理就别让它持续打断你。",
    accentClass: "urgent"
  },
  {
    id: "q4",
    title: "不紧急不重要",
    description: "放这里做缓冲，空下来再看。",
    accentClass: "backlog"
  }
];

const DEFAULT_QUADRANT_ID = "q1";

const state = {
  tab: "todo",
  data: {
    tasks: [],
    completionLog: {},
    updatedAt: null,
    projects: []
  },
  syncConfig: {
    serverUrl: "",
    syncKey: "",
    lastSyncMessage: "未配置同步"
  },
  syncStatus: null,
  currentMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDateKey: formatDateKey(new Date())
};

const calendarPreviewSettings = {
  maxCharsPerItem: 10
};

const dragState = {
  taskId: null,
  sourceCard: null,
  placeholder: null,
  ghost: null,
  offsetX: 0,
  offsetY: 0
};

const refs = {
  taskForm: document.getElementById("taskForm"),
  taskInput: document.getElementById("taskInput"),
  quadrantBoard: document.getElementById("quadrantBoard"),
  pendingCount: document.getElementById("pendingCount"),
  todayLabel: document.getElementById("todayLabel"),
  monthLabel: document.getElementById("monthLabel"),
  calendarGrid: document.getElementById("calendarGrid"),
  selectedDateTitle: document.getElementById("selectedDateTitle"),
  selectedDateCount: document.getElementById("selectedDateCount"),
  selectedDateLog: document.getElementById("selectedDateLog"),
  calendarAddForm: document.getElementById("calendarAddForm"),
  calendarAddInput: document.getElementById("calendarAddInput"),
  prevMonth: document.getElementById("prevMonth"),
  nextMonth: document.getElementById("nextMonth"),
  stickyToggle: document.getElementById("stickyToggle"),
  serverUrlInput: document.getElementById("serverUrlInput"),
  syncKeyInput: document.getElementById("syncKeyInput"),
  saveSyncButton: document.getElementById("saveSyncButton"),
  syncNowButton: document.getElementById("syncNowButton"),
  syncStatusText: document.getElementById("syncStatusText"),
  tabTodo: document.getElementById("tabTodo"),
  tabProjects: document.getElementById("tabProjects"),
  todoView: document.getElementById("todoView"),
  projectsView: document.getElementById("projectsView"),
  projectList: document.getElementById("projectList"),
  addProjectButton: document.getElementById("addProjectButton")
};

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatChineseDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);
}

function formatTime(isoString) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoString));
}

function formatDateTime(isoString) {
  if (!isoString) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoString));
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return false;
  }

  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function normalizeQuadrantId(value) {
  return QUADRANTS.some((quadrant) => quadrant.id === value) ? value : DEFAULT_QUADRANT_ID;
}

function sortPendingTasks(left, right) {
  if (left.quadrantOrder !== right.quadrantOrder) {
    return left.quadrantOrder - right.quadrantOrder;
  }

  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function getQuadrantTaskMap() {
  const grouped = Object.fromEntries(QUADRANTS.map((quadrant) => [quadrant.id, []]));

  state.data.tasks
    .filter((task) => !task.completed)
    .forEach((task) => {
      grouped[normalizeQuadrantId(task.quadrantId)].push(task);
    });

  for (const quadrant of QUADRANTS) {
    grouped[quadrant.id].sort(sortPendingTasks);
  }

  return grouped;
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

function setState(nextState) {
  state.data = nextState;
  render();
}

function setSyncConfig(config) {
  state.syncConfig = config;
  refs.serverUrlInput.value = config.serverUrl || "";
  refs.syncKeyInput.value = config.syncKey || "";
  renderSyncStatus();
}

function setSyncStatus(status) {
  state.syncStatus = status;
  renderSyncStatus();
}

function setStickyStatus(isOpen) {
  refs.stickyToggle.textContent = isOpen ? "关闭桌面便签" : "打开桌面便签";
  refs.stickyToggle.classList.toggle("active", isOpen);
}

function renderTasks() {
  const pending = state.data.tasks.filter((task) => !task.completed);
  const grouped = getQuadrantTaskMap();

  refs.pendingCount.textContent = `${pending.length} 项`;
  refs.quadrantBoard.innerHTML = QUADRANTS.map((quadrant) => createQuadrantColumn(quadrant, grouped[quadrant.id])).join("");
}

function renderSyncStatus() {
  const liveStatus = state.syncStatus?.message;
  const savedMessage = state.syncConfig?.lastSyncMessage;
  const timestamp = state.syncStatus?.updatedAt || state.syncConfig?.lastSyncedAt;
  const text = liveStatus || savedMessage || "未配置同步";
  refs.syncStatusText.textContent = timestamp ? `${text} · ${formatDateTime(timestamp)}` : text;
}

function createQuadrantColumn(quadrant, tasks) {
  const listContent = tasks.length
    ? tasks.map((task) => createPendingTaskCard(task)).join("")
    : '<div class="quadrant-empty">把任务拖到这里，或者从上面直接添加。</div>';

  return `
    <section class="quadrant-column ${quadrant.accentClass}" data-quadrant-id="${quadrant.id}">
      <div class="quadrant-header">
        <div>
          <p class="quadrant-tag">${quadrant.id.toUpperCase()}</p>
          <h3>${quadrant.title}</h3>
          <p class="quadrant-description">${quadrant.description}</p>
        </div>
        <span class="quadrant-count">${tasks.length} 项</span>
      </div>
      <div class="quadrant-list" data-drop-zone="quadrant" data-quadrant-id="${quadrant.id}">
        ${listContent}
      </div>
    </section>
  `;
}

function createPendingTaskCard(task) {
  return `
    <article class="task-card pending-card" data-task-id="${task.id}" data-pending="true">
      <div class="task-card-main">
        <div class="task-meta">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-time">创建于 ${formatDateTime(task.createdAt)}</div>
        </div>
        <div class="task-actions">
          <button class="task-action edit-date" data-action="edit-task">编辑</button>
          <button class="task-action complete" data-action="toggle">完成并选日期</button>
          <button class="task-action delete" data-action="delete">删除</button>
          <button class="drag-handle" type="button" data-drag-handle title="拖动排序">::</button>
        </div>
      </div>
    </article>
  `;
}

function createCompletionLogItem(item) {
  const task = getTaskById(item.taskId);
  const actions = task
    ? `
        <div class="task-actions log-actions">
          <button class="task-action undo" data-action="toggle">撤销</button>
          <button class="task-action edit-date" data-action="edit-date">改日期</button>
          <button class="task-action delete" data-action="delete">删除</button>
        </div>
      `
    : "";

  return `
    <div class="log-item" data-task-id="${escapeHtml(item.taskId)}">
      <div class="log-item-title">${escapeHtml(item.title)}</div>
      <div class="log-item-time">完成时间 ${formatTime(item.completedAt)}</div>
      ${actions}
    </div>
  `;
}

function renderCalendar() {
  const current = state.currentMonth;
  refs.monthLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long"
  }).format(current);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const todayKey = formatDateKey(new Date());

  const items = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const dateKey = formatDateKey(date);
    const logs = Array.isArray(state.data.completionLog[dateKey]) ? state.data.completionLog[dateKey] : [];
    const isCurrentMonth = date.getMonth() === month;
    const classes = [
      "calendar-day",
      isCurrentMonth ? "" : "muted",
      dateKey === todayKey ? "today" : "",
      dateKey === state.selectedDateKey ? "selected" : ""
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

    items.push(`
      <button type="button" class="${classes}" data-date-key="${dateKey}">
        <div class="day-top">
          <span>${date.getDate()}</span>
          ${logs.length ? `<span class="day-badge">${logs.length}</span>` : ""}
        </div>
        <div class="day-preview">${previewHtml}</div>
      </button>
    `);
  }

  refs.calendarGrid.innerHTML = items.join("");
}

function renderSelectedDateLog() {
  const date = new Date(`${state.selectedDateKey}T00:00:00`);
  const logs = Array.isArray(state.data.completionLog[state.selectedDateKey])
    ? state.data.completionLog[state.selectedDateKey]
    : [];

  refs.selectedDateTitle.textContent = formatChineseDate(date).replace("星期", "周");
  refs.selectedDateCount.textContent = `${logs.length} 条`;
  refs.selectedDateLog.innerHTML = logs.length
    ? logs.map((item) => createCompletionLogItem(item)).join("")
    : '<div class="empty-state">这一天还没有完成记录。</div>';
}

function renderTabBar() {
  const isProjects = state.tab === "projects";
  refs.tabTodo.classList.toggle("active", !isProjects);
  refs.tabProjects.classList.toggle("active", isProjects);
}

function renderViewVisibility() {
  const isProjects = state.tab === "projects";
  refs.todoView.style.display = isProjects ? "none" : "";
  refs.projectsView.style.display = isProjects ? "" : "none";
}

const PRIORITY_LABELS = {
  q1: "急重",
  q2: "重要",
  q3: "紧急",
  q4: "待定"
};

function createProjectTaskRow(ptask) {
  return `
    <div class="schedule-row" data-ptask-id="${escapeHtml(ptask.id)}">
      <div class="schedule-cell name">${escapeHtml(ptask.taskName)}</div>
      <div class="schedule-cell">${escapeHtml(ptask.startDate || "-")}</div>
      <div class="schedule-cell">${escapeHtml(ptask.endDate || "-")}</div>
      <div class="schedule-cell">
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width:${ptask.progress}%"></div>
        </div>
        <span style="font-size:10px;color:rgba(45,36,29,0.5)">${ptask.progress}%</span>
      </div>
      <div class="schedule-cell"><span class="priority-tag ${escapeHtml(ptask.priority)}">${PRIORITY_LABELS[ptask.priority] || ptask.priority}</span></div>
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
        <option value="q1">急重</option>
        <option value="q2">重要</option>
        <option value="q3">紧急</option>
        <option value="q4" selected>待定</option>
      </select>
      <button type="submit">添加任务</button>
    </form>`;
}

function createProjectCard(project) {
  const rows = project.tasks.map(createProjectTaskRow).join("");
  return `
    <div class="project-card" data-project-id="${escapeHtml(project.id)}">
      <div class="project-card-header">
        <span class="project-card-name">${escapeHtml(project.name)}</span>
        <div class="project-card-actions">
          <button class="project-btn-edit" data-action="edit-project" data-project-id="${escapeHtml(project.id)}" type="button">改名</button>
          <button class="project-btn-delete" data-action="delete-project" data-project-id="${escapeHtml(project.id)}" type="button">删除项目</button>
        </div>
      </div>
      <div class="schedule-table">
        <div class="schedule-table-header">
          <span>任务名称</span>
          <span>开始日期</span>
          <span>结束日期</span>
          <span>进度</span>
          <span>优先级</span>
          <span>操作</span>
        </div>
        ${rows || '<div class="project-empty" style="padding:16px">暂无任务，在下方添加</div>'}
      </div>
      ${createAddProjectTaskForm(project.id)}
    </div>`;
}

function renderProjectList() {
  const projects = state.data.projects || [];
  if (!projects.length) {
    refs.projectList.innerHTML = '<div class="project-empty">暂无项目，点击右上角"新建项目"开始</div>';
    return;
  }
  refs.projectList.innerHTML = projects.map(createProjectCard).join("");
}

function render() {
  refs.todayLabel.textContent = formatChineseDate(new Date());
  renderTabBar();
  renderViewVisibility();
  if (state.tab === "projects") {
    renderProjectList();
    renderSyncStatus();
    return;
  }
  renderTasks();
  renderSyncStatus();
  renderCalendar();
  renderSelectedDateLog();
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
  return state.data.tasks.find((task) => task.id === taskId) || null;
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

  const targetQuadrantId = normalizeQuadrantId(zone.dataset.quadrantId);
  const items = Array.from(zone.children).filter(
    (child) =>
      child !== dragState.sourceCard &&
      (child.classList.contains("pending-card") || child.classList.contains("task-placeholder"))
  );

  return {
    targetQuadrantId,
    targetIndex: items.indexOf(dragState.placeholder)
  };
}

async function finalizeTaskDrag() {
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

  const nextState = await window.todoApi.moveTask(
    taskId,
    dropResult.targetQuadrantId,
    dropResult.targetIndex
  );
  setState(nextState);
}

async function initialize() {
  const [loaded, syncConfig, stickyStatus] = await Promise.all([
    window.todoApi.loadState(),
    window.todoApi.getSyncConfig(),
    window.todoApi.getStickyStatus()
  ]);

  setState(loaded);
  setSyncConfig(syncConfig);
  setStickyStatus(stickyStatus.isOpen);
}

refs.taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = refs.taskInput.value.trim();

  if (!title) {
    return;
  }

  const nextState = await window.todoApi.addTask(title);
  refs.taskInput.value = "";
  setState(nextState);
});

refs.saveSyncButton.addEventListener("click", async () => {
  const payload = {
    serverUrl: refs.serverUrlInput.value.trim(),
    syncKey: refs.syncKeyInput.value.trim()
  };

  const result = await window.todoApi.saveSyncConfig(payload);
  setSyncConfig(result.config);
  setSyncStatus(result.status);
});

refs.syncNowButton.addEventListener("click", async () => {
  const status = await window.todoApi.runSync("manual");
  setSyncStatus(status);
});

document.body.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-drag-handle]");
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
  if (!dragState.taskId) {
    return;
  }

  event.preventDefault();
  updateDragGhostPosition(event.clientX, event.clientY);
  movePlaceholderToZone(event.clientX, event.clientY);
});

window.addEventListener("pointerup", async () => {
  if (!dragState.taskId) {
    return;
  }

  await finalizeTaskDrag();
});

window.addEventListener("pointercancel", () => {
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
    let nextState = null;

    if (action === "delete") {
      nextState = await window.todoApi.deleteTask(taskId);
    } else if (action === "edit-task") {
      if (!currentTask || currentTask.completed) {
        return;
      }

      const nextTitle = await requestTaskTitle(currentTask.title, "编辑进行中的任务");
      if (!nextTitle || nextTitle === currentTask.title) {
        return;
      }

      nextState = await window.todoApi.updateTaskTitle(taskId, nextTitle);
    } else if (action === "edit-date") {
      if (!currentTask?.completedAt) {
        return;
      }

      const defaultDateKey = formatDateKey(new Date(currentTask.completedAt));
      const chosenDateKey = await requestDateKey(
        defaultDateKey,
        `修改「${currentTask.title}」的完成日期（YYYY-MM-DD）`
      );
      if (!chosenDateKey) {
        return;
      }

      nextState = await window.todoApi.updateCompletedDate(taskId, chosenDateKey);
      state.selectedDateKey = chosenDateKey;
      const [year, month] = chosenDateKey.split("-").map(Number);
      state.currentMonth = new Date(year, month - 1, 1);
    } else {
      let completionDateKey = null;
      if (!currentTask?.completed) {
        completionDateKey = await requestDateKey(
          formatDateKey(new Date()),
          `填写「${currentTask?.title || "任务"}」完成日期（YYYY-MM-DD）`
        );
        if (!completionDateKey) {
          return;
        }
      }

      nextState = await window.todoApi.toggleTask(taskId, completionDateKey);
    }

    if (action !== "delete") {
      const toggledTask = nextState.tasks.find((task) => task.id === taskId);
      if (toggledTask?.completedAt) {
        state.selectedDateKey = formatDateKey(new Date(toggledTask.completedAt));
        state.currentMonth = new Date(
          new Date(toggledTask.completedAt).getFullYear(),
          new Date(toggledTask.completedAt).getMonth(),
          1
        );
      }
    }

    setState(nextState);
    return;
  }

  const dayButton = event.target.closest("[data-date-key]");
  if (dayButton) {
    const dateKey = dayButton.dataset.dateKey;
    state.selectedDateKey = dateKey;
    const [year, month] = dateKey.split("-").map(Number);
    state.currentMonth = new Date(year, month - 1, 1);
    render();
  }
});

refs.calendarAddForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = refs.calendarAddInput.value.trim();
  if (!title) {
    return;
  }

  const nextState = await window.todoApi.addCompletedTask({
    title,
    dateKey: state.selectedDateKey
  });
  refs.calendarAddInput.value = "";
  setState(nextState);
});

refs.prevMonth.addEventListener("click", () => {
  state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
  renderCalendar();
});

refs.nextMonth.addEventListener("click", () => {
  state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
  renderCalendar();
});

refs.stickyToggle.addEventListener("click", async () => {
  const status = await window.todoApi.toggleSticky();
  setStickyStatus(status.isOpen);
});

window.todoApi.onStateChanged((nextState) => {
  setState(nextState);
});

window.todoApi.onStickyStatus((payload) => {
  setStickyStatus(payload.isOpen);
});

window.todoApi.onSyncStatus((payload) => {
  setSyncStatus(payload);
});

refs.tabTodo.addEventListener("click", () => {
  state.tab = "todo";
  render();
});

refs.tabProjects.addEventListener("click", () => {
  state.tab = "projects";
  render();
});

refs.addProjectButton.addEventListener("click", async () => {
  const name = await requestTaskTitle("", "输入项目名称");
  if (!name) return;
  try {
    const nextState = await window.todoApi.addProject(name);
    setState(nextState);
  } catch (error) {
    console.error("添加项目失败:", error);
  }
});

refs.projectList.addEventListener("click", async (event) => {
  const actionBtn = event.target.closest("[data-action]");
  if (!actionBtn) return;

  const action = actionBtn.dataset.action;
  const projectId = actionBtn.dataset.projectId || actionBtn.closest("[data-project-id]")?.dataset.projectId;
  const ptaskId = actionBtn.dataset.ptaskId || actionBtn.closest("[data-ptask-id]")?.dataset.ptaskId;
  let nextState;

  if (action === "edit-project") {
    const project = state.data.projects.find((p) => p.id === projectId);
    if (!project) return;
    const name = await requestTaskTitle(project.name, "修改项目名称");
    if (!name || name === project.name) return;
    nextState = await window.todoApi.updateProjectName(projectId, name);
  } else if (action === "delete-project") {
    nextState = await window.todoApi.deleteProject(projectId);
  } else if (action === "edit-ptask") {
    const project = state.data.projects.find((p) => p.id === projectId);
    if (!project) return;
    const ptask = project.tasks.find((t) => t.id === ptaskId);
    if (!ptask) return;

    const modal = document.createElement("div");
    modal.className = "date-modal-backdrop";
    modal.innerHTML = `
      <div class="date-modal" style="width:420px">
        <p class="date-modal-title">编辑项目任务</p>
        <label style="display:block;margin-bottom:8px">任务名称 <input id="editPtaskName" type="text" value="${escapeHtml(ptask.taskName)}" style="width:100%;border:none;background:#fffdf9;border-radius:10px;padding:8px;box-shadow:inset 0 0 0 1px var(--line)" /></label>
        <label style="display:block;margin-bottom:8px">开始日期 <input id="editPtaskStart" type="date" value="${escapeHtml(ptask.startDate)}" style="width:100%;border:none;background:#fffdf9;border-radius:10px;padding:8px;box-shadow:inset 0 0 0 1px var(--line)" /></label>
        <label style="display:block;margin-bottom:8px">结束日期 <input id="editPtaskEnd" type="date" value="${escapeHtml(ptask.endDate)}" style="width:100%;border:none;background:#fffdf9;border-radius:10px;padding:8px;box-shadow:inset 0 0 0 1px var(--line)" /></label>
        <label style="display:block;margin-bottom:8px">进度 (0-100) <input id="editPtaskProgress" type="number" min="0" max="100" value="${ptask.progress}" style="width:100%;border:none;background:#fffdf9;border-radius:10px;padding:8px;box-shadow:inset 0 0 0 1px var(--line)" /></label>
        <label style="display:block;margin-bottom:8px">优先级
          <select id="editPtaskPriority" style="width:100%;border:none;background:#fffdf9;border-radius:10px;padding:8px;box-shadow:inset 0 0 0 1px var(--line)">
            <option value="q1" ${ptask.priority === "q1" ? "selected" : ""}>急重</option>
            <option value="q2" ${ptask.priority === "q2" ? "selected" : ""}>重要</option>
            <option value="q3" ${ptask.priority === "q3" ? "selected" : ""}>紧急</option>
            <option value="q4" ${ptask.priority === "q4" ? "selected" : ""}>待定</option>
          </select>
        </label>
        <div class="date-modal-actions">
          <button id="ptaskEditCancel" class="date-modal-button neutral" type="button">取消</button>
          <button id="ptaskEditSave" class="date-modal-button primary" type="button">保存</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector("#ptaskEditCancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#ptaskEditSave").addEventListener("click", async () => {
      const fields = {
        taskName: modal.querySelector("#editPtaskName").value.trim(),
        startDate: modal.querySelector("#editPtaskStart").value,
        endDate: modal.querySelector("#editPtaskEnd").value,
        progress: Number(modal.querySelector("#editPtaskProgress").value),
        priority: modal.querySelector("#editPtaskPriority").value
      };
      modal.remove();
      const result = await window.todoApi.updateProjectTask(projectId, ptaskId, fields);
      setState(result);
    });
    return;
  } else if (action === "delete-ptask") {
    nextState = await window.todoApi.deleteProjectTask(projectId, ptaskId);
  }

  if (nextState) setState(nextState);
});

refs.projectList.addEventListener("submit", async (event) => {
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
  const nextState = await window.todoApi.addProjectTask(projectId, taskData);
  setState(nextState);
});

initialize();
