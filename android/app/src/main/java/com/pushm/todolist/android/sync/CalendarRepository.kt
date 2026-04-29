package com.pushm.todolist.android.sync

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.provider.CalendarContract
import java.time.ZoneId
import java.time.ZoneOffset

class CalendarRepository(
  private val context: Context,
  private val configStore: SyncConfigStore
) {
  private val resolver = context.contentResolver

  fun getAvailableCalendars(): List<DeviceCalendar> {
    val projection = arrayOf(
      CalendarContract.Calendars._ID,
      CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
      CalendarContract.Calendars.VISIBLE,
      CalendarContract.Calendars.SYNC_EVENTS
    )

    val calendars = mutableListOf<DeviceCalendar>()
    resolver.query(
      CalendarContract.Calendars.CONTENT_URI,
      projection,
      "${CalendarContract.Calendars.VISIBLE}=1",
      null,
      CalendarContract.Calendars.CALENDAR_DISPLAY_NAME
    )?.use { cursor ->
      val idIndex = cursor.getColumnIndexOrThrow(CalendarContract.Calendars._ID)
      val nameIndex = cursor.getColumnIndexOrThrow(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME)
      val syncEventsIndex = cursor.getColumnIndexOrThrow(CalendarContract.Calendars.SYNC_EVENTS)

      while (cursor.moveToNext()) {
        val syncEvents = cursor.getInt(syncEventsIndex)
        if (syncEvents == 0) {
          continue
        }

        calendars += DeviceCalendar(
          id = cursor.getLong(idIndex),
          displayName = cursor.getString(nameIndex).orEmpty()
        )
      }
    }

    return calendars
  }

  fun syncCompletedTasks(calendarId: Long, completedTasks: List<CompletedTask>): CalendarSyncStats {
    val mappings = configStore.loadTaskEventMappings()
    val activeTaskIds = completedTasks.mapTo(mutableSetOf()) { it.id }
    var createdCount = 0
    var updatedCount = 0
    var deletedCount = 0

    completedTasks.forEach { task ->
      val existingEventId = mappings[task.id]
      if (existingEventId != null) {
        val updatedRows = resolver.update(
          ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, existingEventId),
          buildEventValues(calendarId, task),
          null,
          null
        )

        if (updatedRows > 0) {
          updatedCount += 1
          return@forEach
        }
      }

      val insertedUri = resolver.insert(
        CalendarContract.Events.CONTENT_URI,
        buildEventValues(calendarId, task)
      )

      val insertedEventId = insertedUri?.lastPathSegment?.toLongOrNull()
      if (insertedEventId != null) {
        mappings[task.id] = insertedEventId
        createdCount += 1
      }
    }

    val staleTaskIds = mappings.keys.filter { it !in activeTaskIds }
    staleTaskIds.forEach { taskId ->
      val eventId = mappings[taskId] ?: return@forEach
      val deletedRows = resolver.delete(
        ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId),
        null,
        null
      )
      if (deletedRows > 0) {
        deletedCount += 1
      }
      mappings.remove(taskId)
    }

    configStore.saveTaskEventMappings(mappings)
    return CalendarSyncStats(
      createdCount = createdCount,
      updatedCount = updatedCount,
      deletedCount = deletedCount
    )
  }

  private fun buildEventValues(calendarId: Long, task: CompletedTask): ContentValues {
    val completedDate = task.completedAt.atZone(ZoneId.systemDefault()).toLocalDate()
    val start = completedDate.atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli()
    val end = completedDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli()

    return ContentValues().apply {
      put(CalendarContract.Events.CALENDAR_ID, calendarId)
      put(CalendarContract.Events.TITLE, task.title)
      put(CalendarContract.Events.DESCRIPTION, "来源: My TodoList\n任务ID: ${task.id}")
      put(CalendarContract.Events.DTSTART, start)
      put(CalendarContract.Events.DTEND, end)
      put(CalendarContract.Events.ALL_DAY, 1)
      put(CalendarContract.Events.EVENT_TIMEZONE, "UTC")
      put(CalendarContract.Events.HAS_ALARM, 0)
    }
  }
}
