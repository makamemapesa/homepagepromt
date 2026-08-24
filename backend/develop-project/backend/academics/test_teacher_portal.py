"""Tests for the teacher portal: what a signed-in teacher can see and change.

Every teacher-scoped screen resolves the signed-in user to an academics.Teacher
row by e-mail, so these tests cover both that lookup and the write paths that
depend on it.
"""
from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import SchoolSettings, UserProfile
from students.models import Student
from .models import (
    Attendance, Class, LessonPlan, StudentAttendance, Subject, Teacher,
    TeacherAssignment, Timetable,
)


class TeacherPortalTestCase(TestCase):
    """A teacher assigned to Form 1A only, plus a Form 1B they have nothing to do with."""

    # The Teacher row and the login differ in capitalisation — the two records are
    # created by different screens (Academics → Teachers vs User Management), and
    # role_sync deliberately matches them case-insensitively.
    TEACHER_ROW_EMAIL = "jhassan@school.edu"
    TEACHER_LOGIN_EMAIL = "JHassan@School.edu"

    def setUp(self):
        SchoolSettings.objects.create(academic_session="2026", current_term="Term 2")
        self.client = APIClient()

        self.maths = Subject.objects.create(name="Mathematics", code="MTH", department="Science")
        self.english = Subject.objects.create(name="English", code="ENG", department="Arts")
        self.mine = Class.objects.create(name="Form 1A", section="Secondary", level="Form 1", arm="A")
        self.theirs = Class.objects.create(name="Form 1B", section="Secondary", level="Form 1", arm="B")

        # Teacher record exists before the login is created, as it does when an
        # admin adds staff first and issues logins later.
        self.teacher = Teacher.objects.create(name="J Hassan", email=self.TEACHER_ROW_EMAIL)
        self.teacher_user = User.objects.create_user(
            username="jhassan", email=self.TEACHER_LOGIN_EMAIL, password="StrongPass123"
        )
        UserProfile.objects.update_or_create(user=self.teacher_user, defaults={"role": "teacher"})
        self.teacher_user.refresh_from_db()

        TeacherAssignment.objects.create(
            teacher=self.teacher, subject=self.maths, student_class=self.mine, status="active"
        )

        self.other_teacher = Teacher.objects.create(name="A Other", email="aother@school.edu")

        self.my_student = Student.objects.create(
            reg_no="MINE-1", first_name="Mine", last_name="Student",
            date_of_birth=date(2010, 1, 1), gender="Male",
            student_class=self.mine, admission_date=date(2024, 1, 1),
        )
        self.their_student = Student.objects.create(
            reg_no="THEIRS-1", first_name="Theirs", last_name="Student",
            date_of_birth=date(2010, 1, 1), gender="Female",
            student_class=self.theirs, admission_date=date(2024, 1, 1),
        )

        self.client.force_authenticate(user=self.teacher_user)

    def results(self, response):
        data = response.json()
        return data["results"] if isinstance(data, dict) and "results" in data else data


class TeacherIdentityTests(TeacherPortalTestCase):
    """A teacher must be recognised even when the two e-mails differ in case.

    role_sync links the Teacher row to the login with ``email__iexact``, so a
    capitalisation difference is a supported state — and it left every
    teacher-scoped screen resolving to "no teacher", i.e. blank.
    """

    def test_only_one_teacher_row_exists_for_the_login(self):
        self.assertEqual(Teacher.objects.filter(email__iexact=self.TEACHER_ROW_EMAIL).count(), 1)

    def test_teacher_sees_their_class(self):
        res = self.client.get("/api/classes/")

        names = [c["name"] for c in self.results(res)]
        self.assertEqual(names, ["Form 1A"])

    def test_teacher_sees_students_in_their_class(self):
        res = self.client.get("/api/students/")

        reg_nos = [s["reg_no"] for s in self.results(res)]
        self.assertEqual(reg_nos, ["MINE-1"])

    def test_teacher_dashboard_counts_their_own_class(self):
        res = self.client.get("/api/dashboard/stats/")

        self.assertEqual(res.json()["totalClasses"], 1)
        self.assertEqual(res.json()["totalStudents"], 1)

    def test_teacher_can_save_marks_for_their_class(self):
        payload = [{
            "student": self.my_student.id, "subject": self.maths.id,
            "student_class": self.mine.id, "term": "Term 2, 2026",
            "exam_type": "CA 1", "academic_session": "2026", "score": 70,
        }]

        res = self.client.post("/api/exam-marks/bulk_save/", {"marks": payload}, format="json")

        self.assertEqual(res.json()["saved"], 1)

    def test_teacher_sees_their_own_timetable_only(self):
        Timetable.objects.create(
            day="Monday", period=1, time="8:00 - 8:45",
            student_class=self.mine, subject=self.maths, teacher=self.teacher,
        )
        Timetable.objects.create(
            day="Monday", period=2, time="8:45 - 9:30",
            student_class=self.theirs, subject=self.english, teacher=self.other_teacher,
        )

        res = self.client.get("/api/timetable/")

        rows = self.results(res)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["period"], 1)

    def test_teacher_without_a_teacher_record_gets_an_empty_list_not_an_error(self):
        orphan = User.objects.create_user(
            username="ghost", email="ghost@nowhere.edu", password="StrongPass123"
        )
        UserProfile.objects.update_or_create(user=orphan, defaults={"role": "teacher"})
        orphan.refresh_from_db()
        Teacher.objects.filter(email__iexact="ghost@nowhere.edu").delete()
        self.client.force_authenticate(user=orphan)

        res = self.client.get("/api/classes/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.results(res), [])


class LessonPlanTests(TeacherPortalTestCase):

    def plan_payload(self, **overrides):
        payload = {
            "topic": "Fractions", "subject": self.maths.id, "student_class": self.mine.id,
            "week": "Week 3", "date": "2026-05-04", "status": "upcoming",
        }
        payload.update(overrides)
        return payload

    def test_a_plan_a_teacher_creates_is_attributed_to_them(self):
        """Otherwise it saves with no teacher and vanishes from their own list."""
        res = self.client.post("/api/lesson-plans/", self.plan_payload(), format="json")

        self.assertEqual(res.status_code, 201)
        self.assertEqual(LessonPlan.objects.get().teacher, self.teacher)

    def test_a_teacher_can_see_the_plan_they_just_created(self):
        self.client.post("/api/lesson-plans/", self.plan_payload(), format="json")

        res = self.client.get("/api/lesson-plans/")

        self.assertEqual(len(self.results(res)), 1)

    def test_a_teacher_cannot_file_a_plan_under_another_teacher(self):
        res = self.client.post(
            "/api/lesson-plans/", self.plan_payload(teacher=self.other_teacher.id), format="json"
        )

        self.assertEqual(res.status_code, 201)
        self.assertEqual(LessonPlan.objects.get().teacher, self.teacher)

    def test_a_teacher_cannot_reassign_their_plan_away(self):
        self.client.post("/api/lesson-plans/", self.plan_payload(), format="json")
        plan = LessonPlan.objects.get()

        self.client.patch(
            f"/api/lesson-plans/{plan.id}/", {"teacher": self.other_teacher.id}, format="json"
        )

        plan.refresh_from_db()
        self.assertEqual(plan.teacher, self.teacher)

    def test_an_admin_can_still_assign_a_plan_to_any_teacher(self):
        admin = User.objects.create_user(
            username="admin1", email="admin1@school.edu", password="StrongPass123"
        )
        UserProfile.objects.update_or_create(user=admin, defaults={"role": "super_admin"})
        admin.refresh_from_db()
        self.client.force_authenticate(user=admin)

        self.client.post(
            "/api/lesson-plans/", self.plan_payload(teacher=self.other_teacher.id), format="json"
        )

        self.assertEqual(LessonPlan.objects.get().teacher, self.other_teacher)


class StudentAttendanceTests(TeacherPortalTestCase):
    """Who may change a register, and who may only read it.

    The base fixture's teacher takes Mathematics in Form 1A without being its
    class teacher. Form 2A below is the class they actually hold, so every test
    here contrasts the two roles the same person occupies.
    """

    def setUp(self):
        super().setUp()
        self.homeroom = Class.objects.create(
            name="Form 2A", section="Secondary", level="Form 2", arm="A",
            class_teacher=self.teacher,
        )
        self.homeroom_student = Student.objects.create(
            reg_no="HOME-1", first_name="Homeroom", last_name="Student",
            date_of_birth=date(2010, 1, 1), gender="Male",
            student_class=self.homeroom, admission_date=date(2024, 1, 1),
        )

    def post_register(self, student, student_class, status="present"):
        return self.client.post("/api/student-attendance/", {
            "date": "2026-05-04", "student": student.id,
            "student_class": student_class.id, "status": status,
        }, format="json")

    # ── the class teacher ─────────────────────────────────────────────

    def test_class_teacher_can_record_attendance_for_their_own_class(self):
        res = self.post_register(self.homeroom_student, self.homeroom)

        self.assertEqual(res.status_code, 201)

    def test_class_teacher_can_correct_a_record(self):
        record = StudentAttendance.objects.create(
            date=date(2026, 5, 4), student=self.homeroom_student,
            student_class=self.homeroom, status="present",
        )

        res = self.client.patch(
            f"/api/student-attendance/{record.id}/",
            {"status": "late", "note": "Bus was delayed"}, format="json",
        )

        self.assertEqual(res.status_code, 200)
        record.refresh_from_db()
        self.assertEqual(record.status, "late")
        self.assertEqual(record.note, "Bus was delayed")

    def test_class_teacher_can_delete_a_record(self):
        record = StudentAttendance.objects.create(
            date=date(2026, 5, 4), student=self.homeroom_student,
            student_class=self.homeroom, status="absent",
        )

        res = self.client.delete(f"/api/student-attendance/{record.id}/")

        self.assertEqual(res.status_code, 204)
        self.assertFalse(StudentAttendance.objects.filter(id=record.id).exists())

    def test_class_teacher_cannot_move_a_record_into_a_class_they_only_teach(self):
        """Editing their own register must not become a way to write elsewhere."""
        record = StudentAttendance.objects.create(
            date=date(2026, 5, 4), student=self.homeroom_student,
            student_class=self.homeroom, status="present",
        )

        res = self.client.patch(
            f"/api/student-attendance/{record.id}/",
            {"student_class": self.mine.id}, format="json",
        )

        self.assertEqual(res.status_code, 403)
        record.refresh_from_db()
        self.assertEqual(record.student_class_id, self.homeroom.id)

    # ── the subject teacher ───────────────────────────────────────────

    def test_subject_teacher_cannot_record_attendance(self):
        res = self.post_register(self.my_student, self.mine)

        self.assertEqual(res.status_code, 403)
        self.assertEqual(StudentAttendance.objects.count(), 0)

    def test_subject_teacher_cannot_correct_a_record(self):
        record = StudentAttendance.objects.create(
            date=date(2026, 5, 4), student=self.my_student,
            student_class=self.mine, status="present",
        )

        res = self.client.patch(
            f"/api/student-attendance/{record.id}/", {"status": "absent"}, format="json"
        )

        self.assertEqual(res.status_code, 403)
        record.refresh_from_db()
        self.assertEqual(record.status, "present")

    def test_subject_teacher_cannot_delete_a_record(self):
        record = StudentAttendance.objects.create(
            date=date(2026, 5, 4), student=self.my_student,
            student_class=self.mine, status="present",
        )

        res = self.client.delete(f"/api/student-attendance/{record.id}/")

        self.assertEqual(res.status_code, 403)
        self.assertTrue(StudentAttendance.objects.filter(id=record.id).exists())

    def test_subject_teacher_can_still_read_the_register(self):
        """Losing the edit must not cost them the view."""
        StudentAttendance.objects.create(
            date=date(2026, 5, 4), student=self.my_student,
            student_class=self.mine, status="absent",
        )

        res = self.client.get(f"/api/student-attendance/?student_class={self.mine.id}")

        rows = self.results(res)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["status"], "absent")

    def test_subject_teacher_sees_their_class_in_the_summary(self):
        StudentAttendance.objects.create(
            date=date(2026, 5, 4), student=self.my_student,
            student_class=self.mine, status="present",
        )

        res = self.client.get("/api/student-attendance/summary/?date=2026-05-04")

        self.assertEqual([r["student_class"] for r in res.json()], [self.mine.id])

    def test_the_refusal_explains_which_role_is_missing(self):
        res = self.post_register(self.my_student, self.mine)

        self.assertIn("class teacher", res.json()["detail"])

    # ── classes nothing to do with them ───────────────────────────────

    def test_teacher_cannot_record_attendance_for_a_class_they_do_not_teach(self):
        """get_queryset hides other classes on read; writes must be closed too."""
        res = self.post_register(self.their_student, self.theirs, status="absent")

        self.assertEqual(res.status_code, 403)
        self.assertEqual(StudentAttendance.objects.count(), 0)

    def test_teacher_cannot_edit_attendance_for_another_class(self):
        record = StudentAttendance.objects.create(
            date=date(2026, 5, 4), student=self.their_student,
            student_class=self.theirs, status="present",
        )

        res = self.client.patch(
            f"/api/student-attendance/{record.id}/", {"status": "absent"}, format="json"
        )

        self.assertEqual(res.status_code, 404)
        record.refresh_from_db()
        self.assertEqual(record.status, "present")

    # ── administrators ────────────────────────────────────────────────

    def test_an_admin_records_attendance_for_any_class(self):
        admin = User.objects.create_user(
            username="admin_att", email="admin_att@example.com", password="StrongPass123"
        )
        UserProfile.objects.update_or_create(user=admin, defaults={"role": "admin"})
        admin.refresh_from_db()
        self.client.force_authenticate(user=admin)

        res = self.post_register(self.their_student, self.theirs)

        self.assertEqual(res.status_code, 201)

    # ── the summary is unaffected by the write rule ───────────────────

    def test_summary_counts_every_record_not_just_the_first_page(self):
        """Counted in the database, so a big school is not silently truncated."""
        extra = [
            Student.objects.create(
                reg_no="BULK-%d" % i, first_name="Bulk%d" % i, last_name="Student",
                date_of_birth=date(2010, 1, 1), gender="Male",
                student_class=self.mine, admission_date=date(2024, 1, 1),
            )
            for i in range(60)
        ]
        for index, student in enumerate(extra):
            StudentAttendance.objects.create(
                date=date(2026, 5, 4), student=student, student_class=self.mine,
                status="absent" if index % 3 == 0 else "present",
            )

        res = self.client.get("/api/student-attendance/summary/?date=2026-05-04")

        row = next(r for r in res.json() if r["student_class"] == self.mine.id)
        self.assertEqual(row["absent"], 20)
        self.assertEqual(row["present"], 40)

    def test_summary_only_covers_the_teachers_own_classes(self):
        StudentAttendance.objects.create(
            date=date(2026, 5, 4), student=self.their_student,
            student_class=self.theirs, status="present",
        )
        StudentAttendance.objects.create(
            date=date(2026, 5, 4), student=self.my_student,
            student_class=self.mine, status="present",
        )

        res = self.client.get("/api/student-attendance/summary/?date=2026-05-04")

        self.assertEqual([r["student_class"] for r in res.json()], [self.mine.id])


class ClassAttendanceAggregateTests(TeacherPortalTestCase):
    """The per-class daily totals follow the same rule as the per-student rows."""

    def setUp(self):
        super().setUp()
        self.homeroom = Class.objects.create(
            name="Form 2A", section="Secondary", level="Form 2", arm="A",
            class_teacher=self.teacher,
        )

    def test_class_teacher_can_record_the_class_total(self):
        res = self.client.post("/api/attendance/", {
            "date": "2026-05-04", "student_class": self.homeroom.id,
            "present": 30, "absent": 2, "late": 1,
        }, format="json")

        self.assertEqual(res.status_code, 201)

    def test_subject_teacher_cannot_record_the_class_total(self):
        res = self.client.post("/api/attendance/", {
            "date": "2026-05-04", "student_class": self.mine.id,
            "present": 30, "absent": 2, "late": 1,
        }, format="json")

        self.assertEqual(res.status_code, 403)
        self.assertEqual(Attendance.objects.count(), 0)

    def test_subject_teacher_can_still_read_the_class_total(self):
        Attendance.objects.create(
            date=date(2026, 5, 4), student_class=self.mine, present=30, absent=2, late=1
        )

        res = self.client.get(f"/api/attendance/?student_class={self.mine.id}")

        self.assertEqual(len(self.results(res)), 1)


class AttendancePermissionFlagTests(TeacherPortalTestCase):
    """/api/classes/ tells the screen which classes it may offer an editor for."""

    def setUp(self):
        super().setUp()
        self.homeroom = Class.objects.create(
            name="Form 2A", section="Secondary", level="Form 2", arm="A",
            class_teacher=self.teacher,
        )

    def flags(self, response):
        return {row["name"]: row["can_manage_attendance"] for row in self.results(response)}

    def test_the_flag_separates_the_two_roles_a_teacher_holds(self):
        res = self.client.get("/api/classes/")

        flags = self.flags(res)
        self.assertTrue(flags["Form 2A"])
        self.assertFalse(flags["Form 1A"])

    def test_an_admin_may_manage_every_class(self):
        admin = User.objects.create_user(
            username="admin_flag", email="admin_flag@example.com", password="StrongPass123"
        )
        UserProfile.objects.update_or_create(user=admin, defaults={"role": "admin"})
        admin.refresh_from_db()
        self.client.force_authenticate(user=admin)

        res = self.client.get("/api/classes/")

        self.assertTrue(all(self.flags(res).values()))

    def test_a_class_with_no_class_teacher_is_not_managed_by_a_subject_teacher(self):
        """class_teacher is nullable — an empty post must not read as a match."""
        self.assertIsNone(self.mine.class_teacher_id)

        res = self.client.get("/api/classes/")

        self.assertFalse(self.flags(res)["Form 1A"])
