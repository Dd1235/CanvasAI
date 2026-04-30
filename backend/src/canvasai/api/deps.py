from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
from typing import Annotated

from canvasai.storage.client import get_supabase

logger = logging.getLogger(__name__)
token_auth_scheme = HTTPBearer()

# Note: We dropped 'async' here. FastAPI automatically runs synchronous functions 
# in a threadpool, which is perfect since get_user makes a quick network call!
def get_current_user_id(
    token: Annotated[HTTPAuthorizationCredentials, Depends(token_auth_scheme)]
) -> str:
    """
    Validates the Supabase JWT using the official Supabase client.
    This handles all algorithm changes (HS256 vs RS256) automatically.
    """
    try:
        db = get_supabase()
        
        # The Supabase client securely validates the token against their servers
        user_response = db.auth.get_user(token.credentials)
        
        if not user_response or not user_response.user:
            raise ValueError("Token is valid, but no user was returned.")
            
        return user_response.user.id

    except Exception as e:
        logger.error(f"Auth verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token."
        )