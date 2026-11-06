package com.nabd.ayrad

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

internal class QuoteWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        if (!QuoteStorage.alertsEnabled(applicationContext)) return Result.success()
        return try {
            val quote = MarketReader.fetch()
            val previous = QuoteStorage.price(applicationContext)
            val change = previous?.let { kotlin.math.round((quote.price - it) * 100.0) / 100.0 }
            QuoteStorage.saveSuccess(applicationContext, quote, change)
            if (previous != null && change != null && change != 0.0) QuoteNotifier.notify(applicationContext, previous, quote.price, change)
            Result.success()
        } catch (_: Exception) {
            // Keep the last successful value intact; retry with WorkManager backoff.
            Result.retry()
        }
    }
}
