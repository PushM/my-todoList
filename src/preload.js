const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("todoApi", {
  loadState: () => ipcRenderer.invoke("state:load"),
  addTask: (title) => ipcRenderer.invoke("task:add", title),
  updateTaskTitle: (taskId, title) => ipcRenderer.invoke("task:updateTitle", taskId, title),
  moveTask: (taskId, targetQuadrantId, targetIndex) =>
    ipcRenderer.invoke("task:move", taskId, targetQuadrantId, targetIndex),
  toggleTask: (taskId, completionDateKey) =>
    ipcRenderer.invoke("task:toggle", taskId, completionDateKey),
  updateCompletedDate: (taskId, completionDateKey) =>
    ipcRenderer.invoke("task:updateCompletedDate", taskId, completionDateKey),
  addCompletedTask: (payload) => ipcRenderer.invoke("task:addCompleted", payload),
  deleteTask: (taskId) => ipcRenderer.invoke("task:delete", taskId),
  addProject: (name) => ipcRenderer.invoke("project:add", name),
  updateProjectName: (projectId, name) => ipcRenderer.invoke("project:updateName", projectId, name),
  deleteProject: (projectId) => ipcRenderer.invoke("project:delete", projectId),
  addProjectTask: (projectId, taskData) => ipcRenderer.invoke("projectTask:add", projectId, taskData),
  updateProjectTask: (projectId, taskId, fields) =>
    ipcRenderer.invoke("projectTask:update", projectId, taskId, fields),
  deleteProjectTask: (projectId, taskId) => ipcRenderer.invoke("projectTask:delete", projectId, taskId),
  reorderPanels: (orderedIds) => ipcRenderer.invoke("panel:reorder", orderedIds),
  reorderProjects: (orderedIds) => ipcRenderer.invoke("project:reorder", orderedIds),
  getSyncConfig: () => ipcRenderer.invoke("sync:config:get"),
  saveSyncConfig: (payload) => ipcRenderer.invoke("sync:config:save", payload),
  runSync: (reason) => ipcRenderer.invoke("sync:run", reason),
  toggleSticky: () => ipcRenderer.invoke("sticky:toggle"),
  getStickyStatus: () => ipcRenderer.invoke("sticky:status"),
  closeSticky: () => ipcRenderer.invoke("sticky:close"),
  minimizeSticky: () => ipcRenderer.invoke("window:minimizeSticky"),
  onStateChanged: (listener) => {
    const wrapped = (_, value) => listener(value);
    ipcRenderer.on("state:changed", wrapped);
    return () => ipcRenderer.removeListener("state:changed", wrapped);
  },
  onStickyStatus: (listener) => {
    const wrapped = (_, value) => listener(value);
    ipcRenderer.on("sticky:status", wrapped);
    return () => ipcRenderer.removeListener("sticky:status", wrapped);
  },
  onSyncStatus: (listener) => {
    const wrapped = (_, value) => listener(value);
    ipcRenderer.on("sync:status", wrapped);
    return () => ipcRenderer.removeListener("sync:status", wrapped);
  }
});
