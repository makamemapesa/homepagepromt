"""A student may have several guardians, and each can hold their own portal login."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from academics.models import Class
from core.models import UserProfile
from fees.models import Payment
from students.models import ParentGuardian, Student


class GuardianPortalAccessTests(TestCase):
    def setUp(self):
        admin = User.objects.create_user(
            username="sa@example.com", email="sa@example.com", password="SuperPass123"
        )
        UserProfile.objects.update_or_create(user=admin, defaults={"role": "super_admin"})
        self.admin = User.objects.get(pk=admin.pk)
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        self.student_class = Class.objects.create(
            name="Form 1A", section="Secondary", level="Form 1", arm="A"
        )
        self.student = Student.objects.create(
            reg_no="AN-100", first_name="Amina", last_name="Said",
            date_of_birth="2014-03-02", gender="Female",
            admission_date="2026-01-13", student_class=self.student_class,
        )

    def _portal_user(self, email, name="Guardian"):
        user = User.objects.create_user(username=email, email=email, password="SomePass12345")
        UserProfile.objects.update_or_create(user=user, defaults={"role": "parent"})
        return User.objects.get(pk=user.pk)

    def _as(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    # ── The model allows more than one ───────────────────────────────────

    def test_a_student_can_have_a_mother_and_a_father(self):
        ParentGuardian.objects.create(
            student=self.student, full_name="Fatma Said", relationship="Mother",
            phone="+255700000001", is_primary=True,
        )
        ParentGuardian.objects.create(
            student=self.student, full_name="Said Juma", relationship="Father",
            phone="+255700000002",
        )

        self.assertEqual(self.student.guardians.count(), 2)
        # Ordering puts the main contact first.
        self.assertEqual(self.student.parent.relationship, "Mother")

    # ── Portal access ────────────────────────────────────────────────────

    def test_the_father_reaches_the_parent_portal(self):
        mother_user = self._portal_user("fatma@example.com")
        father_user = self._portal_user("said@example.com")
        ParentGuardian.objects.create(
            student=self.student, user=mother_user, full_name="Fatma Said",
            relationship="Mother", phone="+255700000001", is_primary=True,
        )
        ParentGuardian.objects.create(
            student=self.student, user=father_user, full_name="Said Juma",
            relationship="Father", phone="+255700000002",
        )

        response = self._as(father_user).get("/api/parent/dashboard/")

        self.assertEqual(response.status_code, 200)
        children = response.data["children"]
        self.assertEqual(len(children), 1)
        self.assertEqual(children[0]["student"]["reg_no"], "AN-100")

    def test_an_uncle_or_brother_works_the_same_way(self):
        for relationship, email in (("Uncle", "uncle@example.com"), ("Brother", "brother@example.com")):
            user = self._portal_user(email)
            ParentGuardian.objects.create(
                student=self.student, user=user, full_name=f"The {relationship}",
                relationship=relationship, phone=f"+2557000{len(relationship)}",
            )

            response = self._as(user).get("/api/parent/dashboard/")

            self.assertEqual(response.status_code, 200, relationship)
            self.assertEqual(len(response.data["children"]), 1, relationship)

    def test_every_guardian_sees_the_same_records(self):
        Payment.objects.create(
            student=self.student, amount=50000, date="2026-02-01",
            method="Cash", status="confirmed", term="Term 1, 2026",
        )
        father_user = self._portal_user("said@example.com")
        ParentGuardian.objects.create(
            student=self.student, user=father_user, full_name="Said Juma",
            relationship="Father", phone="+255700000002",
        )
        client = self._as(father_user)

        self.assertEqual(client.get("/api/students/").data["count"], 1)
        self.assertEqual(client.get("/api/fees/payments/").data["count"], 1)
        self.assertEqual(client.get("/api/parent/attendance/").status_code, 200)
        self.assertEqual(client.get("/api/parent/timetable/").status_code, 200)
        self.assertEqual(client.get("/api/dashboard/stats/").data["totalStudents"], 1)

    def test_a_guardian_of_another_student_sees_nothing_of_this_one(self):
        other = Student.objects.create(
            reg_no="AN-200", first_name="Other", last_name="Child",
            date_of_birth="2014-03-02", gender="Male", admission_date="2026-01-13",
        )
        outsider = self._portal_user("outsider@example.com")
        ParentGuardian.objects.create(
            student=other, user=outsider, full_name="Outsider",
            relationship="Father", phone="+255700000009",
        )

        response = self._as(outsider).get("/api/students/")

        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["reg_no"], "AN-200")

    def test_one_guardian_of_two_children_sees_both_once_each(self):
        second = Student.objects.create(
            reg_no="AN-101", first_name="Juma", last_name="Said",
            date_of_birth="2016-05-02", gender="Male", admission_date="2026-01-13",
        )
        father_user = self._portal_user("said@example.com")
        for student in (self.student, second):
            ParentGuardian.objects.create(
                student=student, user=father_user, full_name="Said Juma",
                relationship="Father", phone="+255700000002",
            )

        response = self._as(father_user).get("/api/parent/dashboard/")

        self.assertEqual(len(response.data["children"]), 2)
        self.assertEqual(self._as(father_user).get("/api/students/").data["count"], 2)

    # ── Registering guardians through the API ────────────────────────────

    def test_registration_accepts_several_guardians(self):
        response = self.client.post("/api/students/", {
            "reg_no": "AN-300", "first_name": "Zawadi", "last_name": "Mohamed",
            "date_of_birth": "2014-03-02", "gender": "Female",
            "admission_date": "2026-01-13", "student_class": self.student_class.id,
            "parent": {"full_name": "Fatma Said", "relationship": "Mother", "phone": "+255700000001"},
            "guardians": [
                {"full_name": "Said Juma", "relationship": "Father", "phone": "+255700000002"},
                {"full_name": "Hamisi Said", "relationship": "Uncle", "phone": "+255700000003"},
            ],
        }, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        student = Student.objects.get(reg_no="AN-300")
        self.assertEqual(student.guardians.count(), 3)
        self.assertEqual(student.parent.relationship, "Mother")
        self.assertTrue(student.parent.is_primary)
        self.assertEqual(student.guardians.filter(is_primary=True).count(), 1)

    def test_the_detail_endpoint_lists_every_guardian(self):
        ParentGuardian.objects.create(
            student=self.student, full_name="Fatma Said", relationship="Mother",
            phone="+255700000001", is_primary=True,
        )
        ParentGuardian.objects.create(
            student=self.student, user=self._portal_user("said@example.com"),
            full_name="Said Juma", relationship="Father", phone="+255700000002",
        )

        data = self.client.get(f"/api/students/{self.student.id}/").data

        self.assertEqual(len(data["guardians"]), 2)
        self.assertEqual(data["parent"]["relationship"], "Mother")
        self.assertFalse(data["guardians"][0]["has_portal_access"])
        self.assertTrue(data["guardians"][1]["has_portal_access"])

    def test_editing_guardians_keeps_an_existing_portal_login(self):
        father_user = self._portal_user("said@example.com")
        mother = ParentGuardian.objects.create(
            student=self.student, full_name="Fatma Said", relationship="Mother",
            phone="+255700000001", is_primary=True,
        )
        father = ParentGuardian.objects.create(
            student=self.student, user=father_user, full_name="Said Juma",
            relationship="Father", phone="+255700000002",
        )

        response = self.client.patch(f"/api/students/{self.student.id}/", {
            "guardians": [
                {"id": mother.id, "full_name": "Fatma Said", "relationship": "Mother",
                 "phone": "+255700000001", "is_primary": True},
                {"id": father.id, "full_name": "Said Juma Ali", "relationship": "Father",
                 "phone": "+255700000002"},
            ],
        }, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        father.refresh_from_db()
        self.assertEqual(father.full_name, "Said Juma Ali")
        self.assertEqual(father.user, father_user, "the portal login must survive an edit")

    def test_a_guardian_removed_from_the_list_is_deleted(self):
        mother = ParentGuardian.objects.create(
            student=self.student, full_name="Fatma Said", relationship="Mother",
            phone="+255700000001", is_primary=True,
        )
        ParentGuardian.objects.create(
            student=self.student, full_name="Temp Guardian", relationship="Uncle",
            phone="+255700000003",
        )

        self.client.patch(f"/api/students/{self.student.id}/", {
            "guardians": [
                {"id": mother.id, "full_name": "Fatma Said", "relationship": "Mother",
                 "phone": "+255700000001", "is_primary": True},
            ],
        }, format="json")

        self.assertEqual(self.student.guardians.count(), 1)
        self.assertEqual(self.student.guardians.first().full_name, "Fatma Said")

    def test_a_legacy_single_parent_payload_still_edits_the_main_contact(self):
        mother = ParentGuardian.objects.create(
            student=self.student, full_name="Fatma Said", relationship="Mother",
            phone="+255700000001", is_primary=True,
        )
        father = ParentGuardian.objects.create(
            student=self.student, full_name="Said Juma", relationship="Father",
            phone="+255700000002",
        )

        response = self.client.patch(f"/api/students/{self.student.id}/", {
            "parent": {"full_name": "Fatma Said Ali", "relationship": "Mother",
                       "phone": "+255700000001"},
        }, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        mother.refresh_from_db()
        father.refresh_from_db()
        self.assertEqual(mother.full_name, "Fatma Said Ali")
        self.assertEqual(father.full_name, "Said Juma", "other guardians must be left alone")
        self.assertEqual(self.student.guardians.count(), 2)

    # ── Giving a guardian their login ────────────────────────────────────

    def test_a_guardian_without_a_login_is_listed_as_pending(self):
        ParentGuardian.objects.create(
            student=self.student, full_name="Said Juma", relationship="Father",
            phone="+255700000002", email="said@example.com",
        )

        pending = self.client.get("/api/parents/pending/").data

        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["full_name"], "Said Juma")
        self.assertEqual(pending[0]["relationship"], "Father")

    def test_creating_the_account_grants_that_guardian_the_portal(self):
        father = ParentGuardian.objects.create(
            student=self.student, full_name="Said Juma", relationship="Father",
            phone="+255700000002", email="said@example.com",
        )

        response = self.client.post("/api/users/", {
            "first_name": "Said", "last_name": "Juma", "email": "said@example.com",
            "password": "FatherPass123", "role": "parent",
            "parent_guardian_id": father.id,
        }, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        father.refresh_from_db()
        self.assertIsNotNone(father.user)

        portal = self._as(User.objects.get(username="said@example.com"))
        self.assertEqual(len(portal.get("/api/parent/dashboard/").data["children"]), 1)


class GuardianImportTests(TestCase):
    """The bulk import can bring in a second guardian too."""

    def setUp(self):
        admin = User.objects.create_user(
            username="sa@example.com", email="sa@example.com", password="SuperPass123"
        )
        UserProfile.objects.update_or_create(user=admin, defaults={"role": "super_admin"})
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.get(pk=admin.pk))

    def _upload(self, csv_text):
        from django.core.files.uploadedfile import SimpleUploadedFile

        return self.client.post(
            "/api/students/import-students/",
            {"file": SimpleUploadedFile("s.csv", csv_text.encode("utf-8"), content_type="text/csv")},
            format="multipart",
        )

    def test_two_guardians_import_from_one_row(self):
        response = self._upload(
            "reg_no,first_name,last_name,date_of_birth,gender,admission_date,"
            "parent_name,parent_phone,relationship,"
            "guardian2_name,guardian2_phone,guardian2_relationship,guardian2_email\n"
            "AN-400,Amina,Said,2014-03-02,Female,2026-01-13,"
            "Fatma Said,+255700000001,Mother,"
            "Said Juma,+255700000002,Father,said@example.com\n"
        )

        self.assertEqual(response.status_code, 201, response.data)
        student = Student.objects.get(reg_no="AN-400")
        self.assertEqual(student.guardians.count(), 2)
        self.assertEqual(student.parent.relationship, "Mother")
        father = student.guardians.get(relationship="Father")
        self.assertEqual(father.email, "said@example.com")
        self.assertFalse(father.is_primary)

    def test_a_half_filled_second_guardian_is_reported(self):
        response = self._upload(
            "reg_no,first_name,last_name,date_of_birth,gender,admission_date,"
            "parent_name,parent_phone,relationship,guardian2_name\n"
            "AN-401,Amina,Said,2014-03-02,Female,2026-01-13,"
            "Fatma Said,+255700000001,Mother,Said Juma\n"
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("guardian2_phone", str(response.data))


class PendingGuardianRemovalTests(TestCase):
    """Removing one guardian must never take the student and co-guardian with it."""

    def setUp(self):
        admin = User.objects.create_user(
            username="sa@example.com", email="sa@example.com", password="SuperPass123"
        )
        UserProfile.objects.update_or_create(user=admin, defaults={"role": "super_admin"})
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.get(pk=admin.pk))
        self.student = Student.objects.create(
            reg_no="AN-500", first_name="Amina", last_name="Said",
            date_of_birth="2014-03-02", gender="Female", admission_date="2026-01-13",
        )

    def test_removing_one_of_several_guardians_keeps_the_student(self):
        mother = ParentGuardian.objects.create(
            student=self.student, full_name="Fatma Said", relationship="Mother",
            phone="+255700000001", is_primary=True,
        )
        father = ParentGuardian.objects.create(
            student=self.student, full_name="Said Juma", relationship="Father",
            phone="+255700000002",
        )

        response = self.client.delete(f"/api/parents/pending/{father.id}/")

        self.assertIn(response.status_code, (200, 204))
        self.assertTrue(Student.objects.filter(pk=self.student.pk).exists())
        self.assertTrue(ParentGuardian.objects.filter(pk=mother.pk).exists())
        self.assertFalse(ParentGuardian.objects.filter(pk=father.pk).exists())

    def test_removing_the_only_guardian_still_removes_the_student(self):
        only = ParentGuardian.objects.create(
            student=self.student, full_name="Fatma Said", relationship="Mother",
            phone="+255700000001", is_primary=True,
        )

        response = self.client.delete(f"/api/parents/pending/{only.id}/")

        self.assertIn(response.status_code, (200, 204))
        self.assertFalse(Student.objects.filter(pk=self.student.pk).exists())
