# TikTok Mobile App Live Stream Multi-Viewer & Auto-Liker (100% Cloud Automated)

> [!IMPORTANT]
> **Gaming Incentive Program Rule**: Web automation is strictly excluded. **Only live stream engagement generated through the official TikTok Mobile App counts.**
> This system deploys genuine Android environments running the TikTok Mobile App on GitHub Actions runners, automated via high-speed ADB and native touch simulation.
> **100% Cloud-Native**: No local PC, emulator, or phone required. All session extraction, storage, and synchronization is handled automatically in the cloud via Google Drive & Google Sheets!

---

## 🌟 100% Automated Cloud Architecture (Zero Local Work)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                     FULLY AUTOMATED GOOGLE DRIVE & GITHUB ACTIONS PIPELINE                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

 [ 1. Cloud-Native First Run (Onboarding) ]
 ──────────────────────────────────────────
  GitHub Runner starts for Account
          │
          ├──► 1. Generates permanent hardware Device ID (e.g. 4a8f9b2c...)
          ├──► 2. Injects credentials / token into Android TikTok Mobile App
          ├──► 3. Extracts authenticated app data package (shared_prefs & databases)
          ├──► 4. Automatically uploads session archive to your Google Drive ("TikTok_Sessions")
          └──► 5. Saves the Google Drive link + Device ID directly into your Google Sheet!

 [ 2. Every Subsequent 6-Hour Runner Rotation (Across 20–30 Repos) ]
 ───────────────────────────────────────────────────────────────────
  GitHub Runner starts
          │
          ├──► 1. Applies the persistent Device ID: adb shell settings put secure android_id ...
          ├──► 2. Automatically downloads session archive from Google Drive (< 2s)
          ├──► 3. Restores app data into TikTok directory
          ├──► 4. Opens TikTok App --> 100% ALREADY AUTHENTICATED! (Zero logins, Zero captchas)
          ├──► 5. Deep-links into Live Stream: snssdk1233://live?room_id=...
          ├──► 6. Native Auto-Tapper sends 120–240 likes/min continuously
          └──► 7. Syncs real-time watch time & likes back to Google Sheet
```

---

## 1. Google Drive & Google Sheets Setup

You only need **1 Google Service Account** (which has access to both Google Sheets and Google Drive).

### Step 1: Create Google Sheet
Create a Google Sheet named **`Accounts`** with these columns (or copy [`accounts_template.csv`](file:///c:/Users/Hi/Desktop/Gaming%20Incentive%20Program/accounts_template.csv)):

| id | username | password | cookies_json | session_backup_url | device_id | proxy | status | last_active | assigned_runner |
|---|---|---|---|---|---|---|---|---|---|
| 1 | user1@mail.com | Pass123! | `sessionid_token_1` | *(Auto-filled by Cloud)* | *(Auto-filled)* | `http://user:pass@proxy1:8080` | Idle | | |
| 2 | user2@mail.com | Pass123! | `sessionid_token_2` | *(Auto-filled by Cloud)* | *(Auto-filled)* | `http://user:pass@proxy2:8080` | Idle | | |

### Step 2: Share with Service Account
1. Create a Service Account in Google Cloud Console with **Google Drive API** and **Google Sheets API** enabled.
2. Share your Google Sheet and an optional Google Drive folder with your Service Account email (e.g. `bot-runner@your-project.iam.gserviceaccount.com`) as **Editor**.

---

## 2. GitHub Secrets Configuration

In your GitHub repository (or across all 20–30 accounts), add:
**Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**:

| Secret Name | Description | Required? |
|---|---|---|
| `GOOGLE_SHEET_ID` | Your Google Sheet ID (from the spreadsheet URL) | Yes |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Entire contents of your Google Service Account JSON key | Yes |
| `GOOGLE_SHEET_NAME` | Sheet tab name (default: `Accounts`) | Optional |
| `VPN_TOKEN` | NordVPN Token (if using NordVPN CLI) | Optional |
| `TIKTOK_APK_URL` | Download link to x86_64 TikTok Mobile APK | Optional |

---

## 3. How to Run via GitHub Actions

1. Go to the **Actions** tab in your repository.
2. Select **TikTok Mobile App Live Stream Multi-Viewer & Auto-Liker**.
3. Click **Run workflow** and enter:
   - **Target TikTok Live Stream URL / @username**: e.g. `https://www.tiktok.com/@username/live` or `@username`
   - **Duration in minutes**: e.g. `60` (up to 360 min)
   - **Likes per minute**: e.g. `120`
   - **VPN Provider**: `none`, `nordvpn`, or `pia`
4. Click **Run workflow**.

---

## 4. Scaling Across 20–30 GitHub Accounts

1. Duplicate/fork this repository across your 20–30 GitHub accounts.
2. Add your `GOOGLE_SHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON` to each repository secrets.
3. Each repository runs 5 parallel matrix runners.
4. 25 repositories x 5 runners = **125 concurrent mobile app viewers** watching and generating over **900,000 likes/hour**!
5. All runners automatically pull from and synchronize with your central Google Drive and Google Sheet without collision.

---

## File Structure

```
├── .github/workflows/
│   ├── tiktok-app-booster.yml     # Main parallel matrix workflow
│   └── test-connection.yml        # Diagnostic test workflow
├── scripts/
│   ├── setup_emulator.sh          # Android SDK & AVD bootstrap script
│   ├── setup_vpn.sh               # VPN setup helper
│   ├── fast_tap.sh                # High-speed on-device native touch script
│   └── test_local.py              # Test suite
├── src/
│   ├── config.py                  # App configuration & CLI args
│   ├── models.py                  # Account & stream data models
│   ├── sheet_service.py           # Google Sheets reader & status updater
│   ├── drive_service.py           # Google Drive cloud session storage & sync
│   ├── auto_login.py              # Autonomous cloud onboarding & session archiver
│   ├── adb_controller.py          # Android ADB automation & touch engine
│   ├── vpn_service.py             # VPN routing service
│   └── main.py                    # Master orchestrator
├── accounts_template.csv          # Template for Google Sheets
├── accounts_template.json         # JSON format template
├── requirements.txt               # Dependencies
└── README.md                      # Documentation
```
