import asyncio
import os
import json
import re
from playwright.async_api import async_playwright
import random

# CONFIG
# CONFIG
WORKER_DIR = os.path.dirname(__file__)
SCREENSHOTS_DIR = os.path.join(WORKER_DIR, "screenshots")
ACCOUNTS_DIR = os.path.join(WORKER_DIR, "accounts")

def get_user_paths(username: str):
    user_dir = os.path.join(ACCOUNTS_DIR, username)
    os.makedirs(user_dir, exist_ok=True)
    return {
        "cookies": os.path.join(user_dir, "cookies.json"),
        "user_info": os.path.join(user_dir, "user_info.json"),
        "login_log": os.path.join(user_dir, "login.log")
    }

async def human_delay(min_sec=1.0, max_sec=3.0):
    """Sleeps for a random amount of time to simulate human behavior."""
    delay = random.uniform(min_sec, max_sec)
    await asyncio.sleep(delay)

async def publish_post_task(content: str, media_paths: str = None, reply_to_id: str = None, username: str = None, dry_run: bool = False):
    """
    Publishes a post to X using Playwright.
    Supports threading via reply_to_id and multiple media files.
    Returns a dict with success (bool), log (str), screenshot_path (str), tweet_id (str).
    """
    log_messages = []
    screenshot_file = None
    success = False
    tweet_id = None

    def log(msg):
        print(f"[Worker] {msg}")
        log_messages.append(msg)

    # Resolve cookies path
    if username:
        paths = get_user_paths(username)
        cookies_path = paths["cookies"]
    else:
        # Fallback to legacy path if no username provided
        cookies_path = os.path.join(WORKER_DIR, "cookies.json")

    # Check if cookies file exists, if not try environment variable
    storage_state = None
    temp_cookies_path = None
    
    if os.path.exists(cookies_path) and os.path.getsize(cookies_path) > 2:
        storage_state = cookies_path
        log(f"Using cookies from file: {cookies_path}")
    else:
        # Try to load from environment variable (for Railway deployment)
        cookies_json_str = os.environ.get('X_COOKIES_JSON')
        if cookies_json_str:
            try:
                # Create a temporary file with the cookies
                import tempfile
                temp_fd, temp_cookies_path = tempfile.mkstemp(suffix='.json', text=True)
                with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
                    f.write(cookies_json_str)
                storage_state = temp_cookies_path
                log("Using cookies from X_COOKIES_JSON environment variable")
            except Exception as e:
                log(f"Failed to load cookies from environment: {e}")
                return {"success": False, "log": f"Failed to load cookies from environment: {e}", "screenshot_path": None, "tweet_id": None}
        else:
            log(f"No cookies found for {username or 'default'}")
            return {"success": False, "log": f"cookies.json not found and X_COOKIES_JSON not set for {username or 'default'}.", "screenshot_path": None, "tweet_id": None}


    async with async_playwright() as p:
        # Launch browser (headless=True for background operation)
        browser = await p.chromium.launch(headless=True) 

        try:
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                storage_state=storage_state
            )
            context.set_default_timeout(45000) # 45 seconds
            context.set_default_navigation_timeout(90000) # 90 seconds

            if storage_state:
                log("Session state loaded successfully.")
            else:
                log("No session state found. Proceeding as guest/fresh.")
        except Exception as e:
            await browser.close()
            # Clean up temp file if it was created
            if temp_cookies_path and os.path.exists(temp_cookies_path):
                try:
                    os.unlink(temp_cookies_path)
                except:
                    pass
            return {"success": False, "log": f"Failed to initialize context with session: {e}", "screenshot_path": None, "tweet_id": None}


        page = await context.new_page()

        try:
            # --- NAVIGATION / SETUP ---
            if reply_to_id:
                log(f"Thread Mode: Replying to tweet {reply_to_id}...")
                await page.goto(f"https://x.com/i/status/{reply_to_id}", timeout=60000)
                await human_delay(3, 5)
                
                # Find the main tweet and click reply
                try:
                    reply_btn = page.locator('article[data-testid="tweet"]').first.locator('[data-testid="reply"]')
                    await reply_btn.click()
                    log("Clicked Reply button on parent tweet.")
                    await page.wait_for_selector('[data-testid="tweetTextarea_0"]', state="visible", timeout=10000)
                    log("Reply modal open.")
                except Exception as e:
                     log(f"Failed to open reply modal: {e}. Trying fallback.")
            else:
                log("New Post Mode: Navigating to home...")
                await page.goto("https://x.com/home", timeout=60000)
                await human_delay(2, 5)
                try:
                    await page.wait_for_selector('[data-testid="tweetTextarea_0"]', state="visible", timeout=10000)
                    log("Home Compose box found.")
                    await page.locator('[data-testid="tweetTextarea_0"]').click()
                except:
                    log("Converting to Global Compose modal logic...")
                    await page.keyboard.press("n") # Shortcut for new tweet
                    await human_delay(1, 2)

            # --- CONTENT ENTRY ---
            # Wait for text area (works for both Home and Reply Modal)
            textarea = page.locator('[data-testid="tweetTextarea_0"]')
            if await textarea.is_visible():
                await textarea.click()
                await human_delay(0.5, 1)
                
                # Type content
                await page.keyboard.type(content, delay=random.randint(30, 80)) 
                log(f"Typed: {content[:20]}...")
                await human_delay(1, 3)

                # Upload media (multiple support)
                if media_paths:
                    path_list = [p.strip() for p in media_paths.split(',') if p.strip()]
                    valid_paths = [p for p in path_list if os.path.exists(p)]
                    
                    if valid_paths:
                        log(f"Uploading {len(valid_paths)} media files: {valid_paths}")
                        # X allows up to 4 images, or 1 video, or 1 GIF
                        await page.set_input_files('[data-testid="fileInput"]', valid_paths)
                        log("Media upload triggered. Waiting for processing...")
                        await human_delay(5, 10) # Videos need more time
                    else:
                        log(f"Warning: Media paths provided but files not found: {path_list}")
                
                # --- SEND ---

                if not dry_run:
                    tweet_button = page.locator('[data-testid="tweetButtonInline"]')
                    # Determine correct button (Modal uses 'tweetButton', inline uses 'tweetButtonInline' usually)
                    # Actually, for replies it might be 'tweetButton' inside the modal.
                    # Let's try to find *any* enabled tweet button in the active context
                    if not await tweet_button.is_visible():
                         tweet_button = page.locator('[data-testid="tweetButton"]')
                    
                    if await tweet_button.is_enabled():
                        await tweet_button.click()
                        log("Clicked Post/Reply button.")
                        await human_delay(4, 7) # Wait for network
                        success = True
                    else:
                         log("Button disabled. Content empty or upload stuck?")
                else:
                    log("DRY RUN: Skipping send.")
                    success = True

            else:
                log("Critial: Could not find text area.")

            # --- ID EXTRACTION (Post-Send) ---
            if success and not dry_run:
                log("Attempting to retrieve Tweet ID...")
                try:
                    # Strategy: Click 'Profile' -> Get First Tweet Link
                    await page.locator('[data-testid="AppTabBar_Profile_Link"]').click()
                    await page.wait_for_url("**/status/**", timeout=2000) # Optional wait if profile redirects fast? No, profile is /username
                    await human_delay(2, 4)
                    
                    # Look for the first tweet timestamp/link
                    # Selector: article -> time -> parent anchor
                    latest_tweet_link = page.locator('article').first.locator('time').locator('..')
                    href = await latest_tweet_link.get_attribute('href')
                    
                    if href and 'status' in href:
                        # href format: /username/status/123456789
                        match = re.search(r'status/(\d+)', href)
                        if match:
                            tweet_id = match.group(1)
                            log(f"Extracted Tweet ID: {tweet_id}")
                    else:
                        log("Could not extract ID from profile feed.")
                        
                except Exception as e:
                    log(f"ID Extraction failed: {e}")

            # Verification Screenshot
            screenshot_file = os.path.join(SCREENSHOTS_DIR, f"result_{random.randint(1000,9999)}.png")
            await page.screenshot(path=screenshot_file)

        except Exception as e:
            log(f"Error: {e}")
            screenshot_file = os.path.join(SCREENSHOTS_DIR, f"error_{random.randint(1000,9999)}.png")
            await page.screenshot(path=screenshot_file)
        finally:
            await browser.close()

    return {
        "success": success,
        "log": "\n".join(log_messages),
        "screenshot_path": screenshot_file,
        "tweet_id": tweet_id
    }


async def scrape_stats_task(tweet_id: str, username: str = None):
    """
    Engagement stats for a given tweet ID.
    """
    stats = {"views": 0, "likes": 0, "reposts": 0}
    log_messages = []

    def log(msg):
        print(f"[Worker-Scraper] {msg}")
        log_messages.append(msg)

    if username:
        cookies_path = get_user_paths(username)["cookies"]
    else:
        cookies_path = os.path.join(WORKER_DIR, "cookies.json")

    if not os.path.exists(cookies_path):
        return {"success": False, "log": "cookies.json missing", "stats": stats}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
             user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        try:
            with open(cookies_path, 'r') as f:
                await context.add_cookies(json.load(f))
            
            page = await context.new_page()
            url = f"https://x.com/i/status/{tweet_id}"
            log(f"Navigating to {url}...")
            await page.goto(url, timeout=30000)
            await page.wait_for_selector('article[data-testid="tweet"]', timeout=15000)
            await human_delay(2, 4)

            # Extract Stats
            # Views (often textual like "145 Views" or inside an execution-detail)
            # Strategy: Look for the a tag that links to /analytics
            try:
                # This selector changes often. Generic approach:
                # Use the metrics group at the bottom of the tweet
                # Likes: [data-testid="like"] or [data-testid="unlike"]
                like_el = page.locator('[data-testid="like"], [data-testid="unlike"]').first
                like_text = await like_el.get_attribute("aria-label") 
                # aria-label is usually "15 Likes. Like" or "Like"
                if like_text:
                    match = re.search(r'(\d+) Likes', like_text.replace(",", "")) # "1,234 Likes"
                    if match:
                        stats["likes"] = int(match.group(1))
                
                # Reposts: [data-testid="retweet"] or [data-testid="unretweet"]
                rt_el = page.locator('[data-testid="retweet"], [data-testid="unretweet"]').first
                rt_text = await rt_el.get_attribute("aria-label")
                if rt_text:
                     match = re.search(r'(\d+) Reposts', rt_text.replace(",", ""))
                     if match:
                         stats["reposts"] = int(match.group(1))

                # Views: Usually a span with text "Views"
                # Or href=".../analytics"
                analytics_link = page.locator('a[href*="/analytics"]').first
                if await analytics_link.is_visible():
                     # The text might be inside a parent or sibling
                     # Often it's simple text "150 Views" in a span
                     # Let's try finding the text content of the link
                     view_text = await analytics_link.text_content()
                     # "150 Views"
                     match = re.search(r'([\d,KkMm\.]+) Views', view_text)
                     if match:
                         # Need to parse K/M
                         num_str = match.group(1).replace(",", "")
                         multiplier = 1
                         if 'K' in num_str.upper():
                             multiplier = 1000
                             num_str = num_str.upper().replace("K", "")
                         elif 'M' in num_str.upper():
                             multiplier = 1000000
                             num_str = num_str.upper().replace("M", "")
                         
                         stats["views"] = int(float(num_str) * multiplier)

                log(f"Scraped: {stats}")

            except Exception as e:
                log(f"Parsing failed: {e}")

        except Exception as e:
            log(f"Scrape error: {e}")
        finally:
            await browser.close()

    return {"success": True, "log": "\n".join(log_messages), "stats": stats}

async def login_to_x(username, password):
    """
    Automates login to X and saves cookies per user.
    """
    log_messages = []
    success = False
    paths = get_user_paths(username)
    cookies_path = paths["cookies"]
    user_info_path = paths["user_info"]
    login_log_path = paths["login_log"]
    
    def log(msg):
        print(f"[Worker-Login] {msg}")
        log_messages.append(msg)
        try:
            with open(login_log_path, "a") as f:
                f.write(f"{msg}\n")
        except:
            pass

    # Clear old log
    try:
        with open(login_log_path, "w") as f:
            f.write("--- New Login Attempt ---\n")
    except:
        pass

    log("Starting Playwright...")
    async with async_playwright() as p:
        try:
            log("Launching browser (headless=True)...")
            browser = await p.chromium.launch(headless=True)
            log("Browser launched. Creating context...")
            context = await browser.new_context(
                 user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            log("Context and page created.")

            log("Navigating to login page...")
            await page.goto("https://x.com/i/flow/login", timeout=60000)
            log("At login page.")
            await human_delay(2, 4)

            # 1. Username
            log("Entering username...")
            # Often input[autocomplete="username"] or name="text"
            await page.wait_for_selector('input[autocomplete="username"]', timeout=20000)
            await page.fill('input[autocomplete="username"]', username)
            await page.keyboard.press("Enter")
            await human_delay(2, 3)

            # 2. Check for "Unusual Login" / Email Challenge
            # Sometimes X asks for email or phone if on new device
            if await page.locator('input[name="text"]').is_visible():
                log("Unusual login detected! Taking diagnostic screenshot...")
                diag_screenshot = os.path.join(SCREENSHOTS_DIR, f"unusual_login_{random.randint(1000,9999)}.png")
                await page.screenshot(path=diag_screenshot)
                log(f"Diagnostic screenshot saved: {diag_screenshot}")
                log("(Asking for phone/email). Trying to proceed if possible...")
            
            # 3. Password
            log("Entering password...")
            try:
                await page.wait_for_selector('input[name="password"]', timeout=10000)
                await page.fill('input[name="password"]', password)
                await page.keyboard.press("Enter")
                await human_delay(3, 5)
            except:
                 log("Password field not found. Maybe username invalid or challenge triggered.")
                 await browser.close()
                 return {"success": False, "log": "Login flow interrupted (Password step). check username."}

            # 4. Verification Check
            # Wait for home or some indicator of success
            try:
                # Wait for home link or compose box or notifications
                # X sometimes redirects to /home, sometimes stays on / if already logged in etc.
                await page.wait_for_selector('[data-testid="AppTabBar_Home_Link"], [data-testid="SideNav_AccountSwitcher_Button"]', timeout=30000)
                log("Login verified! Found account indicator.")
                success = True
            except:
                # Check for 2FA input
                if await page.locator('input[data-testid="ocfEnterTextTextInput"]').is_visible():
                     log("2FA Challenge detected. Not supported.")
                else:
                     log("Login verification failed. Timeout waiting for account indicator.")

            if success:
                # Save cookies
                log(f"Saving cookies to {cookies_path}")
                await context.storage_state(path=cookies_path)
                
                # Save user info for frontend display
                try:
                    from datetime import datetime
                    with open(user_info_path, 'w', encoding='utf-8') as f:
                        json.dump({
                            "username": username, 
                            "connected_at": str(datetime.now()),
                            "status": "connected"
                        }, f, ensure_ascii=False)
                    log(f"Saved user info to {user_info_path}")
                except Exception as e:
                    log(f"Failed to save user info: {e}")

        except Exception as e:
            msg = f"Login failed: {e}"
            log(msg)
            screenshot_name = f"error_login_{random.randint(1000,9999)}.png"
            screenshot = os.path.join(SCREENSHOTS_DIR, screenshot_name)
            try:
                await page.screenshot(path=screenshot)
                log(f"Error screenshot saved: {screenshot}")
            except:
                pass
            return {"success": False, "log": msg, "screenshot_path": screenshot_name}
        
        finally:
            await browser.close()

    return {"success": success, "log": "\n".join(log_messages)}

if __name__ == "__main__":
    # Test run
    # asyncio.run(publish_post_task("Thread Test Child", reply_to_id="123456789", dry_run=True))
    pass
