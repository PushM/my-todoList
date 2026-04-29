package com.pushm.todolist.android.sync

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

class TodoSyncEngine(
  private val context: Context,
  private val configStore: SyncConfigStore,
  private val calendarRepository: CalendarRepository,
  private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
  suspend fun syncFromServer(): Result<String> = withContext(ioDispatcher) {
    val config = configStore.loadConfig()
    if (config.serverUrl.isBlank() || config.syncKey.isBlank()) {
      return@withContext Result.failure(IllegalStateException("Missing sync config"))
    }

    if (!hasCalendarPermissions()) {
      return@withContext Result.failure(SecurityException("Missing calendar permission"))
    }

    val calendarId = config.selectedCalendarId ?: return@withContext Result.failure(
      IllegalStateException("Missing selected calendar")
    )

    val url = URL("${config.serverUrl.trimEnd('/')}/api/sync")
    val connection = (url.openConnection() as HttpURLConnection).apply {
      requestMethod = "GET"
      connectTimeout = 10000
      readTimeout = 10000
      setRequestProperty("x-sync-key", config.syncKey)
      setRequestProperty("x-device-name", "android-calendar-sync")
    }

    return@withContext try {
      val responseCode = connection.responseCode
      if (responseCode == HttpURLConnection.HTTP_NOT_FOUND) {
        configStore.saveLastSyncMessage("云端暂无数据")
        Result.success("云端暂无数据")
      } else if (responseCode !in 200..299) {
        Result.failure(IllegalStateException("Sync request failed: $responseCode"))
      } else {
        val payload = connection.inputStream.bufferedReader().use { it.readText() }
        val completedTasks = SyncStateParser.fromServerPayload(payload)
        val stats = calendarRepository.syncCompletedTasks(calendarId, completedTasks)
        val message = "已同步到系统日历：新增 ${stats.createdCount}，更新 ${stats.updatedCount}，删除 ${stats.deletedCount}"
        configStore.saveLastSyncMessage(message)
        Result.success(message)
      }
    } catch (error: Exception) {
      Result.failure(error)
    } finally {
      connection.disconnect()
    }
  }

  suspend fun applyStatePayload(payload: String): Result<String> = withContext(ioDispatcher) {
    if (!hasCalendarPermissions()) {
      return@withContext Result.failure(SecurityException("Missing calendar permission"))
    }

    val calendarId = configStore.getSelectedCalendarId() ?: return@withContext Result.failure(
      IllegalStateException("Missing selected calendar")
    )

    return@withContext try {
      val completedTasks = SyncStateParser.fromStatePayload(payload)
      val stats = calendarRepository.syncCompletedTasks(calendarId, completedTasks)
      val message = "已同步到系统日历：新增 ${stats.createdCount}，更新 ${stats.updatedCount}，删除 ${stats.deletedCount}"
      configStore.saveLastSyncMessage(message)
      Result.success(message)
    } catch (error: Exception) {
      Result.failure(error)
    }
  }

  private fun hasCalendarPermissions(): Boolean {
    return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED
  }
}
