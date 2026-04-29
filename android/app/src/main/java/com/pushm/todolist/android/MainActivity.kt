package com.pushm.todolist.android

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.pushm.todolist.android.databinding.ActivityMainBinding
import com.pushm.todolist.android.sync.CalendarRepository
import com.pushm.todolist.android.sync.CalendarSyncScheduler
import com.pushm.todolist.android.sync.DeviceCalendar
import com.pushm.todolist.android.sync.SyncConfigStore
import com.pushm.todolist.android.sync.TodoSyncEngine

class MainActivity : AppCompatActivity() {
  private lateinit var binding: ActivityMainBinding
  private lateinit var configStore: SyncConfigStore
  private lateinit var calendarRepository: CalendarRepository
  private lateinit var scheduler: CalendarSyncScheduler
  private lateinit var syncEngine: TodoSyncEngine

  private val calendarPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions()
  ) { permissions ->
    val granted = permissions[Manifest.permission.READ_CALENDAR] == true &&
      permissions[Manifest.permission.WRITE_CALENDAR] == true

    if (!granted) {
      Toast.makeText(this, getString(R.string.calendar_permission_denied), Toast.LENGTH_LONG).show()
      return@registerForActivityResult
    }

    ensureCalendarTargetSelected {
      Toast.makeText(this, getString(R.string.calendar_sync_ready), Toast.LENGTH_SHORT).show()
      scheduler.schedulePeriodicSync()
      scheduler.enqueueImmediateSync()
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    binding = ActivityMainBinding.inflate(layoutInflater)
    setContentView(binding.root)

    configStore = SyncConfigStore(this)
    calendarRepository = CalendarRepository(this, configStore)
    scheduler = CalendarSyncScheduler(this)
    syncEngine = TodoSyncEngine(this, configStore, calendarRepository)

    configureWebView(binding.webView)
    binding.webView.loadUrl("https://appassets.androidplatform.net/mobile/index.html")

    if (configStore.loadConfig().syncKey.isNotBlank()) {
      ensureCalendarSyncReady()
    }
  }

  fun ensureCalendarSyncReady() {
    if (!hasCalendarPermissions()) {
      calendarPermissionLauncher.launch(
        arrayOf(
          Manifest.permission.READ_CALENDAR,
          Manifest.permission.WRITE_CALENDAR
        )
      )
      return
    }

    ensureCalendarTargetSelected {
      scheduler.schedulePeriodicSync()
    }
  }

  fun isCalendarSyncReady(): Boolean {
    return hasCalendarPermissions() && configStore.getSelectedCalendarId() != null
  }

  private fun configureWebView(webView: WebView) {
    val assetLoader = WebViewAssetLoader.Builder()
      .addPathHandler("/mobile/", MobileAssetsPathHandler(this))
      .build()

    webView.settings.javaScriptEnabled = true
    webView.settings.domStorageEnabled = true
    webView.settings.allowFileAccess = false
    webView.settings.allowContentAccess = false
    webView.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
    webView.webChromeClient = WebChromeClient()
    webView.webViewClient = object : WebViewClientCompat() {
      override fun shouldInterceptRequest(view: WebView, request: android.webkit.WebResourceRequest) =
        assetLoader.shouldInterceptRequest(request.url)
    }
    webView.addJavascriptInterface(
      TodoBridge(this, configStore, scheduler, syncEngine),
      "AndroidTodoBridge"
    )
  }

  private fun hasCalendarPermissions(): Boolean {
    return checkSelfPermission(Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED &&
      checkSelfPermission(Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED
  }

  private fun ensureCalendarTargetSelected(onReady: () -> Unit = {}) {
    val savedCalendarId = configStore.getSelectedCalendarId()
    val calendars = calendarRepository.getAvailableCalendars()

    if (calendars.isEmpty()) {
      Toast.makeText(this, getString(R.string.calendar_sync_missing_target), Toast.LENGTH_LONG).show()
      return
    }

    if (savedCalendarId != null && calendars.any { it.id == savedCalendarId }) {
      onReady()
      return
    }

    if (calendars.size == 1) {
      configStore.saveSelectedCalendar(calendars.first())
      onReady()
      return
    }

    showCalendarPicker(calendars, onReady)
  }

  private fun showCalendarPicker(calendars: List<DeviceCalendar>, onReady: () -> Unit) {
    val labels = calendars.map { it.displayName }.toTypedArray()
    AlertDialog.Builder(this)
      .setTitle(R.string.calendar_select_title)
      .setItems(labels) { _, which ->
        configStore.saveSelectedCalendar(calendars[which])
        onReady()
      }
      .setCancelable(true)
      .show()
  }
}
