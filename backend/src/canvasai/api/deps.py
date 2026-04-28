from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Annotated

from canvasai.config import get_settings, Settings

# HTTPBearer automatically inspects the Authorization header
token_auth_scheme = HTTPBearer()

async def get_current_user_id(
    token: Annotated[HTTPAuthorizationCredentials, Depends(token_auth_scheme)],
    settings: Annotated[Settings, Depends(get_settings)]
) -> str:
    """
    Validates the Supabase JWT and extracts the user's UUID.
    Raises HTTP 401 on missing, expired, or invalid tokens.
    """
    try:
        payload = jwt.decode(
            token.credentials,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )
        
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token is missing the 'sub' claim."
            )
            
        return user_id

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )