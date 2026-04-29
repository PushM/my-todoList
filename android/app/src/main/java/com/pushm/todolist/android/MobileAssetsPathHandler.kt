package com.pushm.todolist.android

import android.content.Context
import android.webkit.MimeTypeMap
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.InputStream

class MobileAssetsPathHandler(private val context: Context) : WebViewAssetLoader.PathHandler {
  override fun handle(path: String): WebResourceResponse? {
    val safePath = path.removePrefix("/").ifBlank { "index.html" }
    val assetPath = "mobile/$safePath"
    val mimeType = MimeTypeMap.getSingleton()
      .getMimeTypeFromExtension(assetPath.substringAfterLast('.', "html"))
      ?: when {
        assetPath.endsWith(".js") -> "application/javascript"
        assetPath.endsWith(".css") -> "text/css"
        assetPath.endsWith(".json") -> "application/json"
        else -> "text/html"
      }

    val inputStream: InputStream = try {
      context.assets.open(assetPath)
    } catch (_: Exception) {
      return null
    }

    return WebResourceResponse(mimeType, "utf-8", inputStream)
  }
}
