package com.nabd.ayrad

import android.Manifest
import android.app.Activity
import android.content.res.ColorStateList
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.core.view.WindowCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var priceText: TextView
    private lateinit var typeText: TextView
    private lateinit var movementText: TextView
    private lateinit var sessionText: TextView
    private lateinit var checkedText: TextView
    private lateinit var statusText: TextView
    private lateinit var historyText: TextView
    private lateinit var openingText: TextView
    private lateinit var closingText: TextView
    private lateinit var observationsCount: TextView
    private lateinit var sparkline: SparklineView
    private lateinit var alertSwitch: Switch
    private var pendingAlertPermission = false

    private lateinit var screenScroll: ScrollView
    private val navEntries = mutableListOf<LinearLayout>()
    private val forest = 0xFF09090C.toInt()
    private val green = 0xFF43C77B.toInt()
    private val purple = 0xFF8B5CF6.toInt()
    private val ink = 0xFFF5F2FA.toInt()
    private val muted = 0xFFA19BA9.toInt()
    private val pageColor = 0xFF0B0B0E.toInt()
    private val white = Color.WHITE
    private val darkInk = 0xFF211A2B.toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = pageColor
        window.navigationBarColor = pageColor
        window.decorView.systemUiVisibility = 0
        buildScreen()
        loadSavedData()
        if (QuoteStorage.alertsEnabled(this)) AlertScheduler.enable(this)
        refreshQuote()
    }

    private fun buildScreen() {
        val root = vertical().apply { setBackgroundColor(pageColor) }
        val page = vertical().apply {
            setPadding(dp(18), dp(14), dp(18), dp(24))
            setBackgroundColor(pageColor)
        }
        screenScroll = ScrollView(this).apply { clipToPadding = false; addView(page) }

        val header = horizontal().apply { gravity = Gravity.CENTER_VERTICAL }
        val brandMark = ImageView(this).apply {
            setImageResource(R.drawable.nabd_logo)
            contentDescription = "شعار نبض أيراد"
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        header.addView(brandMark, LinearLayout.LayoutParams(dp(42), dp(42)))
        val headerCopy = vertical().apply {
            addView(text("نبض أيراد", 18, ink, true))
            addView(text("متابعة سهم AYRADE · AYRD", 10, muted))
        }
        header.addView(headerCopy, LinearLayout.LayoutParams(0, -2, 1f).apply { marginStart = dp(10) })
        header.addView(text("●  بورصة الجزائر", 10, green, true).apply {
            background = rounded(0xFFE5F1E8.toInt(), 18)
            setPadding(dp(9), dp(6), dp(9), dp(6))
        })
        page.addView(header, marginParams(bottom = 20))

        page.addView(text("قائمة المتابعة  ·  تفاصيل السهم", 10, muted), marginParams(bottom = 4))
        page.addView(text("سعر AYRD", 21, ink, true), marginParams(bottom = 10))

        val quoteCard = vertical().apply {
            setPadding(dp(18), dp(17), dp(18), dp(16))
            background = purpleGradient()
            elevation = dp(7).toFloat()
        }
        page.addView(quoteCard, marginParams(bottom = 13))

        val quoteHeader = horizontal().apply { gravity = Gravity.CENTER_VERTICAL }
        val companyMark = text("أ", 16, 0xFFB8EBC8.toInt(), true).apply {
            gravity = Gravity.CENTER
            background = rounded(0xFF7448D4.toInt(), 11)
        }
        quoteHeader.addView(companyMark, LinearLayout.LayoutParams(dp(36), dp(36)))
        val companyCopy = vertical().apply {
            addView(text("أيراد  AYRADE", 13, white, true))
            addView(text("الرمز AYRD  ·  DZD", 9, 0xFFE5DAFA.toInt()))
        }
        quoteHeader.addView(companyCopy, LinearLayout.LayoutParams(0, -2, 1f).apply { marginStart = dp(9) })
        quoteHeader.addView(text("●  منشور", 9, 0xFFBFE8CC.toInt(), true).apply {
            background = rounded(0xFF7448D4.toInt(), 16)
            setPadding(dp(8), dp(5), dp(8), dp(5))
        })
        quoteCard.addView(quoteHeader)

        quoteCard.addView(text("آخر سعر متاح", 10, 0xFFE3D8F7.toInt()).apply { setPadding(0, dp(19), 0, 0) })
        val priceRow = horizontal().apply { gravity = Gravity.CENTER_VERTICAL }
        priceText = text("—", 42, white, true).apply {
            textDirection = View.TEXT_DIRECTION_LTR
            gravity = Gravity.RIGHT or Gravity.CENTER_VERTICAL
            letterSpacing = -.035f
        }
        priceRow.addView(priceText, LinearLayout.LayoutParams(0, -2, 1f))
        priceRow.addView(text("دج", 14, 0xFFE8DFFF.toInt(), true).apply { setPadding(dp(7), 0, 0, 0) })
        quoteCard.addView(priceRow)

        val stateRow = horizontal().apply { gravity = Gravity.CENTER_VERTICAL }
        typeText = text("بانتظار السعر", 9, 0xFFF0E8FF.toInt()).apply {
            background = rounded(0xFF7047D1.toInt(), 6)
            setPadding(dp(8), dp(4), dp(8), dp(4))
            maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END; maxWidth = dp(245)
        }
        stateRow.addView(typeText)
        movementText = text("", 9, 0xFFBFE8CC.toInt(), true).apply { setPadding(dp(8), 0, 0, 0); maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END; maxWidth = dp(160) }
        stateRow.addView(movementText)
        quoteCard.addView(stateRow, marginParams(top = 5))

        val chartHeader = horizontal().apply { gravity = Gravity.CENTER_VERTICAL }
        val chartTitle = vertical().apply {
            addView(text("سجل قراءاتك", 10, 0xFFF2EDFA.toInt(), true))
            addView(text("مخطط محلي، وليس تاريخاً رسمياً", 8, 0xFFB6AFC2.toInt()))
        }
        chartHeader.addView(chartTitle, LinearLayout.LayoutParams(0, -2, 1f))
        observationsCount = text("٠ فحص", 8, 0xFFE8DCFF.toInt()).apply {
            background = rounded(0xFF7047D1.toInt(), 6)
            setPadding(dp(7), dp(4), dp(7), dp(4))
        }
        chartHeader.addView(observationsCount)
        quoteCard.addView(chartHeader, marginParams(top = 17))
        sparkline = SparklineView(this)
        quoteCard.addView(sparkline, LinearLayout.LayoutParams(-1, dp(91)))

        val divider = View(this).apply { setBackgroundColor(0x33FFFFFF) }
        quoteCard.addView(divider, LinearLayout.LayoutParams(-1, dp(1)).apply { topMargin = dp(5); bottomMargin = dp(11) })
        val facts = horizontal()
        val sessionFact = fact("تاريخ الجلسة", "غير متاح من المصدر")
        sessionText = sessionFact.second
        facts.addView(sessionFact.first, LinearLayout.LayoutParams(0, -2, 1f))
        val checkedFact = fact("آخر فحص ناجح", "—")
        checkedText = checkedFact.second
        facts.addView(checkedFact.first, LinearLayout.LayoutParams(0, -2, 1f).apply { marginStart = dp(8) })
        quoteCard.addView(facts)

        val refreshButton = Button(this).apply {
            text = "تحديث السعر  ↻"
            textSize = 12f
            isAllCaps = false
            setTextColor(forest)
            background = rounded(0xFFE1F3E7.toInt(), 10)
            setOnClickListener { refreshQuote() }
        }
        quoteCard.addView(refreshButton, LinearLayout.LayoutParams(-1, dp(44)).apply { topMargin = dp(15) })
        statusText = text("يتم التحقق من المصدر الرسمي…", 9, 0xFFD5C7F0.toInt()).apply { setPadding(0, dp(8), 0, 0) }
        quoteCard.addView(statusText)

        val marketCard = vertical().apply {
            setPadding(dp(16), dp(15), dp(16), dp(13))
            background = rounded(white, 15)
            elevation = dp(1).toFloat()
        }
        page.addView(marketCard, marginParams(bottom = 12))
        val marketHeading = horizontal().apply { gravity = Gravity.CENTER_VERTICAL }
        marketHeading.addView(text("أسعار الجلسة", 14, darkInk, true), LinearLayout.LayoutParams(0, -2, 1f))
        marketHeading.addView(text("بيانات المصدر", 9, green).apply {
            background = rounded(0xFFEAF4EC.toInt(), 6)
            setPadding(dp(7), dp(4), dp(7), dp(4))
        })
        marketCard.addView(marketHeading, marginParams(bottom = 10))
        val marketPrices = horizontal()
        val openingBlock = priceFact("الافتتاح المنشور")
        openingText = openingBlock.second
        marketPrices.addView(openingBlock.first, LinearLayout.LayoutParams(0, -2, 1f))
        val verticalRule = View(this).apply { setBackgroundColor(0xFFE9EDEA.toInt()) }
        marketPrices.addView(verticalRule, LinearLayout.LayoutParams(dp(1), dp(41)))
        val closingBlock = priceFact("الإغلاق المنشور")
        closingText = closingBlock.second
        marketPrices.addView(closingBlock.first, LinearLayout.LayoutParams(0, -2, 1f))
        marketCard.addView(marketPrices)
        marketCard.addView(text("إذا لم تنشر البورصة إغلاقاً، لا نعرض سعر الافتتاح على أنه إغلاق.", 9, 0xFF746D7C.toInt()).apply {
            setPadding(0, dp(10), 0, 0)
        })

        val alertCard = vertical().apply {
            setPadding(dp(15), dp(14), dp(15), dp(14))
            background = rounded(0xFF17171C.toInt(), 15)
            elevation = dp(1).toFloat()
            elevation = dp(1).toFloat()
        }
        page.addView(alertCard, marginParams(bottom = 12))
        val alertHeading = horizontal().apply { gravity = Gravity.CENTER_VERTICAL }
        val alertCopy = vertical().apply {
            addView(text("التنبيهات والفحص الدوري", 14, ink, true))
            addView(text("مقارنة الأسعار بين الفحوصات الناجحة", 9, muted))
        }
        alertHeading.addView(alertCopy, LinearLayout.LayoutParams(0, -2, 1f))
        alertSwitch = Switch(this).apply {
            isChecked = QuoteStorage.alertsEnabled(this@MainActivity)
            contentDescription = "تفعيل فحص الخلفية والتنبيهات"
            thumbTintList = ColorStateList(arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()), intArrayOf(purple, 0xFF817B89.toInt()))
            trackTintList = ColorStateList(arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()), intArrayOf(0x887E57D1.toInt(), 0xFF3B3941.toInt()))
        }
        alertSwitch.setOnCheckedChangeListener { _, checked -> onAlertToggle(checked) }
        alertHeading.addView(alertSwitch)
        alertCard.addView(alertHeading)
        alertCard.addView(text("الفحص كل ١٥ دقيقة تقريباً عند توفر الإنترنت، لكن أندرويد قد يؤخره وقد يفوت تغيراً بين فحصين. التنبيهات ليست لحظية أو مضمونة. الإيقاف الإجباري يوقف العمل حتى إعادة فتح التطبيق.", 9, muted).apply {
            setPadding(0, dp(8), 0, 0)
        })

        val historyCard = vertical().apply {
            setPadding(dp(15), dp(14), dp(15), dp(14))
            background = rounded(white, 15)
            elevation = dp(1).toFloat()
        }
        page.addView(historyCard, marginParams(bottom = 13))
        historyCard.addView(text("التغيرات المرصودة", 14, darkInk, true), marginParams(bottom = 7))
        historyText = text("لا توجد تغيرات مسجلة بعد.", 10, 0xFF756D7D.toInt())
        historyCard.addView(historyText)

        page.addView(text("المصدر الرسمي: sgbv.dz", 9, green, true).apply { gravity = Gravity.CENTER }, marginParams(bottom = 8))
        page.addView(text("هذا التطبيق مستقل وغير تابع لبورصة الجزائر أو AYRADE. البيانات للمتابعة فقط وليست نصيحة استثمارية.", 9, muted).apply { gravity = Gravity.CENTER }, marginParams(bottom = 7))

        val navBar = horizontal().apply {
            setPadding(dp(7), dp(7), dp(7), dp(7))
            background = rounded(0xFF17171C.toInt(), 22)
            elevation = dp(8).toFloat()
        }
        navBar.addView(navItem("⌂", "الرئيسية", page, true), LinearLayout.LayoutParams(0, dp(52), 1f))
        navBar.addView(navItem("⌁", "الرسم", quoteCard), LinearLayout.LayoutParams(0, dp(52), 1f))
        navBar.addView(navItem("◉", "التنبيهات", alertCard), LinearLayout.LayoutParams(0, dp(52), 1f))
        navBar.addView(navItem("≡", "السجل", historyCard), LinearLayout.LayoutParams(0, dp(52), 1f))
        root.addView(screenScroll, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(navBar, marginParams(top = 4, bottom = 5).apply { marginStart = dp(14); marginEnd = dp(14) })
        setContentView(root)
    }

    private fun onAlertToggle(enabled: Boolean) {
        if (!enabled) {
            pendingAlertPermission = false
            QuoteStorage.setAlerts(this, false)
            AlertScheduler.disable(this)
            return
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            pendingAlertPermission = true
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
        } else {
            QuoteStorage.setAlerts(this, true)
            AlertScheduler.enable(this)
        }
    }

    @Deprecated("Android permission result callback")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_NOTIFICATIONS && pendingAlertPermission) {
            pendingAlertPermission = false
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
                QuoteStorage.setAlerts(this, true)
                AlertScheduler.enable(this)
            } else {
                QuoteStorage.setAlerts(this, false)
                alertSwitch.isChecked = false
                Toast.makeText(this, "يلزم السماح بالإشعارات لتفعيل التنبيهات.", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun refreshQuote() {
        statusText.text = "جارٍ الاتصال بالمصدر الرسمي…"
        executor.execute {
            try {
                val quote = MarketReader.fetch()
                val previous = QuoteStorage.price(this)
                val change = previous?.let { kotlin.math.round((quote.price - it) * 100.0) / 100.0 }
                QuoteStorage.saveSuccess(this, quote, change)
                if (QuoteStorage.alertsEnabled(this) && previous != null && change != null && change != 0.0) {
                    QuoteNotifier.notify(this, previous, quote.price, change)
                }
                runOnUiThread { loadSavedData(); statusText.text = "تم الفحص بنجاح · من SGBV" }
            } catch (_: Exception) {
                runOnUiThread {
                    loadSavedData()
                    statusText.text = "تعذّر الاتصال أو قراءة المصدر؛ نحتفظ بآخر سعر ناجح."
                }
            }
        }
    }

    private fun loadSavedData() {
        val price = QuoteStorage.price(this)
        priceText.text = price?.let { String.format(Locale.ROOT, "%,.2f", it) } ?: "—"
        val preferences = getSharedPreferences("nabd-ayrad-local", MODE_PRIVATE)
        typeText.text = preferences.getString("priceLabel", null) ?: "السعر المنشور"
        val session = QuoteStorage.sessionDate(this)
        sessionText.text = session ?: "غير متاح من المصدر"
        val checked = QuoteStorage.checkedAt(this)
        checkedText.text = if (checked > 0) SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(checked)) else "لم ينجح فحص بعد"
        openingText.text = QuoteStorage.openingPrice(this)?.let { String.format(Locale.ROOT, "%,.2f دج", it) } ?: "غير منشور"
        closingText.text = QuoteStorage.closingPrice(this)?.let { String.format(Locale.ROOT, "%,.2f دج", it) } ?: "غير منشور"
        val samples = QuoteStorage.observations(this)
        sparkline.setPrices(samples.map { it.price })
        observationsCount.text = "${samples.size} فحص"
        val history = QuoteStorage.history(this)
        movementText.text = if (history.isEmpty()) "المقارنة الأولى تحفظ كسعر أساس" else {
            val item = history.first()
            val change = item.optDouble("change")
            val direction = if (change > 0) "↑ ارتفاع" else "↓ انخفاض"
            "$direction · ${String.format(Locale.ROOT, "%.2f دج", kotlin.math.abs(change))}"
        }
        if (history.isNotEmpty()) movementText.setTextColor(if (history.first().optDouble("change") > 0) 0xFF9DE5B5.toInt() else 0xFFFFA6A6.toInt())
        historyText.text = if (history.isEmpty()) "لا توجد تغيرات مسجلة بعد." else history.take(6).joinToString("\n\n") { item ->
            val time = SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(item.optLong("time")))
            val change = item.optDouble("change")
            val arrow = if (change > 0) "↑" else "↓"
            "$arrow ${item.optString("direction")}  ·  ${String.format(Locale.ROOT, "%.2f دج", kotlin.math.abs(change))}\n${String.format(Locale.ROOT, "%.2f", item.optDouble("old"))}  ←  ${String.format(Locale.ROOT, "%.2f", item.optDouble("new"))}   ·   $time"
        }
    }

    private fun fact(label: String, initial: String): Pair<LinearLayout, TextView> {
        val box = vertical()
        box.addView(text(label, 8, 0xFFD9C9F8.toInt()))
        val value = text(initial, 9, 0xFFFFFCFF.toInt(), true).apply { maxLines = 1 }
        box.addView(value)
        return box to value
    }

    private fun priceFact(label: String): Pair<LinearLayout, TextView> {
        val box = vertical().apply { setPadding(dp(5), dp(3), dp(5), dp(3)) }
        box.addView(text(label, 9, 0xFF766E7F.toInt()).apply { gravity = Gravity.CENTER })
        val value = text("غير منشور", 13, darkInk, true).apply { gravity = Gravity.CENTER; setPadding(0, dp(3), 0, 0) }
        box.addView(value)
        return box to value
    }

    private fun navItem(icon: String, label: String, target: View, selected: Boolean = false): LinearLayout {
        val item = vertical().apply {
            gravity = Gravity.CENTER
            setPadding(dp(3), dp(3), dp(3), dp(3))
            background = rounded(if (selected) purple else 0xFF17171C.toInt(), 17)
            addView(text(icon, 17, if (selected) white else 0xFFAAA4B2.toInt()).apply { gravity = Gravity.CENTER })
            addView(text(label, 8, if (selected) white else 0xFFAAA4B2.toInt(), selected).apply { gravity = Gravity.CENTER })
        }
        navEntries.add(item)
        item.setOnClickListener {
            navEntries.forEach { entry ->
                val active = entry === item
                entry.background = rounded(if (active) purple else 0xFF17171C.toInt(), 17)
                (entry.getChildAt(0) as TextView).setTextColor(if (active) white else 0xFFAAA4B2.toInt())
                (entry.getChildAt(1) as TextView).setTextColor(if (active) white else 0xFFAAA4B2.toInt())
            }
            screenScroll.post { screenScroll.smoothScrollTo(0, (target.top - dp(8)).coerceAtLeast(0)) }
        }
        return item
    }

    private fun purpleGradient() = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(0xFF986CFF.toInt(), 0xFF8858EF.toInt(), 0xFF6E45CB.toInt())
    ).apply { cornerRadius = dp(19).toFloat() }

    private fun vertical() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; layoutDirection = View.LAYOUT_DIRECTION_RTL }
    private fun horizontal() = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; layoutDirection = View.LAYOUT_DIRECTION_RTL }
    private fun text(value: String, size: Int, color: Int, bold: Boolean = false) = TextView(this).apply {
        text = value; textSize = size.toFloat(); setTextColor(color)
        if (bold) setTypeface(typeface, Typeface.BOLD)
        textDirection = View.TEXT_DIRECTION_RTL; gravity = Gravity.RIGHT or Gravity.CENTER_VERTICAL
    }
    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply { setColor(color); cornerRadius = dp(radius).toFloat() }
    private fun marginParams(top: Int = 0, bottom: Int = 0) = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(top); bottomMargin = dp(bottom) }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() { super.onDestroy(); executor.shutdown() }

    companion object { private const val REQUEST_NOTIFICATIONS = 91 }
}
