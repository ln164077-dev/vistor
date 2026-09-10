import requests
import json

# URL of the deployed website or local dev server
URL = "https://visitorswebsite.manus.space"

def test_site_accessibility():
    print(f"[*] Testing connection to: {URL}")
    try:
        response = requests.get(URL, timeout=10)
        print(f"[+] Status Code: {response.status_code}")
        if response.status_code == 200:
            print("[+] Website is online and responding successfully.")
        else:
            print("[-] Website returned non-200 status code.")
    except Exception as e:
        print(f"[-] Error connecting to website: {e}")

if __name__ == "__main__":
    test_site_accessibility()
