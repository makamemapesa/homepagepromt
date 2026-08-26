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

        # Restore JSONField writes on a sqlite build without JSON1. Deliberately
        # not wrapped in try/except: if this fails to load, every settings and
        # homepage save fails too, and a silent pass would turn that into a
        # mystery 500 rather than a startup error naming the cause.
        import core.sqlite_compat  # noqa: F401
