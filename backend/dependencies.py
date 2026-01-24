from fastapi import Header, HTTPException, Request
from backend.config import settings
from loguru import logger

async def verify_token(request: Request, x_admin_token: str = Header(None)):
    # Crucial: Allow CORS preflight requests
    if request.method == "OPTIONS":
        return x_admin_token
    
    # Safe check
    server_token = settings.ADMIN_TOKEN
    
    if server_token and server_token.strip():
        server_token = server_token.strip()
        client_token = x_admin_token.strip() if x_admin_token else ""
        
        if client_token != server_token:
            masked_client = client_token[:2] + "***" if len(client_token) > 2 else "***"
            masked_server = server_token[:2] + "***" if len(server_token) > 2 else "***"
            logger.warning(f"Auth Failed. Client sent: '{masked_client}', Server expects: '{masked_server}'")
            raise HTTPException(status_code=401, detail="Invalid token")
    return x_admin_token
