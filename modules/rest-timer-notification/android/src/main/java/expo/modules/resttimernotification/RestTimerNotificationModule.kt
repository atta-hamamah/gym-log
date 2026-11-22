package expo.modules.resttimernotification

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHANNEL_ID = "rest-timer-live"
private const val NOTIFICATION_ID = 7341

/**
 * The rest countdown as an ongoing notification. Android draws the countdown
 * itself (a chronometer counting down to the end time), so it keeps ticking
 * while the app is in the background or killed, and removes itself when rest
 * ends. The alarm at the end is a separate scheduled notification (JS side).
 */
class RestTimerNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("RestTimerNotification")

    /** Shows or updates the countdown. Returns false when notifications are off or rest already ended. */
    Function("show") { endAtMs: Double, title: String, body: String, channelName: String ->
      show(endAtMs.toLong(), title, body, channelName)
    }

    Function("dismiss") {
      manager().cancel(NOTIFICATION_ID)
    }
  }

  private fun manager() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun show(endAt: Long, title: String, body: String, channelName: String): Boolean {
    val nm = manager()
    val remaining = endAt - System.currentTimeMillis()
    if (remaining <= 0 || !nm.areNotificationsEnabled()) {
      nm.cancel(NOTIFICATION_ID)
      return false
    }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // Silent channel: the countdown is information, the end alarm makes the noise.
      val channel = NotificationChannel(CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_DEFAULT).apply {
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
      }
      nm.createNotificationChannel(channel)
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context).setPriority(Notification.PRIORITY_DEFAULT)
    }

    builder
      .setSmallIcon(smallIcon())
      .setContentTitle(title)
      .setContentText(body)
      .setWhen(endAt)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
    launchIntent()?.let { builder.setContentIntent(it) }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) builder.setTimeoutAfter(remaining)
    if (Build.VERSION.SDK_INT >= 36) requestPromotion(builder)

    nm.notify(NOTIFICATION_ID, builder.build())
    return true
  }

  /** Android 16 "Live Updates": the countdown can also show as a chip in the status bar. */
  private fun requestPromotion(builder: Notification.Builder) {
    try {
      builder.javaClass
        .getMethod("setRequestPromotedOngoing", Boolean::class.javaPrimitiveType)
        .invoke(builder, true)
    } catch (_: Exception) {
      // Not available on this Android build: a normal ongoing notification is fine.
    }
  }

  /** The monochrome icon expo-notifications generates from app.json, else the app icon. */
  private fun smallIcon(): Int {
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else context.applicationInfo.icon
  }

  /** Tapping the notification brings the app back where the user left it. */
  private fun launchIntent(): PendingIntent? {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    return PendingIntent.getActivity(
      context,
      NOTIFICATION_ID,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
