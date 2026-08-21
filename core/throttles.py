from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """
    Strict rate limiting for login attempts to prevent brute force attacks.
    Allows only 5 login attempts per minute per IP address.
    """
    scope = "login"
    rate = "5/minute"


class PublicApplicationThrottle(AnonRateThrottle):
    """
    Rate limiting for public online application submissions.
    Prevents spam flooding of applicant creation and auto-account creation.
    Allows 10 applications per hour per IP address.
    """
    scope = "public_application"
    rate = "10/hour"
