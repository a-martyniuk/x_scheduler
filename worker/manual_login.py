import asyncio
import os
import json
from playwright.async_api import async_playwright

async def manual_login():
    cookies_path = os.path.join(os.path.dirname(__file__), "cookies.json")
    user_info_path = os.path.join(os.path.dirname(__file__), "user_info.json")
    
    print("\n--- X Scheduler Manual Login ---")
    print("This will open a browser window. Please log in to X.")
    print("After you reach the Home page, close the browser or come back here.")
    
    async with async_playwright() as p:
        # Launch browser in HEADED mode, using MS Edge to look more 'human'
        try:
            browser = await p.chromium.launch(headless=False, channel="msedge")
        except:
            # Fallback to default chromium if edge not found
            browser = await p.chromium.launch(headless=False)
            
        context = await browser.new_context(
             user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        await page.goto("https://x.com/i/flow/login")
        
        print("\nWaiting for you to log in...")
        print("Keep this terminal open. Follow the steps in the browser.")
        
        # Wait for user to reach home (indication of success)
        # We check for the compose button or home link
        try:
            await page.wait_for_selector('[data-testid="AppTabBar_Home_Link"]', timeout=300000) # 5 minutes
            print("\n✅ Login detected!")
            
            # Save state
            await context.storage_state(path=cookies_path)
            print(f"✅ Cookies saved to {cookies_path}")
            
            # Try to extract username
            try:
                username_el = await page.wait_for_selector('[data-testid="SideNav_AccountSwitcher_Button"]', timeout=5000)
                username_text = await username_el.text_content()
                # Clean up username (usually looks like 'Account\n@username')
                if "@" in username_text:
                    username = "@" + username_text.split("@")[-1].split()[0]
                else:
                    username = "Connected User"
            except:
                username = "Connected User"
                
            with open(user_info_path, 'w', encoding='utf-8') as f:
                json.dump({"username": username, "status": "connected"}, f, ensure_ascii=False)
            print(f"✅ User info saved ({username})")
            
        except Exception as e:
            print(f"\n❌ Login timed out or failed: {e}")
        
        finally:
            await browser.close()
            print("\nBrowser closed. You can now use the X Scheduler app.")

if __name__ == "__main__":
    asyncio.run(manual_login())
