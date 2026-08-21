from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenBlacklistView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from core.throttles import LoginRateThrottle

_COOKIE_NAME = "fiss_refresh"
_COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def _refresh_cookie_kwargs(request, token: str) -> dict:
    """Build consistent Set-Cookie kwargs for the refresh token."""
    secure = not settings.DEBUG
    return dict(
        key=_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure,
        samesite="Lax",
        max_age=_COOKIE_MAX_AGE,
        path="/",
    )


class CookieTokenObtainPairView(TokenObtainPairView):
    """
    Login: rate-limited.
    Returns access token in the JSON body and stores the refresh token
    in an httpOnly cookie so JavaScript cannot read it (XSS mitigation).
    """
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            refresh = response.data.pop("refresh", None)
            if refresh:
                response.set_cookie(**_refresh_cookie_kwargs(request, refresh))
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """
    Token refresh: reads the refresh token from the httpOnly cookie
    instead of the request body, returns a new access token in the body,
    and rotates the refresh cookie.
    """

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(_COOKIE_NAME)
        if not refresh_token:
            return Response(
                {"detail": "No refresh token cookie found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        # Pass the cookie value directly to the serializer — avoids DRF data mutation issues
        serializer = self.get_serializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        data = dict(serializer.validated_data)
        new_refresh = data.pop("refresh", None)
        response = Response(data, status=status.HTTP_200_OK)
        if new_refresh:
            response.set_cookie(**_refresh_cookie_kwargs(request, new_refresh))
        return response


class CookieTokenBlacklistView(TokenBlacklistView):
    """
    Logout: reads the refresh token from the httpOnly cookie,
    blacklists it, and clears the cookie.
    """

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(_COOKIE_NAME)
        if not refresh_token:
            # Already logged out — clear cookie just in case and return OK
            response = Response({"detail": "Already logged out."}, status=status.HTTP_200_OK)
            response.delete_cookie(_COOKIE_NAME, path="/")
            return response

        serializer = self.get_serializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        response = Response({"detail": "Token blacklisted."}, status=status.HTTP_200_OK)
        response.delete_cookie(_COOKIE_NAME, path="/")
        return response


urlpatterns = [
    path("admin/", admin.site.urls),
    # Auth endpoints using httpOnly cookie for the refresh token
    path("api/auth/token/", CookieTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", CookieTokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/blacklist/", CookieTokenBlacklistView.as_view(), name="token_blacklist"),
    # App routes
    path("api/", include("core.urls")),
    path("api/", include("students.urls")),
    path("api/", include("academics.urls")),
    path("api/", include("exams.urls")),
    path("api/", include("fees.urls")),
    path("api/", include("donors.urls")),
    path("api/", include("admissions.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
