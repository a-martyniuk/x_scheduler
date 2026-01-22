import asyncio
from playwright.async_api import async_playwright
import json
import os

# CONFIG
COOKIES_FILE = "cookies.json"

async def main():
    print("Launching browser... Please log in to X manually.")
    async with async_playwright() as p:
        # Launch non-headless to let user interact
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        
        # Open page
        page = await context.new_page()
        await page.goto("https://x.com/i/flow/login")

        print("Waiting for you to log in...")
        print("Script will wait up to 5 minutes for you to reach the home page (detecting 'Account Switcher' or 'Tweet' button).")

        try:
            # Wait for an element that indicates successful login. 
            # [data-testid="SideNav_AccountSwitcher_Button"] is usually the profile entry in bottom left.
            # [data-testid="tweetButtonInline"] is the post button.
            await page.wait_for_selector('[data-testid="SideNav_AccountSwitcher_Button"]', timeout=300000) 
            print("Login detected!")
            
            # Explicitly wait a moment for cookies to fully set
            await asyncio.sleep(2)
            
            cookies = await context.cookies()
            output_path = os.path.join(os.path.dirname(__file__), COOKIES_FILE)
            with open(output_path, "w") as f:
                json.dump(cookies, f, indent=2)
            
            print(f"✅ Success! Cookies saved to {output_path}")

        except Exception as e:
            print(f"❌ Timeout or error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
