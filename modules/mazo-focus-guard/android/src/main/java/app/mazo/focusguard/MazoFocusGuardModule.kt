package app.mazo.focusguard

import android.app.AppOpsManager
import android.appwidget.AppWidgetManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.app.Activity
import android.provider.DocumentsContract
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS-facing bridge. Permission checks open the relevant system settings screen
 * (these are special-access grants, not runtime permissions). start/stop just
 * hand off to [FocusGuardService], which owns the polling + overlay.
 */
class MazoFocusGuardModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context unavailable")

  /** Pending promise for the SAF folder-tree picker (resolved in OnActivityResult). */
  private var pendingFolderPromise: Promise? = null

  companion object {
    private const val REQ_PICK_TREE = 7321
  }

  override fun definition() = ModuleDefinition {
    Name("MazoFocusGuard")

    Function("hasUsageAccess") { hasUsageAccess() }

    Function("openUsageAccessSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
    }

    Function("hasOverlayPermission") { Settings.canDrawOverlays(context) }

    Function("requestOverlayPermission") {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
      ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
      context.startActivity(intent)
    }

    Function("startGuard") { blockedPackages: List<String>, sessionLabel: String, endsAtEpochMs: Double ->
      val intent = Intent(context, FocusGuardService::class.java).apply {
        action = FocusGuardService.ACTION_START
        putStringArrayListExtra(FocusGuardService.EXTRA_PACKAGES, ArrayList(blockedPackages))
        putExtra(FocusGuardService.EXTRA_LABEL, sessionLabel)
        putExtra(FocusGuardService.EXTRA_ENDS_AT, endsAtEpochMs.toLong())
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    Function("stopGuard") {
      val intent = Intent(context, FocusGuardService::class.java).apply {
        action = FocusGuardService.ACTION_STOP
      }
      context.startService(intent)
    }

    // ── Apps & usage (powers reliable "open <app>" + usage-based coaching) ──

    Function("getInstalledApps") { installedApps() }

    Function("launchApp") { packageName: String ->
      val launch = context.packageManager.getLaunchIntentForPackage(packageName)
      if (launch != null) {
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(launch)
        true
      } else {
        false
      }
    }

    Function("getUsageStats") { daysBack: Int -> usageStats(daysBack) }

    Function("getDistractionByHour") { daysBack: Int, packages: List<String> ->
      distractionByHour(daysBack, packages)
    }

    // ── Guardian nudge (the angry-face soft overlay) ──

    Function("startNudge") { packages: List<String>, thresholdSeconds: Int, snoozeSeconds: Int, dailyCap: Int, headline: String, message: String, endsAtEpochMs: Double ->
      val intent = Intent(context, FocusGuardService::class.java).apply {
        action = FocusGuardService.ACTION_START_NUDGE
        putStringArrayListExtra(FocusGuardService.EXTRA_NUDGE_PACKAGES, ArrayList(packages))
        putExtra(FocusGuardService.EXTRA_NUDGE_THRESHOLD, thresholdSeconds)
        putExtra(FocusGuardService.EXTRA_NUDGE_SNOOZE, snoozeSeconds)
        putExtra(FocusGuardService.EXTRA_NUDGE_CAP, dailyCap)
        putExtra(FocusGuardService.EXTRA_NUDGE_HEADLINE, headline)
        putExtra(FocusGuardService.EXTRA_NUDGE_MESSAGE, message)
        putExtra(FocusGuardService.EXTRA_ENDS_AT, endsAtEpochMs.toLong())
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    Function("stopNudge") {
      val intent = Intent(context, FocusGuardService::class.java).apply {
        action = FocusGuardService.ACTION_STOP_NUDGE
      }
      context.startService(intent)
    }

    Function("consumeNudgeLaunch") {
      val label = FocusGuardService.pendingNudgeLaunchLabel
      FocusGuardService.pendingNudgeLaunchLabel = null
      label
    }

    // ── Home-screen widget bridge (writes the prefs the widget reads + refreshes it) ──

    Function("setWidgetData") { json: String ->
      val prefs = context.getSharedPreferences("mazo_widget_prefs", Context.MODE_PRIVATE)
      prefs.edit().putString("mazo_widget_data", json).apply()
      try {
        val mgr = AppWidgetManager.getInstance(context)
        val comp = ComponentName(context.packageName, "${context.packageName}.widget.MazoWidgetProvider")
        val ids = mgr.getAppWidgetIds(comp)
        if (ids != null && ids.isNotEmpty()) {
          val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
            component = comp
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
          }
          context.sendBroadcast(intent)
        }
      } catch (_: Throwable) { }
    }

    // ── Document Finder (SAF folder grant + on-device text index) ──

    OnActivityResult { _, payload ->
      if (payload.requestCode == REQ_PICK_TREE) {
        val promise = pendingFolderPromise
        pendingFolderPromise = null
        val uri = payload.data?.data
        if (payload.resultCode == Activity.RESULT_OK && uri != null) {
          try {
            context.contentResolver.takePersistableUriPermission(
              uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
          } catch (_: Throwable) { }
          promise?.resolve(uri.toString())
        } else {
          promise?.resolve(null)
        }
      }
    }

    /** Launch the system folder picker; resolves with the granted tree URI or null. */
    AsyncFunction("pickDocsFolder") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      pendingFolderPromise = promise
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(
          Intent.FLAG_GRANT_READ_URI_PERMISSION or
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        )
      }
      activity.startActivityForResult(intent, REQ_PICK_TREE)
    }

    /** Recursively list non-directory files inside a granted folder tree. */
    AsyncFunction("listDocsInTree") { treeUri: String -> listTree(treeUri) }

    /** Read up to `maxBytes` of UTF-8 text from a document URI. "" on failure. */
    AsyncFunction("readDocText") { uriStr: String, maxBytes: Int -> readDocText(uriStr, maxBytes) }

    /** Open a document in the user's default app for its type. */
    Function("openDocument") { uriStr: String -> openDoc(uriStr) }
  }

  // ── Document Finder helpers ──────────────────────────────────────────────

  /** Flatten a granted folder tree into non-directory file descriptors. */
  private fun listTree(treeUriStr: String): List<Map<String, Any>> {
    val out = ArrayList<Map<String, Any>>()
    try {
      val treeUri = Uri.parse(treeUriStr)
      val rootId = DocumentsContract.getTreeDocumentId(treeUri)
      walkTree(treeUri, rootId, out, 0)
    } catch (_: Throwable) { }
    return out
  }

  private fun walkTree(treeUri: Uri, parentDocId: String, out: MutableList<Map<String, Any>>, depth: Int) {
    if (depth > 8 || out.size > 5000) return
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocId)
    val proj = arrayOf(
      DocumentsContract.Document.COLUMN_DOCUMENT_ID,
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE,
      DocumentsContract.Document.COLUMN_SIZE,
      DocumentsContract.Document.COLUMN_LAST_MODIFIED
    )
    context.contentResolver.query(childrenUri, proj, null, null, null)?.use { c ->
      while (c.moveToNext()) {
        val docId = c.getString(0) ?: continue
        val name = c.getString(1) ?: continue
        val mime = c.getString(2) ?: ""
        val size = if (c.isNull(3)) 0L else c.getLong(3)
        val modified = if (c.isNull(4)) 0L else c.getLong(4)
        if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
          walkTree(treeUri, docId, out, depth + 1)
        } else {
          val docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId)
          out.add(
            mapOf(
              "uri" to docUri.toString(),
              "name" to name,
              "mime" to mime,
              "size" to size.toDouble(),
              "modified" to modified.toDouble()
            )
          )
        }
      }
    }
  }

  private fun readDocText(uriStr: String, maxBytes: Int): String {
    return try {
      val uri = Uri.parse(uriStr)
      context.contentResolver.openInputStream(uri)?.use { ins ->
        val cap = if (maxBytes <= 0) 1_000_000 else maxBytes
        val buf = ByteArray(cap)
        var total = 0
        while (total < cap) {
          val r = ins.read(buf, total, cap - total)
          if (r <= 0) break
          total += r
        }
        String(buf, 0, total, Charsets.UTF_8)
      } ?: ""
    } catch (_: Throwable) {
      ""
    }
  }

  private fun openDoc(uriStr: String): Boolean {
    return try {
      val uri = Uri.parse(uriStr)
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, context.contentResolver.getType(uri) ?: "*/*")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      true
    } catch (_: Throwable) {
      false
    }
  }

  /** Opens-per-hour-of-day (0..23) for the given packages over the last `daysBack` days. */
  private fun distractionByHour(daysBack: Int, packages: List<String>): List<Int> {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    val start = end - daysBack.coerceAtLeast(1).toLong() * 24L * 60L * 60L * 1000L
    val wanted = packages.toHashSet()
    val buckets = IntArray(24)
    val events = usm.queryEvents(start, end)
    val event = UsageEvents.Event()
    val cal = java.util.Calendar.getInstance()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND &&
        (wanted.isEmpty() || wanted.contains(event.packageName))
      ) {
        cal.timeInMillis = event.timeStamp
        buckets[cal.get(java.util.Calendar.HOUR_OF_DAY)]++
      }
    }
    return buckets.toList()
  }

  private fun installedApps(): List<Map<String, String>> {
    val pm = context.packageManager
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val resolved = pm.queryIntentActivities(intent, 0)
    val seen = HashSet<String>()
    val out = ArrayList<Map<String, String>>()
    for (ri in resolved) {
      val pkg = ri.activityInfo?.packageName ?: continue
      if (pkg == context.packageName) continue
      if (!seen.add(pkg)) continue
      val label = ri.loadLabel(pm)?.toString() ?: pkg
      out.add(mapOf("packageName" to pkg, "label" to label))
    }
    return out
  }

  private fun usageStats(daysBack: Int): List<Map<String, Any>> {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    val start = end - daysBack.coerceAtLeast(1).toLong() * 24L * 60L * 60L * 1000L
    val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, start, end) ?: emptyList()
    val totals = HashMap<String, Long>()
    for (s in stats) {
      if (s.totalTimeInForeground <= 0L) continue
      totals[s.packageName] = (totals[s.packageName] ?: 0L) + s.totalTimeInForeground
    }
    val pm = context.packageManager
    return totals.entries
      .asSequence()
      .filter { it.key != context.packageName }
      .sortedByDescending { it.value }
      .take(15)
      .map { e ->
        val label = try {
          pm.getApplicationLabel(pm.getApplicationInfo(e.key, 0)).toString()
        } catch (_: Throwable) {
          e.key
        }
        mapOf("packageName" to e.key, "label" to label, "totalMs" to e.value.toDouble())
      }
      .toList()
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }
}
