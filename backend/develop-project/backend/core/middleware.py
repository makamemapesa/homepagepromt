"""
Audit log middleware.

Records CREATE / UPDATE / DELETE / LOGIN / LOGOUT / EXPORT / SETTINGS actions
automatically for every authenticated API request that mutates data.
Read-only GET requests are NOT logged (to avoid noise).
"""
import json
from django.utils.deprecation import MiddlewareMixin
from .models import AuditLog

# Map HTTP method → action string
_METHOD_ACTION = {
    "POST":   "CREATE",
    "PUT":    "UPDATE",
    "PATCH":  "UPDATE",
    "DELETE": "DELETE",
}

# URL fragment → module label
_PATH_MODULE = [
    ("/api/students",       "Students"),
    ("/api/academics",      "Academics"),
    ("/api/exam-marks",     "Exams"),
    ("/api/exam-results",   "Exams"),
    ("/api/fees",           "Fees"),
    ("/api/donors",         "Donors"),
    ("/api/notifications",  "Notifications"),
    ("/api/users",          "Users"),
    ("/api/settings",       "Settings"),
    ("/api/auth",           "Auth"),
]

# Special overrides for specific URL fragments
_SPECIAL = {
    "/api/auth/login":      ("LOGIN",   "Auth"),
    "/api/auth/logout":     ("LOGOUT",  "Auth"),
    "/api/reports/":        ("EXPORT",  "Reports"),
    "/api/settings/":       ("SETTINGS","Settings"),
    "clear_all":            ("DELETE",  "Notifications"),
    "mark_all_read":        ("UPDATE",  "Notifications"),
    "compute_results":      ("UPDATE",  "Exams"),
    "bulk_save":            ("UPDATE",  "Exams"),
    "promote":              ("UPDATE",  "Students"),
    "upload_document":      ("UPDATE",  "Students"),
}


def _get_client_ip(request):
    # Only trust X-Forwarded-For if the server is behind a trusted proxy.
    # In production, configure SECURE_PROXY_SSL_HEADER and use REMOTE_ADDR.
    # Trusting X_FORWARDED_FOR blindly allows IP spoofing.
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        # Take only the first IP (client IP) from the chain and strip whitespace.
        ip = forwarded.split(",")[0].strip()
        # Basic sanity check: must look like an IP address
        if ip and all(c in "0123456789.:abcdefABCDEF" for c in ip):
            return ip
    return request.META.get("REMOTE_ADDR")


def _resolve_module(path: str) -> str:
    for fragment, label in _PATH_MODULE:
        if fragment in path:
            return label
    return "System"


def _resolve_action(request) -> str:
    path = request.path
    for fragment, (action, _) in _SPECIAL.items():
        if fragment in path:
            return action
    return _METHOD_ACTION.get(request.method, "")


def _resolve_detail(request, response_status: int) -> str:
    """Build a short human-readable detail string."""
    method = request.method
    path = request.path
    parts = [p for p in path.split("/") if p and p not in ("api",)]
    resource = parts[0] if parts else "resource"
    pk = parts[1] if len(parts) > 1 and parts[1].isdigit() else None
    action_map = {
        "POST":   f"Created {resource}" + (f" #{pk}" if pk else ""),
        "PUT":    f"Updated {resource}" + (f" #{pk}" if pk else ""),
        "PATCH":  f"Updated {resource}" + (f" #{pk}" if pk else ""),
        "DELETE": f"Deleted {resource}" + (f" #{pk}" if pk else ""),
    }
    return action_map.get(method, f"{method} {path}")[:255]


class AuditLogMiddleware(MiddlewareMixin):
    """
    After each mutating API request, writes one AuditLog row.
    Only fires for authenticated users to avoid polluting logs with
    anonymous/failed-auth noise (those are handled separately).
    """

    def process_response(self, request, response):
        # Only log mutating methods
        if request.method not in _METHOD_ACTION and not any(
            f in request.path for f in ("/api/auth/login", "/api/auth/logout")
        ):
            return response

        # Only log /api/ paths
        if not request.path.startswith("/api/"):
            return response

        # Determine action (skip empty)
        action = _resolve_action(request)
        if not action:
            return response

        # Require authenticated user
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return response

        module = _resolve_module(request.path)
        detail = _resolve_detail(request, response.status_code)
        log_status = "success" if response.status_code < 400 else "failed"

        try:
            AuditLog.objects.create(
                user=user,
                action=action,
                module=module,
                detail=detail,
                ip=_get_client_ip(request),
                status=log_status,
            )
        except Exception:
            # Never let audit logging break the actual response
            pass

        return response
