import asyncio
import time
import os
import json
import re
from patchright.async_api import async_playwright


import random
from loguru import logger
from datetime import datetime
from .config import XSelectors
from backend.config import settings

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
            
            # Parse and normalize cookie structure
            try:
                cookies_data = json.loads(cookies_json_str)
                if isinstance(cookies_data, list):
                    # Clean cookies for Playwright
                    cleaned_cookies = []
                    for c in cookies_data:
                        new_c = c.copy()
                        # Remove incompatible fields
                        for k in ['hostOnly', 'session', 'storeId', 'id']:
                            new_c.pop(k, None)
                        # Rename expirationDate -> expires
                        if 'expirationDate' in new_c:
                            new_c['expires'] = new_c.pop('expirationDate')
                        # Fix sameSite
                        if 'sameSite' in new_c:
                            ss = str(new_c['sameSite']).lower().replace('_', '').replace('-', '')
                            if ss in ['norestriction', 'unspecified']:
                                new_c['sameSite'] = 'None'
                            elif ss == 'strict':
                                new_c['sameSite'] = 'Strict'
                            elif ss == 'lax':
                                new_c['sameSite'] = 'Lax'
                            elif ss == 'none':
                                new_c['sameSite'] = 'None'
                            else:
                                new_c['sameSite'] = 'None'
                        cleaned_cookies.append(new_c)

                    # Wrap list in Playwright storage_state format
                    final_structure = {
                        "cookies": cleaned_cookies,
                        "origins": []
                    }
                    content_to_write = json.dumps(final_structure)
                else:
                    # Assume it's already in correct format
                    content_to_write = cookies_json_str
            except Exception as e:
                log_func(f"Using raw cookies due to parse error: {e}")
                content_to_write = cookies_json_str

            with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
                f.write(content_to_write)
            log_func("Using cookies from X_COOKIES_JSON environment variable")
            return temp_cookies_path, temp_cookies_path
        except Exception as e:
            log_func(f"Failed to load cookies from environment: {e}")
            

async def publish_post_task(content, media_paths=None, reply_to_id=None, username=None, dry_run=False):
    """
    Publishes a post (tweet) or reply using Playwright.
    """
    tweet_id = None
    success = False
    screenshot_file = None
    log_messages = []
    temp_cookies_path = None

    def log(msg):
        logger.info(f"[Worker] {msg}")
        log_messages.append(msg)

    log(f"Starting publish task. User: {username}, ReplyTo: {reply_to_id}")

    # Resolve cookies
    storage_state, temp_cookies_path = await _get_storage_state(username, log)
    
    if not storage_state:
        return {"success": False, "log": "No cookies found. Please input them.", "screenshot_path": None, "tweet_id": None}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        try:
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                storage_state=storage_state,
                viewport={"width": 1280, "height": 720},
                device_scale_factor=1,
            )
            page = await context.new_page()
            
            # Basic anti-detect
            await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        except Exception as e:
            log(f"CRITICAL: Failed to initialize context with session: {e}") 
            if 'browser' in locals():
                await browser.close()
            # Clean up temp file if it was created
            if temp_cookies_path and os.path.exists(temp_cookies_path):
                try:
                    os.unlink(temp_cookies_path)
                except:
                    pass
            return {"success": False, "log": f"Failed to initialize context with session: {e}", "screenshot_path": None, "tweet_id": None}




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
                    log(f"Media paths received (raw): {repr(media_paths)}")
                    # Attempt to parse as JSON first (common for imported posts)
                    try:
                        path_list = json.loads(media_paths)
                        if isinstance(path_list, str):
                            path_list = [p.strip() for p in path_list.split(',') if p.strip()]
                    except:
                        # Fallback to comma-separated
                        path_list = [p.strip() for p in str(media_paths).split(',') if p.strip()]
                    
                    # Log normalized paths
                    log(f"Parsed media paths: {path_list}")
                    
                    # Check if any path is actually a URL (imported)
                    # For now we only support local paths for UPLOAD
                    local_paths = [p for p in path_list if not p.startswith('http')]
                    remote_paths = [p for p in path_list if p.startswith('http')]
                    
                    if remote_paths:
                        log(f"Warning: Remote media URLs not directly supported for upload yet: {remote_paths}")

                    if local_paths:
                        normalized_paths = []
                        for p in local_paths:
                            if os.path.exists(p):
                                normalized_paths.append(p)
                            else:
                                # Fallback: check if the filename exists in our local UPLOAD_DIR
                                filename = os.path.basename(p.replace('\\', '/'))
                                # Try to find where UPLOAD_DIR would be
                                from backend.routes.upload import UPLOAD_DIR as BACKEND_UPLOAD_DIR
                                alt_path = os.path.join(BACKEND_UPLOAD_DIR, filename)
                                if os.path.exists(alt_path):
                                    log(f"Found media via fallback: {alt_path}")
                                    normalized_paths.append(alt_path)
                                else:
                                    log(f"Warning: Media not found at {p} or {alt_path}")
                        
                        valid_paths = normalized_paths
                    
                    if valid_paths:
                        is_video = any(p.lower().endswith(('.mp4', '.mov', '.webm', '.ogg', '.m4v')) for p in valid_paths)
                        log(f"Uploading {len(valid_paths)} media files (isVideo={is_video}): {valid_paths}")
                        
                        # DIAGNOSTIC: Verify files before upload
                        for vp in valid_paths:
                            if os.path.exists(vp):
                                file_size = os.path.getsize(vp) / (1024 * 1024)  # MB
                                log(f"✓ File exists: {vp} ({file_size:.2f} MB)")
                            else:
                                log(f"✗ ERROR: File NOT found: {vp}")
                        
                        # DIAGNOSTIC: Take screenshot AND save HTML before upload
                        try:
                            diag_before = os.path.join(settings.DATA_DIR, "screenshots", f"before_upload_{int(asyncio.get_event_loop().time())}.png")
                            os.makedirs(os.path.dirname(diag_before), exist_ok=True)
                            await page.screenshot(path=diag_before, full_page=True)
                            log(f"📸 Pre-upload screenshot: {diag_before}")
                            
                            # Also save HTML to see available elements
                            html_dump = os.path.join(settings.DATA_DIR, "screenshots", f"composer_html_{int(asyncio.get_event_loop().time())}.html")
                            html_content = await page.content()
                            with open(html_dump, 'w', encoding='utf-8') as f:
                                f.write(html_content)
                            log(f"📄 Composer HTML saved: {html_dump}")
                        except Exception as e:
                            log(f"Diagnostic capture failed: {e}")
                        
                        # CRITICAL: Use direct file input method
                        upload_success = False
                        try:
                            log("Attempting UI-driven upload via FileChooser...")
                            
                            # 1. Prepare to catch the file chooser event
                            async with page.expect_file_chooser() as fc_info:
                                # 2. Click the visible "Media" button
                                # Looking for [aria-label="Add photos or video"] (English) or "Fotos y vídeos" (Spanish) etc.
                                # Also support data-testid explicitly for the button wrapper if possible.
                                media_btn = page.locator('div[role="button"][aria-label*="photos"], div[role="button"][aria-label*="media"], div[role="button"][aria-label*="fotos"], div[role="button"][aria-label*="vídeo"]').first
                                
                                if await media_btn.is_visible():
                                    await media_btn.hover()
                                    await asyncio.sleep(0.5)
                                    await media_btn.click()
                                else:
                                    # Fallback: Try to find the button by the file input's parent/sibling relationship
                                    # The input is usually inside a div that is the button, or close to it.
                                    # We try to click the label or the div wrapping the input.
                                    fallback_btn = page.locator('[data-testid="fileInput"]').locator('xpath=..')
                                    if await fallback_btn.is_visible():
                                         await fallback_btn.click()
                                    else:
                                        # Last resort
                                        await page.click('[data-testid="fileInput"]', force=True)
                                    
                            # 3. Set files on the intercepted chooser
                            file_chooser = await fc_info.value
                            await file_chooser.set_files(valid_paths)
                            log(f"✅ Medias selected via FileChooser: {valid_paths}")
                            upload_success = True
                        except Exception as e:
                            log(f"UI-driven upload failed: {e}")
                        
                        # Wait for media preview to be visible (CRITICAL)
                        # IMPORTANT: Don't just check for containers, verify actual media elements exist
                        log("Waiting for media preview to confirm attachment...")
                        media_confirmed = False
                        try:
                            if is_video:
                                # For videos, look for actual <video> element or video player
                                await page.wait_for_selector('div[data-testid="tweetComposer"] video, div[data-testid="videoPlayer"]', state="visible", timeout=30000)
                                log("✅ Video element confirmed in composer.")
                                media_confirmed = True
                            else:
                                # For images, look for actual <img> elements
                                await page.wait_for_selector('div[data-testid="tweetComposer"] img[alt*="Image"]', state="visible", timeout=30000)
                                log("✅ Image element confirmed in composer.")
                                media_confirmed = True
                        except:
                            log("❌ CRITICAL ERROR: Media element NOT DETECTED after upload attempt.")
                            # Take diagnostic screenshot
                            try:
                                diag_shot = os.path.join(settings.DATA_DIR, "screenshots", f"upload_failed_{int(asyncio.get_event_loop().time())}.png")
                                os.makedirs(os.path.dirname(diag_shot), exist_ok=True)
                                await page.screenshot(path=diag_shot, full_page=True)
                                log(f"Diagnostic screenshot saved: {diag_shot}")
                            except: pass
                            
                            # ABORT: Video was expected but not uploaded
                            if is_video:
                                log("❌ ABORTING: Video upload failed - cannot publish post without video")
                                success = False
                                # Return error - backend will handle status update
                                return {"success": False, "error": "Video upload failed - media element not detected"}
                        
                        
                        if is_video:
                            log("Video detected. Monitoring video processing status...")
                            # CRITICAL: Wait until X.com finishes processing the video
                            # Instead of fixed wait, actively monitor for completion indicators
                            video_ready = False
                            max_wait = 180  # Increased to 3 minutes for slow processing
                            start_time = asyncio.get_event_loop().time()
                            
                            # Give X some time to START processing/showing the indicator
                            log("Waiting 5s for processing UI to appear...")
                            await asyncio.sleep(5)
                            
                            while not video_ready and (asyncio.get_event_loop().time() - start_time) < max_wait:
                                try:
                                    # Check if video is still processing (look for processing indicators)
                                    # Indicators: Text "Processing", "Encoding", "Uploading" OR role="progressbar"
                                    # Multilingual: "Procesando", "Enviando", "Codificando"
                                    processing_text = await page.locator('text=/processing|encoding|uploading|procesando|enviando|codificando/i').count()
                                    progress_bar = await page.locator('[role="progressbar"]').count()
                                    
                                    if processing_text == 0 and progress_bar == 0:
                                        # No processing indicators found, video should be ready
                                        elapsed = int(asyncio.get_event_loop().time() - start_time)
                                        log(f"✅ Video processing complete after {elapsed}s")
                                        video_ready = True
                                    else:
                                        # Still processing, wait a bit more
                                        await asyncio.sleep(2)
                                        if int(asyncio.get_event_loop().time() - start_time) % 10 == 0:
                                            log("Still processing video...")
                                except:
                                    # If we can't check, assume it's ready after minimum wait
                                    await asyncio.sleep(2)
                            
                            if not video_ready:
                                log(f"❌ CRITICAL: Video processing TIMEOUT after {max_wait}s. Aborting.")
                                # Abort logic
                                return {"success": False, "error": f"Video processing timed out after {max_wait}s"}
                        else:
                            await human_delay(3, 6)
                    else:
                        if local_paths:
                            # Diagnostic: check parent directory
                            try:
                                upload_dir = os.path.dirname(local_paths[0])
                                log(f"CRITICAL Warning: Local media NOT FOUND. Checking parent dir {upload_dir}...")
                                if os.path.exists(upload_dir):
                                    log(f"Parent dir exists. Contents: {os.listdir(upload_dir)[:10]}")
                                else:
                                    log(f"Parent dir DOES NOT EXIST: {upload_dir}")
                            except: pass
                            log(f"CRITICAL Warning: Local media paths provided but files NOT FOUND on disk: {local_paths}")
                        elif not remote_paths:
                            log("No valid media paths found to upload.")

                
                # --- FINAL STATE DIAGNOSTIC ---
                try:
                    state_shot = os.path.join(settings.DATA_DIR, "screenshots", f"compose_state_{int(asyncio.get_event_loop().time())}.png")
                    os.makedirs(os.path.dirname(state_shot), exist_ok=True)
                    await page.screenshot(path=state_shot)
                    log(f"Composer state screenshot saved: {state_shot}")
                except: pass

                # --- SEND ---

                if not dry_run:
                    tweet_button = page.locator(XSelectors.BTN_TWEET_INLINE)
                    if not await tweet_button.is_visible():
                         tweet_button = page.locator(XSelectors.BTN_TWEET_MODAL)
                    
                    # Wait for button to be enabled (upload processing)
                    log("Waiting for Tweet button to be enabled...")
                    try:
                        await tweet_button.wait_for(state="attached", timeout=60000)
                        # Wait specifically for enabled state
                        # Increase wait time for videos (can take minutes for large ones)
                        max_wait = 180 if is_video else 45 
                        for i in range(max_wait): 
                            if await tweet_button.is_enabled():
                                log(f"Tweet button enabled after {i}s.")
                                break
                            
                            # CHECK FOR ERROR TOASTS
                            error_selector = '[data-testid="toast"], div[role="alert"]'
                            if await page.locator(error_selector).count() > 0:
                                error_text = await page.locator(error_selector).first.inner_text()
                                log(f"CRITICAL: X shows error message: {error_text}")
                                # We don't necessarily abort, but we log it
                            
                            if i % 10 == 0 and i > 0:
                                log(f"Still waiting for button... ({i}s)")
                            await asyncio.sleep(1)
                    except Exception as e:
                        log(f"Error waiting for button: {e}")
                        pass

                    # --- FINAL SANITY CHECK BEFORE CLICKING ---
                    # If we expected a video, verify it is present immediately before posting.
                    # This prevents cases where upload failed/cancelled but the button became enabled for text only.
                    if is_video:
                        log("Performing final video presence check...")
                        # Look for video player or video tag
                        video_present = await page.locator('div[data-testid="tweetComposer"] video, div[data-testid="videoPlayer"]').count() > 0
                        
                        if not video_present:
                            log("❌ CRITICAL: Video element MISSING from composer before tweet click. Aborting.")
                            
                            # Try to catch any error message visible
                            try:
                                error_text = await page.locator('[data-testid="toast"], div[role="alert"]').inner_text()
                                if error_text: log(f"X Error Message: {error_text}")
                            except: pass
                            
                            return {"success": False, "error": "Video failed to attach - missing from composer before send"}
                        else:
                            log("✅ Video element confirmed present. Proceeding to tweet.")

                    if await tweet_button.is_enabled():
                        await tweet_button.click()
                        log("Clicked Post/Reply button.")
                        await human_delay(5, 8) # Wait for network
                        success = True
                    else:
                         log("Button disabled after wait. Upload might have failed or content is invalid.")
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
                    # Wait for profile page to load (URL should be x.com/username)
                    await page.wait_for_load_state("networkidle", timeout=10000)
                    await human_delay(3, 5)
                    
                    # Look for the first tweet timestamp/link
                    # Selector: article -> time -> parent anchor
                    latest_tweet_link = page.locator(f'{XSelectors.TWEET_ARTICLE}').first.locator('time').locator('..')
                    if await latest_tweet_link.count() > 0:
                        href = await latest_tweet_link.get_attribute('href')
                        
                        if href and 'status' in href:
                            # href format: /username/status/123456789
                            match = re.search(r'status/(\d+)', href)
                            if match:
                                tweet_id = match.group(1)
                                log(f"Extracted Tweet ID: {tweet_id}")
                    else:
                        log("Could not find any tweets on profile feed.")
                        
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

    # Resolve cookies
    storage_state, temp_cookies_path = await _get_storage_state(username, log)
    
    if not storage_state:
        return {"success": False, "log": "cookies.json missing", "stats": stats}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                storage_state=storage_state
            )
            
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
            # Clean up temp file for cookies if it was created
            if temp_cookies_path and os.path.exists(temp_cookies_path):
                try:
                    os.unlink(temp_cookies_path)
                except:
                    pass

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


def parse_number(text):
    if not text: return 0
    text = text.replace(",", "").strip().upper()
    match = re.search(r'([\d\.]+)', text)
    if not match: return 0
    num = float(match.group(1))
    if 'K' in text: num *= 1000
    elif 'M' in text: num *= 1000000
    return int(num)

async def scrape_tweet_from_article(article, context, clean_username, log_func=None):
    """
    Extracts tweet data from a single article element.
    Returns a dictionary or None if extraction fails.
    """
    if log_func is None:
        def log_func(msg): logger.info(f"[Scraper] {msg}")

    try:
        tweet_text_el = article.locator(XSelectors.TWEET_TEXT).first
        raw_text = await tweet_text_el.inner_text() if await tweet_text_el.count() > 0 else "No Text"
        
        # 1. Extract Tweet ID First (Critical for precision)
        link_el = article.locator('a[href*="/status/"]').first
        tweet_id = None
        tweet_url = ""
        
        if await link_el.count() > 0:
            href = await link_el.get_attribute('href')
            if href:
                match = re.search(r'status/(\d+)', href)
                tweet_id = match.group(1) if match else None
                tweet_url = href
        
        if not tweet_id:
             return None

        # 2. Extract / Calculate Date
        datetime_str = None
        time_tag = article.locator('time')
        
        # Try Snowflake ID calculation (Best Precision)
        try:
            # Snowflake formula: (id >> 22) + 1288834974657
            timestamp_ms = (int(tweet_id) >> 22) + 1288834974657
            # Ensure it ends with Z to signify UTC for the ISO string
            datetime_str = datetime.utcfromtimestamp(timestamp_ms / 1000.0).isoformat() + "Z"
        except Exception as e:
            log_func(f"Snowflake formula error for {tweet_id}: {e}")

        # Fallback to HTML Tags
        if not datetime_str and await time_tag.count() > 0:
            try:
                await time_tag.first.wait_for(state="attached", timeout=1000)
                datetime_str = await time_tag.first.get_attribute('datetime')
                if not datetime_str:
                        datetime_str = await time_tag.first.get_attribute('title') or await time_tag.first.get_attribute('aria-label')
            except: pass

        if not datetime_str:
                log_func(f"Warning: No valid date found for article (Tweet ID: {tweet_id})")

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

        # Stats Scraping from Timeline
        views = 0
        likes = 0
        reposts = 0
        replies = 0
        bookmarks = 0
        url_link_clicks = 0
        user_profile_clicks = 0
        detail_expands = 0

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
                if label and ("Repl" in label or "Resp" in label):
                    raw = label.split("Repl")[0].split("Resp")[0]
                    replies = parse_number(raw)
            
            # Bookmarks
            bm_el = article.locator(f'[data-testid="bookmark"], [data-testid="removeBookmark"]').first
            if await bm_el.count() > 0:
                label = await bm_el.get_attribute("aria-label")
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
            
            # --- DEEP ANALYTICS SCRAPING ---
            # Only if context and clean_username are provided
            if context and clean_username and tweet_id:
                try:
                    log_func(f"Fetching detailed analytics for tweet {tweet_id}...")
                    analytics_url = f"https://x.com/{clean_username}/status/{tweet_id}/analytics"
                    
                    # Open in new tab
                    analytics_page = await context.new_page()
                    try:
                        await analytics_page.goto(analytics_url, timeout=20000)
                        await human_delay(2, 3)
                        
                        # Strategy 1: Aria labels
                        try:
                            metric_containers = await analytics_page.locator('[aria-label], [data-testid]').all()
                            for container in metric_containers:
                                aria_label = await container.get_attribute('aria-label')
                                if aria_label:
                                    if 'link click' in aria_label.lower():
                                        match = re.search(r'(\d+)', aria_label)
                                        if match: url_link_clicks = int(match.group(1))
                                    elif 'profile visit' in aria_label.lower():
                                        match = re.search(r'(\d+)', aria_label)
                                        if match: user_profile_clicks = int(match.group(1))
                                    elif 'detail expand' in aria_label.lower():
                                        match = re.search(r'(\d+)', aria_label)
                                        if match: detail_expands = int(match.group(1))
                        except: pass
                        
                        # Strategy 2: Text regex fallback
                        if url_link_clicks == 0 and user_profile_clicks == 0 and detail_expands == 0:
                            try:
                                all_text = await analytics_page.locator('body').inner_text()
                                link_match = re.search(r'(\d[\d,]*)\s*[^\d\w]*\s*(?:Link clicks?)', all_text, re.IGNORECASE)
                                if link_match: url_link_clicks = int(link_match.group(1).replace(',', ''))
                                
                                profile_match = re.search(r'(\d[\d,]*)\s*[^\d\w]*\s*(?:Profile visits?)', all_text, re.IGNORECASE)
                                if profile_match: user_profile_clicks = int(profile_match.group(1).replace(',', ''))
                                
                                detail_match = re.search(r'(\d[\d,]*)\s*[^\d\w]*\s*(?:Detail expands?)', all_text, re.IGNORECASE)
                                if detail_match: detail_expands = int(detail_match.group(1).replace(',', ''))
                            except: pass

                    except Exception as e:
                        log_func(f"Failed to fetch analytics for {tweet_id}: {e}")
                    finally:
                        await analytics_page.close()
                        await human_delay(0.5, 1)

                except Exception as e:
                    log_func(f"Analytics navigation failed for {tweet_id}: {e}")

        except Exception as e:
            pass

        # Check if Repost
        is_repost = False
        try:
            # STRATEGY 1: Check strict selector for "You reposted" (Legacy)
            header = article.locator(XSelectors.METRIC_SOCIAL_CONTEXT).first
            
            # STRATEGY 2: Check fallback generic social context
            if await header.count() == 0:
                 header = article.locator('[data-testid="socialContext"]').first

            if await header.count() > 0:
                header_text = (await header.inner_text()).lower()
                # Enhanced keywords for Spanish/English
                repost_keywords = [
                    "repost", "retweet", "reposte", "comparti", 
                    "you reposted", "reposteaste", "reposteó", "retuiteó"
                ]
                if any(x in header_text for x in repost_keywords):
                    is_repost = True
            
            # STRATEGY 3: Check "Replying to" (Spanish: "En respuesta a")
            if not is_repost:
                # Looking for the text "Replying to" or "En respuesta a" in the body
                reply_indicator = article.locator('div:has-text("Replying to"), div:has-text("En respuesta a")').first
                if await reply_indicator.count() > 0:
                    is_repost = True # Treat replies as noise for "Clean Policy"
            
            # STRATEGY 4 (ROBUST): Compare Author Handle
            if not is_repost and clean_username:
                try:
                    # Find the user link in the header. Usually the first link in User-Name.
                    # It has an href like "/FinanzasArgy"
                    user_link = article.locator('[data-testid="User-Name"] a[href^="/"]').first
                    if await user_link.count() > 0:
                        href = await user_link.get_attribute("href") # e.g. /FinanzasArgy
                        if href:
                            tweet_author = href.strip("/").lower()
                            # Clean up checks (ignore query params if any)
                            if "?" in tweet_author:
                                tweet_author = tweet_author.split("?")[0]
                            
                            
                            
                            current_user = clean_username.lower()
                            
                            if tweet_author != current_user:
                                is_repost = True
                                # log_func(f"Detected Repost by Handle Mismatch: {tweet_author} != {current_user}")
                    else:
                         # No handle found, likely ad or odd element
                         pass
                except Exception as e:
                    pass

            # STRATEGY 5: Detect Quote Tweets (User has 0 followers but viral stats -> likely scraping the quoted tweet)
            # Quote Tweets usually have TWO User-Name elements or TWO Avatars visible within the article context
            # (One for the poster, one for the quoted user).
            if not is_repost:
                try:
                    # Count avatars. If > 1, it is likely a Quote Tweet (or Thread, but Threads usually look different)
                    # Use a generic selector for avatar containers
                    avatars = await article.locator('[data-testid^="User-Avatar-Container"]').all()
                    if len(avatars) > 1:
                        is_repost = True
                        # log_func(f"Detected Quote Tweet (Multiple Avatars): {len(avatars)}")
                except:
                    pass
        except Exception as e:
            pass

        return {
            "tweet_id": tweet_id,
            "content": content,
            "views": views,
            "likes": likes,
            "reposts": reposts,
            "replies": replies,
            "bookmarks": bookmarks,
            "url_link_clicks": url_link_clicks,
            "user_profile_clicks": user_profile_clicks,
            "detail_expands": detail_expands,
            "published_at": datetime_str,
            "media_url": media_url,
            "is_repost": is_repost
        }
    except Exception as e:
        log_func(f"Failed to scrape article: {e}")
        return None

async def sync_history_task(username: str):
    log_messages = []
    
    def log(msg):
        logger.info(f"[Worker] {msg}")
        log_messages.append(msg)

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
        posts_imported = []
        seen_tweet_ids = set() # Track IDs to avoid duplicates
        min_date = None

        try:
            page = await context.new_page()
            
            # Clean username for URL
            clean_username = username.lstrip('@')
            
            # Switch back to Search (Latest) Strategy
            # This bypasses profile feed filtering and scrolling limits
            url = f"https://x.com/search?q=from%3A{clean_username}&src=typed_query&f=live"
            log(f"Navigating to Search (Latest): {url}")
            
            await page.goto(url, timeout=60000, wait_until="networkidle")
            await human_delay(3, 5)

            # Debug HTML dump removed for production cleanup
            # try:
            #     html_content = await page.content()
            #     debug_html_path = os.path.join(WORKER_DIR, f"debug_profile_{clean_username}.html")
            #     with open(debug_html_path, "w", encoding="utf-8") as f:
            #         f.write(html_content)
            #     log(f"DEBUG: Saved raw HTML to {debug_html_path}")
            # except Exception as e:
            #     log(f"DEBUG: Failed to save/analyze HTML: {e}")

            # --- VERIFY SESSION ---
            if not await verify_session(page, log):
                 # Save screenshot for debug
                diag_login = os.path.join(SCREENSHOTS_DIR, f"sync_login_wall_{clean_username}.png")
                await page.screenshot(path=diag_login)
                log("ERROR: Session verification failed during sync. Cookies might be invalid or expired.")
                return {"success": False, "log": "Session verification failed. Please update cookies.", "posts": [], "profile": {}}
            
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

            # --- DYNAMIC SCROLL & SCRAPE LOOP ---
            log("Starting dynamic scroll & scrape...")
            
            max_iterations = 50  # Safety limit
            no_new_tweets_count = 0
            
            for i in range(max_iterations):
                # 1. Scrape visible articles FIRST
                all_articles = await page.locator('article').all()
                new_in_batch = 0
                
                for article in all_articles:
                    try:
                        # Quick check if it's a tweet (has status link)
                        status_link = article.locator('a[href*="/status/"]')
                        if await status_link.count() == 0:
                            continue

                        # Extract ID briefly for check
                        href = await status_link.first.get_attribute('href')
                        match = re.search(r'status/(\d+)', href)
                        if not match: continue
                        
                        tid = match.group(1)
                        if tid in seen_tweet_ids:
                            continue # Already processed

                        # Full scrape
                        tweet_data = await scrape_tweet_from_article(article, context, clean_username, log)
                        
                        if tweet_data:
                            # Verify if ID matches (sometimes article structure is nested trickily)
                            # scrape_tweet_from_article does its own extraction.
                            real_tid = tweet_data['tweet_id']
                            if real_tid in seen_tweet_ids:
                                continue
                                
                            seen_tweet_ids.add(real_tid)
                            posts_imported.append(tweet_data)
                            # log(f"Scraped Tweet: {real_tid} | {tweet_data['content'][:30]}...")
                            new_in_batch += 1
                            
                            # Reset no-change counter if we found something
                            no_new_tweets_count = 0
                    
                    except Exception as e:
                        # log(f"Error scraping an article: {e}")
                        pass
                
                if new_in_batch > 0:
                    log(f"Batch {i+1}: Found {new_in_batch} new tweets. Total: {len(posts_imported)}")
                else:
                    no_new_tweets_count += 1
                
                if no_new_tweets_count >= 3:
                     log(f"No new tweets found for {no_new_tweets_count} consecutive scrolls. Stopping.")
                     break

                # 2. Scroll Logic
                # Use scrollHeight to ensure we hit bottom, but also small increments to trigger JS observers
                await page.evaluate("window.scrollBy(0, 1500)") 
                await asyncio.sleep(1)
                await page.evaluate("window.scrollBy(0, 1500)") # Double scroll
                await asyncio.sleep(2.5) # Wait for network
            
            log(f"Finished scrolling. Found {len(posts_imported)} total unique tweets.")
            
            # Determine range
            if posts_imported:
                for p in posts_imported:
                    if p.get("published_at"):
                        try:
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

async def import_single_tweet(url: str, username: str):
    """
    Imports a single tweet by URL.
    This bypasses feed visibility issues by navigating directly to the tweet.
    """
    log_messages = []
    
    def log(msg):
        logger.info(f"[Worker-Import] {msg}")
        log_messages.append(msg)

    # Resolve cookies
    storage_state, _ = await _get_storage_state(username, log)
    if not storage_state:
        return {"success": False, "log": "No cookies found."}

    tweet_data = None
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            storage_state=storage_state
        )

        try:
            page = await context.new_page()
            log(f"Navigating to tweet: {url}")
            await page.goto(url, timeout=60000, wait_until="networkidle")
            await human_delay(2, 4)

            # Check if login success (re-use verify if possible, or simple check)
            if "login" in page.url:
                return {"success": False, "log": "Redirected to login. Cookies might be invalid."}

            # Locate article
            # In single tweet view, the main tweet is usually the first article or one with the specific ID focus
            # We can just look for the article that corresponds to the Tweet ID in the URL.
            
            tweet_id_match = re.search(r'status/(\d+)', url)
            if not tweet_id_match:
                 return {"success": False, "log": "Invalid Tweet URL"}
            
            target_id = tweet_id_match.group(1)
            
            # Simple strategy: grab all articles, find the one with the link to this tweet OR just the first one.
            # Usually the focused tweet is the first major article.
            
            # Wait for any article
            try:
                await page.wait_for_selector('article', timeout=15000)
            except:
                # Capture debug screenshot
                await page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "import_fail.png"))
                return {"success": False, "log": "No content found (timeout)."}
            
            articles = await page.locator('article').all()
            found_article = None
            
            for art in articles:
                # Check if this article links to the target ID (self-link)
                # Or checks if the time element links to it
                links = art.locator(f'a[href*="{target_id}"]').first
                if await links.count() > 0:
                    found_article = art
                    break
            
            if not found_article and len(articles) > 0:
                 # Fallback: assume first article is the tweet
                 found_article = articles[0]
            
            if found_article:
                log("Found target article element.")
                clean_username = username.lstrip('@')
                tweet_data = await scrape_tweet_from_article(found_article, context, clean_username, log)
                if tweet_data:
                    log(f"Successfully scraped tweet: {tweet_data['tweet_id']}")
                else:
                    log("Failed to scrape data from article element.")
            else:
                log("Could not locate the tweet article element.")
            
        except Exception as e:
            log(f"Import error: {e}")
            await page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "import_error.png"))
        
        finally:
            await browser.close()

    return {
        "success": bool(tweet_data),
        "log": "\n".join(log_messages),
        "tweet": tweet_data
    }

async def check_login_state(username: str) -> dict:
    """
    Lightweight health check for session validity.
    Returns {"status": "valid" | "invalid" | "error", "log": str}
    """
    log_messages = []
    def log(msg):
        logger.info(f"[HealthCheck] {msg}")
        log_messages.append(msg)

    storage_state, _ = await _get_storage_state(username, log)
    if not storage_state:
        return {"status": "invalid", "log": "No cookies found"}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
             user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
             storage_state=storage_state
        )
        try:
            page = await context.new_page()
            # Optimization: Block resources heavily
            await page.route("**/*", lambda route: route.abort() 
                if route.request.resource_type in ["image", "stylesheet", "font", "media"] 
                else route.continue_()
            )
            
            # Go to home to check session
            await page.goto("https://x.com/home", timeout=20000)
            await human_delay(1, 2)
            
            is_valid = await verify_session(page, log)
            return {"status": "valid" if is_valid else "invalid", "log": "\n".join(log_messages)}
            
        except Exception as e:
            return {"status": "error", "log": str(e)}
        finally:
            await browser.close()

