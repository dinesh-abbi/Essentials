package com.catalyst.essentials

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Runs the `WidgetQuickLog` headless JS task (registered in WidgetSync.ts)
 * so a widget tap can persist a real water log through the app's normal
 * AsyncStorage/Firestore path without ever starting an Activity.
 */
class WidgetQuickLogTaskService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val amount = intent?.getIntExtra(WidgetQuickLogReceiver.EXTRA_AMOUNT_ML, 0) ?: 0
        if (amount <= 0) return null

        val data = Arguments.createMap().apply {
            putInt("amountMl", amount)
        }

        return HeadlessJsTaskConfig(
            "WidgetQuickLog",
            data,
            10000L,
            true
        )
    }
}
