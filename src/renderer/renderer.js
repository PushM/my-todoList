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
  data: {
    tasks: [],
    completionLog: {},
    updatedAt: null
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
  syncStatusText: document.getElementById("syncStatusText")
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
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoString));
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
          <div class="task-time">创建于 ${formatTime(task.createdAt)}</div>
        </div>
        <div class="task-actions">
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

function render() {
  refs.todayLabel.textContent = formatChineseDate(new Date());
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

initialize();
