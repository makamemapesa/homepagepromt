"""Roles created in one place must show up in the matching section of the other."""
import datetime

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from academics.models import Class, Teacher
from admissions.models import AdmissionWindow
from core.models import UserProfile
from students.models import ParentGuardian, Student


class RoleMappingTests(TestCase):
    def setUp(self):
        self.super_admin = User.objects.create_user(
            username="sa@example.com", email="sa@example.com", password="SuperPass123"
        )
        UserProfile.objects.filter(user=self.super_admin).update(role="super_admin")
        # Reload so the profile cached by the create signal reflects the new role.
        self.super_admin = User.objects.get(pk=self.super_admin.pk)
        self.client = APIClient()
        self.client.force_authenticate(user=self.super_admin)

    def _create_user(self, email, role, **extra):
        payload = {
            "first_name": extra.pop("first_name", "Test"),
            "last_name": extra.pop("last_name", "User"),
            "email": email,
            "password": "SomeStrongPass123",
            "role": role,
        }
        payload.update(extra)
        return self.client.post("/api/users/", payload, format="json")

    # ── User Management → section ────────────────────────────────────────

    def test_created_teacher_role_is_reported_back(self):
        response = self._create_user("asha@example.com", "teacher")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["role"], "teacher")

    def test_teacher_role_user_gets_a_teacher_record(self):
        self._create_user("asha@example.com", "teacher", first_name="Asha", last_name="Said")

        teacher = Teacher.objects.get(email="asha@example.com")
        self.assertEqual(teacher.name, "Asha Said")
        self.assertEqual(teacher.status, "active")

    def test_teacher_role_user_can_reach_the_teacher_panel(self):
        self._create_user("asha@example.com", "teacher", first_name="Asha", last_name="Said")
        teacher = Teacher.objects.get(email="asha@example.com")
        student_class = Class.objects.create(
            name="Form 1A", section="Secondary", level="Form 1", arm="A", class_teacher=teacher
        )
        Student.objects.create(
            reg_no="S1", first_name="Amina", last_name="Bakari", date_of_birth="2014-01-01",
            gender="Female", admission_date="2026-01-13", student_class=student_class,
        )

        client = APIClient()
        client.force_authenticate(user=User.objects.get(username="asha@example.com"))

        self.assertEqual(client.get("/api/classes/").data["count"], 1)
        self.assertEqual(client.get("/api/students/").data["count"], 1)
        self.assertEqual(client.get("/api/dashboard/stats/").data["totalClasses"], 1)

    def test_roles_without_a_domain_table_get_no_stray_records(self):
        for role in ("accountant", "admin", "staff"):
            self._create_user(f"{role}@example.com", role)

            profile = UserProfile.objects.get(user__username=f"{role}@example.com")
            self.assertEqual(profile.role, role)
            self.assertFalse(Teacher.objects.filter(email=f"{role}@example.com").exists())

    def test_parent_role_links_a_guardian_waiting_for_a_login(self):
        student = Student.objects.create(
            reg_no="S2", first_name="Kito", last_name="Juma", date_of_birth="2015-01-01",
            gender="Male", admission_date="2026-01-13",
        )
        ParentGuardian.objects.create(
            student=student, full_name="Fatma Juma", relationship="Mother",
            phone="+255700000000", email="fatma@example.com",
        )

        self._create_user("fatma@example.com", "parent")

        self.assertEqual(
            ParentGuardian.objects.get(email="fatma@example.com").user.username,
            "fatma@example.com",
        )

    # ── Section → User Management ────────────────────────────────────────

    def test_teacher_created_in_the_panel_gets_a_teacher_role_account(self):
        response = self.client.post(
            "/api/teachers/",
            {"name": "Juma Ali", "email": "juma@example.com", "department": "Sciences", "status": "active"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="juma@example.com")
        self.assertEqual(UserProfile.objects.get(user=user).role, "teacher")
        self.assertEqual(user.get_full_name(), "Juma Ali")

    def test_teacher_appears_in_user_management(self):
        self.client.post(
            "/api/teachers/", {"name": "Juma Ali", "email": "juma@example.com"}, format="json"
        )

        listed = [
            row for row in self.client.get("/api/users/").data["results"]
            if row["email"] == "juma@example.com"
        ]
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["role"], "teacher")

    def test_a_teacher_record_never_demotes_an_administrator(self):
        Teacher.objects.create(name="Head Teacher", email="sa@example.com")

        self.assertEqual(UserProfile.objects.get(user=self.super_admin).role, "super_admin")

    # ── Changes afterwards ───────────────────────────────────────────────

    def test_moving_off_the_teacher_role_retires_the_record(self):
        self._create_user("rehema@example.com", "teacher")
        user = User.objects.get(username="rehema@example.com")

        self.client.patch(f"/api/users/{user.id}/", {"role": "accountant"}, format="json")
        self.assertEqual(Teacher.objects.get(email="rehema@example.com").status, "inactive")

        self.client.patch(f"/api/users/{user.id}/", {"role": "teacher"}, format="json")
        self.assertEqual(Teacher.objects.get(email="rehema@example.com").status, "active")

    def test_changing_a_teachers_email_keeps_their_record_reachable(self):
        self._create_user("old@example.com", "teacher")
        user = User.objects.get(username="old@example.com")

        self.client.patch(f"/api/users/{user.id}/", {"email": "new@example.com"}, format="json")

        self.assertEqual(list(Teacher.objects.values_list("email", flat=True)), ["new@example.com"])

    # ── Public application ───────────────────────────────────────────────

    def test_public_application_creates_a_parent_role_account(self):
        today = datetime.date.today()
        window = AdmissionWindow.objects.create(
            academic_session="2026", open_date=today,
            close_date=today + datetime.timedelta(days=30),
        )

        response = APIClient().post(
            "/api/applicants/",
            {
                "window": window.id, "first_name": "Ali", "last_name": "Juma",
                "date_of_birth": "2015-01-01", "gender": "Male",
                "applying_for_class": "Std 1", "academic_session": "2026",
                "parent_name": "Fatma Juma", "parent_phone": "+255700000000",
                "parent_email": "newparent@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            UserProfile.objects.get(user__username="newparent@example.com").role, "parent"
        )
