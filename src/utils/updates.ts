import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Notifications } from '@/utils/notifications';

/**
 * Self-hosted OTA update plumbing (GitHub Releases — no Play Store, no EAS).
 *
 * Centralised here because two screens now need it: the update prompt that
 * fires on launch, and Profile's "What's New" viewer. The release *body* is
 * always the versioned changelog markdown — publish-github.js hands
 * `changelogs/vX.Y.Z.md` to `gh release create --notes-file` — so `notes` can
 * be fed straight into parseChangelog().
 */

const REPO = 'dinesh-abbi/Essentials';
const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=20`;

const PENDING_INSTALL_KEY = '@essentials_pending_install_version';
const SEEN_UPDATE_KEY = '@essentials_seen_update_version';

export interface ReleaseInfo {
  /** Semver with any leading "v" stripped, e.g. "1.0.21". */
  version: string;
  /** Raw changelog markdown from the release body. */
  notes: string;
  /** APK asset URL, when one is attached. */
  apkUrl?: string;
  publishedAt?: string;
}

export const currentVersion: string =
  Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';

function normalizeRelease(data: any): ReleaseInfo | null {
  const version = data?.tag_name?.replace(/^v/i, '');
  if (!version) return null;
  const apkAsset = (data.assets ?? []).find((a: any) =>
    typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.apk')
  );
  return {
    version,
    notes: data.body || '',
    apkUrl: apkAsset?.browser_download_url ?? data.assets?.[0]?.browser_download_url,
    publishedAt: data.published_at,
  };
}

/** Numeric semver comparison — "1.0.10" must beat "1.0.9", so no string compare. */
export function isNewerVersion(latest: string, current: string): boolean {
  const l = latest.split('.').map((n) => parseInt(n, 10) || 0);
  const c = current.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] || 0;
    const cv = c[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    return normalizeRelease(await response.json());
  } catch (error) {
    console.warn('[updates] Latest release check failed:', error);
    return null;
  }
}

/**
 * Finds the release matching a specific version — used by Profile to show the
 * notes for the version actually installed.
 */
export async function fetchReleaseForVersion(version: string): Promise<ReleaseInfo | null> {
  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    const list = await response.json();
    if (!Array.isArray(list)) return null;
    const match = list.find((r: any) => r?.tag_name?.replace(/^v/i, '') === version);
    return match ? normalizeRelease(match) : null;
  } catch (error) {
    console.warn('[updates] Release lookup failed:', error);
    return null;
  }
}

/** Latest release, but only when it is actually newer than what's installed. */
export async function checkForUpdate(): Promise<ReleaseInfo | null> {
  const latest = await fetchLatestRelease();
  if (!latest?.apkUrl) return null;
  return isNewerVersion(latest.version, currentVersion) ? latest : null;
}

// ── Cache & Storage Management ────────────────────────────────────────────────

/** Local file path where the APK for a given version is stored. */
export function getApkFilePath(version: string): string {
  return `${FileSystem.cacheDirectory}update-${version}.apk`;
}

/**
 * Checks whether a complete, valid APK file is already cached locally.
 * Must be non-empty (>1MB minimum size check to guard against truncated/0-byte files).
 */
export async function isApkDownloaded(version: string): Promise<boolean> {
  try {
    const path = getApkFilePath(version);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return false;
    // Guard against corrupt/interrupted downloads (valid APKs are several MBs)
    if (info.size && info.size > 1024 * 1024) {
      return true;
    }
    // Delete partial/corrupted 0-byte file
    await FileSystem.deleteAsync(path, { idempotent: true });
    return false;
  } catch (error) {
    console.warn('[updates] Error checking cached APK:', error);
    return false;
  }
}

/**
 * Clean up older cached APKs to prevent storage bloat on Android.
 * Keeps only the specified version (e.g. current target), deletes everything else.
 */
export async function cleanOldApks(keepVersion?: string): Promise<void> {
  try {
    if (!FileSystem.cacheDirectory) return;
    const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    const keepFilename = keepVersion ? `update-${keepVersion}.apk` : null;

    for (const file of files) {
      if (file.startsWith('update-') && file.endsWith('.apk')) {
        if (keepFilename && file === keepFilename) continue;
        const fullPath = `${FileSystem.cacheDirectory}${file}`;
        await FileSystem.deleteAsync(fullPath, { idempotent: true });
        console.log(`[updates] Cleaned up old APK: ${file}`);
      }
    }
  } catch (error) {
    console.warn('[updates] Error cleaning old APKs:', error);
  }
}

// ── "Already offered" tracking ────────────────────────────────────────────────

export async function markUpdateSeen(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_UPDATE_KEY, version);
  } catch (error) {
    console.warn('[updates] Failed to record seen update:', error);
  }
}

export async function hasSeenUpdate(version: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_UPDATE_KEY)) === version;
  } catch (error) {
    console.warn('[updates] Failed to read seen update:', error);
    return false;
  }
}

// ── Pending Install Tracking (Screen-Off / Background State) ─────────────────

export async function setPendingInstall(version: string | null): Promise<void> {
  try {
    if (version) {
      await AsyncStorage.setItem(PENDING_INSTALL_KEY, version);
    } else {
      await AsyncStorage.removeItem(PENDING_INSTALL_KEY);
    }
  } catch (error) {
    console.warn('[updates] Failed to set pending install:', error);
  }
}

export async function getPendingInstall(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_INSTALL_KEY);
  } catch (error) {
    console.warn('[updates] Failed to get pending install:', error);
    return null;
  }
}

/**
 * Posts a high-priority system notification indicating that the update is
 * downloaded and ready to install. Useful when screen is off or app is in background.
 */
export async function notifyUpdateReady(version: string): Promise<void> {
  try {
    if (Platform.OS !== 'android') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📦 Essentials Update Ready',
        body: `Version ${version} is downloaded and ready to install. Tap to finish setup.`,
        data: {
          route: `/update?version=${version}`,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: 'hydration#003',
        seconds: 1,
        repeats: false,
      },
    });
  } catch (error) {
    console.warn('[updates] Failed to post update ready notification:', error);
  }
}

// ── Download & Installation Execution ─────────────────────────────────────────

/**
 * Downloads the APK for a release with progress reporting.
 * Skips download if the APK is already cached locally.
 */
export async function downloadApk(
  release: ReleaseInfo,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!release.apkUrl) throw new Error('This release has no APK attached.');

  // Clean old APKs to free up device storage first
  await cleanOldApks(release.version);

  const destination = getApkFilePath(release.version);

  // Check if already cached
  const alreadyDownloaded = await isApkDownloaded(release.version);
  if (alreadyDownloaded) {
    onProgress?.(1);
    return destination;
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    release.apkUrl,
    destination,
    {},
    (event) => {
      if (!event.totalBytesExpectedToWrite) return;
      onProgress?.(event.totalBytesWritten / event.totalBytesExpectedToWrite);
    }
  );

  const downloadResult = await downloadResumable.downloadAsync();
  if (!downloadResult?.uri) throw new Error('Downloaded file URI not returned.');

  // Validate downloaded file
  const info = await FileSystem.getInfoAsync(downloadResult.uri);
  if (!info.exists || (info.size && info.size < 1024 * 1024)) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
    throw new Error('Downloaded file is incomplete or corrupted. Please retry.');
  }

  return downloadResult.uri;
}

/**
 * Hands the downloaded APK to Android's package installer.
 * If the app is currently inactive/backgrounded or screen is off, defers the prompt
 * until the user returns to the app and notifies them.
 */
export async function installApk(version: string): Promise<boolean> {
  const filePath = getApkFilePath(version);
  const downloaded = await isApkDownloaded(version);
  if (!downloaded) {
    throw new Error('Update file is not downloaded yet.');
  }

  // Check Android screen/app lifecycle state:
  // Android 10+ restricts background activity starts. If the screen is off or
  // app is in background, defer the intent handoff to avoid OS blocking.
  if (AppState.currentState !== 'active') {
    console.log('[updates] Screen off or app backgrounded — deferring install');
    await setPendingInstall(version);
    await notifyUpdateReady(version);
    return false;
  }

  // App is active and screen is on: proceed with package installer intent
  await setPendingInstall(null);

  // Android 7+ refuses file:// URIs across app boundaries — the installer
  // needs a content:// URI granted read permission.
  const contentUri = await FileSystem.getContentUriAsync(filePath);

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });

  return true;
}

/**
 * Full flow: downloads the APK (if not already cached) and triggers installation.
 */
export async function downloadAndInstall(
  release: ReleaseInfo,
  onProgress?: (progress: number) => void
): Promise<void> {
  await downloadApk(release, onProgress);
  await installApk(release.version);
}

/**
 * Handles any pending install when the app returns to the foreground.
 */
export async function handlePendingInstallIfActive(): Promise<void> {
  try {
    const pendingVersion = await getPendingInstall();
    if (!pendingVersion) return;

    const downloaded = await isApkDownloaded(pendingVersion);
    if (downloaded && AppState.currentState === 'active') {
      console.log(`[updates] Resuming pending install for v${pendingVersion}`);
      await installApk(pendingVersion);
    }
  } catch (error) {
    console.warn('[updates] Failed to handle pending install:', error);
  }
}
