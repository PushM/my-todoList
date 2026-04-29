package com.pushm.todolist.android.sync

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

data class SyncConfig(
  val serverUrl: String,
  val syncKey: String,
  val selectedCalendarId: Long? = null
)

data class CompletedTask(
  val id: String,
  val title: String,
  val completedAt: Instant
)

data class DeviceCalendar(
  val id: Long,
  val displayName: String
)

data class CalendarSyncStats(
  val createdCount: Int,
  val updatedCount: Int,
  val deletedCount: Int
)

object SyncStateParser {
  fun fromServerPayload(payload: String): List<CompletedTask> {
    val root = JSONObject(payload)
    return fromStateObject(root.optJSONObject("state") ?: JSONObject())
  }

  fun fromStatePayload(payload: String): List<CompletedTask> {
    return fromStateObject(JSONObject(payload))
  }

  private fun fromStateObject(state: JSONObject): List<CompletedTask> {
    val tasksArray = state.optJSONArray("tasks") ?: JSONArray()
    val completedTasks = mutableListOf<CompletedTask>()

    for (index in 0 until tasksArray.length()) {
      val item = tasksArray.optJSONObject(index) ?: continue
      if (!item.optBoolean("completed", false)) {
        continue
      }

      val taskId = item.optString("id").trim()
      val title = item.optString("title").trim()
      val completedAtRaw = item.optString("completedAt").trim()
      if (taskId.isEmpty() || title.isEmpty() || completedAtRaw.isEmpty()) {
        continue
      }

      val completedAt = runCatching { Instant.parse(completedAtRaw) }.getOrNull() ?: continue
      completedTasks += CompletedTask(
        id = taskId,
        title = title,
        completedAt = completedAt
      )
    }

    return completedTasks
  }
}
