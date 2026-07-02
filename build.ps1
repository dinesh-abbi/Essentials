# ============================================================
# Windows PowerShell Build Script for Catalyst Essentials
# ============================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$logFile = "$env:TEMP\essentials_build.log"
$apkSrc  = "android\app\build\outputs\apk\release\app-release.apk"
$apkDest = "CatalystEssentials.apk"

# ---- Helper: run a command and stream output to log -----------
function Invoke-Step {
    param([string]$Label, [scriptblock]$Block)
    Write-Host ""
    Write-Host "  >> $Label" -ForegroundColor Cyan
    Write-Host "     (output streaming to $logFile)" -ForegroundColor DarkGray
    try {
        & $Block 2>&1 | Tee-Object -FilePath $logFile -Append | ForEach-Object {
            Write-Host "     $_" -ForegroundColor DarkGray
        }
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            throw "Step failed with exit code $LASTEXITCODE"
        }
        Write-Host "  [OK] $Label" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "  [FAIL] $Label" -ForegroundColor Red
        Write-Host "  Error: $_"     -ForegroundColor Red
        Write-Host ""
        Write-Host "  Full log: $logFile" -ForegroundColor Yellow
        exit 1
    }
}

Clear-Host
"" | Out-Null

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CATALYST ESSENTIALS  --  Production APK Builder  v2.0    " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ---- STEP 1: Environment Checks --------------------------------
Write-Host "STEP 1/4  Verifying build environment" -ForegroundColor White

# Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "  ERROR: Node.js is not installed. Install it from https://nodejs.org" -ForegroundColor Red
    exit 1
}
$nodeVer = & node --version
Write-Host "  Node.js : $nodeVer" -ForegroundColor Green

# Java
$javaExe = "C:\Program Files\Java\jre1.8.0_481\bin\java.exe"
if (-not (Test-Path $javaExe)) {
    # Fallback: search PATH (PS5 compatible)
    $javaCmd = Get-Command java -ErrorAction SilentlyContinue
    if ($javaCmd) { $javaExe = $javaCmd.Source } else { $javaExe = $null }
}
if (-not $javaExe -or -not (Test-Path $javaExe)) {
    Write-Host "  ERROR: Java not found. Install JDK 17+ and add to PATH." -ForegroundColor Red
    exit 1
}
$javaVer = (& cmd.exe /c "`"$javaExe`" -version 2>&1") | Select-Object -First 1
Write-Host "  Java    : $javaVer" -ForegroundColor Green

# Android SDK
$sdkPath = $env:ANDROID_HOME
if (-not $sdkPath) { $sdkPath = $env:ANDROID_SDK_ROOT }
if (-not $sdkPath) {
    $guess = "$env:USERPROFILE\AppData\Local\Android\Sdk"
    if (Test-Path $guess) {
        $env:ANDROID_HOME = $guess
        $sdkPath = $guess
    }
}
if (-not $sdkPath) {
    Write-Host "  ERROR: Android SDK not found. Set ANDROID_HOME." -ForegroundColor Red
    exit 1
}
Write-Host "  Android : $sdkPath" -ForegroundColor Green

# Set JAVA_HOME so Gradle can find it
$javaHome = Split-Path (Split-Path $javaExe -Parent) -Parent
$env:JAVA_HOME = $javaHome
Write-Host "  JAVA_HOME set to: $javaHome" -ForegroundColor DarkGray

# ---- STEP 2: Install dependencies ------------------------------
Write-Host ""
Write-Host "STEP 2/4  Installing dependencies" -ForegroundColor White

if (-not (Test-Path "node_modules")) {
    Invoke-Step "npm install" {
        & cmd.exe /c "npm install"
    }
} else {
    Write-Host "  [OK] node_modules already present." -ForegroundColor Green
}

# ---- STEP 3: Expo Prebuild ------------------------------------
Write-Host ""
Write-Host "STEP 3/4  Running expo prebuild (generates Android project)" -ForegroundColor White

Invoke-Step "expo prebuild --platform android --clean" {
    & cmd.exe /c "npx expo prebuild --platform android --clean"
}

if (-not (Test-Path "android")) {
    Write-Host "  ERROR: android/ folder missing after prebuild." -ForegroundColor Red
    exit 1
}

# ---- STEP 4: Gradle Release Build -----------------------------
Write-Host ""
Write-Host "STEP 4/4  Compiling Release APK (this takes 3-8 minutes)" -ForegroundColor White

Invoke-Step "gradlew assembleRelease" {
    Set-Location android
    & cmd.exe /c "gradlew.bat assembleRelease"
    Set-Location ..
}

# ---- Copy APK to project root ---------------------------------
if (Test-Path $apkSrc) {
    Copy-Item $apkSrc -Destination $apkDest -Force
    $sizeMB = "{0:N1}" -f ((Get-Item $apkDest).Length / 1MB)
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  BUILD COMPLETE!" -ForegroundColor Green
    Write-Host "  Output : $apkDest ($sizeMB MB)" -ForegroundColor Green
    Write-Host "  Copy this file to your phone and install it." -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  ERROR: APK not found at expected path: $apkSrc" -ForegroundColor Red
    Write-Host "  Check $logFile for Gradle errors." -ForegroundColor Yellow
    exit 1
}
