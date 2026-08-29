#!/usr/bin/env bash
# Bootstrap Android Emulator & TikTok Mobile APK on GitHub Actions Runner
set -e

echo "=== [1/5] Setting up Android Environment ==="
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Library/Android/sdk}
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH

echo "Checking ADB version..."
adb version

echo "=== [2/5] Creating Optimized Android Virtual Device (AVD) ==="
AVD_NAME="TikTokRunnerDevice"
SYSTEM_IMAGE="system-images;android-34;google_apis;x86_64"

# Accept licenses
yes | sdkmanager --licenses > /dev/null 2>&1 || true

# Install system image if missing
if ! sdkmanager --list_installed | grep -q "android-34.*google_apis.*x86_64"; then
    echo "Downloading system image: $SYSTEM_IMAGE ..."
    sdkmanager "$SYSTEM_IMAGE"
fi

# Create AVD
echo "no" | avdmanager create avd -n "$AVD_NAME" -k "$SYSTEM_IMAGE" --force

echo "=== [3/5] Starting Headless Android Emulator ==="
# Check OS for hardware acceleration flag
EMU_FLAGS="-no-window -no-audio -no-boot-anim -no-snapshot-save -gpu swiftshader_indirect -camera-back none -camera-front none -memory 2048"

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Running on macOS (Native Hypervisor.framework acceleration enabled)"
    $ANDROID_HOME/emulator/emulator -avd "$AVD_NAME" $EMU_FLAGS &
else
    echo "Running on Linux (KVM acceleration enabled)"
    $ANDROID_HOME/emulator/emulator -avd "$AVD_NAME" $EMU_FLAGS -accel on &
fi

echo "=== [4/5] Waiting for Android Emulator to Boot Complete ==="
adb wait-for-device
while true; do
    BOOT=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
    if [ "$BOOT" = "1" ]; then
        echo "Android Emulator booted successfully!"
        break
    fi
    echo "Waiting for boot... (sys.boot_completed=$BOOT)"
    sleep 3
done

# Dismiss system keyguard
adb shell input keyevent 82 || true

echo "=== [5/5] Installing TikTok APK ==="
TIKTOK_APK_PATH="${TIKTOK_APK_PATH:-./tiktok_app.apk}"

if [ -f "$TIKTOK_APK_PATH" ]; then
    echo "Installing local APK from $TIKTOK_APK_PATH ..."
    adb install -r -d "$TIKTOK_APK_PATH"
elif [ -n "$TIKTOK_APK_URL" ]; then
    echo "Downloading and installing APK from $TIKTOK_APK_URL ..."
    curl -L "$TIKTOK_APK_URL" -o /tmp/tiktok.apk
    adb install -r -d /tmp/tiktok.apk
else
    echo "No APK specified or found at $TIKTOK_APK_PATH. Ensure TikTok is installed or provided in repository."
fi

# Push fast_tap.sh script to device
chmod +x ./scripts/fast_tap.sh || true
adb push ./scripts/fast_tap.sh /data/local/tmp/fast_tap.sh
adb shell chmod +x /data/local/tmp/fast_tap.sh

echo "=== Android Emulator & TikTok Environment Ready! ==="
