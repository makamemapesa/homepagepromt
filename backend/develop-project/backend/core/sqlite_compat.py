"""Keep JSONField writable on a sqlite build that was compiled without JSON1.

Django adds ``CHECK (JSON_VALID("col"))`` to every JSONField column it creates
on sqlite. The interpreter this project's venv is built on ships sqlite 3.35.5
with the JSON1 extension left out, so that function does not exist and *any*
write to a table holding a JSONField dies with::

    OperationalError: unknown function: JSON_VALID()

which takes School Settings (grade bands, timetable periods) and the whole of
Homepage content down with it — the rows can be read but never saved.

Registering a Python implementation of ``JSON_VALID`` on each new connection
restores writes. JSON *lookups* (``field__key=...``) stay unavailable because
they need ``JSON_EXTRACT`` too; nothing in this project uses one, and adding a
half-working ``JSON_EXTRACT`` would hide that rather than report it.

This is a shim, not a cure. The real fix is an interpreter whose sqlite has
JSON1 — it is compiled in by default from sqlite 3.38 — and this module checks
before it registers anything, so it quietly does nothing once that is in place.
"""
import json

from django.db.backends.signals import connection_created
from django.dispatch import receiver


def _has_json1(raw_connection) -> bool:
    try:
        raw_connection.execute("SELECT JSON_VALID('{}')")
    except Exception:
        return False
    return True


def _json_valid(value):
    """sqlite's JSON_VALID: 1 for parseable JSON text, 0 otherwise, NULL for NULL."""
    if value is None:
        return None
    try:
        json.loads(value)
    except Exception:
        return 0
    return 1


@receiver(connection_created)
def register_json_valid(connection, **kwargs):
    if connection.vendor != "sqlite":
        return
    raw = connection.connection
    if raw is None or _has_json1(raw):
        return
    raw.create_function("JSON_VALID", 1, _json_valid)
