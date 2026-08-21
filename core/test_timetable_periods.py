"""The school's bell schedule is configurable, and validated before it is stored."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import SchoolSettings, UserProfile


def periods(*rows):
    return [
        {"period": n, "label": label, "start": start, "end": end, "is_break": is_break}
        for n, label, start, end, is_break in rows
    ]


class TimetablePeriodTests(TestCase):
    def setUp(self):
        self.admin = self._user("admin@example.com", "admin")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _user(self, email, role):
        user = User.objects.create_user(username=email, email=email, password="SomePass12345")
        UserProfile.objects.update_or_create(user=user, defaults={"role": role})
        return User.objects.get(pk=user.pk)

    def test_a_school_starts_with_a_default_schedule(self):
        response = self.client.get("/api/settings/")

        schedule = response.data["timetable_periods"]
        self.assertEqual(len(schedule), 6)
        self.assertEqual(schedule[0]["start"], "08:00")
        self.assertEqual(schedule[0]["end"], "08:45")

    def test_admin_can_set_their_own_periods_and_times(self):
        payload = periods(
            (1, "Registration", "07:30", "07:50", False),
            (2, "Lesson 1", "07:50", "08:50", False),
            (3, "Tea Break", "08:50", "09:10", True),
            (4, "Lesson 2", "09:10", "10:10", False),
        )

        response = self.client.patch(
            "/api/settings/", {"timetable_periods": payload}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        stored = SchoolSettings.objects.get(pk=1).timetable_periods
        self.assertEqual(len(stored), 4)
        self.assertEqual(stored[1]["label"], "Lesson 1")
        self.assertEqual(stored[1]["end"], "08:50")
        self.assertTrue(stored[2]["is_break"])

    def test_a_single_period_day_is_allowed(self):
        response = self.client.patch(
            "/api/settings/",
            {"timetable_periods": periods((1, "All day", "08:00", "15:00", False))},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(SchoolSettings.objects.get(pk=1).timetable_periods), 1)

    def test_twelve_periods_are_allowed(self):
        payload = [
            {"period": n, "label": f"P{n}", "start": f"{7 + n:02d}:00", "end": f"{7 + n:02d}:45"}
            for n in range(1, 13)
        ]

        response = self.client.patch(
            "/api/settings/", {"timetable_periods": payload}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(SchoolSettings.objects.get(pk=1).timetable_periods), 12)

    def test_end_before_start_is_rejected(self):
        response = self.client.patch(
            "/api/settings/",
            {"timetable_periods": periods((1, "Backwards", "10:00", "09:00", False))},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("before it starts", str(response.data))

    def test_duplicate_period_numbers_are_rejected(self):
        response = self.client.patch(
            "/api/settings/",
            {
                "timetable_periods": periods(
                    (1, "One", "08:00", "08:45", False),
                    (1, "Also one", "08:45", "09:30", False),
                )
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("more than once", str(response.data))

    def test_a_nonsense_time_is_rejected(self):
        response = self.client.patch(
            "/api/settings/",
            {"timetable_periods": [{"period": 1, "start": "half eight", "end": "09:00"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_a_missing_time_is_rejected(self):
        response = self.client.patch(
            "/api/settings/",
            {"timetable_periods": [{"period": 1, "start": "08:00"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("end", str(response.data))

    def test_teachers_and_parents_can_read_the_schedule(self):
        self.client.patch(
            "/api/settings/",
            {"timetable_periods": periods((1, "Lesson 1", "07:50", "08:50", False))},
            format="json",
        )

        for role in ("teacher", "parent"):
            client = APIClient()
            client.force_authenticate(user=self._user(f"{role}@example.com", role))

            response = client.get("/api/settings/")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["timetable_periods"][0]["label"], "Lesson 1")

    def test_a_teacher_cannot_change_the_schedule(self):
        client = APIClient()
        client.force_authenticate(user=self._user("teacher2@example.com", "teacher"))

        response = client.patch(
            "/api/settings/",
            {"timetable_periods": periods((1, "Hijacked", "06:00", "07:00", False))},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
