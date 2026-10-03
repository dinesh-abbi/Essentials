package com.catalyst.essentials

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers the hand-written native modules that are not the widget:
 *   "AlarmScheduler"  — barcode alarm (AlarmSchedulerModule)
 *   "QrCodeScanner"   — ML Kit image decode (QrCodeScannerModule)
 *
 * Replaces the old AlarmSchedulerPackage + WidgetStoragePackage pair (the
 * latter was a misleading name — it only ever held the QR scanner). The
 * widget keeps its own WidgetPackage ("WidgetStorage"). Module names must
 * stay unique across packages: a duplicate getName() is a crash at startup,
 * not a build error.
 */
class EssentialsNativePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(AlarmSchedulerModule(reactContext), QrCodeScannerModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
