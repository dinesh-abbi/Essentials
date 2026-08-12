package com.catalyst.essentials

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Bridge for src/utils/WidgetSync.ts. Persists the latest hydration totals
 * to SharedPreferences and immediately repaints every placed widget —
 * this is the entire "sync" mechanism, no polling involved.
 */
class WidgetDataStore(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "WidgetStorage"

    @ReactMethod
    fun setWidgetData(waterMl: Double, waterGoal: Double, logsToday: Double) {
        try {
            val ctx = reactApplicationContext
            val prefs = ctx.getSharedPreferences(WaterWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putInt(WaterWidgetProvider.KEY_WATER_ML, waterMl.toInt())
                .putInt(WaterWidgetProvider.KEY_WATER_GOAL, waterGoal.toInt())
                .putInt(WaterWidgetProvider.KEY_LOGS_TODAY, logsToday.toInt())
                .apply()
            WaterWidgetProvider.updateAll(ctx)
        } catch (e: Exception) {
            Log.e("WidgetDataStore", "Failed to sync widget data", e)
        }
    }
}
