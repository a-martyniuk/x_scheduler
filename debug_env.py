"""
Debug script to check environment variables in Railway
"""
import os
import json

print("=" * 50)
print("ENVIRONMENT VARIABLE DIAGNOSTIC")
print("=" * 50)

# Check if variables exist
x_cookies = os.environ.get('X_COOKIES_JSON')
x_username = os.environ.get('X_USERNAME')

print(f"\n1. X_USERNAME exists: {x_username is not None}")
if x_username:
    print(f"   Value: '{x_username}'")
    print(f"   Length: {len(x_username)}")

print(f"\n2. X_COOKIES_JSON exists: {x_cookies is not None}")
if x_cookies:
    print(f"   Length: {len(x_cookies)} characters")
    print(f"   First 100 chars: {x_cookies[:100]}")
    print(f"   Last 100 chars: {x_cookies[-100:]}")
    
    # Try to parse as JSON
    try:
        parsed = json.loads(x_cookies)
        print(f"\n3. JSON is VALID ✓")
        print(f"   Has 'cookies' key: {'cookies' in parsed}")
        if 'cookies' in parsed:
            print(f"   Number of cookies: {len(parsed['cookies'])}")
    except json.JSONDecodeError as e:
        print(f"\n3. JSON is INVALID ✗")
        print(f"   Error: {e}")
        print(f"   This is why the account is not showing!")
else:
    print("\n3. X_COOKIES_JSON is NOT SET")
    print("   This is why the account is not showing!")

print("\n" + "=" * 50)
