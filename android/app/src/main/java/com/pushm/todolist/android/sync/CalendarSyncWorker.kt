package com.pushm.todolist.android.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class CalendarSyncWorker(
  appContext: Context,
  workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {
  override suspend fun doWork(): Result {
    val configStore = SyncConfigStore(applicationContext)
    val calendarRepository = CalendarRepository(applicationContext, configStore)
    val syncEngine = TodoSyncEngine(applicationContext, configStore, calendarRepository)

    return syncEngine.syncFromServer().fold(
      onSuccess = { Result.success() },
      onFailure = { error ->
        when (error) {
          is IllegalStateException, is SecurityException -> Result.success()
          else -> Result.retry()
        }
      }
    )
  }
}
