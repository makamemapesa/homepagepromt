from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .models import HomePageContent, UserProfile


class HomePageContentAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="superadmin", email="super@example.com", password="StrongPass123")
        # A profile is auto-created by the post_save signal, so this has to update
        # that row rather than insert a second one — and it must set the role
        # outright, since the auto-created role is deliberately unprivileged.
        self.profile, _ = UserProfile.objects.update_or_create(
            user=self.user, defaults={"role": "super_admin"}
        )
        # Drop the profile cached on the instance by the signal, so the role
        # checks see super_admin (a real request loads the user fresh anyway).
        self.user.refresh_from_db()

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

    def test_super_admin_can_upload_homepage_media(self):
        from io import BytesIO
        from PIL import Image

        self.client.force_authenticate(user=self.user)
        buffer = BytesIO()
        Image.new("RGB", (1, 1), color="white").save(buffer, format="PNG")
        buffer.seek(0)
        image_file = SimpleUploadedFile("hero.png", buffer.read(), content_type="image/png")
        video_file = SimpleUploadedFile("intro.mp4", b"FAKEVIDEO1234", content_type="video/mp4")
        payload = {
            "hero_title": "Hero with Upload",
            "hero_image_upload": image_file,
            "hero_video_upload": video_file,
        }

        response = self.client.patch("/api/homepage-content/", payload, format="multipart")

        self.assertEqual(response.status_code, 200)
        content = HomePageContent.objects.get()
        self.assertTrue(content.hero_image_upload.name)
        self.assertTrue(content.hero_image_upload.name.endswith(".png"))
        self.assertTrue(content.hero_video_upload.name)
        self.assertTrue(content.hero_video_upload.name.endswith(".mp4"))
        self.assertIn("hero_image_upload", response.json())
        self.assertIn("hero_video_upload", response.json())
