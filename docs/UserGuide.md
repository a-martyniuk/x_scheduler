# X Scheduler - User Guide

## Overview
X Scheduler is a self-hosted tool that allows you to schedule posts (tweets) and threads for X (formerly Twitter) using a local browser automation worker (Playwright). It bypasses the need for the expensive official API by using your own browser cookies.

## Features
- **Schedule Posts**: Pick a date and time.
- **Media Upload**: Attach images to your posts.
- **Threads**: Create threaded replies (self-replying chains).
- **Dark Mode**: Toggle between light and dark themes.
- **Auto-Retry**: Failed posts are retried automatically up to 3 times.

## Getting Started

### 1. Cookies Setup (Critical)
The worker needs your authentication cookies to post on your behalf.
1. Log in to X.com in your regular browser.
2. Use a "Cookie Editor" extension to export cookies as JSON.
3. Save the file as `cookies.json` in the `worker/` directory:
   `d:\Projects\x_scheduler\worker\cookies.json`

### 2. Running the App
You need two terminals running:

**Backend (API & Scheduler):**
```bash
cd backend
python -m uvicorn main:app --reload
```

**Frontend (UI):**
```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`.

## How to Use Threads
The threading feature allows you to schedule a sequence of posts. The system is smart enough to wait for the "Parent" tweet to be sent before attempting to send the "Child" reply.

1.  **Create the First Post (Parent)**:
    *   Click a date on the calendar.
    *   Write your content (e.g., "Thread Part 1/3").
    *   Set the time (e.g., 10:00 AM).
    *   Save.

2.  **Create a Reply (Child)**:
    *   Click a date (can be the same time or later).
    *   In the "New Post" modal, look for **"Reply to (Thread)"**.
    *   Select the Parent post you just created from the dropdown.
    *   Write your reply (e.g., "Thread Part 2/3").
    *   Save.

**How it works:**
*   When the Parent post is sent, the worker extracts its **Tweet ID** (e.g., `18105...`).
*   When the Child post is due, the scheduler checks if the Parent has a Tweet ID.
    *   **If Yes:** It launches the worker, navigates to the Parent tweet, and replies to it.
    *   **If No (Parent not sent yet):** It **skips** the Child post and checks again in 1 minute.
