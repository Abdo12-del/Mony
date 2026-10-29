package com.nabd.ayrad

import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

internal data class Quote(
    val price: Double,
    val priceType: String,
    val priceLabel: String,
    val sessionDate: String?,
    val fetchedAt: Long = System.currentTimeMillis(),
    val openingPrice: Double? = null,
    val closingPrice: Double? = null
)

internal object MarketReader {
    private const val SOURCE_URL = "https://www.sgbv.dz/"

    fun fetch(): Quote {
        val connection = (URL(SOURCE_URL).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 9000
            readTimeout = 9000
            setRequestProperty("User-Agent", "Nabd-Ayrad-Android/1.0")
            setRequestProperty("Accept", "text/html")
        }
        val html = try {
            if (connection.responseCode !in 200..299) error("استجابة المصدر غير ناجحة (${connection.responseCode})")
            connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        } finally { connection.disconnect() }
        if (html.isBlank()) error("صفحة المصدر فارغة")
        if (html.length > 5_000_000) error("حجم صفحة المصدر غير متوقع")
        return parse(html)
    }

    internal fun parse(html: String): Quote {
        val rowRegex = Regex("(?is)<tr\\b[^>]*>(.*?)</tr>")
        val cellRegex = Regex("(?is)<t[dh]\\b[^>]*>(.*?)</t[dh]>")
        val rows = rowRegex.findAll(html).map { row ->
            cellRegex.findAll(row.groupValues[1]).map { plain(it.groupValues[1]) }.toList()
        }
        val quote = rows.firstOrNull { cells -> cells.any { it.trim().equals("AYRD", true) } && cells.any { it.contains("AYRADE", true) } }
            ?: error("لم يُعثر على صف AYRADE/AYRD الرسمي")
        val tickerIndex = quote.indexOfFirst { it.trim().equals("AYRD", true) }
        val opening = parseNumber(quote.getOrNull(tickerIndex + 1))
        val closing = parseNumber(quote.getOrNull(tickerIndex + 2))
        val selected = closing ?: opening
        require(selected != null && selected > 0) { "لم ينشر المصدر سعراً صالحاً لسهم AYRD" }
        return if (closing != null) {
            Quote(selected, "close", "سعر الإغلاق المنشور", findDate(html), openingPrice = opening, closingPrice = closing)
        } else {
            Quote(selected, "reference", "سعر افتتاح منشور (مرجعي، ليس إغلاقاً)", findDate(html), openingPrice = opening, closingPrice = null)
        }
    }

    private fun plain(html: String): String = decode(html.replace(Regex("(?is)<script\\b[^>]*>.*?</script>"), " ")
        .replace(Regex("(?is)<style\\b[^>]*>.*?</style>"), " ")
        .replace(Regex("<[^>]*>"), " ")).replace(Regex("[\\u200e\\u200f\\u202a-\\u202e]"), " ")
        .replace(Regex("\\s+"), " ").trim()

    private fun decode(text: String): String = text
        .replace("&nbsp;", " ", true).replace("&#160;", " ", true).replace("&amp;", "&", true)
        .replace("&quot;", "\"", true).replace("&#39;", "'", true)
        .replace("&lt;", "<", true).replace("&gt;", ">", true)
        .replace(Regex("&#(\\d+);")) { it.groupValues[1].toIntOrNull()?.toChar()?.toString() ?: it.value }
        .replace(Regex("&#x([0-9a-fA-F]+);")) { it.groupValues[1].toIntOrNull(16)?.toChar()?.toString() ?: it.value }

    private fun parseNumber(raw: String?): Double? {
        if (raw.isNullOrBlank() || raw.trim().uppercase(Locale.ROOT) in setOf("NC", "N/C", "N.C.", "—", "-", "N/A")) return null
        val normalized = raw.replace("\\s".toRegex(), "").replace(',', '.')
        return normalized.toDoubleOrNull()?.takeIf { it.isFinite() }
    }

    private fun findDate(html: String): String? {
        val text = plain(html)
        val idx = Regex("AYRD|AYRADE", RegexOption.IGNORE_CASE).find(text)?.range?.first ?: return null
        val context = text.substring(maxOf(0, idx - 260), minOf(text.length, idx + 450))
        val month = "(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|june|july|august|september|october|november|december)"
        Regex("(\\d{1,2})\\s+($month)\\s+(\\d{4})", RegexOption.IGNORE_CASE).find(context)?.let {
            return "${it.groupValues[1]} ${it.groupValues[2]} ${it.groupValues[3]}"
        }
        return Regex("\\b(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4})\\b").find(context)?.groupValues?.get(1)
    }
}
