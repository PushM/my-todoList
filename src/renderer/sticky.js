const QUADRANTS = [
  { id: "q1", title: "既紧急又重要", accentClass: "urgent-important" },
  { id: "q2", title: "重要不紧急", accentClass: "important" },
  { id: "q3", title: "紧急不重要", accentClass: "urgent" },
  { id: "q4", title: "不紧急不重要", accentClass: "backlog" }
];

const DEFAULT_QUADRANT_ID = "q1";

const refs = {
  dateLabel: document.getElementById("dateLabel"),
  taskCount: document.getElementById("taskCount"),
  quadrantBoard: document.getElementById("quadrantBoard"),
  taskForm: document.getElementById("taskForm"),
  taskInput: document.getElementById("taskInput"),
  closeBtn: document.getElementById("closeBtn"),
  minimizeBtn: document.getElementById("minimizeBtn")
};

const stickyState = {
  tasks: []
};

const dragState = {
  taskId: null,
  sourceCard: null,
  placeholder: null,
  ghost: null,
  offsetX: 0,
  offsetY: 0
};

function formatToday() {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date());
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(isoString) {
  return new Intl.DateTimeFormat("zh-CN", {
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

function requestDateKey(defaultDateKey, message) {
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function getTaskById(taskId) {
  return stickyState.tasks.find((task) => task.id === taskId) || null;
}

function setState(nextState) {
  stickyState.tasks = Array.isArray(nextState.tasks) ? nextState.tasks : [];
  render();
}

function getQuadrantTaskMap() {
  const grouped = Object.fromEntries(QUADRANTS.map((quadrant) => [quadrant.id, []]));

  stickyState.tasks
    .filter((task) => !task.completed)
    .forEach((task) => {
      grouped[normalizeQuadrantId(task.quadrantId)].push(task);
    });

  for (const quadrant of QUADRANTS) {
    grouped[quadrant.id].sort(sortPendingTasks);
  }

  return grouped;
}

function render() {
  const pendingTasks = stickyState.tasks.filter((task) => !task.completed);
  const grouped = getQuadrantTaskMap();

  refs.dateLabel.textContent = formatToday();
  refs.taskCount.textContent = `${pendingTasks.length} 项待办`;
  refs.quadrantBoard.innerHTML = QUADRANTS.map((quadrant) => createQuadrantColumn(quadrant, grouped[quadrant.id])).join("");
}

function createQuadrantColumn(quadrant, tasks) {
  const listContent = tasks.length
    ? tasks.map((task) => createPendingTaskCard(task)).join("")
    : '<div class="quadrant-empty">拖到这里</div>';

  return `
    <section class="quadrant-column ${quadrant.accentClass}">
      <div class="quadrant-header">
        <strong>${quadrant.title}</strong>
        <span>${tasks.length}</span>
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
        <div class="task-time">创建于 ${formatDateTime(task.createdAt)}</div>
      </div>
      <div class="task-actions">
        <button class="task-action edit-date" data-action="edit-task">编</button>
        <button class="task-action complete" data-action="toggle">完成</button>
        <button class="task-action delete" data-action="delete">删</button>
        <button class="drag-handle" type="button" data-drag-handle title="拖动排序">::</button>
      </div>
    </article>
  `;
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
  if (dragState.taskId) {
    await finalizeTaskDrag();
  }
});

window.addEventListener("pointercancel", () => {
  if (dragState.taskId) {
    cleanupDragState();
  }
});

document.body.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const card = button.closest("[data-task-id]");
  const taskId = card?.dataset.taskId;
  if (!taskId) {
    return;
  }

  const action = button.dataset.action;
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

  setState(nextState);
});

refs.closeBtn.addEventListener("click", async () => {
  await window.todoApi.closeSticky();
});

refs.minimizeBtn.addEventListener("click", async () => {
  await window.todoApi.minimizeSticky();
});

window.todoApi.onStateChanged((nextState) => {
  setState(nextState);
});

window.todoApi.loadState().then((nextState) => {
  setState(nextState);
});
