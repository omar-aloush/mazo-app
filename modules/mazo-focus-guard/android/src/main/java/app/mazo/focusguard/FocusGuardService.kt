package app.mazo.focusguard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Foreground service that enforces a focus session. While running it polls the
 * current foreground app once a second; when a blocked package is in front it
 * draws a full-screen overlay (TYPE_APPLICATION_OVERLAY — works from the
 * background, unlike launching an Activity). The overlay is removed as soon as
 * the user leaves the blocked app. Auto-stops at `endsAt`.
 */
class FocusGuardService : Service() {
  companion object {
    const val ACTION_START = "app.mazo.focusguard.START"
    const val ACTION_STOP = "app.mazo.focusguard.STOP"
    const val EXTRA_PACKAGES = "packages"
    const val EXTRA_LABEL = "label"
    const val EXTRA_ENDS_AT = "endsAt"

    const val ACTION_START_NUDGE = "app.mazo.focusguard.START_NUDGE"
    const val ACTION_STOP_NUDGE = "app.mazo.focusguard.STOP_NUDGE"
    const val EXTRA_NUDGE_PACKAGES = "nudgePackages"
    const val EXTRA_NUDGE_THRESHOLD = "nudgeThresholdSec"
    const val EXTRA_NUDGE_SNOOZE = "nudgeSnoozeSec"
    const val EXTRA_NUDGE_CAP = "nudgeDailyCap"
    const val EXTRA_NUDGE_HEADLINE = "nudgeHeadline"
    const val EXTRA_NUDGE_MESSAGE = "nudgeMessage"
    const val EXTRA_NUDGE_APP = "mazo_nudge_app"

    /** Set when the user taps "Open Mazō" on a nudge; module reads + clears it. */
    @JvmStatic var pendingNudgeLaunchLabel: String? = null

    private const val CHANNEL_ID = "mazo-focus-guard"
    private const val NOTIF_ID = 7711
    private const val POLL_MS = 1000L

    // Living Garden palette (dark)
    private const val BG = "#141311"
    private const val INK = "#ECE7DC"
    private const val SAGE = "#8FB896"
    private const val SAGE_INK = "#9FC6A6"
    private const val MUTED = "#837C6D"
  }

  private val handler = Handler(Looper.getMainLooper())
  private var windowManager: WindowManager? = null
  private var usageStatsManager: UsageStatsManager? = null
  private var overlayView: View? = null
  private var countdownView: TextView? = null

  private var blocked: Set<String> = emptySet()
  private var label: String = "Focus session"
  private var endsAt: Long = 0L

  // Nudge mode (the angry-face guardian) — independent of block mode.
  private var watched: Set<String> = emptySet()
  private var nudgeThresholdMs: Long = 15 * 60_000L
  private var nudgeSnoozeMs: Long = 5 * 60_000L
  private var nudgeDailyCap: Int = 6
  private var nudgeHeadline: String = "Stop — you've got exams"
  private var nudgeMessageTemplate: String = "You've been on {app} for {n} min."
  private var nudgeEndsAt: Long = 0L
  private var continuousMs: Long = 0L
  private var lastWatchedPkg: String? = null
  private var snoozeUntil: Long = 0L
  private var nudgesShownToday: Int = 0
  private var nudgeDayStamp: Int = -1
  private var nudgeOverlay: View? = null

  private val poll = object : Runnable {
    override fun run() {
      try { checkForeground() } catch (_: Throwable) { /* keep polling */ }
      handler.postDelayed(this, POLL_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> { stopEverything(); return START_NOT_STICKY }
      ACTION_STOP_NUDGE -> {
        clearNudge()
        if (blocked.isEmpty()) { stopEverything(); return START_NOT_STICKY }
        ensureRunning(); return START_STICKY
      }
      ACTION_START_NUDGE -> {
        watched = intent.getStringArrayListExtra(EXTRA_NUDGE_PACKAGES)?.toSet() ?: emptySet()
        nudgeThresholdMs = intent.getIntExtra(EXTRA_NUDGE_THRESHOLD, 900).toLong() * 1000L
        nudgeSnoozeMs = intent.getIntExtra(EXTRA_NUDGE_SNOOZE, 300).toLong() * 1000L
        nudgeDailyCap = intent.getIntExtra(EXTRA_NUDGE_CAP, 6)
        nudgeHeadline = intent.getStringExtra(EXTRA_NUDGE_HEADLINE) ?: nudgeHeadline
        nudgeMessageTemplate = intent.getStringExtra(EXTRA_NUDGE_MESSAGE) ?: nudgeMessageTemplate
        nudgeEndsAt = intent.getLongExtra(EXTRA_ENDS_AT, 0L)
        continuousMs = 0L; lastWatchedPkg = null
        ensureRunning(); return START_STICKY
      }
    }

    // Default / ACTION_START — block-mode focus session.
    blocked = intent?.getStringArrayListExtra(EXTRA_PACKAGES)?.toSet() ?: emptySet()
    label = intent?.getStringExtra(EXTRA_LABEL) ?: "Focus session"
    endsAt = intent?.getLongExtra(EXTRA_ENDS_AT, 0L) ?: 0L
    ensureRunning()
    return START_STICKY
  }

  // ── Foreground detection ─────────────────────────────
  private fun checkForeground() {
    if (endsAt in 1..System.currentTimeMillis()) {
      stopEverything()
      return
    }
    val pkg = currentForegroundPackage() ?: return
    evaluateNudge(pkg)
    if (pkg == packageName) {
      hideOverlay()
      return
    }
    if (blocked.contains(pkg)) showOverlay() else hideOverlay()
  }

  private fun currentForegroundPackage(): String? {
    val usm = usageStatsManager ?: return null
    val now = System.currentTimeMillis()
    val events = usm.queryEvents(now - 10_000, now)
    val event = UsageEvents.Event()
    var last: String? = null
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
        last = event.packageName
      }
    }
    return last
  }

  private fun ensureRunning() {
    usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    startInForeground()
    handler.removeCallbacks(poll)
    handler.post(poll)
  }

  private fun clearNudge() {
    watched = emptySet(); continuousMs = 0L; lastWatchedPkg = null; nudgeEndsAt = 0L
    removeNudgeOverlay()
  }

  // ── Nudge (the angry-face guardian) ──────────────────
  private fun evaluateNudge(pkg: String) {
    if (watched.isEmpty()) return
    if (nudgeEndsAt in 1..System.currentTimeMillis()) {
      clearNudge()
      if (blocked.isEmpty()) stopEverything()
      return
    }
    rolloverNudgeDay()
    if (pkg != lastWatchedPkg) { continuousMs = 0L; lastWatchedPkg = pkg }
    if (!watched.contains(pkg)) { continuousMs = 0L; removeNudgeOverlay(); return }
    continuousMs += POLL_MS
    val now = System.currentTimeMillis()
    if (nudgeOverlay == null &&
      continuousMs >= nudgeThresholdMs &&
      now > snoozeUntil &&
      nudgesShownToday < nudgeDailyCap) {
      showNudgeOverlay(pkg)
    }
  }

  private fun rolloverNudgeDay() {
    val day = (System.currentTimeMillis() / 86_400_000L).toInt()
    if (day != nudgeDayStamp) { nudgeDayStamp = day; nudgesShownToday = 0 }
  }

  private fun showNudgeOverlay(pkg: String) {
    nudgesShownToday++
    val minutes = (continuousMs / 60000L).toInt()
    val appLabel = labelFor(pkg)
    val msg = nudgeMessageTemplate.replace("{app}", appLabel).replace("{n}", minutes.toString())

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#8C141311")) // ~55% scrim
      setPadding(dp(28), dp(28), dp(28), dp(28))
    }
    val face = MazoFaceView(this).apply { startShake() }
    root.addView(face, LinearLayout.LayoutParams(dp(120), dp(120)))

    val title = TextView(this).apply {
      text = nudgeHeadline; setTextColor(Color.parseColor(INK)); textSize = 23f
      gravity = Gravity.CENTER; setPadding(0, dp(18), 0, dp(8))
    }
    val body = TextView(this).apply {
      text = msg; setTextColor(Color.parseColor(SAGE_INK)); textSize = 15f
      gravity = Gravity.CENTER; setPadding(dp(8), 0, dp(8), dp(22))
    }
    val open = Button(this).apply {
      text = "Open Mazō & make a plan"
      setOnClickListener { face.stopShake(); openMazoFromNudge(appLabel) }
    }
    val snooze = TextView(this).apply {
      text = "5 more minutes"; setTextColor(Color.parseColor(MUTED)); textSize = 14f
      gravity = Gravity.CENTER; setPadding(0, dp(18), 0, 0)
      setOnClickListener {
        snoozeUntil = System.currentTimeMillis() + nudgeSnoozeMs
        continuousMs = 0L; face.stopShake(); removeNudgeOverlay()
      }
    }
    root.addView(title); root.addView(body); root.addView(open); root.addView(snooze)

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      type,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    )
    try { windowManager?.addView(root, params); nudgeOverlay = root } catch (_: Throwable) {}
  }

  private fun removeNudgeOverlay() {
    val v = nudgeOverlay ?: return
    try { windowManager?.removeView(v) } catch (_: Throwable) {}
    nudgeOverlay = null
  }

  private fun labelFor(pkg: String): String = try {
    val pm = packageManager
    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
  } catch (_: Throwable) { "this app" }

  private fun openMazoFromNudge(appLabel: String) {
    pendingNudgeLaunchLabel = appLabel
    removeNudgeOverlay()
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      putExtra(EXTRA_NUDGE_APP, appLabel)
    }
    try { if (launch != null) startActivity(launch) } catch (_: Throwable) {}
  }

  // ── Overlay ──────────────────────────────────────────
  private fun showOverlay() {
    updateCountdown()
    if (overlayView != null) return

    val view = buildOverlayView()
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      type,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      PixelFormat.OPAQUE
    )
    try {
      windowManager?.addView(view, params)
      overlayView = view
    } catch (_: Throwable) {
      // Overlay permission revoked mid-session — nothing we can do, fail quiet.
    }
  }

  private fun hideOverlay() {
    val v = overlayView ?: return
    try { windowManager?.removeView(v) } catch (_: Throwable) {}
    overlayView = null
    countdownView = null
  }

  private fun buildOverlayView(): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor(BG))
      setPadding(dp(32), dp(32), dp(32), dp(32))
    }

    val emoji = TextView(this).apply {
      text = "🌱" // 🌱
      textSize = 44f
      gravity = Gravity.CENTER
    }
    val title = TextView(this).apply {
      text = "Stay in your session"
      setTextColor(Color.parseColor(INK))
      textSize = 26f
      gravity = Gravity.CENTER
      setPadding(0, dp(20), 0, dp(8))
    }
    val subtitle = TextView(this).apply {
      text = label
      setTextColor(Color.parseColor(SAGE_INK))
      textSize = 15f
      gravity = Gravity.CENTER
    }
    val counter = TextView(this).apply {
      setTextColor(Color.parseColor(SAGE))
      textSize = 38f
      gravity = Gravity.CENTER
      setPadding(0, dp(24), 0, dp(28))
    }
    countdownView = counter

    val back = Button(this).apply {
      text = "Back to focus"
      setOnClickListener { goHome() }
    }
    val openApp = TextView(this).apply {
      text = "Open Mazō to end early"
      setTextColor(Color.parseColor(MUTED))
      textSize = 14f
      gravity = Gravity.CENTER
      setPadding(0, dp(22), 0, 0)
      setOnClickListener { openMazo() }
    }

    root.addView(emoji)
    root.addView(title)
    root.addView(subtitle)
    root.addView(counter)
    root.addView(back)
    root.addView(openApp)
    updateCountdownOn(counter)
    return root
  }

  private fun updateCountdown() {
    countdownView?.let { updateCountdownOn(it) }
  }

  private fun updateCountdownOn(tv: TextView) {
    if (endsAt <= 0L) { tv.text = ""; return }
    val remainingSec = ((endsAt - System.currentTimeMillis()) / 1000).coerceAtLeast(0)
    val m = remainingSec / 60
    val s = remainingSec % 60
    tv.text = String.format("%02d:%02d left", m, s)
  }

  private fun goHome() {
    hideOverlay()
    val home = Intent(Intent.ACTION_MAIN).apply {
      addCategory(Intent.CATEGORY_HOME)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    try { startActivity(home) } catch (_: Throwable) {}
  }

  private fun openMazo() {
    hideOverlay()
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    try { if (launch != null) startActivity(launch) } catch (_: Throwable) {}
  }

  // ── Lifecycle ────────────────────────────────────────
  private fun startInForeground() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

  private fun buildNotification(): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Focus Guardian",
        NotificationManager.IMPORTANCE_LOW
      )
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.createNotificationChannel(channel)
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setContentTitle("Focus Guardian active")
      .setContentText("Protecting your focus session")
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setOngoing(true)
      .build()
  }

  private fun stopEverything() {
    handler.removeCallbacks(poll)
    hideOverlay()
    removeNudgeOverlay()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(Service.STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    stopSelf()
  }

  override fun onDestroy() {
    handler.removeCallbacks(poll)
    hideOverlay()
    removeNudgeOverlay()
    super.onDestroy()
  }

  private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()
}
