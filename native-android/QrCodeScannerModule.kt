package com.catalyst.essentials

import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage

/**
 * `NativeModules.QrCodeScanner` — decodes a QR/barcode from a picked image
 * with ML Kit (used by the UPI scanner's "from gallery" path and the barcode
 * alarm's "import a photo" path). Needs `com.google.mlkit:barcode-scanning`,
 * added to app/build.gradle by withEssentialsNative.js.
 * Recovered from the v1.1.2 APK.
 */
class QrCodeScannerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "QrCodeScanner"

  @ReactMethod
  fun scanQrCodeFromImage(imageUriString: String, promise: Promise) {
    try {
      val stream = reactApplicationContext.contentResolver.openInputStream(Uri.parse(imageUriString))
      if (stream == null) {
        promise.reject("FILE_NOT_FOUND", "Could not open image file input stream")
        return
      }
      val bitmap = stream.use { BitmapFactory.decodeStream(it) }
      if (bitmap == null) {
        promise.reject("INVALID_IMAGE", "Could not decode image bitmap")
        return
      }
      BarcodeScanning.getClient()
        .process(InputImage.fromBitmap(bitmap, 0))
        .addOnSuccessListener { barcodes ->
          if (barcodes.isNotEmpty()) {
            promise.resolve(barcodes[0].rawValue ?: barcodes[0].displayValue ?: "")
          } else {
            promise.reject("NO_QR", "No QR code found in the image")
          }
        }
        .addOnFailureListener { e -> promise.reject("SCAN_FAILED", "Failed to scan QR code from image", e) }
    } catch (e: Exception) {
      promise.reject("ERROR", e.message, e)
    }
  }
}
