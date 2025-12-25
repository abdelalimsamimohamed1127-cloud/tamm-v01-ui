import jwt
import os
from rest_framework import authentication
from rest_framework import exceptions

from django.conf import settings

# --- Supabase JWT Authentication Backend ---
import logging

logger = logging.getLogger(__name__)

class SupabaseJWTAuthentication(authentication.BaseAuthentication):
    """
    Authenticates requests using Supabase JWTs.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return None

        try:
            token = auth_header.split(' ')[1]
        except IndexError:
            logger.warning("Invalid token header: No credentials provided.")
            raise exceptions.AuthenticationFailed('Invalid token header. No credentials provided.')

        if not token:
            return None

        jwt_secret = settings.SUPABASE_JWT_SECRET
        jwt_aud = settings.SUPABASE_JWT_AUD
        jwt_iss = settings.SUPABASE_JWT_ISS

        if not jwt_secret:
            raise exceptions.ImproperlyConfigured("SUPABASE_JWT_SECRET is not configured in Django settings.")

        try:
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                audience=jwt_aud,
                issuer=jwt_iss,
                options={"verify_signature": True, "verify_exp": True, "verify_aud": True, "verify_iss": True}
            )
        except jwt.exceptions.ExpiredSignatureError:
            logger.warning("Token authentication failed: Expired signature")
            raise exceptions.AuthenticationFailed('Token has expired.')
        except jwt.exceptions.InvalidAudienceError:
            logger.warning("Token authentication failed: Invalid audience")
            raise exceptions.AuthenticationFailed('Invalid token audience.')
        except jwt.exceptions.InvalidIssuerError:
            logger.warning("Token authentication failed: Invalid issuer")
            raise exceptions.AuthenticationFailed('Invalid token issuer.')
        except jwt.exceptions.InvalidSignatureError:
            logger.warning("Token authentication failed: Invalid signature")
            raise exceptions.AuthenticationFailed('Invalid token signature.')
        except jwt.exceptions.DecodeError:
            logger.warning("Token authentication failed: Decode error")
            raise exceptions.AuthenticationFailed('Error decoding token.')
        except Exception as e:
            logger.error(f"Token authentication failed with an unexpected error: {e}", exc_info=True)
            raise exceptions.AuthenticationFailed(f'Token authentication failed: {e}')

        user_id = payload.get('sub')
        user_role = payload.get('role')

        if not user_id:
            logger.warning("Token authentication failed: JWT payload missing user ID (sub).")
            raise exceptions.AuthenticationFailed('JWT payload missing user ID (sub).')

        class AuthenticatedUser:
            is_authenticated = True
            def __init__(self, user_id, role):
                self.id = user_id
                self.user_id = user_id
                self.role = role
            def __str__(self):
                return f"User({self.id})"

        request.user_id_from_jwt = user_id
        request.user_role_from_jwt = user_role

        return AuthenticatedUser(user_id, user_role), payload

    def authenticate_header(self, request):
        return 'Bearer realm="api"'

