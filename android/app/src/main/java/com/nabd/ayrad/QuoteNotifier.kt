package com.nabd.ayrad

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.util.Locale
import kotlin.math.abs

internal object QuoteNotifier {
    fun notify(context: Context, previous: Double, current: Double, change: Double) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "تنبيهات سعر AYRD", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "إشعار عند رصد تغير بين فحصين ناجحين"
            }
        )
        val direction = if (change > 0) "ارتفاع" else "انخفاض"
        val delta = String.format(Locale.ROOT, "%.2f", abs(change))
        val text = "$direction بمقدار $delta دج؛ من ${String.format(Locale.ROOT, "%.2f", previous)} إلى ${String.format(Locale.ROOT, "%.2f", current)} دج"
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("محفظتي · رُصد $direction في AYRD")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText("$text. هذا تغير مرصود بين فحصين، وليس بالضرورة تغير جلسة التداول."))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true).build()
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
    }
    private const val CHANNEL_ID = "ayrd-price-changes"
    private const val NOTIFICATION_ID = 4201
}
