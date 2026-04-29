package com.pushm.todolist.android

import android.webkit.JavascriptInterface
import com.pushm.todolist.android.sync.CalendarSyncScheduler
import com.pushm.todolist.android.sync.SyncConfigStore
import com.pushm.todolist.android.sync.TodoSyncEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class TodoBridge(
  private val activity: MainActivity,
  private val configStore: SyncConfigStore,
  private val scheduler: CalendarSyncScheduler,
  private val syncEngine: TodoSyncEngine
) {
  private val scope = CoroutineScope(Dispatchers.Main)

  @JavascriptInterface
  fun getBootstrapConfig(): String {
    return configStore.buildBootstrapConfig()
  }

  @JavascriptInterface
  fun saveSyncConfig(serverUrl: String?, syncKey: String?) {
    val nextServerUrl = serverUrl.orEmpty().trim()
    val nextSyncKey = syncKey.orEmpty().trim()
    configStore.saveConfig(nextServerUrl, nextSyncKey)
    scope.launch {
      if (nextServerUrl.isBlank() || nextSyncKey.isBlank()) {
        return@launch
      }

      activity.ensureCalendarSyncReady()
      scheduler.schedulePeriodicSync()
      scheduler.enqueueImmediateSync()
    }
  }

  @JavascriptInterface
  fun syncCalendarState(statePayload: String?) {
    val payload = statePayload?.trim().orEmpty()
    if (payload.isEmpty()) {
      return
    }

    val config = configStore.loadConfig()
    if (config.serverUrl.isBlank() || config.syncKey.isBlank()) {
      return
    }

    scope.launch {
      activity.ensureCalendarSyncReady()
      if (!activity.isCalendarSyncReady()) {
        return@launch
      }

      syncEngine.applyStatePayload(payload)
    }
  }
}
