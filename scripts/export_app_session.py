import os
import sys
import subprocess
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def export_session(account_name: str = "account_1"):
    """
    Backs up the authenticated TikTok App session from a connected Android device or emulator.
    This creates an encrypted/portable archive that can be restored on any GitHub runner without logging in.
    """
    print(f"=== Exporting TikTok App Session for: {account_name} ===")
    
    # 1. Stop TikTok
    print("Stopping TikTok app...")
    subprocess.run(["adb", "shell", "am", "force-stop", "com.zhiliaoapp.musically"], check=False)
    
    # 2. Get Device Android ID
    res = subprocess.run(["adb", "shell", "settings", "get", "secure", "android_id"], stdout=subprocess.PIPE, text=True)
    device_id = res.stdout.strip()
    print(f"[+] Device Android ID: {device_id}")

    # 3. Create Tarball inside device
    output_filename = f"tiktok_session_{account_name}.tar.gz"
    device_tar = f"/sdcard/{output_filename}"
    
    print("Creating session bundle from app data...")
    subprocess.run([
        "adb", "shell",
        f"tar -czf {device_tar} /data/data/com.zhiliaoapp.musically/shared_prefs /data/data/com.zhiliaoapp.musically/databases 2>/dev/null"
    ], check=False)
    
    # 4. Pull to computer
    print(f"Pulling archive to {output_filename}...")
    pull_res = subprocess.run(["adb", "pull", device_tar, output_filename], stdout=subprocess.PIPE, text=True)
    subprocess.run(["adb", "shell", "rm", device_tar], check=False)
    
    if os.path.exists(output_filename) and os.path.getsize(output_filename) > 0:
        print(f"\n[SUCCESS] Session successfully exported to: {output_filename}")
        print("--------------------------------------------------------------------------------")
        print("Instructions for your Google Sheet:")
        print(f"1. Upload '{output_filename}' to your cloud storage (Google Drive, GitHub Releases, S3, R2, etc.)")
        print(f"2. Paste the direct download link into the 'session_backup_url' column for {account_name}.")
        print(f"3. Paste device ID '{device_id}' into the 'device_id' column.")
        print("--------------------------------------------------------------------------------")
    else:
        print("\n[-] Could not export session. Make sure your local emulator has root access or debuggable permissions.")

if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "account_1"
    export_session(name)
