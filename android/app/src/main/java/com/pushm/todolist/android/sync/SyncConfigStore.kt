package com.pushm.todolist.android.sync

import android.content.Context
import org.json.JSONObject

class SyncConfigStore(context: Context) {
  private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun loadConfig(): SyncConfig {
    return SyncConfig(
      serverUrl = prefs.getString(KEY_SERVER_URL, "")?.trim().orEmpty(),
      syncKey = prefs.getString(KEY_SYNC_KEY, "")?.trim().orEmpty(),
      selectedCalendarId = prefs.takeIf { it.contains(KEY_SELECTED_CALENDAR_ID) }?.getLong(KEY_SELECTED_CALENDAR_ID, -1L)
        ?.takeIf { it >= 0L }
    )
  }

  fun saveConfig(serverUrl: String, syncKey: String) {
    prefs.edit()
      .putString(KEY_SERVER_URL, serverUrl.trim())
      .putString(KEY_SYNC_KEY, syncKey.trim())
      .apply()
  }

  fun buildBootstrapConfig(): String {
    val config = loadConfig()
    return JSONObject()
      .put("serverUrl", config.serverUrl)
      .put("syncKey", config.syncKey)
      .toString()
  }

  fun saveSelectedCalendar(calendar: DeviceCalendar) {
    prefs.edit()
      .putLong(KEY_SELECTED_CALENDAR_ID, calendar.id)
      .putString(KEY_SELECTED_CALENDAR_NAME, calendar.displayName)
      .apply()
  }

  fun getSelectedCalendarId(): Long? {
    return prefs.takeIf { it.contains(KEY_SELECTED_CALENDAR_ID) }
      ?.getLong(KEY_SELECTED_CALENDAR_ID, -1L)
      ?.takeIf { it >= 0L }
  }

  fun getSelectedCalendarName(): String? {
    return prefs.getString(KEY_SELECTED_CALENDAR_NAME, null)
  }

  fun saveTaskEventMappings(mappings: Map<String, Long>) {
    val payload = JSONObject()
    mappings.forEach { (taskId, eventId) ->
      payload.put(taskId, eventId)
    }
    prefs.edit().putString(KEY_TASK_EVENT_MAPPINGS, payload.toString()).apply()
  }

  fun loadTaskEventMappings(): MutableMap<String, Long> {
    val raw = prefs.getString(KEY_TASK_EVENT_MAPPINGS, null) ?: return mutableMapOf()
    val json = runCatching { JSONObject(raw) }.getOrNull() ?: return mutableMapOf()
    val mappings = mutableMapOf<String, Long>()
    val keys = json.keys()
    while (keys.hasNext()) {
      val taskId = keys.next()
      val eventId = json.optLong(taskId, -1L)
      if (eventId >= 0L) {
        mappings[taskId] = eventId
      }
    }
    return mappings
  }

  fun saveLastSyncMessage(message: String) {
    prefs.edit().putString(KEY_LAST_SYNC_MESSAGE, message).apply()
  }

  companion object {
    private const val PREFS_NAME = "todo-android-sync"
    private const val KEY_SERVER_URL = "server_url"
    private const val KEY_SYNC_KEY = "sync_key"
    private const val KEY_SELECTED_CALENDAR_ID = "selected_calendar_id"
    private const val KEY_SELECTED_CALENDAR_NAME = "selected_calendar_name"
    private const val KEY_TASK_EVENT_MAPPINGS = "task_event_mappings"
    private const val KEY_LAST_SYNC_MESSAGE = "last_sync_message"
  }
}
