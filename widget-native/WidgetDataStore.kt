package com.catalyst.essentials

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Bridge for src/utils/WidgetSync.ts. Persists the latest hydration totals
 * to SharedPreferences and immediately repaints every placed widget —
 * this is the entire "sync" mechanism, no polling involved.
 *
 * Also exposes [getWidgetData] so the JS side can read what the widget is
 * currently showing — used on Home screen focus to reconcile totals when a
 * quick-log from the widget hasn't finished writing to Firestore yet.
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
                .putInt(WaterWidgetProvider.KEY_SYNC_DATE_KEY, WaterWidgetProvider.todayDateKey())
                .apply()
            WaterWidgetProvider.updateAll(ctx)
        } catch (e: Exception) {
            Log.e("WidgetDataStore", "Failed to sync widget data", e)
        }
    }

    /**
     * Returns the widget's current SharedPreferences state so the JS side can
     * reconcile it with Firestore/AsyncStorage on app resume.
     *
     * If the stored date key doesn't match today, returns zeroed totals —
     * the same stale-data guard that [WaterWidgetProvider.updateWidget] uses.
     */
    @ReactMethod
    fun getWidgetData(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val prefs = ctx.getSharedPreferences(WaterWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)

            val today = WaterWidgetProvider.todayDateKey()
            val isStale = prefs.getInt(WaterWidgetProvider.KEY_SYNC_DATE_KEY, 0) != today

            val result = Arguments.createMap().apply {
                putInt("waterMl", if (isStale) 0 else prefs.getInt(WaterWidgetProvider.KEY_WATER_ML, 0))
                putInt("waterGoal", prefs.getInt(WaterWidgetProvider.KEY_WATER_GOAL, 3000))
                putInt("logsToday", if (isStale) 0 else prefs.getInt(WaterWidgetProvider.KEY_LOGS_TODAY, 0))
                putBoolean("isStale", isStale)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e("WidgetDataStore", "Failed to read widget data", e)
            promise.reject("WIDGET_READ_ERROR", "Failed to read widget data", e)
        }
    }
}
