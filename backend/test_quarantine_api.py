import requests
import sys

API_URL = "http://localhost:8000/api/posts"

def test_quarantine_filter():
    print(f"Testing {API_URL}...")
    try:
        # 1. Fetch default (should not have quarantine)
        res = requests.get(API_URL + "/")
        if res.status_code != 200:
            print(f"Failed to fetch default: {res.text}")
            return
        
        default_posts = res.json()
        print(f"Default posts count: {len(default_posts)}")
        for p in default_posts:
            if p['status'] == 'quarantine':
                print("FAILURE: Found quarantine post in default feed!")
                return

        # 2. Fetch quarantine specifically
        res_q = requests.get(API_URL + "/", params={"status": "quarantine"})
        if res_q.status_code != 200:
             print(f"Failed to fetch quarantine: {res_q.text}")
             return
        
        q_posts = res_q.json()
        print(f"Quarantine posts count: {len(q_posts)}")
        for p in q_posts:
            if p['status'] != 'quarantine':
                print(f"FAILURE: Found non-quarantine post in quarantine feed: {p['status']}")
                return

        print("SUCCESS: API filtering works correctly.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_quarantine_filter()
