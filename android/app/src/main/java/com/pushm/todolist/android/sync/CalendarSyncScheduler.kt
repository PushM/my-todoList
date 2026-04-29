package com.pushm.todolist.android.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class CalendarSyncScheduler(private val context: Context) {
  private val workManager = WorkManager.getInstance(context)

  fun schedulePeriodicSync() {
    val request = PeriodicWorkRequestBuilder<CalendarSyncWorker>(15, TimeUnit.MINUTES)
      .setConstraints(
        Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .build()
      )
      .build()

    workManager.enqueueUniquePeriodicWork(
      PERIODIC_WORK_NAME,
      ExistingPeriodicWorkPolicy.UPDATE,
      request
    )
  }

  fun enqueueImmediateSync() {
    val request = OneTimeWorkRequestBuilder<CalendarSyncWorker>()
      .setConstraints(
        Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .build()
      )
      .build()

    workManager.enqueueUniqueWork(
      IMMEDIATE_WORK_NAME,
      ExistingWorkPolicy.REPLACE,
      request
    )
  }

  companion object {
    private const val PERIODIC_WORK_NAME = "calendar-sync-periodic"
    private const val IMMEDIATE_WORK_NAME = "calendar-sync-now"
  }
}
