from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient


def reset_throttles():
    """Clear DRF's rate-limit counters between tests.

    They live in the default cache, which is not rolled back with the database,
    so unrelated tests earlier in the run burn through the 10/minute anonymous
    allowance and whatever comes next gets a 429 instead of its answer.
    """
    cache.clear()

from .models import HomePageContent, UserProfile


class HomePageContentAPITests(TestCase):
    def setUp(self):
        reset_throttles()
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


class HomepageEditorSaveTests(TestCase):
    """The exact payload shape the Homepage editor sends when you press Save.

    The editor posts multipart, because it also carries file uploads. The API
    client deliberately does not case-convert a multipart body, so the editor
    has to send the model's own field names — these tests pin that contract
    down, since getting it wrong fails silently: DRF ignores unknown keys and
    returns 200, which is exactly how every save used to be lost.
    """

    def setUp(self):
        reset_throttles()
        self.client = APIClient()
        admin = User.objects.create_user(
            username="hp_admin", email="hp_admin@example.com", password="StrongPass123"
        )
        UserProfile.objects.update_or_create(user=admin, defaults={"role": "super_admin"})
        admin.refresh_from_db()
        self.client.force_authenticate(user=admin)

    def patch(self, payload):
        return self.client.patch("/api/homepage-content/", payload, format="multipart")

    def content(self):
        # The view creates row 1 lazily, so a test that reads before it writes
        # would otherwise blow up rather than report what it is checking.
        return HomePageContent.objects.get_or_create(pk=1)[0]

    # ── the contract the editor relies on ─────────────────────────────

    def test_text_field_is_applied(self):
        res = self.patch({"hero_title": "Mapesa Academy"})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.content().hero_title, "Mapesa Academy")

    def test_camel_case_keys_are_not_silently_accepted(self):
        """A camelCase key changes nothing — which is why the editor must not send one.

        DRF ignores unknown fields rather than rejecting them, so this returns
        200 with the old value intact. The assertion documents the trap.
        """
        before = self.content().hero_title

        res = self.patch({"heroTitle": "Should Not Apply"})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.content().hero_title, before)

    def test_switching_a_section_off_is_applied(self):
        """`false` must travel as "false"; the old editor sent "" and got a 400."""
        HomePageContent.objects.update_or_create(pk=1, defaults={"whatsapp_enabled": True})

        res = self.patch({"whatsapp_enabled": "false"})

        self.assertEqual(res.status_code, 200)
        self.assertFalse(self.content().whatsapp_enabled)

    def test_switching_a_section_on_is_applied(self):
        res = self.patch({"maintenance_mode_enabled": "true"})

        self.assertEqual(res.status_code, 200)
        self.assertTrue(self.content().maintenance_mode_enabled)

    def test_an_empty_string_for_a_boolean_is_silently_ignored(self):
        """Precisely the bug the old editor had, pinned so it cannot come back.

        It sent ``String(value || "")`` for every field, so an off switch left as
        an empty string. DRF treats that as "field not supplied" on a partial
        update: the request succeeds, the switch never moves, and the screen
        reports a successful save. Hence the editor now sends "false".
        """
        HomePageContent.objects.update_or_create(pk=1, defaults={"whatsapp_enabled": True})

        res = self.patch({"whatsapp_enabled": ""})

        self.assertEqual(res.status_code, 200)
        self.assertTrue(self.content().whatsapp_enabled, "the empty string quietly did nothing")

    def test_an_empty_string_for_a_number_is_silently_ignored(self):
        HomePageContent.objects.update_or_create(pk=1, defaults={"news_max_display": 3})

        res = self.patch({"news_max_display": ""})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.content().news_max_display, 3)

    def test_an_empty_string_for_a_list_block_is_rejected_outright(self):
        """JSON fields do fail loudly, so a bad payload cannot pass unnoticed."""
        res = self.patch({"hero_stats": ""})

        self.assertEqual(res.status_code, 400)

    def test_zero_is_applied_rather_than_treated_as_blank(self):
        res = self.patch({"news_max_display": "0"})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.content().news_max_display, 0)

    def test_a_list_block_is_applied(self):
        rows = '[{"value": "12", "label": "Years Teaching"}]'

        res = self.patch({"hero_stats": rows})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.content().hero_stats, [{"value": "12", "label": "Years Teaching"}])

    def test_emptying_a_list_block_is_applied(self):
        res = self.patch({"about_highlights": "[]"})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.content().about_highlights, [])

    def test_an_object_block_is_applied(self):
        post = '{"title": "Prize Day", "date": "1 May 2026", "excerpt": "", "image": "", "link": ""}'

        res = self.patch({"featured_news_post": post})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.content().featured_news_post["title"], "Prize Day")

    def test_a_partial_save_leaves_every_other_block_alone(self):
        """The editor sends only what changed; the rest must survive untouched."""
        HomePageContent.objects.update_or_create(
            pk=1, defaults={"footer_copyright": "© 2026 Mapesa", "hero_title": "Original"}
        )

        self.patch({"hero_title": "Changed"})

        row = self.content()
        self.assertEqual(row.hero_title, "Changed")
        self.assertEqual(row.footer_copyright, "© 2026 Mapesa")

    def test_the_response_carries_the_stored_values_back(self):
        """The editor re-seeds its form from the response, so it must be current."""
        res = self.patch({"hero_title": "Round Trip"})

        self.assertEqual(res.data["hero_title"], "Round Trip")

    # ── what the public page then reads ───────────────────────────────

    def test_a_saved_change_reaches_the_public_endpoint(self):
        """End to end: what an administrator saves is what a visitor is served."""
        self.patch({"nav_login_label": "Sign In", "footer_tagline": "Reach Higher"})

        anonymous = APIClient()
        res = anonymous.get("/api/homepage-content/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["nav_login_label"], "Sign In")
        self.assertEqual(res.data["footer_tagline"], "Reach Higher")

    def test_every_block_the_page_renders_is_present_in_the_payload(self):
        """A missing key makes the page silently fall back to its built-in copy."""
        res = APIClient().get("/api/homepage-content/")

        for key in [
            "nav_links", "nav_results_label", "hero_stats", "hero_video_caption",
            "credentials", "about_paragraphs", "about_images", "about_cta",
            "support_stats", "stats_banner", "programs", "features",
            "vision_eyebrow", "mission_eyebrow", "gallery", "admission_levels",
            "admissions_status_title", "news_label", "featured_news_post",
            "news_cards", "contact_heading", "contact_phones", "contact_form_title",
            "footer_school_links", "footer_portal_links", "footer_registration_lines",
            "footer_tagline", "social_media_links", "whatsapp_number",
            "announcement_banner_text", "maintenance_mode_message", "custom_css",
        ]:
            self.assertIn(key, res.data, "%s is missing from the homepage payload" % key)

    def test_collections_ship_with_real_content_not_empty_lists(self):
        """An empty list would leave the editor with nothing to show or edit."""
        res = APIClient().get("/api/homepage-content/")

        for key in ["nav_links", "about_images", "news_cards", "footer_registration_lines",
                    "footer_school_links", "programs", "features", "gallery"]:
            self.assertTrue(res.data[key], "%s came back empty" % key)

    # ── who may save ──────────────────────────────────────────────────

    def test_a_teacher_cannot_edit_the_homepage(self):
        teacher = User.objects.create_user(
            username="hp_teacher", email="hp_teacher@example.com", password="StrongPass123"
        )
        UserProfile.objects.update_or_create(user=teacher, defaults={"role": "teacher"})
        teacher.refresh_from_db()
        self.client.force_authenticate(user=teacher)
        before = self.content().hero_title

        res = self.patch({"hero_title": "Nope"})

        self.assertEqual(res.status_code, 403)
        self.assertEqual(self.content().hero_title, before)

    def test_an_anonymous_visitor_cannot_edit_the_homepage(self):
        anonymous = APIClient()

        res = anonymous.patch(
            "/api/homepage-content/", {"hero_title": "Nope"}, format="multipart"
        )

        self.assertIn(res.status_code, (401, 403))
