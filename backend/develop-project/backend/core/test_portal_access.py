"""What each portal may reach.

These rules are invisible from the screens themselves: a role that cannot read
an endpoint gets an empty dropdown, not an error, so a regression here looks
like "the page is just blank" rather than like a permissions bug. Each test
below states one rule and why it exists.
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from academics.models import (
    AcademicCalendar, Class, Subject, Teacher, TeacherAssignment, Timetable,
)
from core.models import SchoolSettings, UserProfile
from exams.models import ExamMark, ExamResult
from fees.models import Payment
from students.models import ParentGuardian, Student

TERM = "Term 2, 2026"


class PortalAccessTestCase(TestCase):
    """One school, one login per role, and a child belonging to the parent."""

    def setUp(self):
        SchoolSettings.objects.create(academic_session="2026", current_term="Term 2")

        self.mine = Class.objects.create(
            name="Form 1A", section="Secondary", level="Form 1", arm="A"
        )
        self.other = Class.objects.create(
            name="Form 1B", section="Secondary", level="Form 1", arm="B"
        )
        self.subject = Subject.objects.create(name="Maths", code="MTH", department="Sci")

        self.users = {}
        for role in ["super_admin", "admin", "teacher", "accountant", "parent", "staff"]:
            user = User.objects.create_user(
                username=role, email="%s@school.test" % role, password="StrongPass123"
            )
            UserProfile.objects.update_or_create(user=user, defaults={"role": role})
            user.refresh_from_db()
            self.users[role] = user

        # role_sync creates the Teacher row from the login, so reuse it.
        self.teacher, _ = Teacher.objects.get_or_create(
            email="teacher@school.test", defaults={"name": "T Teacher"}
        )
        self.mine.class_teacher = self.teacher
        self.mine.save()
        TeacherAssignment.objects.create(
            teacher=self.teacher, subject=self.subject,
            student_class=self.mine, status="active",
        )

        self.child = Student.objects.create(
            reg_no="CHILD-1", first_name="Own", last_name="Child",
            date_of_birth=date(2010, 1, 1), gender="Male",
            student_class=self.mine, admission_date=date(2024, 1, 1),
        )
        self.stranger = Student.objects.create(
            reg_no="OTHER-1", first_name="Someone", last_name="Else",
            date_of_birth=date(2010, 1, 1), gender="Female",
            student_class=self.other, admission_date=date(2024, 1, 1),
        )
        ParentGuardian.objects.create(
            student=self.child, user=self.users["parent"], full_name="A Parent",
            relationship="Mother", phone="+255700000000", is_primary=True,
        )

    def as_role(self, role):
        client = APIClient()
        client.force_authenticate(user=self.users[role])
        return client

    def rows(self, response):
        data = response.json()
        return data["results"] if isinstance(data, dict) and "results" in data else data


class ReferenceDataAccessTests(PortalAccessTestCase):
    """Classes, subjects, the timetable and the calendar are reference data.

    Every screen in the portal starts with "choose a class". When the class list
    came back empty the page had nothing to load and looked broken rather than
    forbidden — which is how this went unnoticed.
    """

    def test_accountant_can_list_classes(self):
        res = self.as_role("accountant").get("/api/classes/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(self.rows(res)), 2)

    def test_staff_can_list_classes(self):
        res = self.as_role("staff").get("/api/classes/")

        self.assertEqual(res.status_code, 200)

    def test_parent_sees_only_the_classes_their_child_is_in(self):
        res = self.as_role("parent").get("/api/classes/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual([c["name"] for c in self.rows(res)], ["Form 1A"])

    def test_teacher_still_sees_only_their_own_classes(self):
        res = self.as_role("teacher").get("/api/classes/")

        self.assertEqual([c["name"] for c in self.rows(res)], ["Form 1A"])

    def test_a_parent_cannot_create_a_class(self):
        res = self.as_role("parent").post("/api/classes/", {
            "name": "Sneaky", "section": "Secondary", "level": "Form 2", "arm": "C",
        }, format="json")

        self.assertEqual(res.status_code, 403)

    def test_staff_can_read_the_timetable_and_calendar(self):
        Timetable.objects.create(
            student_class=self.mine, subject=self.subject, teacher=self.teacher,
            day="Monday", period=1,
        )
        AcademicCalendar.objects.create(
            event="Mid-term break", type="holiday",
            date=date(2026, 5, 1), end_date=date(2026, 5, 5),
        )
        client = self.as_role("staff")

        self.assertEqual(len(self.rows(client.get("/api/timetable/"))), 1)
        self.assertEqual(len(self.rows(client.get("/api/academic-calendar/"))), 1)

    def test_staff_cannot_change_the_calendar(self):
        res = self.as_role("staff").post("/api/academic-calendar/", {
            "event": "Nope", "type": "holiday",
            "date": "2026-06-01", "end_date": "2026-06-02",
        }, format="json")

        self.assertEqual(res.status_code, 403)

    def test_teacher_can_read_the_staff_directory(self):
        """The class-teacher and author pickers are populated from this list."""
        res = self.as_role("teacher").get("/api/teachers/")

        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(self.rows(res)) >= 1)

    def test_teacher_cannot_edit_the_staff_directory(self):
        res = self.as_role("teacher").patch(
            f"/api/teachers/{self.teacher.id}/", {"name": "Renamed"}, format="json"
        )

        self.assertEqual(res.status_code, 403)


class AccountantExamAccessTests(PortalAccessTestCase):
    """Accountants read exam records because releasing a report card is fee-gated."""

    def setUp(self):
        super().setUp()
        ExamResult.objects.create(
            student=self.child, student_class=self.mine, term=TERM,
            academic_session="2026", average=Decimal("72.00"),
        )
        ExamMark.objects.create(
            student=self.child, subject=self.subject, student_class=self.mine,
            term=TERM, exam_type="CA 1", academic_session="2026", score=Decimal("70.00"),
        )

    def test_accountant_can_read_results(self):
        res = self.as_role("accountant").get("/api/exam-results/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(self.rows(res)), 1)

    def test_accountant_can_read_marks(self):
        res = self.as_role("accountant").get("/api/exam-marks/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(self.rows(res)), 1)

    def test_accountant_cannot_enter_a_mark(self):
        res = self.as_role("accountant").post("/api/exam-marks/bulk_save/", {
            "marks": [{
                "student": self.child.id, "subject": self.subject.id,
                "student_class": self.mine.id, "term": TERM, "exam_type": "CA 2",
                "academic_session": "2026", "score": 99,
            }]
        }, format="json")

        self.assertEqual(res.status_code, 403)

    def test_accountant_cannot_compute_results(self):
        res = self.as_role("accountant").post("/api/exam-results/compute_results/", {
            "student_class": self.mine.id, "term": TERM,
        }, format="json")

        self.assertEqual(res.status_code, 403)

    def test_staff_cannot_read_exam_records(self):
        """Minimal self-service: a staff member has no business in student marks."""
        client = self.as_role("staff")

        self.assertEqual(client.get("/api/exam-results/").status_code, 403)
        self.assertEqual(client.get("/api/exam-marks/").status_code, 403)
        self.assertEqual(client.get("/api/students/").status_code, 403)


class FeeClearanceAccessTests(PortalAccessTestCase):
    """A teacher needs the fee decision without being handed the ledger."""

    def setUp(self):
        super().setUp()
        Payment.objects.create(
            student=self.child, amount=Decimal("100000"), date=date(2026, 5, 1),
            method="Cash", status="confirmed", term=TERM,
        )
        Payment.objects.create(
            student=self.stranger, amount=Decimal("50000"), date=date(2026, 5, 1),
            method="Cash", status="pending", term=TERM,
        )

    def test_teacher_can_read_clearance(self):
        res = self.as_role("teacher").get(f"/api/fees/payments/clearance/?term={TERM}")

        self.assertEqual(res.status_code, 200)
        rows = {r["student"]: r for r in res.json()["students"]}
        self.assertTrue(rows[self.child.id]["cleared"])

    def test_teacher_still_cannot_read_the_payment_ledger(self):
        """The point of the clearance endpoint: the answer, not the amounts."""
        res = self.as_role("teacher").get("/api/fees/payments/")

        self.assertEqual(res.status_code, 403)

    def test_clearance_is_scoped_to_the_teachers_own_classes(self):
        res = self.as_role("teacher").get(f"/api/fees/payments/clearance/?term={TERM}")

        listed = {r["student"] for r in res.json()["students"]}
        self.assertIn(self.child.id, listed)
        self.assertNotIn(self.stranger.id, listed)

    def test_clearance_is_scoped_to_a_parents_own_children(self):
        res = self.as_role("parent").get(f"/api/fees/payments/clearance/?term={TERM}")

        listed = {r["student"] for r in res.json()["students"]}
        self.assertEqual(listed, {self.child.id})

    def test_a_pending_payment_blocks_clearance_and_says_so(self):
        res = self.as_role("accountant").get(f"/api/fees/payments/clearance/?term={TERM}")

        rows = {r["student"]: r for r in res.json()["students"]}
        self.assertFalse(rows[self.stranger.id]["cleared"])
        self.assertIn("awaiting confirmation", rows[self.stranger.id]["reason"])

    def test_clearance_carries_no_amounts(self):
        """Whatever the caller's role, this endpoint never discloses a figure."""
        res = self.as_role("teacher").get(f"/api/fees/payments/clearance/?term={TERM}")

        for row in res.json()["students"]:
            self.assertEqual(set(row), {"student", "cleared", "reason"})
            self.assertNotIn("100000", row["reason"])

    def test_term_is_required(self):
        res = self.as_role("accountant").get("/api/fees/payments/clearance/")

        self.assertEqual(res.status_code, 400)

    def test_staff_cannot_read_clearance(self):
        res = self.as_role("staff").get(f"/api/fees/payments/clearance/?term={TERM}")

        self.assertEqual(res.status_code, 403)
