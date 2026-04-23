import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.auth.jwt_utils import verify_token

_bearer = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
) -> str:
    """Returns the user_id (UUID string) from a valid Bearer JWT."""
    try:
        payload = verify_token(credentials.credentials)
        user_id: str = payload["sub"]
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token has expired")
    except Exception:
        raise HTTPException(401, "Invalid authentication token")
