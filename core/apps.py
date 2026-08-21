from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        # Import signal handlers to ensure UserProfile objects are created
        # when User instances are created (e.g. via createsuperuser).
        try:
            import core.signals  # noqa: F401
        except Exception:
            pass
