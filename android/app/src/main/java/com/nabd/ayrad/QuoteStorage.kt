package com.nabd.ayrad

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

internal data class Observation(val price: Double, val time: Long)

internal object QuoteStorage {
    private const val PREFS = "nabd-ayrad-local"
    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun hasQuote(context: Context) = prefs(context).contains("price")
    fun price(context: Context): Double? = if (hasQuote(context)) prefs(context).getString("price", null)?.toDoubleOrNull() else null
    fun sessionDate(context: Context): String? = prefs(context).getString("sessionDate", null)
    fun checkedAt(context: Context): Long = prefs(context).getLong("checkedAt", 0L)
    fun openingPrice(context: Context): Double? = prefs(context).getString("openingPrice", null)?.toDoubleOrNull()
    fun closingPrice(context: Context): Double? = prefs(context).getString("closingPrice", null)?.toDoubleOrNull()
    fun observations(context: Context): List<Observation> {
        val array = try { JSONArray(prefs(context).getString("observations", "[]")) } catch (_: Exception) { JSONArray() }
        return (0 until array.length()).mapNotNull { index ->
            val row = array.optJSONObject(index) ?: return@mapNotNull null
            val price = row.optDouble("price", Double.NaN)
            if (price.isFinite()) Observation(price, row.optLong("time")) else null
        }
    }
    fun alertsEnabled(context: Context) = prefs(context).getBoolean("alerts", false)
    fun setAlerts(context: Context, enabled: Boolean) { prefs(context).edit().putBoolean("alerts", enabled).apply() }
    fun ownedShares(context: Context): Long? = if (prefs(context).contains("ownedSharesAYRD")) prefs(context).getLong("ownedSharesAYRD", 0L) else null
    fun setOwnedShares(context: Context, quantity: Long) { prefs(context).edit().putLong("ownedSharesAYRD", quantity).apply() }

    fun saveSuccess(context: Context, quote: Quote, change: Double?) {
        val p = prefs(context)
        val editor = p.edit().putString("price", quote.price.toString())
            .putString("priceType", quote.priceType).putString("priceLabel", quote.priceLabel)
            .putLong("checkedAt", quote.fetchedAt)
        if (quote.sessionDate != null) editor.putString("sessionDate", quote.sessionDate) else editor.remove("sessionDate")
        if (quote.openingPrice != null) editor.putString("openingPrice", quote.openingPrice.toString()) else editor.remove("openingPrice")
        if (quote.closingPrice != null) editor.putString("closingPrice", quote.closingPrice.toString()) else editor.remove("closingPrice")
        val observations = try { JSONArray(p.getString("observations", "[]")) } catch (_: Exception) { JSONArray() }
        observations.put(JSONObject().put("price", quote.price).put("time", quote.fetchedAt))
        while (observations.length() > 60) observations.remove(0)
        editor.putString("observations", observations.toString())
        if (change != null && change != 0.0) {
            val history = try { JSONArray(p.getString("history", "[]")) } catch (_: Exception) { JSONArray() }
            val item = JSONObject().put("old", quote.price - change).put("new", quote.price)
                .put("change", change).put("time", quote.fetchedAt)
                .put("direction", if (change > 0) "ارتفاع" else "انخفاض")
            history.put(item)
            while (history.length() > 30) history.remove(0)
            editor.putString("history", history.toString())
        }
        editor.apply()
    }

    fun history(context: Context): List<JSONObject> {
        val array = try { JSONArray(prefs(context).getString("history", "[]")) } catch (_: Exception) { JSONArray() }
        return (0 until array.length()).mapNotNull { array.optJSONObject(it) }.reversed()
    }
}
