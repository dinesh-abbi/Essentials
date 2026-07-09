#!/bin/bash

# --- Color Scheme & Aesthetics ---
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

# --- Parse Command Line Arguments ---
CLEAN_BUILD=false
for arg in "$@"; do
  if [ "$arg" = "--clean" ] || [ "$arg" = "-c" ]; then
    CLEAN_BUILD=true
  fi
done

# --- Fancy Terminal Spinner ---
run_with_spinner() {
  local msg="$1"
  shift
  # Start command in background
  "$@" > /tmp/build_task.log 2>&1 &
  local pid=$!
  
  local delay=0.1
  local spinstr='|/-\'
  
  printf "${CYAN}${BOLD}[ RUNNING ]${RESET} %s " "$msg"
  
  while kill -0 $pid 2>/dev/null; do
    local temp=${spinstr#?}
    printf "${CYAN}[%c]${RESET}" "$spinstr"
    local spinstr=$temp${spinstr%"$temp"}
    sleep $delay
    printf "\b\b\b"
  done
  
  wait $pid
  local exit_status=$?
  
  if [ $exit_status -eq 0 ]; then
    printf "\r${GREEN}${BOLD}[ SUCCESS ]${RESET} %s    \n" "$msg"
  else
    printf "\r${RED}${BOLD}[  FAIL   ]${RESET} %s    \n" "$msg"
    echo -e "${RED}${BOLD}Error Log Output:${RESET}"
    cat /tmp/build_task.log | tail -n 25
    echo -e "${RED}Please fix the error above and try again.${RESET}"
    exit 1
  fi
}

clear

# --- ASCII Art Header ---
echo -e "${CYAN}${BOLD}"
cat <<'EOF'
====================================================================

███████╗███████╗███████╗███████╗███╗   ██╗████████╗██╗ █████╗ ██╗     ███████╗
██╔════╝██╔════╝██╔════╝██╔════╝████╗  ██║╚══██╔══╝██║██╔══██╗██║     ██╔════╝
█████╗  ███████╗███████╗█████╗  ██╔██╗ ██║   ██║   ██║███████║██║     ███████╗
██╔══╝  ╚════██║╚════██║██╔══╝  ██║╚██╗██║   ██║   ██║██╔══██║██║     ╚════██║
███████╗███████║███████║███████╗██║ ╚████║   ██║   ██║██║  ██║███████╗███████║
╚══════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝

====================================================================
EOF
echo -e "${RESET}"

echo -e "${CYAN}// CORE_BUILD_SEQUENCE: STARTING${RESET}\n"

# Force the build to use JDK 17 (LTS) to prevent Java 25 native-access prefab compilation errors
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
export PATH="$JAVA_HOME/bin:$PATH"

# --- Prompt for Publish ---
PUBLISH_BUILD=false
if [ -t 0 ]; then
  echo -n -e "${CYAN}${BOLD}Would you like to publish this build to GitHub? (y/N): ${RESET}"
  read -r PUBLISH_RESPONSE
  PUBLISH_RESPONSE=$(echo "$PUBLISH_RESPONSE" | tr '[:upper:]' '[:lower:]')
  if [ "$PUBLISH_RESPONSE" = "y" ] || [ "$PUBLISH_RESPONSE" = "yes" ]; then
    PUBLISH_BUILD=true
  fi
fi

# --- STEP 1: Environment Checks ---
echo -e "${BOLD}[ STEP 1/4 ] Verifying build environment...${RESET}"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}[ERROR] Node.js is not installed. Please install Node.js first.${RESET}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node -v)${RESET}"

# Check Java Development Kit (JDK)
if ! command -v java &> /dev/null; then
  echo -e "${RED}[ERROR] Java JDK is not found. Java is required to compile Android release builds.${RESET}"
  echo -e "${YELLOW}Please install OpenJDK 17 or higher and add it to your PATH.${RESET}"
  exit 1
fi
echo -e "${GREEN}✓ Java JDK found: $(java -version 2>&1 | head -n 1)${RESET}"

# Check Android SDK
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  echo -e "${YELLOW}[WARN] ANDROID_HOME or ANDROID_SDK_ROOT environment variable is not set.${RESET}"
  echo -e "${YELLOW}Attempting to verify standard Windows/Mac SDK paths...${RESET}"
  
  # Check common paths
  COMMON_WIN_PATH="$USERPROFILE/AppData/Local/Android/Sdk"
  COMMON_MAC_PATH="$HOME/Library/Android/sdk"
  
  if [ -d "$COMMON_WIN_PATH" ]; then
    export ANDROID_HOME="$COMMON_WIN_PATH"
    echo -e "${GREEN}✓ Found Android SDK at: $ANDROID_HOME${RESET}"
  elif [ -d "$COMMON_MAC_PATH" ]; then
    export ANDROID_HOME="$COMMON_MAC_PATH"
    echo -e "${GREEN}✓ Found Android SDK at: $ANDROID_HOME${RESET}"
  else
    echo -e "${RED}[ERROR] Android SDK was not found in common locations.${RESET}"
    echo -e "${RED}Please set the ANDROID_HOME environment variable to your Android SDK directory.${RESET}"
    exit 1
  fi
else
  SDK_PATH="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
  echo -e "${GREEN}✓ Android SDK path verified: $SDK_PATH${RESET}"
fi

# --- STEP 2: Fetch dependencies ---
echo -e "\n${BOLD}[ STEP 2/4 ] Fetching dependencies...${RESET}"
# Check if node_modules exists, if not install
if [ ! -d "node_modules" ]; then
  run_with_spinner "Installing node dependencies (npm install)" npm install
else
  echo -e "${GREEN}✓ Node modules already installed.${RESET}"
fi

# If publishing is requested, run publish workflow instead of standard build
if [ "$PUBLISH_BUILD" = "true" ]; then
  # Ensure android directory exists since publish script requires gradlew
  if [ ! -d "android" ]; then
    echo -e "\n${YELLOW}android/ folder not found. Generating native project wrapper...${RESET}"
    run_with_spinner "Generating native project (expo prebuild)" npx expo prebuild --platform android
  fi

  echo -e "\n${BOLD}[ STEP 3/4 ] Running GitHub Publish Sequence...${RESET}"
  PUBLISH_ARGS=""
  if [ "$CLEAN_BUILD" = "true" ]; then
    PUBLISH_ARGS="--force"
  fi
  node publish-github.js $PUBLISH_ARGS
  PUBLISH_EXIT=$?
  
  if [ $PUBLISH_EXIT -eq 0 ]; then
    # Copy APK to root
    APK_SRC="android/app/build/outputs/apk/release/app-release.apk"
    APK_DEST="CatalystEssentials.apk"
    if [ -f "$APK_SRC" ]; then
      rm -f "$APK_DEST"
      cp "$APK_SRC" "$APK_DEST"
      echo -e "\n=================================================="
      echo -e "${GREEN}${BOLD}🎉 PUBLISH & BUILD COMPLETED SUCCESSFULLY!${RESET}"
      echo -e "=================================================="
      echo -e "${CYAN}Output File:${RESET} ${BOLD}$APK_DEST${RESET}"
      echo -e "${CYAN}File Size:  ${RESET} $(du -h "$APK_DEST" | cut -f1)"
      echo -e "=================================================="
    fi
    exit 0
  else
    echo -e "${RED}[ERROR] Publishing failed.${RESET}"
    exit 1
  fi
fi

# --- STEP 3: Expo Prebuild ---
echo -e "\n${BOLD}[ STEP 3/4 ] Generating Native Android Project wrapper...${RESET}"

if [ "$CLEAN_BUILD" = "true" ]; then
  echo -e "${YELLOW}Clean build requested. Regenerating android/ folder from scratch...${RESET}"
  run_with_spinner "Generating native project (expo prebuild --clean)" npx expo prebuild --platform android --clean
elif [ ! -d "android" ]; then
  echo -e "${YELLOW}android/ folder not found. Generating native project...${RESET}"
  run_with_spinner "Generating native project (expo prebuild)" npx expo prebuild --platform android
else
  echo -e "${GREEN}✓ android/ folder already exists. Skipping native project regeneration to leverage Gradle caching.${RESET}"
  echo -e "${YELLOW}Hint: Run with '--clean' or '-c' to force-regenerate the native folder (e.g., ./build.sh --clean).${RESET}"
fi

# --- STEP 4: Gradle Compilation ---
echo -e "\n${BOLD}[ STEP 4/4 ] Compiling Production-level APK...${RESET}"

if [ ! -d "android" ]; then
  echo -e "${RED}[ERROR] Android folder was not generated correctly.${RESET}"
  exit 1
fi

# Move into android folder
cd android || exit

# Run Gradle Wrapper
if [ -f "./gradlew" ]; then
  run_with_spinner "Compiling Release APK (gradlew assembleRelease)" ./gradlew assembleRelease
elif [ -f "gradlew.bat" ]; then
  # Fallback for Windows-only terminals
  run_with_spinner "Compiling Release APK (gradlew.bat assembleRelease)" cmd.exe /c "gradlew.bat assembleRelease"
else
  echo -e "${RED}[ERROR] Gradle wrapper (gradlew) not found in android directory.${RESET}"
  exit 1
fi

# Navigate back to root
cd .. || exit

# --- STEP 5: Package Output ---
APK_SRC="android/app/build/outputs/apk/release/app-release.apk"
APK_DEST="CatalystEssentials.apk"

if [ -f "$APK_SRC" ]; then
  # Clear old destination first to avoid confusion if copy fails
  rm -f "$APK_DEST"
  cp "$APK_SRC" "$APK_DEST"
  echo -e "\n=================================================="
  echo -e "${GREEN}${BOLD}🎉 BUILD COMPLETED SUCCESSFULLY!${RESET}"
  echo -e "=================================================="
  echo -e "${CYAN}Output File:${RESET} ${BOLD}$APK_DEST${RESET}"
  echo -e "${CYAN}File Size:  ${RESET} $(du -h "$APK_DEST" | cut -f1)"
  echo -e "=================================================="
  echo -e "${GREEN}You can now download and install the APK on any Android device!${RESET}"
else
  echo -e "\n${RED}[ERROR] Build succeeded but could not locate output APK at:${RESET}"
  echo -e "${RED}$APK_SRC${RESET}"
  exit 1
fi
