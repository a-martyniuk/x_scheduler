# worker/config.py

class XSelectors:
    """
    Centralized configuration for X.com (Twitter) DOM selectors.
    If X changes their class names, update them here.
    """
    
    # --- LOGIN ---
    LOGIN_INPUT_USERNAME = 'input[autocomplete="username"]'
    LOGIN_INPUT_PASSWORD = 'input[name="password"]'
    LOGIN_INPUT_CHALLENGE = 'input[name="text"]' # Phone/Email challenge
    LOGIN_BTN_NEXT = 'text="Next"' # Often dynamic, but usually handled by Enter key
    
    # Indicators of successful login
    HOME_LINK = '[data-testid="AppTabBar_Home_Link"]'
    ACCOUNT_SWITCHER = '[data-testid="SideNav_AccountSwitcher_Button"]'
    
    # Login Wall / Logged out indicators
    LOGGED_OUT_SIGN_UP = '[data-testid="signup"]'
    LOGGED_OUT_LOGIN = '[data-testid="login"]'

    
    # --- POSTING ---
    COMPOSE_BOX_HOME = '[data-testid="tweetTextarea_0"]'
    FILE_INPUT = '[data-testid="fileInput"]'
    
    # Buttons
    BTN_TWEET_INLINE = '[data-testid="tweetButtonInline"]'
    BTN_TWEET_MODAL = '[data-testid="tweetButton"]'
    BTN_REPLY_MODAL = '[data-testid="reply"]'
    
    PROFILE_LINK = '[data-testid="AppTabBar_Profile_Link"]'
    
    # --- FEED / SCRAPING ---
    TWEET_ARTICLE = 'article[data-testid="tweet"]'
    TWEET_TEXT = '[data-testid="tweetText"]'
    
    # Metrics
    METRIC_LIKE = '[data-testid="like"]'
    METRIC_UNLIKE = '[data-testid="unlike"]'
    METRIC_REPOST = '[data-testid="retweet"]'
    METRIC_UNREPOST = '[data-testid="unretweet"]'
    METRIC_SOCIAL_CONTEXT = '[data-testid="socialContext"]' # "You reposted" header
    
    # Analytics
    LINK_ANALYTICS = 'a[href*="/analytics"]'
    CONTAINER_VIEW_STAT = '[data-testid="app-text-transition-container"]'
    
    # --- PROFILE ---
    LINK_FOLLOWERS = 'a[href*="/followers"]'
    LINK_VERIFIED_FOLLOWERS = 'a[href*="/verified_followers"]'
