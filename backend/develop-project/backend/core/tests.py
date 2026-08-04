from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import HomePageContent, UserProfile


class HomePageContentAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="superadmin", email="super@example.com", password="StrongPass123")
        # Signals may auto-create a profile on User creation; use get_or_create to avoid UNIQUE errors in tests
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user, defaults={"role": "super_admin"})

    def test_public_can_read_default_homepage_content(self):
        response = self.client.get("/api/homepage-content/")

        self.assertEqual(response.status_code, 200)
        # DRF serializer returns snake_case keys in tests
        self.assertEqual(response.json()["hero_title"], "AL NAMAA ACADEMY")

    def test_super_admin_can_update_homepage_content(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            "hero_title": "New Hero Title",
            "about_title": "New About Title",
            "mission_description": "New mission text",
        }

        response = self.client.patch("/api/homepage-content/", payload, format="json")

        self.assertEqual(response.status_code, 200)
        content = HomePageContent.objects.get()
        self.assertEqual(content.hero_title, "New Hero Title")
        self.assertEqual(content.about_title, "New About Title")
        self.assertEqual(content.mission_description, "New mission text")
