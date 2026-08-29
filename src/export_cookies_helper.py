import json
import sys

def format_cookies():
    """Helper script to format raw cookie JSON or string into the Google Sheets format."""
    print("=== TikTok Cookie Formatter for Google Sheets ===")
    print("Paste your cookie JSON or sessionid string below (press Enter twice when done):")
    
    lines = []
    while True:
        try:
            line = input()
            if not line:
                break
            lines.append(line)
        except EOFError:
            break
            
    raw_input = "".join(lines).strip()
    if not raw_input:
        print("No input provided.")
        return

    # Check if raw sessionid string
    if not raw_input.startswith("[") and not raw_input.startswith("{"):
        if "sessionid" in raw_input:
            print("\n[+] Detected sessionid key-value.")
        else:
            print("\n[+] Detected raw sessionid token.")
        print(f"Value for Google Sheet 'cookies_json' column:\n{raw_input}")
        return

    try:
        data = json.loads(raw_input)
        # Compact single-line JSON string safe for spreadsheets
        compact = json.dumps(data, separators=(',', ':'))
        print("\n[+] Successfully formatted Cookie JSON for Google Sheet:")
        print("------------------------------------------------------------")
        print(compact)
        print("------------------------------------------------------------")
    except Exception as e:
        print(f"[-] Could not parse JSON: {e}. Outputting as raw text:")
        print(raw_input)

if __name__ == "__main__":
    format_cookies()
