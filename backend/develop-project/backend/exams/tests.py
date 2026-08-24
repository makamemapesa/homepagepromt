"""End-to-end tests for the examination panel: marks entry, results, ranking."""
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from academics.models import Class, Subject, Teacher, TeacherAssignment
from core.models import Notification, SchoolSettings, UserProfile
from fees.models import Payment
from students.models import ParentGuardian, Student
from .models import ExamMark, ExamResult, SubjectResult

TERM = "Term 2, 2026"
SESSION = "2026"


def make_admin(username="admin1", email="admin1@example.com"):
    user = User.objects.create_user(username=username, email=email, password="StrongPass123")
    UserProfile.objects.update_or_create(user=user, defaults={"role": "super_admin"})
    user.refresh_from_db()
    return user


class ExamPanelTestCase(TestCase):
    """Shared fixture: one class, two subjects, three students, an admin."""

    def setUp(self):
        SchoolSettings.objects.create(academic_session=SESSION, current_term="Term 2")
        self.client = APIClient()
        self.admin = make_admin()
        self.client.force_authenticate(user=self.admin)

        self.cls = Class.objects.create(name="Form 1A", section="Secondary", level="Form 1", arm="A")
        self.other_cls = Class.objects.create(name="Form 1B", section="Secondary", level="Form 1", arm="B")
        self.maths = Subject.objects.create(name="Mathematics", code="MTH", department="Science")
        self.english = Subject.objects.create(name="English", code="ENG", department="Arts")

        self.students = [
            Student.objects.create(
                reg_no="REG-%d" % i, first_name="Student%d" % i, last_name="Last%d" % i,
                date_of_birth=date(2010, 1, 1), gender="Male",
                student_class=self.cls, admission_date=date(2024, 1, 1),
            )
            for i in range(1, 4)
        ]

    def mark_payload(self, student, subject, exam_type, score):
        return {
            "student": student.id, "subject": subject.id, "student_class": self.cls.id,
            "term": TERM, "exam_type": exam_type, "academic_session": SESSION, "score": score,
        }

    def bulk_save(self, items):
        return self.client.post("/api/exam-marks/bulk_save/", {"marks": items}, format="json")

    def compute(self, **overrides):
        body = {
            "student_class": self.cls.id, "term": TERM, "academic_session": SESSION,
            "ca_types": [], "best_n": 0, "final_exam_type": "", "ca_weight": 0.30,
        }
        body.update(overrides)
        return self.client.post("/api/exam-results/compute_results/", body, format="json")


class MarksEntryTests(ExamPanelTestCase):

    def test_bulk_save_creates_marks(self):
        res = self.bulk_save([self.mark_payload(s, self.maths, "CA 1", 70) for s in self.students])

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["errors"], [])
        self.assertEqual(res.json()["saved"], 3)
        self.assertEqual(ExamMark.objects.count(), 3)

    def test_resaving_a_mark_updates_it_instead_of_failing(self):
        """Correcting an already-entered score must overwrite it, not be rejected."""
        self.bulk_save([self.mark_payload(self.students[0], self.maths, "CA 1", 55)])

        res = self.bulk_save([self.mark_payload(self.students[0], self.maths, "CA 1", 88)])

        self.assertEqual(res.json()["errors"], [])
        self.assertEqual(res.json()["saved"], 1)
        self.assertEqual(ExamMark.objects.count(), 1)
        self.assertEqual(ExamMark.objects.get().score, Decimal("88.00"))

    def test_decimal_scores_are_preserved(self):
        self.bulk_save([self.mark_payload(self.students[0], self.maths, "CA 1", 87.5)])

        self.assertEqual(ExamMark.objects.get().score, Decimal("87.50"))

    def test_score_outside_zero_to_hundred_is_rejected(self):
        res = self.bulk_save([
            self.mark_payload(self.students[0], self.maths, "CA 1", 150),
            self.mark_payload(self.students[1], self.maths, "CA 1", -5),
        ])

        self.assertEqual(len(res.json()["errors"]), 2)
        self.assertEqual(ExamMark.objects.count(), 0)

    def test_exam_type_and_term_whitespace_is_normalised(self):
        self.bulk_save([self.mark_payload(self.students[0], self.maths, " CA 1 ", 60)])

        self.assertEqual(ExamMark.objects.get().exam_type, "CA 1")

    def test_available_types_lists_each_type_once(self):
        self.bulk_save(
            [self.mark_payload(s, self.maths, "CA 1", 60) for s in self.students]
            + [self.mark_payload(s, self.english, "Final Exam", 70) for s in self.students]
        )

        res = self.client.get(
            "/api/exam-marks/available_types/?student_class=%d&term=%s&academic_session=%s"
            % (self.cls.id, TERM, SESSION)
        )

        self.assertEqual(res.json()["types"], ["CA 1", "Final Exam"])

    def test_marks_list_is_not_capped_at_the_default_page_size(self):
        """A full class times several assessments easily exceeds one page."""
        extra = [
            Student.objects.create(
                reg_no="BULK-%d" % i, first_name="Bulk%d" % i, last_name="Student",
                date_of_birth=date(2010, 1, 1), gender="Female",
                student_class=self.cls, admission_date=date(2024, 1, 1),
            )
            for i in range(60)
        ]
        self.bulk_save([self.mark_payload(s, self.maths, "CA 1", 50) for s in extra])

        res = self.client.get("/api/exam-marks/?student_class=%d&page_size=200" % self.cls.id)

        self.assertEqual(len(res.json()["results"]), 60)


class ComputeResultsTests(ExamPanelTestCase):

    def enter(self, scores):
        """scores: {student_index: {exam_type: score}} for Mathematics."""
        items = []
        for idx, by_type in scores.items():
            for exam_type, score in by_type.items():
                items.append(self.mark_payload(self.students[idx], self.maths, exam_type, score))
        self.bulk_save(items)

    def test_ca_and_final_are_weighted_correctly(self):
        self.enter({0: {"CA 1": 80, "Final Exam": 60}})

        self.compute(ca_types=["CA 1"], final_exam_type="Final Exam", ca_weight=0.30)

        sr = SubjectResult.objects.get()
        self.assertEqual(sr.ca_score, Decimal("24.00"))    # 80 * 0.30
        self.assertEqual(sr.exam_score, Decimal("42.00"))  # 60 * 0.70
        self.assertEqual(sr.total, Decimal("66.00"))

    def test_best_n_keeps_only_the_highest_ca_scores(self):
        self.enter({0: {"CA 1": 40, "CA 2": 90, "CA 3": 80}})

        self.compute(ca_types=["CA 1", "CA 2", "CA 3"], best_n=2)

        self.assertEqual(SubjectResult.objects.get().total, Decimal("85.00"))  # (90+80)/2

    def test_tied_students_share_a_position(self):
        self.enter({0: {"CA 1": 90}, 1: {"CA 1": 90}, 2: {"CA 1": 50}})

        self.compute(ca_types=["CA 1"])

        positions = sorted(ExamResult.objects.values_list("position", flat=True))
        self.assertEqual(positions, [1, 1, 3])

    def test_subject_positions_are_ranked_within_the_class(self):
        self.enter({0: {"CA 1": 90}, 1: {"CA 1": 70}, 2: {"CA 1": 50}})

        self.compute(ca_types=["CA 1"])

        by_student = {sr.exam_result.student_id: sr.position for sr in SubjectResult.objects.all()}
        self.assertEqual(by_student[self.students[0].id], 1)
        self.assertEqual(by_student[self.students[1].id], 2)
        self.assertEqual(by_student[self.students[2].id], 3)

    def test_recompute_drops_subjects_whose_marks_were_removed(self):
        self.bulk_save([
            self.mark_payload(self.students[0], self.maths, "CA 1", 80),
            self.mark_payload(self.students[0], self.english, "CA 1", 60),
        ])
        self.compute(ca_types=["CA 1"])
        self.assertEqual(SubjectResult.objects.count(), 2)

        ExamMark.objects.filter(subject=self.english).delete()
        self.compute(ca_types=["CA 1"])

        self.assertEqual(SubjectResult.objects.count(), 1)
        self.assertEqual(ExamResult.objects.get().average, Decimal("80.00"))

    def test_recompute_drops_results_for_students_with_no_marks_left(self):
        self.enter({0: {"CA 1": 80}, 1: {"CA 1": 60}})
        self.compute(ca_types=["CA 1"])
        self.assertEqual(ExamResult.objects.count(), 2)

        ExamMark.objects.filter(student=self.students[1]).delete()
        self.compute(ca_types=["CA 1"])

        self.assertEqual(ExamResult.objects.count(), 1)

    def test_recompute_leaves_other_classes_alone(self):
        other = Student.objects.create(
            reg_no="OTHER-1", first_name="Other", last_name="Student",
            date_of_birth=date(2010, 1, 1), gender="Male",
            student_class=self.other_cls, admission_date=date(2024, 1, 1),
        )
        ExamResult.objects.create(
            student=other, student_class=self.other_cls, term=TERM,
            academic_session=SESSION, average=Decimal("70.00"),
        )
        self.enter({0: {"CA 1": 80}})

        self.compute(ca_types=["CA 1"])

        self.assertTrue(ExamResult.objects.filter(student=other).exists())

    def test_computed_count_reflects_students_actually_scored(self):
        self.enter({0: {"CA 1": 80}, 1: {"CA 1": 60}})

        res = self.compute(ca_types=["CA 1"])

        self.assertEqual(res.json()["computed"], 2)

    def test_average_and_division_are_derived_from_subject_totals(self):
        self.bulk_save([
            self.mark_payload(self.students[0], self.maths, "CA 1", 80),
            self.mark_payload(self.students[0], self.english, "CA 1", 70),
        ])

        self.compute(ca_types=["CA 1"])

        result = ExamResult.objects.get()
        self.assertEqual(result.total, Decimal("150.00"))
        self.assertEqual(result.average, Decimal("75.00"))
        self.assertEqual(result.division, "I")
        self.assertEqual(result.grade, "A")
        self.assertEqual(result.status, "promoted")

    def test_missing_class_or_term_is_rejected(self):
        self.assertEqual(self.compute(student_class=None).status_code, 400)
        self.assertEqual(self.compute(term="").status_code, 400)

    def test_ca_weight_outside_zero_to_one_is_rejected(self):
        self.enter({0: {"CA 1": 80, "Final Exam": 60}})

        res = self.compute(ca_types=["CA 1"], final_exam_type="Final Exam", ca_weight=1.5)

        self.assertEqual(res.status_code, 400)

    def test_compute_without_marks_returns_404(self):
        self.assertEqual(self.compute(ca_types=["CA 1"]).status_code, 404)

    def test_final_exam_type_cannot_also_be_a_ca_type(self):
        self.enter({0: {"Final Exam": 60}})

        res = self.compute(ca_types=["Final Exam"], final_exam_type="Final Exam")

        self.assertEqual(res.status_code, 400)

    def test_subject_not_sat_under_this_scheme_is_left_out_of_the_average(self):
        """A subject with no marks of the selected types must not score zero."""
        self.bulk_save([
            self.mark_payload(self.students[0], self.maths, "CA 1", 80),
            self.mark_payload(self.students[0], self.english, "Practical", 90),
        ])

        self.compute(ca_types=["CA 1"])

        self.assertEqual(SubjectResult.objects.count(), 1)
        self.assertEqual(ExamResult.objects.get().average, Decimal("80.00"))

    def test_a_missed_ca_does_not_count_as_a_zero(self):
        """Averaging is over the CAs actually sat, not over every selected type."""
        self.enter({0: {"CA 1": 80}})

        self.compute(ca_types=["CA 1", "CA 2", "CA 3"], best_n=0)

        self.assertEqual(SubjectResult.objects.get().total, Decimal("80.00"))

    def test_full_ca_weight_ignores_the_final_exam(self):
        self.enter({0: {"CA 1": 80, "Final Exam": 20}})

        self.compute(ca_types=["CA 1"], final_exam_type="Final Exam", ca_weight=1.0)

        self.assertEqual(SubjectResult.objects.get().total, Decimal("80.00"))

    def test_negative_best_n_is_rejected(self):
        self.enter({0: {"CA 1": 80}})

        self.assertEqual(self.compute(ca_types=["CA 1"], best_n=-1).status_code, 400)

    def test_recompute_does_not_duplicate_rows(self):
        self.enter({0: {"CA 1": 80}, 1: {"CA 1": 60}})

        self.compute(ca_types=["CA 1"])
        self.compute(ca_types=["CA 1"])

        self.assertEqual(ExamResult.objects.count(), 2)
        self.assertEqual(SubjectResult.objects.count(), 2)


class RoleAccessTests(ExamPanelTestCase):

    def setUp(self):
        super().setUp()
        self.teacher_user = User.objects.create_user(
            username="teach1", email="teach1@example.com", password="StrongPass123"
        )
        UserProfile.objects.update_or_create(user=self.teacher_user, defaults={"role": "teacher"})
        self.teacher_user.refresh_from_db()
        # A Teacher row is created by the role-sync signal when the profile flips
        # to "teacher", so this has to adopt that row rather than insert a second.
        self.teacher, _ = Teacher.objects.get_or_create(
            email="teach1@example.com", defaults={"name": "Teacher One"}
        )
        TeacherAssignment.objects.create(
            teacher=self.teacher, subject=self.maths, student_class=self.cls, status="active"
        )

    def test_teacher_can_save_marks_for_an_assigned_class(self):
        self.client.force_authenticate(user=self.teacher_user)

        res = self.bulk_save([self.mark_payload(self.students[0], self.maths, "CA 1", 70)])

        self.assertEqual(res.json()["saved"], 1)

    def test_teacher_cannot_save_marks_for_another_class(self):
        self.client.force_authenticate(user=self.teacher_user)
        payload = self.mark_payload(self.students[0], self.maths, "CA 1", 70)
        payload["student_class"] = self.other_cls.id

        res = self.bulk_save([payload])

        self.assertEqual(res.json()["saved"], 0)
        self.assertEqual(ExamMark.objects.count(), 0)

    def test_teacher_cannot_compute_results_for_another_class(self):
        self.client.force_authenticate(user=self.teacher_user)

        res = self.compute(student_class=self.other_cls.id, ca_types=["CA 1"])

        self.assertEqual(res.status_code, 403)


class SendReportsToParentsTests(ExamPanelTestCase):
    """Releasing report cards: who receives one, who is held back, and why."""

    def setUp(self):
        super().setUp()
        self.bulk_save([
            self.mark_payload(student, self.maths, "Final Exam", 60 + index * 10)
            for index, student in enumerate(self.students)
        ])
        self.compute(final_exam_type="Final Exam")

        self.parent_users = {}
        for index, student in enumerate(self.students):
            self.parent_users[student.id] = self.link_guardian(
                student, "parent%d@example.com" % index
            )

    def link_guardian(self, student, email, relationship="Mother"):
        """Give ``student`` a guardian with a working portal login."""
        user = User.objects.create_user(
            username=email.split("@")[0], email=email, password="StrongPass123"
        )
        UserProfile.objects.update_or_create(user=user, defaults={"role": "parent"})
        user.refresh_from_db()
        ParentGuardian.objects.create(
            student=student, user=user, full_name="Guardian of %s" % student.first_name,
            relationship=relationship, phone="0700000000", email=email,
        )
        return user

    def pay(self, student, amount=100000, payment_status="confirmed", term=TERM):
        return Payment.objects.create(
            student=student, amount=amount, date=date(2026, 3, 1),
            method="Cash", status=payment_status, term=term,
        )

    def send(self, **overrides):
        body = {"student_class": self.cls.id, "term": TERM, "academic_session": SESSION}
        body.update(overrides)
        return self.client.post("/api/exam-results/send_to_parents/", body, format="json")

    def reasons_by_student(self, response):
        return {row["student"]: row["reason"] for row in response.json()["skipped"]}

    # ── the fee gate ──────────────────────────────────────────────────

    def test_report_is_sent_when_the_term_fee_is_confirmed(self):
        for student in self.students:
            self.pay(student)

        res = self.send()

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["sent"], 3)
        self.assertEqual(res.json()["skipped"], [])
        self.assertEqual(ExamResult.objects.filter(released_at__isnull=True).count(), 0)

    def test_student_with_no_payment_recorded_is_held_back(self):
        self.pay(self.students[0])

        res = self.send()

        self.assertEqual(res.json()["sent"], 1)
        reasons = self.reasons_by_student(res)
        self.assertEqual(set(reasons), {self.students[1].id, self.students[2].id})
        self.assertIn("No confirmed fee payment", reasons[self.students[1].id])
        self.assertIsNone(ExamResult.objects.get(student=self.students[1]).released_at)

    def test_a_payment_still_awaiting_confirmation_holds_the_report_back(self):
        self.pay(self.students[0])
        self.pay(self.students[0], amount=25000, payment_status="pending")

        res = self.send()

        self.assertEqual(res.json()["sent"], 0)
        self.assertIn("awaiting confirmation", self.reasons_by_student(res)[self.students[0].id])

    def test_a_failed_payment_is_neither_credit_nor_a_blocker(self):
        self.pay(self.students[0])
        self.pay(self.students[0], amount=25000, payment_status="failed")

        res = self.send()

        self.assertEqual(res.json()["sent"], 1)

    def test_a_payment_for_another_term_does_not_clear_the_student(self):
        self.pay(self.students[0], term="Term 1, 2026")

        res = self.send()

        self.assertEqual(res.json()["sent"], 0)
        self.assertIn("No confirmed fee payment", self.reasons_by_student(res)[self.students[0].id])

    # ── who actually gets the notification ────────────────────────────

    def test_every_linked_guardian_is_notified(self):
        self.link_guardian(self.students[0], "father0@example.com", relationship="Father")
        self.pay(self.students[0])

        res = self.send()

        self.assertEqual(res.json()["sent"], 1)
        self.assertEqual(res.json()["notified"], 2)
        self.assertEqual(Notification.objects.count(), 2)

    def test_notification_names_the_student_and_the_term(self):
        self.pay(self.students[0])

        self.send()

        note = Notification.objects.get(recipient=self.parent_users[self.students[0].id])
        self.assertIn(TERM, note.title)
        self.assertIn(self.students[0].full_name, note.message)

    def test_student_with_no_portal_login_is_held_back(self):
        ParentGuardian.objects.filter(student=self.students[0]).update(user=None)
        self.pay(self.students[0])

        res = self.send()

        self.assertEqual(res.json()["sent"], 0)
        self.assertIn("No parent portal account", self.reasons_by_student(res)[self.students[0].id])

    def test_result_with_no_subject_breakdown_is_held_back(self):
        extra = Student.objects.create(
            reg_no="REG-99", first_name="Uncomputed", last_name="Student",
            date_of_birth=date(2010, 1, 1), gender="Female",
            student_class=self.cls, admission_date=date(2024, 1, 1),
        )
        self.link_guardian(extra, "parent99@example.com")
        self.pay(extra)
        ExamResult.objects.create(
            student=extra, student_class=self.cls, term=TERM, academic_session=SESSION,
        )

        res = self.send()

        self.assertIn("No computed result yet", self.reasons_by_student(res)[extra.id])

    # ── sending twice ─────────────────────────────────────────────────

    def test_a_report_is_not_sent_twice_by_default(self):
        self.pay(self.students[0])
        self.send()

        res = self.send()

        self.assertEqual(res.json()["sent"], 0)
        self.assertIn("Already sent", self.reasons_by_student(res)[self.students[0].id])
        self.assertEqual(Notification.objects.count(), 1)

    def test_resend_sends_a_corrected_report_again(self):
        self.pay(self.students[0])
        self.send()

        res = self.send(resend=True)

        self.assertEqual(res.json()["sent"], 1)
        self.assertEqual(Notification.objects.count(), 2)

    def test_student_ids_narrows_the_send_to_one_family(self):
        for student in self.students:
            self.pay(student)

        res = self.send(student_ids=[self.students[0].id])

        self.assertEqual(res.json()["sent"], 1)
        self.assertEqual(res.json()["skipped"], [])
        self.assertIsNotNone(ExamResult.objects.get(student=self.students[0]).released_at)
        self.assertIsNone(ExamResult.objects.get(student=self.students[1]).released_at)

    # ── what a parent can see ─────────────────────────────────────────

    def test_parent_cannot_read_a_report_that_was_never_released(self):
        self.client.force_authenticate(user=self.parent_users[self.students[0].id])

        res = self.client.get("/api/exam-results/")

        self.assertEqual(res.json()["count"], 0)

    def test_parent_reads_the_report_once_it_is_released(self):
        self.pay(self.students[0])
        self.send()
        self.client.force_authenticate(user=self.parent_users[self.students[0].id])

        res = self.client.get("/api/exam-results/")

        self.assertEqual(res.json()["count"], 1)
        self.assertEqual(res.json()["results"][0]["student"], self.students[0].id)

    def test_parent_dashboard_hides_an_unreleased_report(self):
        self.client.force_authenticate(user=self.parent_users[self.students[0].id])

        res = self.client.get("/api/parent/dashboard/")

        self.assertEqual(res.json()["children"][0]["results"], [])

    def test_parent_dashboard_shows_a_released_report(self):
        self.pay(self.students[0])
        self.send()
        self.client.force_authenticate(user=self.parent_users[self.students[0].id])

        res = self.client.get("/api/parent/dashboard/")

        self.assertEqual(len(res.json()["children"][0]["results"]), 1)

    def test_release_cannot_be_forced_through_a_plain_patch(self):
        """The fee check lives in send_to_parents; a PATCH must not bypass it."""
        result = ExamResult.objects.get(student=self.students[0])

        res = self.client.patch(
            "/api/exam-results/%d/" % result.id,
            {"released_at": "2026-03-01T00:00:00Z"},
            format="json",
        )

        self.assertEqual(res.status_code, 200)
        result.refresh_from_db()
        self.assertIsNone(result.released_at)

    # ── scope and validation ──────────────────────────────────────────

    def test_missing_class_or_term_is_rejected(self):
        self.assertEqual(self.send(term="").status_code, 400)
        self.assertEqual(self.send(student_class="").status_code, 400)

    def test_sending_before_results_are_computed_returns_404(self):
        ExamResult.objects.all().delete()

        res = self.send()

        self.assertEqual(res.status_code, 404)

    def test_teacher_cannot_send_report_cards_for_another_class(self):
        teacher_user = User.objects.create_user(
            username="teach9", email="teach9@example.com", password="StrongPass123"
        )
        UserProfile.objects.update_or_create(user=teacher_user, defaults={"role": "teacher"})
        teacher_user.refresh_from_db()
        teacher, _ = Teacher.objects.get_or_create(
            email="teach9@example.com", defaults={"name": "Teacher Nine"}
        )
        TeacherAssignment.objects.create(
            teacher=teacher, subject=self.maths, student_class=self.other_cls, status="active"
        )
        self.client.force_authenticate(user=teacher_user)

        res = self.send(student_class=self.cls.id)

        self.assertEqual(res.status_code, 403)

    def test_all_classes_covers_only_the_classes_the_teacher_owns(self):
        """A teacher choosing "all" must not release another year group."""
        teacher_user = User.objects.create_user(
            username="teach8", email="teach8@example.com", password="StrongPass123"
        )
        UserProfile.objects.update_or_create(user=teacher_user, defaults={"role": "teacher"})
        teacher_user.refresh_from_db()
        teacher, _ = Teacher.objects.get_or_create(
            email="teach8@example.com", defaults={"name": "Teacher Eight"}
        )
        TeacherAssignment.objects.create(
            teacher=teacher, subject=self.maths, student_class=self.other_cls, status="active"
        )
        for student in self.students:
            self.pay(student)
        self.client.force_authenticate(user=teacher_user)

        res = self.send(student_class="all")

        self.assertEqual(res.status_code, 404)
        self.assertEqual(ExamResult.objects.filter(released_at__isnull=False).count(), 0)

    def test_admin_can_send_across_all_classes_at_once(self):
        other_student = Student.objects.create(
            reg_no="REG-B1", first_name="Other", last_name="Class",
            date_of_birth=date(2010, 1, 1), gender="Male",
            student_class=self.other_cls, admission_date=date(2024, 1, 1),
        )
        self.link_guardian(other_student, "parentb1@example.com")
        self.bulk_save([{
            "student": other_student.id, "subject": self.maths.id,
            "student_class": self.other_cls.id, "term": TERM,
            "exam_type": "Final Exam", "academic_session": SESSION, "score": 75,
        }])
        self.compute(student_class=self.other_cls.id, final_exam_type="Final Exam")
        for student in self.students + [other_student]:
            self.pay(student)

        res = self.send(student_class="all")

        self.assertEqual(res.json()["sent"], 4)

    def test_a_parent_cannot_release_report_cards(self):
        self.pay(self.students[0])
        self.client.force_authenticate(user=self.parent_users[self.students[0].id])

        res = self.send()

        self.assertEqual(res.status_code, 403)
        self.assertEqual(ExamResult.objects.filter(released_at__isnull=False).count(), 0)

    def test_parent_cannot_read_raw_marks_before_the_report_is_released(self):
        """The scores add up to the report card, so they follow the same gate."""
        self.client.force_authenticate(user=self.parent_users[self.students[0].id])

        res = self.client.get("/api/exam-marks/")

        self.assertEqual(res.json()["count"], 0)

    def test_parent_reads_raw_marks_once_the_report_is_released(self):
        self.pay(self.students[0])
        self.send()
        self.client.force_authenticate(user=self.parent_users[self.students[0].id])

        res = self.client.get("/api/exam-marks/")

        self.assertEqual(res.json()["count"], 1)
        self.assertEqual(res.json()["results"][0]["student"], self.students[0].id)

    def test_releasing_one_term_does_not_expose_another(self):
        ExamMark.objects.create(
            student=self.students[0], subject=self.maths, student_class=self.cls,
            term="Term 1, 2026", exam_type="Final Exam", academic_session=SESSION, score=55,
        )
        self.pay(self.students[0])
        self.send()
        self.client.force_authenticate(user=self.parent_users[self.students[0].id])

        res = self.client.get("/api/exam-marks/")

        terms = {row["term"] for row in res.json()["results"]}
        self.assertEqual(terms, {TERM})
