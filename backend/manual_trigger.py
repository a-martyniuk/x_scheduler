"""
Manual trigger for scheduled posts - for testing
"""
import asyncio
from backend.scheduler import check_scheduled_posts

async def main():
    print("Manually triggering scheduled posts check...")
    await check_scheduled_posts()
    print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
