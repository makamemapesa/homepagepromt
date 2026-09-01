"""Who may do what in the examination panel.

One test per role-and-function, so a permission that drifts fails here by name
rather than being discovered by whoever it lets through. The rules:

  super_admin / admin  everything, unscoped
  teacher              marks for the subjects they teach; computes and comments
                       on results for their own classes — but does not release
  accountant           read only — they confirm the fee that releases a report
  parent               read only, own children, and only once released
  staff                no examination access at all
"""
from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from academics.models import Class, Subject, Teacher, TeacherAssignment
from core.models import SchoolSettings, UserProfile
from students.models import ParentGuardian, Student

from .models import ExamMark, ExamResult

TERM = "Term 2, 2026"
SESSION = "2026"

READERS = ("super_admin", "admin", "teacher", "accountant", "parent")
WRITERS = ("super_admin", "admin", "teacher")
NON_WRITERS = ("accountant", "parent", "staff")


class ExamRoleFunctionTests(TestCase):
    def setUp(self):
        SchoolSettings.objects.create(academic_session=SESSION, current_term="Term 2")
        self.cls = Class.objects.create(name="Form 1A", section="Secondary", level="Form 1", arm="A")
        self.other_cls = Class.objects.create(name="Form 1B", section="Secondary", level="Form 1", arm="B")
        self.maths = Subject.objects.create(name="Mathematics", code="MTH", department="Science")
        self.english = Subject.objects.create(name="English", code="ENG", department="Arts")
        self.cls.subjects.add(self.maths, self.english)

        self.student = Student.objects.create(
            reg_no="REG-1", first_name="Amina", last_name="Said",
            date_of_birth=date(2010, 1, 1), gender="Female",
            student_class=self.cls, admission_date=date(2024, 1, 1),
        )

        self.users = {}
        for role in READERS + ("staff",):
            user = User.objects.create_user(
                username=role, email=f"{role}@example.com", password="StrongPass123"
            )
            UserProfile.objects.update_or_create(user=user, defaults={"role": role})
            user.refresh_from_db()
            self.users[role] = user

        # The teacher takes Mathematics here and is also the class teacher, so
        # English is readable to them but is not theirs to change.
        self.teacher, _ = Teacher.objects.get_or_create(
            email="teacher@example.com", defaults={"name": "Teacher One"}
        )
        TeacherAssignment.objects.create(
            teacher=self.teacher, subject=self.maths, student_class=self.cls, status="active"
        )
        self.cls.class_teacher = self.teacher
        self.cls.save()

        ParentGuardian.objects.create(
            student=self.student, user=self.users["parent"], full_name="Fatma Said",
            relationship="Mother", phone="+255700000001", is_primary=True,
        )

    # ── helpers ──────────────────────────────────────────────────────────

    def client_for(self, role):
        client = APIClient()
        client.force_authenticate(user=self.users[role])
        return client

    def a_mark(self, subject=None):
        ExamMark.objects.all().delete()
        return ExamMark.objects.create(
            student=self.student, subject=subject or self.maths, student_class=self.cls,
            term=TERM, exam_type="CA 1", academic_session=SESSION, score=70,
        )

    def a_result(self, released=False):
        ExamResult.objects.all().delete()
        return ExamResult.objects.create(
            student=self.student, student_class=self.cls, term=TERM,
            academic_session=SESSION, total=70, average=70, grade="C", position=5,
            released_at=timezone.now() if released else None,
        )

    def mark_body(self, subject=None, exam_type="CA 9"):
        return {
            "student": self.student.id, "subject": (subject or self.maths).id,
            "student_class": self.cls.id, "term": TERM, "exam_type": exam_type,
            "academic_session": SESSION, "score": 55,
        }

    # ── Reading ──────────────────────────────────────────────────────────

    def test_every_working_role_can_read_marks_and_results(self):
        for role in READERS:
            client = self.client_for(role)

            self.assertEqual(client.get("/api/exam-marks/").status_code, 200, role)
            self.assertEqual(client.get("/api/exam-results/").status_code, 200, role)

    def test_staff_have_no_examination_access_at_all(self):
        client = self.client_for("staff")
        mark, result = self.a_mark(), self.a_result()

        for method, url in [
            ("get", "/api/exam-marks/"),
            ("get", "/api/exam-results/"),
            ("get", f"/api/exam-marks/available_types/?student_class={self.cls.id}"),
            ("get", f"/api/exam-marks/markable-subjects/?student_class={self.cls.id}"),
            ("delete", f"/api/exam-marks/{mark.id}/"),
            ("delete", f"/api/exam-results/{result.id}/"),
        ]:
            self.assertEqual(getattr(client, method)(url).status_code, 403, f"{method} {url}")

    # ── Writing: only teachers and admins ────────────────────────────────

    def test_accountants_parents_and_staff_cannot_enter_marks(self):
        for role in NON_WRITERS:
            client = self.client_for(role)

            created = client.post("/api/exam-marks/", self.mark_body(), format="json")
            bulk = client.post("/api/exam-marks/bulk_save/", {"marks": [self.mark_body()]}, format="json")

            self.assertEqual(created.status_code, 403, role)
            self.assertEqual(bulk.status_code, 403, role)
        self.assertFalse(ExamMark.objects.filter(exam_type="CA 9").exists())

    def test_accountants_parents_and_staff_cannot_change_or_delete_a_mark(self):
        for role in NON_WRITERS:
            mark = self.a_mark()
            client = self.client_for(role)

            patched = client.patch(f"/api/exam-marks/{mark.id}/", {"score": 1}, format="json")
            deleted = client.delete(f"/api/exam-marks/{mark.id}/")

            self.assertEqual(patched.status_code, 403, role)
            self.assertEqual(deleted.status_code, 403, role)
            self.assertTrue(ExamMark.objects.filter(pk=mark.pk).exists(), role)

    def test_accountants_parents_and_staff_cannot_compute_or_release(self):
        self.a_result()
        body = {"student_class": self.cls.id, "term": TERM, "academic_session": SESSION}

        for role in NON_WRITERS:
            client = self.client_for(role)

            compute = client.post("/api/exam-results/compute_results/", {**body, "ca_types": ["CA 1"]}, format="json")
            release = client.post("/api/exam-results/send_to_parents/", body, format="json")

            self.assertEqual(compute.status_code, 403, role)
            self.assertEqual(release.status_code, 403, role)

    def test_accountants_and_parents_cannot_write_a_teacher_comment(self):
        for role in ("accountant", "parent"):
            result = self.a_result()
            client = self.client_for(role)

            res = client.patch(
                f"/api/exam-results/{result.id}/", {"teacher_comment": "Forged"}, format="json"
            )

            self.assertEqual(res.status_code, 403, role)
            result.refresh_from_db()
            self.assertEqual(result.teacher_comment, "")

    # ── The teacher's own boundary ───────────────────────────────────────

    def test_a_teacher_may_delete_a_mark_in_the_subject_they_teach(self):
        mark = self.a_mark(self.maths)

        res = self.client_for("teacher").delete(f"/api/exam-marks/{mark.id}/")

        self.assertEqual(res.status_code, 204)
        self.assertFalse(ExamMark.objects.filter(pk=mark.pk).exists())

    def test_a_teacher_cannot_delete_a_colleagues_subject_in_their_own_homeroom(self):
        """Readable as class teacher, but deleting it is still not their call."""
        mark = self.a_mark(self.english)

        res = self.client_for("teacher").delete(f"/api/exam-marks/{mark.id}/")

        self.assertEqual(res.status_code, 403)
        self.assertTrue(ExamMark.objects.filter(pk=mark.pk).exists())

    def test_a_teacher_cannot_edit_a_colleagues_subject(self):
        mark = self.a_mark(self.english)

        res = self.client_for("teacher").patch(
            f"/api/exam-marks/{mark.id}/", {"score": 1}, format="json"
        )

        self.assertEqual(res.status_code, 403)
        mark.refresh_from_db()
        self.assertEqual(int(mark.score), 70)

    def test_a_teacher_cannot_compute_another_class(self):
        client = self.client_for("teacher")
        body = {"student_class": self.other_cls.id, "term": TERM, "academic_session": SESSION,
                "ca_types": ["CA 1"]}

        res = client.post("/api/exam-results/compute_results/", body, format="json")

        self.assertEqual(res.status_code, 403)

    def test_releasing_a_report_card_is_an_office_act(self):
        """A teacher marks and computes; publishing to families is the office."""
        self.a_result()
        body = {"term": TERM, "academic_session": SESSION}

        for class_id in (self.cls.id, "all"):
            res = self.client_for("teacher").post(
                "/api/exam-results/send_to_parents/", {**body, "student_class": class_id},
                format="json",
            )

            self.assertEqual(res.status_code, 403, class_id)
        self.assertFalse(ExamResult.objects.filter(released_at__isnull=False).exists())

    # ── Marks and grades are computed, never typed ───────────────────────

    def test_nobody_can_hand_edit_a_computed_grade(self):
        """The average, grade and position come from compute_results alone."""
        for role in WRITERS:
            result = self.a_result()
            client = self.client_for(role)

            res = client.patch(
                f"/api/exam-results/{result.id}/",
                {"average": 99, "total": 99, "grade": "A", "position": 1,
                 "teacher_comment": "Well done"},
                format="json",
            )

            self.assertEqual(res.status_code, 200, role)
            result.refresh_from_db()
            self.assertEqual(int(result.average), 70, role)
            self.assertEqual(result.grade, "C", role)
            self.assertEqual(result.position, 5, role)
            # The one field on that screen a teacher owns did land.
            self.assertEqual(result.teacher_comment, "Well done", role)

    def test_a_report_card_cannot_be_released_by_a_plain_patch(self):
        """Release runs the fee check; PATCH would walk straight past it."""
        result = self.a_result()

        res = self.client_for("teacher").patch(
            f"/api/exam-results/{result.id}/", {"released_at": timezone.now().isoformat()},
            format="json",
        )

        self.assertEqual(res.status_code, 200)
        result.refresh_from_db()
        self.assertIsNone(result.released_at)

    # ── The parent's window ──────────────────────────────────────────────

    def test_a_parent_sees_a_result_only_once_it_is_released(self):
        client = self.client_for("parent")

        self.a_result(released=False)
        self.assertEqual(client.get("/api/exam-results/").json()["count"], 0)

        self.a_result(released=True)
        self.assertEqual(client.get("/api/exam-results/").json()["count"], 1)

    def test_a_parent_sees_no_other_familys_child(self):
        other = Student.objects.create(
            reg_no="REG-2", first_name="Other", last_name="Pupil",
            date_of_birth=date(2010, 1, 1), gender="Male",
            student_class=self.cls, admission_date=date(2024, 1, 1),
        )
        ExamResult.objects.create(
            student=other, student_class=self.cls, term=TERM, academic_session=SESSION,
            total=90, average=90, released_at=timezone.now(),
        )
        self.a_result(released=True)

        rows = self.client_for("parent").get("/api/exam-results/").json()["results"]

        self.assertEqual({row["student"] for row in rows}, {self.student.id})
