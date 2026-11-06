package com.nabd.ayrad

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

internal object AlertScheduler {
    private const val UNIQUE_WORK = "ayrd-periodic-quote-check"

    fun enable(context: Context) {
        val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val request = PeriodicWorkRequestBuilder<QuoteWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE_WORK, ExistingPeriodicWorkPolicy.UPDATE, request
        )
    }

    fun disable(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_WORK)
    }
}
