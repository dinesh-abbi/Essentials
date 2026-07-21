# Changelog

Based on the current uncommitted and untracked git changes, here is a summary of the latest updates:

## New Features
- **Barcode Alarm System:** Introduced a new Barcode Alarm feature, including a new `alarm` routing directory (`src/app/alarm/`), persistent storage utility (`src/utils/BarcodeAlarmStorage.ts`), and documentation (`BARCODE_ALARM.md`).
- **Unified Reporting Views:** Consolidated the separate weekly and monthly views for both the Water and Purchases tracking modules into unified `report.tsx` files (`src/app/water/report.tsx`, `src/app/purchases/report.tsx`), simplifying the user flow.
- **Document Picker Integration:** Added `expo-document-picker` to dependencies in `package.json` to allow file selection capabilities (likely for backups or importing data).

## Bug Fixes
- **Restored Biometric Authentication:** Re-implemented the biometric lock (Face ID / Touch ID) on the Spend Tracker (`src/app/purchases/index.tsx`) that was missing after the recent layout refactor.
- **Flexible Purchase Categories:** Relaxed the `category` type definition in `src/utils/PurchasesStorage.ts` from a strict literal union to `string`, preventing errors when adding custom categories.
- **Historical Weekly Data:** Updated `getWeeklyData` in `src/utils/WaterStorage.ts` to accept an optional `refDateMs` parameter. This fixes the issue of only being able to retrieve weekly data for the current week, enabling historical charting.
- **Notification Mocking:** Added a mock implementation for `dismissAllNotificationsAsync` in `src/utils/notifications.ts` to prevent runtime crashes on environments where native Expo Notifications aren't available.

## UI Fixes & Refactoring
- **Simplified Routing:** Removed unnecessary layout wrappers and separated route files (`_layout.tsx`, `monthly.tsx`, `weekly.tsx`) for the `water` and `purchases` directories in favor of the new unified reports.
- **General Layout Tweaks:** Updated core layouts and main screens including `src/app/_layout.tsx`, `src/app/(tabs)/index.tsx`, `src/app/(tabs)/profile.tsx`, `src/app/purchases/index.tsx`, and `src/app/water/index.tsx` to accommodate the new routing structure and styling improvements.
- **Package Updates:** Bumped versions for several Expo packages (e.g., `expo`, `expo-router`, `@expo/ui`, `expo-notifications`) for improved stability and potential bug fixes.
