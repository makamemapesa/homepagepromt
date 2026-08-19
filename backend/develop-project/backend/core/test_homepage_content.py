"""Everything on the public home page is managed from the dashboard and served publicly."""
import io

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from core.models import HomePageContent, UserProfile

# Every block the public page renders from the API.
MANAGED_KEYS = [
    "logo", "school_name", "tagline",
    "hero_title", "hero_subtitle", "hero_description", "hero_badge_text",
    "hero_primary_cta", "hero_secondary_cta", "hero_stats",
    "credentials", "about_label", "about_title", "about_paragraphs", "about_highlights",
    "support_label", "support_title", "support_description", "support_cta", "support_stats",
    "stats_banner", "programs_label", "programs_title", "programs",
    "features_label", "features_title", "features_description",
    "features_badge_title", "features_badge_subtitle", "features",
    "purpose_label", "purpose_title", "vision_title", "vision_description",
    "mission_title", "mission_description",
    "gallery_label", "gallery_title", "gallery",
    "admissions_label", "admissions_title", "admissions_description",
    "admissions_cta", "admission_levels",
    "news_section_title", "news_section_subtitle", "featured_news_post", "news_cards",
    "contact_label", "contact_area", "contact_region", "contact_hours",
    "contact_registration_line", "contact_phones",
    "footer_established", "footer_description", "footer_registration_lines", "footer_copyright",
]


def png(colour=(16, 120, 70)):
    buffer = io.BytesIO()
    Image.new("RGB", (64, 64), colour).save(buffer, format="PNG")
    buffer.seek(0)
    return SimpleUploadedFile("logo.png", buffer.read(), content_type="image/png")


class HomePageContentTests(TestCase):
    def setUp(self):
        admin = User.objects.create_user(
            username="admin@example.com", email="admin@example.com", password="AdminPass123"
        )
        UserProfile.objects.update_or_create(user=admin, defaults={"role": "admin"})
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.get(pk=admin.pk))

    # ── What the public page can read ────────────────────────────────────

    def test_every_managed_block_is_served_publicly(self):
        response = APIClient().get("/api/homepage-content/")

        self.assertEqual(response.status_code, 200)
        missing = [key for key in MANAGED_KEYS if key not in response.data]
        self.assertEqual(missing, [], f"not exposed to the public page: {missing}")

    def test_a_fresh_site_starts_with_full_default_content(self):
        data = APIClient().get("/api/homepage-content/").data

        self.assertEqual(len(data["programs"]), 3)
        self.assertEqual(len(data["features"]), 6)
        self.assertEqual(len(data["gallery"]), 6)
        self.assertEqual(len(data["credentials"]), 4)
        self.assertEqual(len(data["contact_phones"]), 3)
        self.assertEqual(data["school_name"], "AL NAMAA ACADEMY")

    # ── Saving from the dashboard ────────────────────────────────────────

    def test_text_edits_reach_the_public_endpoint(self):
        response = self.client.patch("/api/homepage-content/", {
            "school_name": "New Academy Name",
            "hero_title": "WELCOME",
            "contact_hours": "Mon – Sat · 7:30–17:00",
            "footer_copyright": "© 2027 New Academy",
        }, format="json")

        self.assertEqual(response.status_code, 200)
        public = APIClient().get("/api/homepage-content/").data
        self.assertEqual(public["school_name"], "New Academy Name")
        self.assertEqual(public["hero_title"], "WELCOME")
        self.assertEqual(public["contact_hours"], "Mon – Sat · 7:30–17:00")
        self.assertEqual(public["footer_copyright"], "© 2027 New Academy")

    def test_repeating_blocks_can_be_replaced_wholesale(self):
        response = self.client.patch("/api/homepage-content/", {
            "programs": [
                {"number": "01", "level": "Kindergarten", "ages": "Early Years",
                 "description": "Only one programme now.", "phone": "+255 700 000 001", "image": ""},
            ],
            "credentials": [{"label": "Reg. No.", "value": "P-NEW-2026"}],
            "about_paragraphs": ["A single new paragraph."],
            "contact_phones": [{"label": "Main Office", "value": "+255 777 000 111"}],
            "gallery": [],
        }, format="json")

        self.assertEqual(response.status_code, 200)
        public = APIClient().get("/api/homepage-content/").data
        self.assertEqual([p["level"] for p in public["programs"]], ["Kindergarten"])
        self.assertEqual(public["credentials"][0]["value"], "P-NEW-2026")
        self.assertEqual(public["about_paragraphs"], ["A single new paragraph."])
        self.assertEqual(public["contact_phones"][0]["value"], "+255 777 000 111")
        self.assertEqual(public["gallery"], [])

    def test_lists_sent_as_json_strings_by_the_upload_form_are_accepted(self):
        """The editor posts multipart so it can carry the logo, so lists arrive as JSON text."""
        import json

        response = self.client.patch("/api/homepage-content/", {
            "school_name": "Multipart Academy",
            "credentials": json.dumps([{"label": "TIN", "value": "999-000-111"}]),
            "about_highlights": json.dumps(["One", "Two"]),
        }, format="multipart")

        self.assertEqual(response.status_code, 200, response.data)
        public = APIClient().get("/api/homepage-content/").data
        self.assertEqual(public["credentials"], [{"label": "TIN", "value": "999-000-111"}])
        self.assertEqual(public["about_highlights"], ["One", "Two"])

    # ── Logo ─────────────────────────────────────────────────────────────

    def test_uploading_a_logo_publishes_a_usable_url(self):
        response = self.client.patch(
            "/api/homepage-content/", {"logo_upload": png()}, format="multipart"
        )

        self.assertEqual(response.status_code, 200, response.data)
        logo = APIClient().get("/api/homepage-content/").data["logo"]
        self.assertTrue(logo.endswith(".png"), logo)
        self.assertIn("/media/homepage/logo/", logo)

    def test_an_uploaded_logo_wins_over_a_pasted_url(self):
        self.client.patch("/api/homepage-content/", {"logo_url": "https://cdn.example.com/a.png"}, format="json")
        self.assertEqual(APIClient().get("/api/homepage-content/").data["logo"], "https://cdn.example.com/a.png")

        self.client.patch("/api/homepage-content/", {"logo_upload": png()}, format="multipart")

        self.assertIn("/media/homepage/logo/", APIClient().get("/api/homepage-content/").data["logo"])

    def test_no_logo_set_leaves_the_field_empty_so_the_site_uses_its_own(self):
        self.assertEqual(APIClient().get("/api/homepage-content/").data["logo"], "")

    # ── Access ───────────────────────────────────────────────────────────

    def test_visitors_may_read_but_not_change_the_homepage(self):
        anonymous = APIClient()

        self.assertEqual(anonymous.get("/api/homepage-content/").status_code, 200)
        self.assertIn(
            anonymous.patch("/api/homepage-content/", {"school_name": "Hijacked"}, format="json").status_code,
            (401, 403),
        )
        self.assertEqual(HomePageContent.objects.get().school_name, "AL NAMAA ACADEMY")

    def test_a_teacher_cannot_change_the_homepage(self):
        teacher = User.objects.create_user(
            username="t@example.com", email="t@example.com", password="SomePass12345"
        )
        UserProfile.objects.update_or_create(user=teacher, defaults={"role": "teacher"})
        client = APIClient()
        client.force_authenticate(user=User.objects.get(pk=teacher.pk))

        response = client.patch("/api/homepage-content/", {"school_name": "Nope"}, format="json")

        self.assertEqual(response.status_code, 403)
