import asyncio
import os
import json
import re
from playwright.async_api import async_playwright
import random
from loguru import logger
from datetime import datetime
from .config import XSelectors

# CONFIG
WORKER_DIR = os.path.dirname(__file__)

SCREENSHOTS_DIR = os.path.join(WORKER_DIR, "screenshots")
ACCOUNTS_DIR = os.path.join(WORKER_DIR, "accounts")

# Ensure critical directories exist
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
os.makedirs(ACCOUNTS_DIR, exist_ok=True)

def get_user_paths(username: str):
    username = username.lstrip('@')
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

async def _get_storage_state(username: str, log_func):
    """
    Helper to resolve storage state (cookies) from file or environment.
    Returns (path_to_use, temp_path_to_cleanup)
    """
    paths = get_user_paths(username)
    cookies_path = paths["cookies"]
    
    # Priority 1: User-specific file
    if os.path.exists(cookies_path) and os.path.getsize(cookies_path) > 2:
        log_func(f"Using cookies from file: {cookies_path}")
        return cookies_path, None

    # Priority 2: Legacy root file
    legacy_cookies = os.path.join(WORKER_DIR, "cookies.json")
    if os.path.exists(legacy_cookies) and os.path.getsize(legacy_cookies) > 2:
        log_func(f"Using legacy cookies from: {legacy_cookies}")
        return legacy_cookies, None

    # Priority 3: X_COOKIES_JSON Environment Variable
    cookies_json_str = os.environ.get('X_COOKIES_JSON')
    if cookies_json_str:
        try:
            import tempfile
            temp_fd, temp_cookies_path = tempfile.mkstemp(suffix='.json', text=True)
            with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
                f.write(cookies_json_str)
            log_func("Using cookies from X_COOKIES_JSON environment variable")
            return temp_cookies_path, temp_cookies_path
        except Exception as e:
            log_func(f"Failed to load cookies from environment: {e}")
    
    log_func(f"No cookies found for {username or 'default'}")
    return None, None

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
        logger.info(f"[Worker] {msg}")
        log_messages.append(msg)
    
    storage_state, temp_cookies_path = await _get_storage_state(username, log)
    if not storage_state:
        return {"success": False, "log": f"No credentials found for {username or 'default'}", "screenshot_path": None, "tweet_id": None}

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
                    reply_btn = page.locator(f'{XSelectors.TWEET_ARTICLE}').first.locator(XSelectors.BTN_REPLY_MODAL)
                    await reply_btn.click()
                    log("Clicked Reply button on parent tweet.")
                    await page.wait_for_selector(XSelectors.COMPOSE_BOX_HOME, state="visible", timeout=10000)
                    log("Reply modal open.")
                except Exception as e:
                     log(f"Failed to open reply modal: {e}. Trying fallback.")
            else:
                log("New Post Mode: Navigating to home...")
                await page.goto("https://x.com/home", timeout=60000)
                await human_delay(2, 5)
                try:
                    await page.wait_for_selector(XSelectors.COMPOSE_BOX_HOME, state="visible", timeout=10000)
                    log("Home Compose box found.")
                    await page.locator(XSelectors.COMPOSE_BOX_HOME).click()
                except:
                    log("Converting to Global Compose modal logic...")
                    await page.keyboard.press("n") # Shortcut for new tweet
                    await human_delay(1, 2)

            # --- CONTENT ENTRY ---
            # Wait for text area (works for both Home and Reply Modal)
            textarea = page.locator(XSelectors.COMPOSE_BOX_HOME)
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
                        await page.set_input_files(XSelectors.FILE_INPUT, valid_paths)
                        log("Media upload triggered. Waiting for processing...")
                        await human_delay(5, 10) # Videos need more time
                    else:
                        log(f"Warning: Media paths provided but files not found: {path_list}")
                
                # --- SEND ---

                if not dry_run:
                    tweet_button = page.locator(XSelectors.BTN_TWEET_INLINE)
                    # Determine correct button (Modal uses 'tweetButton', inline uses 'tweetButtonInline' usually)
                    # Actually, for replies it might be 'tweetButton' inside the modal.
                    # Let's try to find *any* enabled tweet button in the active context
                    if not await tweet_button.is_visible():
                         tweet_button = page.locator(XSelectors.BTN_TWEET_MODAL)
                    
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
                    await page.locator(XSelectors.PROFILE_LINK).click()
                    await page.wait_for_url("**/status/**", timeout=2000) # Optional wait if profile redirects fast? No, profile is /username
                    await human_delay(2, 4)
                    
                    # Look for the first tweet timestamp/link
                    # Selector: article -> time -> parent anchor
                    latest_tweet_link = page.locator(f'{XSelectors.TWEET_ARTICLE}').first.locator('time').locator('..')
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
            logger.debug(f"Screenshot saved: {screenshot_file}")

        except Exception as e:
            logger.exception(f"Worker Error: {e}")
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
        logger.info(f"[Worker-Scraper] {msg}")
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
            
            # Optimization: Block unnecessary resources
            await page.route("**/*", lambda route: route.abort() 
                if route.request.resource_type in ["image", "stylesheet", "font", "media"] 
                else route.continue_()
            )

            url = f"https://x.com/i/status/{tweet_id}"
            logger.info(f"Navigating to {url}...")
            await page.goto(url, timeout=30000)
            # Wait for content instead of just selector if CSS is blocked
            await page.wait_for_selector('article[data-testid="tweet"]', timeout=20000)
            await human_delay(1, 2)

            # Extract Stats
            # Views (often textual like "145 Views" or inside an execution-detail)
            # Strategy: Look for the a tag that links to /analytics
            try:
                # View parsing helper
                def parse_x_number(text):
                    if not text: return 0
                    # Remove commas and whitespace
                    text = text.replace(",", "").strip().upper()
                    match = re.search(r'([\d\.]+)', text)
                    if not match: return 0
                    
                    num = float(match.group(1))
                    if 'K' in text: num *= 1000
                    elif 'M' in text: num *= 1000000
                    return int(num)

                # Likes
                like_els = page.locator('[data-testid="like"], [data-testid="unlike"]').all()
                for el in await like_els:
                    label = await el.get_attribute("aria-label")
                    if label and "Likes" in label:
                        stats["likes"] = parse_x_number(label.split("Likes")[0])
                        break
                
                # Reposts
                rt_els = page.locator('[data-testid="retweet"], [data-testid="unretweet"]').all()
                for el in await rt_els:
                    label = await el.get_attribute("aria-label")
                    if label and "Reposts" in label:
                        stats["reposts"] = parse_x_number(label.split("Reposts")[0])
                        break

                # Views (often in a link to /analytics)
                analytics_link = page.locator('a[href*="/analytics"]').first
                if await analytics_link.is_visible():
                     view_text = await analytics_link.text_content()
                     if view_text and "Views" in view_text:
                         stats["views"] = parse_x_number(view_text.split("Views")[0])
               
                # Fallback for Views if no link found (sometimes it's just a span)
                if stats["views"] == 0:
                    view_spans = page.locator('span:has-text("Views")').all()
                    for span in await view_spans:
                        text = await span.text_content()
                        if text and "Views" in text:
                            stats["views"] = parse_x_number(text.split("Views")[0])
                            break

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
        logger.info(f"[Worker-Login] {msg}")
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
            await page.wait_for_selector(XSelectors.LOGIN_INPUT_USERNAME, timeout=20000)
            await page.fill(XSelectors.LOGIN_INPUT_USERNAME, username)
            await page.keyboard.press("Enter")
            await human_delay(2, 3)

            # 2. Check for "Unusual Login" / Email Challenge
            if await page.locator(XSelectors.LOGIN_INPUT_CHALLENGE).is_visible():
                log("Unusual login detected! Taking diagnostic screenshot...")
                # ... (diagnostic screenshot same) ...
            
            # 3. Password
            log("Entering password...")
            try:
                await page.wait_for_selector(XSelectors.LOGIN_INPUT_PASSWORD, timeout=10000)
                await page.fill(XSelectors.LOGIN_INPUT_PASSWORD, password)
                await page.keyboard.press("Enter")
                await human_delay(3, 5)
            except Exception as e:
                 log(f"Password field not found. Maybe username invalid or challenge triggered. Error: {e}")
                 await browser.close()
                 return {"success": False, "log": "Login flow interrupted (Password step). check username."}

            # 4. Verification Check
            try:
                await page.wait_for_selector(f'{XSelectors.HOME_LINK}, {XSelectors.ACCOUNT_SWITCHER}', timeout=30000)
                log("Login verified! Found account indicator.")
                success = True
            except:
                # ... (2fa check same) ...
                pass

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

async def sync_history_task(username: str):
    """
    Scrapes the user's profile to import historical posts.
    """
    log_messages = []
    posts_imported = []

    def log(msg):
        logger.info(f"[Worker-Sync] {msg}")
        log_messages.append(msg)

    def parse_number(text):
        if not text: return 0
        text = text.replace(",", "").strip().upper()
        match = re.search(r'([\d\.]+)', text)
        if not match: return 0
        num = float(match.group(1))
        if 'K' in text: num *= 1000
        elif 'M' in text: num *= 1000000
        return int(num)

    storage_state, temp_cookies_path = await _get_storage_state(username, log)
    if not storage_state:
        return {"success": False, "log": f"cookies missing for {username}", "posts": [], "profile": {}}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
             user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
             storage_state=storage_state
        )
        
        profile_stats = {"followers": 0, "following": 0}

        try:
            page = await context.new_page()
            
            # Clean username for URL
            clean_username = username.lstrip('@')
            url = f"https://x.com/{clean_username}"
            log(f"Navigating to profile: {url}")
            
            await page.goto(url, timeout=60000, wait_until="networkidle")
            await human_delay(3, 5)

            # Check for Login Wall
            body_text = await page.inner_text("body")
            if "Sign in to X" in body_text or "Log in" in body_text:
                log("WARNING: Detected login wall. Cookies might be invalid or expired.")
                # Save screenshot for debug
                diag_login = os.path.join(SCREENSHOTS_DIR, f"sync_login_wall_{clean_username}.png")
                await page.screenshot(path=diag_login)
            
            # --- SCRAPE PROFILE STATS ---
            try:
                # Followers
                follower_links = page.locator(f'{XSelectors.LINK_FOLLOWERS}, {XSelectors.LINK_VERIFIED_FOLLOWERS}')
                count = await follower_links.count()
                for i in range(count):
                    el = follower_links.nth(i)
                    txt = await el.inner_text() 
                    if "Followers" in txt or "Seguidores" in txt:
                        profile_stats["followers"] = parse_number(txt.split('\n')[0])
                    elif "Following" in txt or "Siguiendo" in txt:
                        profile_stats["following"] = parse_number(txt.split('\n')[0])
                
                log(f"Profile Stats Scraped: {profile_stats}")
            except Exception as e:
                log(f"Failed to scrape profile stats: {e}")

            # Scroll to get more history (Increased depth to detect deeper deletions)
            for i in range(10):
                await page.evaluate("window.scrollBy(0, 2000)")
                await asyncio.sleep(1) # Faster scroll feedback
                # Check if we still see new tweets or reached the end
                # (Simple scroll is usually enough for recent 50-100 tweets)
            
            # Extract recent tweets
            articles = await page.locator(XSelectors.TWEET_ARTICLE).all()
            log(f"Found {len(articles)} tweet articles on feed.")
            
            # ... (debug logging ok) ...

            for article in articles:
                try:
                    # ... (Time/ID extraction logic remains similar as it uses generic HTML tags 'time', 'a') ...
                    # ID / Time extraction logic
                    time_tag = article.locator('time')
                    datetime_str = None
                    tweet_id = None
                    
                    if await time_tag.count() > 0:
                        # Wait for hydration
                        try:
                            await time_tag.first.wait_for(state="attached", timeout=3000)
                        except: pass
                        
                        datetime_str = await time_tag.first.get_attribute('datetime')
                        if not datetime_str:
                             # Fallback to title attribute or aria-label
                             datetime_str = await time_tag.first.get_attribute('title')
                             if not datetime_str:
                                 datetime_str = await time_tag.first.get_attribute('aria-label')
                        
                        if datetime_str:
                             # If we got a string but not ISO, we might need parsing, 
                             # but usually 'datetime' is a clean ISO string.
                             pass
                        else:
                             log(f"Warning: Could not extract datetime/title from time tag for article.")

                        link_el = article.locator('a[href*="/status/"]').first
                        if await link_el.count() > 0:
                            href = await link_el.get_attribute('href')
                            if href:
                                match = re.search(r'status/(\d+)', href)
                                tweet_id = match.group(1) if match else None

                    if tweet_id:
                        # Content
                        content_el = article.locator(XSelectors.TWEET_TEXT)
                        content = ""
                        if await content_el.count() > 0:
                            content = await content_el.inner_text()
                        
                        # Media Scraping
                        media_url = None
                        try:
                            # Try to find an image
                            img_el = article.locator('[data-testid="tweetPhoto"] img').first
                            if await img_el.count() > 0:
                                media_url = await img_el.get_attribute("src")
                            else:
                                # Try video poster
                                video_el = article.locator('[data-testid="videoPlayer"] video').first
                                if await video_el.count() > 0:
                                    media_url = await video_el.get_attribute("poster")
                        except Exception as e:
                            pass

                        # Stats Scraping
                        views = 0
                        likes = 0
                        reposts = 0
                        replies = 0
                        bookmarks = 0

                        try:
                            # Likes
                            like_el = article.locator(f'{XSelectors.METRIC_LIKE}, {XSelectors.METRIC_UNLIKE}').first
                            if await like_el.count() > 0:
                                label = await like_el.get_attribute("aria-label") 
                                if label and "Like" in label: 
                                    likes = parse_number(label.split("Like")[0])

                            # Reposts
                            rt_el = article.locator(f'{XSelectors.METRIC_REPOST}, {XSelectors.METRIC_UNREPOST}').first
                            if await rt_el.count() > 0:
                                label = await rt_el.get_attribute("aria-label")
                                if label and "Repost" in label:
                                    reposts = parse_number(label.split("Repost")[0])
                            
                            # Replies
                            reply_el = article.locator(f'[data-testid="reply"]').first
                            if await reply_el.count() > 0:
                                label = await reply_el.get_attribute("aria-label")
                                # Label usually: "0 Replies. Reply"
                                if label and ("Repl" in label or "Resp" in label):
                                    # Fallback for Spanish generic "Responder"
                                    # English: "XYZ Replies"
                                    raw = label.split("Repl")[0].split("Resp")[0]
                                    replies = parse_number(raw)
                            
                            # Bookmarks
                            bm_el = article.locator(f'[data-testid="bookmark"], [data-testid="removeBookmark"]').first
                            if await bm_el.count() > 0:
                                label = await bm_el.get_attribute("aria-label")
                                # Label usually: "0 Bookmarks. Bookmark" or "Guardar"
                                if label and ("Bookm" in label or "Guard" in label):
                                     raw = label.split("Bookm")[0].split("Guard")[0]
                                     bookmarks = parse_number(raw)

                            # Views
                            analytics_link = article.locator(XSelectors.LINK_ANALYTICS).first
                            if await analytics_link.count() > 0:
                                label = await analytics_link.get_attribute("aria-label")
                                if label and "View" in label:
                                    views = parse_number(label.split("View")[0])
                            else:
                                view_stat = article.locator(f'{XSelectors.CONTAINER_VIEW_STAT}', has_text="View").first
                                if await view_stat.count() == 0:
                                     all_stats = await article.locator('[aria-label*="View"]').all()
                                     for stat in all_stats:
                                         lbl = await stat.get_attribute("aria-label")
                                         if lbl and "View" in lbl:
                                             views = parse_number(lbl.split("View")[0])
                                             break

                        except Exception as e:
                            pass

                        # Check if Repost
                        is_repost = False
                        try:
                            header = article.locator(XSelectors.METRIC_SOCIAL_CONTEXT).first
                            if await header.count() > 0:
                                header_text = (await header.inner_text()).lower()
                                if any(x in header_text for x in ["repost", "retweet", "reposte", "comparti"]):
                                    is_repost = True
                        except Exception as e:
                            pass

                        posts_imported.append({
                            "tweet_id": tweet_id,
                            "content": content,
                            "views": views,
                            "likes": likes,
                            "reposts": reposts,
                            "replies": replies,
                            "bookmarks": bookmarks,
                            "published_at": datetime_str,
                            "media_url": media_url,
                            "is_repost": is_repost
                        })
                except Exception as e:
                    log(f"Failed to parse a tweet: {e}")

            # Determine range
            min_date = None
            if posts_imported:
                # Sort by date (assuming imported list might be mixed, though likely chronological)
                # Actually, feed is usually reverse chron.
                # Let's find the absolute minimum date we saw.
                for p in posts_imported:
                    if p.get("published_at"):
                        try:
                            # 2023-10-27T10:00:00.000Z
                            dt = datetime.fromisoformat(p["published_at"].replace("Z", "+00:00"))
                            if min_date is None or dt < min_date:
                                min_date = dt
                        except: pass
            
            log(f"Sync complete. Parsed {len(posts_imported)} posts. Oldest: {min_date}")
        except Exception as e:
            log(f"Sync error: {e}")
        finally:
            await browser.close()

    return {
        "success": True, 
        "log": "\n".join(log_messages), 
        "posts": posts_imported,
        "oldest_scanned_date": min_date.isoformat() if min_date else None,
        "profile": profile_stats
    }
