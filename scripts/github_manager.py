import os
import sys
import json
import base64
import argparse
import subprocess
import requests
from nacl import encoding, public
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "").strip()
GITHUB_USER = os.getenv("GITHUB_USER", "kashifjutt7456-art").strip()
GITHUB_REPO = os.getenv("GITHUB_REPO", "tiktok-live-booster").strip()

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

def encrypt_secret(public_key_str: str, secret_value: str) -> str:
    """Encrypts a secret using libsodium public-key encryption for GitHub Secrets."""
    public_key = public.PublicKey(public_key_str.encode("utf-8"), encoding.Base64Encoder)
    sealed_box = public.SealedBox(public_key)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")

def get_repo_public_key(owner: str, repo: str):
    """Fetches repository public key for encrypting secrets."""
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/secrets/public-key"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        return res.json()
    else:
        print(f"[-] Failed to get public key for {owner}/{repo}: {res.status_code} - {res.text}")
        return None

def set_github_secret(owner: str, repo: str, secret_name: str, secret_value: str) -> bool:
    """Sets a secret in the target GitHub repository."""
    pk_info = get_repo_public_key(owner, repo)
    if not pk_info:
        return False

    key_id = pk_info["key_id"]
    public_key = pk_info["key"]
    encrypted_value = encrypt_secret(public_key, secret_value)

    url = f"https://api.github.com/repos/{owner}/{repo}/actions/secrets/{secret_name}"
    payload = {
        "encrypted_value": encrypted_value,
        "key_id": key_id
    }
    res = requests.put(url, headers=HEADERS, json=payload)
    if res.status_code in [201, 204]:
        print(f"[+] Secret '{secret_name}' successfully set on GitHub repository {owner}/{repo}!")
        return True
    else:
        print(f"[-] Failed to set secret '{secret_name}': {res.status_code} - {res.text}")
        return False

def create_or_verify_repo(repo_name: str = GITHUB_REPO, is_private: bool = True):
    """Creates the repository if it doesn't exist."""
    url = f"https://api.github.com/repos/{GITHUB_USER}/{repo_name}"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        print(f"[+] Repository '{GITHUB_USER}/{repo_name}' already exists.")
        return True
    
    print(f"[*] Creating repository '{repo_name}' on GitHub under user '{GITHUB_USER}'...")
    create_url = "https://api.github.com/user/repos"
    payload = {
        "name": repo_name,
        "private": is_private,
        "description": "TikTok Mobile App Live Stream Multi-Viewer & Auto-Liker"
    }
    create_res = requests.post(create_url, headers=HEADERS, json=payload)
    if create_res.status_code == 201:
        print(f"[SUCCESS] Repository '{repo_name}' created successfully on GitHub!")
        return True
    else:
        print(f"[-] Failed to create repository: {create_res.status_code} - {create_res.text}")
        return False

def push_code_to_github(repo_name: str = GITHUB_REPO):
    """Initializes git and pushes codebase to GitHub."""
    create_or_verify_repo(repo_name)
    remote_url = f"https://{GITHUB_TOKEN}@github.com/{GITHUB_USER}/{repo_name}.git"

    print("[*] Initializing git commit & pushing to GitHub...")
    subprocess.run(["git", "init"], check=False)
    subprocess.run(["git", "config", "user.name", GITHUB_USER], check=False)
    subprocess.run(["git", "config", "user.email", f"{GITHUB_USER}@users.noreply.github.com"], check=False)
    subprocess.run(["git", "add", "."], check=False)
    subprocess.run(["git", "commit", "-m", "Initial commit: TikTok Mobile App Live Stream Booster"], check=False)
    subprocess.run(["git", "branch", "-M", "main"], check=False)
    
    # Remove existing remote if present
    subprocess.run(["git", "remote", "remove", "origin"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    subprocess.run(["git", "remote", "add", "origin", remote_url], check=False)
    
    res = subprocess.run(["git", "push", "-u", "origin", "main", "--force"], check=False)
    if res.returncode == 0:
        print(f"[SUCCESS] Code pushed to https://github.com/{GITHUB_USER}/{repo_name}!")
        return True
    else:
        print(f"[-] Push failed. Exit code: {res.returncode}")
        return False

def sync_secrets_to_github(sheet_id: str, service_account_file: str = "service_account.json", repo_name: str = GITHUB_REPO):
    """Uploads GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON to GitHub Secrets."""
    if not os.path.exists(service_account_file):
        print(f"[-] Service account file '{service_account_file}' not found.")
        return False

    with open(service_account_file, "r", encoding="utf-8") as f:
        sa_content = f.read()

    print(f"[*] Uploading secrets to https://github.com/{GITHUB_USER}/{repo_name} ...")
    set_github_secret(GITHUB_USER, repo_name, "GOOGLE_SHEET_ID", sheet_id.strip())
    set_github_secret(GITHUB_USER, repo_name, "GOOGLE_SERVICE_ACCOUNT_JSON", sa_content.strip())
    print("[SUCCESS] All GitHub Secrets configured!")

def dispatch_workflow(stream_url: str, duration: int = 60, likes_per_min: int = 120, repo_name: str = GITHUB_REPO):
    """Triggers the live stream viewer & auto-liker workflow on GitHub Actions."""
    url = f"https://api.github.com/repos/{GITHUB_USER}/{repo_name}/actions/workflows/tiktok-app-booster.yml/dispatches"
    payload = {
        "ref": "main",
        "inputs": {
            "stream_url": stream_url,
            "duration_minutes": str(duration),
            "likes_per_minute": str(likes_per_min),
            "vpn_provider": "none"
        }
    }
    res = requests.post(url, headers=HEADERS, json=payload)
    if res.status_code == 204:
        print(f"[SUCCESS] Triggered Live Booster Workflow on GitHub!")
        print(f"Stream: {stream_url} | Duration: {duration}m | Likes/min: {likes_per_min}")
        print(f"View live execution: https://github.com/{GITHUB_USER}/{repo_name}/actions")
        return True
    else:
        print(f"[-] Failed to dispatch workflow: {res.status_code} - {res.text}")
        return False

def check_runs(repo_name: str = GITHUB_REPO):
    """Lists current workflow runs."""
    url = f"https://api.github.com/repos/{GITHUB_USER}/{repo_name}/actions/runs"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        runs = res.json().get("workflow_runs", [])
        print(f"=== Recent Workflow Runs on {GITHUB_USER}/{repo_name} ===")
        for r in runs[:5]:
            print(f"Run #{r['id']} | Status: {r['status']} | Conclusion: {r['conclusion']} | Title: {r['display_title']} | URL: {r['html_url']}")
    else:
        print(f"[-] Could not fetch runs: {res.status_code}")

def main():
    parser = argparse.ArgumentParser(description="GitHub Manager for TikTok Live Automation")
    subparsers = parser.add_subparsers(dest="command")

    # Push command
    p_push = subparsers.add_parser("push", help="Push codebase to GitHub")
    p_push.add_argument("--repo", type=str, default=GITHUB_REPO, help="Target repository name")

    # Set-secrets command
    p_sec = subparsers.add_parser("set-secrets", help="Upload secrets to GitHub repository")
    p_sec.add_argument("--sheet-id", type=str, required=True, help="Google Sheet ID")
    p_sec.add_argument("--sa-file", type=str, default="service_account.json", help="Path to service account JSON")
    p_sec.add_argument("--repo", type=str, default=GITHUB_REPO, help="Target repository name")

    # Dispatch command
    p_disp = subparsers.add_parser("dispatch", help="Trigger live stream workflow")
    p_disp.add_argument("--stream-url", type=str, required=True, help="Target TikTok Live URL / @username")
    p_disp.add_argument("--duration", type=int, default=60, help="Duration in minutes")
    p_disp.add_argument("--likes-per-min", type=int, default=120, help="Likes per minute")
    p_disp.add_argument("--repo", type=str, default=GITHUB_REPO, help="Target repository name")

    # Runs command
    p_runs = subparsers.add_parser("runs", help="List workflow runs")
    p_runs.add_argument("--repo", type=str, default=GITHUB_REPO, help="Target repository name")

    args = parser.parse_args()

    if args.command == "push":
        push_code_to_github(args.repo)
    elif args.command == "set-secrets":
        sync_secrets_to_github(args.sheet_id, args.sa_file, args.repo)
    elif args.command == "dispatch":
        dispatch_workflow(args.stream_url, args.duration, args.likes_per_min, args.repo)
    elif args.command == "runs":
        check_runs(args.repo)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
