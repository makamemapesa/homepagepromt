from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

from . import homepage_defaults as hp


def validate_grade_bands(value):
    """
    Validate that grade_bands is a list of dicts each containing
    'grade' (str) and 'min' (numeric) keys.
    """
    if not isinstance(value, list):
        raise ValidationError("grade_bands must be a list.")
    for i, band in enumerate(value):
        if not isinstance(band, dict):
            raise ValidationError(f"grade_bands[{i}] must be an object.")
        if "grade" not in band:
            raise ValidationError(f"grade_bands[{i}] is missing required key 'grade'.")
        if "min" not in band:
            raise ValidationError(f"grade_bands[{i}] is missing required key 'min'.")
        try:
            float(band["min"])
        except (TypeError, ValueError):
            raise ValidationError(f"grade_bands[{i}].min must be a number, got {band['min']!r}.")


def default_timetable_periods():
    """The period structure a school starts with — every value is editable."""
    return [
        {"period": 1, "label": "Period 1", "start": "08:00", "end": "08:45", "is_break": False},
        {"period": 2, "label": "Period 2", "start": "08:45", "end": "09:30", "is_break": False},
        {"period": 3, "label": "Period 3", "start": "09:45", "end": "10:30", "is_break": False},
        {"period": 4, "label": "Period 4", "start": "10:30", "end": "11:15", "is_break": False},
        {"period": 5, "label": "Period 5", "start": "11:30", "end": "12:15", "is_break": False},
        {"period": 6, "label": "Period 6", "start": "12:15", "end": "13:00", "is_break": False},
    ]


def _parse_clock(value, where):
    """Accept "H:MM" or "HH:MM" and return minutes since midnight."""
    text = str(value or "").strip()
    parts = text.split(":")
    if len(parts) != 2:
        raise ValidationError(f"{where} must be a time like 08:45, got {value!r}.")
    try:
        hours, minutes = int(parts[0]), int(parts[1])
    except (TypeError, ValueError):
        raise ValidationError(f"{where} must be a time like 08:45, got {value!r}.")
    if not (0 <= hours <= 23 and 0 <= minutes <= 59):
        raise ValidationError(f"{where} must be a valid time of day, got {value!r}.")
    return hours * 60 + minutes


def validate_timetable_periods(value):
    """
    Validate the school's timetable period structure: a list of objects each
    holding a 'period' number and a 'start'/'end' time, e.g.

        {"period": 1, "label": "Period 1", "start": "08:00",
         "end": "08:45", "is_break": false}
    """
    if not isinstance(value, list):
        raise ValidationError("timetable_periods must be a list.")

    seen = set()
    for i, slot in enumerate(value):
        if not isinstance(slot, dict):
            raise ValidationError(f"timetable_periods[{i}] must be an object.")
        for key in ("period", "start", "end"):
            if key not in slot:
                raise ValidationError(f"timetable_periods[{i}] is missing required key '{key}'.")
        try:
            number = int(slot["period"])
        except (TypeError, ValueError):
            raise ValidationError(
                f"timetable_periods[{i}].period must be a whole number, got {slot['period']!r}."
            )
        if number < 1:
            raise ValidationError(f"timetable_periods[{i}].period must be 1 or greater.")
        if number in seen:
            raise ValidationError(f"Period number {number} is used more than once.")
        seen.add(number)

        start = _parse_clock(slot["start"], f"timetable_periods[{i}].start")
        end = _parse_clock(slot["end"], f"timetable_periods[{i}].end")
        if end <= start:
            raise ValidationError(
                f"timetable_periods[{i}] ends at or before it starts ({slot['start']} – {slot['end']})."
            )


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ("super_admin", "Super Administrator"),
        ("admin", "School Administrator"),
        ("teacher", "Teacher"),
        ("accountant", "Accountant"),
        ("parent", "Parent"),
        ("staff", "Staff"),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="admin")

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.role})"


class HomePageContent(models.Model):
    hero_title = models.CharField(max_length=200, default="AL NAMAA ACADEMY")
    hero_subtitle = models.CharField(max_length=200, default="Zanzibar • Expect Success")
    hero_description = models.TextField(default="An officially accredited institution offering Nursery, Primary, and Secondary education — grounded in Islamic values, aligned with the ZEC Framework and NECTA examinations.")
    hero_primary_cta = models.CharField(max_length=80, default="Apply for Admission")
    hero_secondary_cta = models.CharField(max_length=80, default="Discover More")
    hero_video_url = models.URLField(blank=True, default="https://www.youtube.com/embed/0t9kQG1Dqv0?rel=0&modestbranding=1&color=white")
    about_title = models.CharField(max_length=200, default="Excellence Through Knowledge & Character")
    about_description = models.TextField(default="Located in Kisauni, West “B” District, Zanzibar, AL NAMAA ACADEMY delivers high-quality education grounded in Islamic values. Our model combines rigorous academics with moral and spiritual development.")
    about_highlights = models.JSONField(default=list, blank=True)
    news_section_title = models.CharField(max_length=200, default="News & Updates")
    news_section_subtitle = models.CharField(max_length=200, default="Latest school stories, achievements and announcements")
    featured_news_post = models.JSONField(default=dict, blank=True)
    news_cards = models.JSONField(default=list, blank=True)
    vision_title = models.CharField(max_length=200, default="Pathways to Fulfilment")
    vision_description = models.TextField(default="To create pathways that assist every student in achieving their academic and personal goals — empowering them to build fulfilling futures and contribute meaningfully to the wider community.")
    mission_title = models.CharField(max_length=200, default="Excellence in Education")
    mission_description = models.TextField(default="To educate all students to the highest levels of achievement, preparing them to be productive, ethical, and creative members of society equipped with the knowledge, skills, and values needed for sustainable development.")
    updated_at = models.DateTimeField(auto_now=True)
    hero_image = models.URLField(blank=True, default="")
    hero_image_upload = models.ImageField(upload_to="homepage/images/", null=True, blank=True)
    hero_video_upload = models.FileField(upload_to="homepage/videos/", null=True, blank=True)

    # ── Site branding (nav, footer, login, dashboard) ────────────────────
    logo_upload = models.ImageField(upload_to="homepage/logo/", null=True, blank=True)
    logo_url = models.URLField(blank=True, default="")
    school_name = models.CharField(max_length=120, default="AL NAMAA ACADEMY")
    tagline = models.CharField(max_length=160, default="Zanzibar • Expect Success")

    # ── Hero extras ──────────────────────────────────────────────────────
    hero_badge_text = models.CharField(max_length=120, default="Admissions · 2026 / 2027")
    hero_stats = models.JSONField(default=hp.hero_stats, blank=True)

    # ── Credentials strip ────────────────────────────────────────────────
    credentials = models.JSONField(default=hp.credentials, blank=True)

    # ── About ────────────────────────────────────────────────────────────
    about_label = models.CharField(max_length=120, default="About Our School")
    about_paragraphs = models.JSONField(default=hp.about_paragraphs, blank=True)
    about_images = models.JSONField(default=list, blank=True)

    # ── Support / sponsorship teaser ─────────────────────────────────────
    support_label = models.CharField(max_length=140, default="Inclusive Education & Sponsorship")
    support_title = models.CharField(max_length=200, default="Educating with Compassion, Building Every Child’s Future")
    support_description = models.TextField(default="Through the generosity of donors and partners under the Muzdalifa Community, 30% of our students receive 100% full sponsorship — ensuring no child is ever denied access to education because of financial hardship.")
    support_cta = models.CharField(max_length=100, default="Learn About Our Support Programs")
    support_stats = models.JSONField(default=hp.support_stats, blank=True)

    # ── Stats banner ─────────────────────────────────────────────────────
    stats_banner = models.JSONField(default=hp.stats_banner, blank=True)

    # ── Programs ─────────────────────────────────────────────────────────
    programs_label = models.CharField(max_length=120, default="Academic Programs")
    programs_title = models.CharField(max_length=200, default="Three Levels of Academic Excellence")
    programs = models.JSONField(default=hp.programs, blank=True)

    # ── Why choose us ────────────────────────────────────────────────────
    features_label = models.CharField(max_length=120, default="Why Choose Us")
    features_title = models.CharField(max_length=200, default="Where Values Meet Academic Excellence")
    features_description = models.TextField(default="AL NAMAA ACADEMY stands apart through its unique integration of Islamic moral education with internationally-recognised academic standards.")
    features_badge_title = models.CharField(max_length=200, default="Ministry of Education & Vocational Training, Zanzibar")
    features_badge_subtitle = models.CharField(max_length=200, default="Reg. No. P 10082026 • ZRB: Z052610299")
    features = models.JSONField(default=hp.features, blank=True)

    # ── Vision & mission section heading ─────────────────────────────────
    purpose_label = models.CharField(max_length=120, default="Our Purpose")
    purpose_title = models.CharField(max_length=200, default="Vision & Mission")

    # ── Campus gallery ───────────────────────────────────────────────────
    gallery_label = models.CharField(max_length=120, default="Campus Life")
    gallery_title = models.CharField(max_length=200, default="Life at AL NAMAA")
    gallery = models.JSONField(default=hp.gallery, blank=True)

    # ── Admissions banner ────────────────────────────────────────────────
    admissions_label = models.CharField(max_length=120, default="Enroll Now")
    admissions_title = models.CharField(max_length=200, default="Admissions Open for 2026/2027")
    admissions_description = models.TextField(default="Secure your child’s place at AL NAMAA ACADEMY. Applications are now being accepted for all three educational levels.")
    admissions_cta = models.CharField(max_length=100, default="Contact Admissions")
    admission_levels = models.JSONField(default=hp.admission_levels, blank=True)

    # ── Contact ──────────────────────────────────────────────────────────
    contact_label = models.CharField(max_length=120, default="Our Campus")
    contact_area = models.CharField(max_length=160, default="Kisauni, West “B” District")
    contact_region = models.CharField(max_length=160, default="Zanzibar, Tanzania")
    contact_hours = models.CharField(max_length=160, default="Monday – Friday · 8:00 AM – 4:00 PM")
    contact_registration_line = models.CharField(max_length=200, default="Reg. No. P 10082026 • ZRB: Z052610299 • TIN: 175-002-324")
    contact_phones = models.JSONField(default=hp.contact_phones, blank=True)

    # ── Footer ───────────────────────────────────────────────────────────
    footer_established = models.CharField(max_length=120, default="Kisauni, Zanzibar • Est. 2020")
    footer_description = models.TextField(default="“Expect Success” — Officially recognised by the Ministry of Education and Vocational Training, Zanzibar. Delivering excellence through Islamic values.")
    footer_registration_lines = models.JSONField(default=list, blank=True)
    footer_copyright = models.CharField(max_length=200, default="© 2026 AL NAMAA ACADEMY. All rights reserved.")

    class Meta:
        verbose_name = "Home Page Content"
        verbose_name_plural = "Home Page Content"

    def __str__(self):
        return self.hero_title


class SchoolSettings(models.Model):
    school_name = models.CharField(max_length=200, default="AL NAMAA ACADEMY")
    short_name = models.CharField(max_length=50, default="AL NAMAA")
    email = models.EmailField(default="admin@school.edu")
    phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)
    address = models.TextField(blank=True)
    motto = models.CharField(max_length=200, blank=True)
    academic_session = models.CharField(max_length=20, default="2026")
    current_term = models.CharField(
        max_length=20,
        choices=[("Term 1", "Term 1"), ("Term 2", "Term 2"), ("Term 3", "Term 3")],
        default="Term 2",
    )
    term_start_date = models.DateField(null=True, blank=True)
    term_end_date = models.DateField(null=True, blank=True)
    grade_a = models.IntegerField(default=75)
    grade_b = models.IntegerField(default=65)
    grade_c = models.IntegerField(default=55)
    grade_d = models.IntegerField(default=45)
    # Fully dynamic grade bands: [{"grade": "A", "min": 75, "remark": "Excellent"}, ...]
    # Sorted descending by min. The last entry is the lowest/fail grade.
    grade_bands = models.JSONField(default=list, blank=True, validators=[validate_grade_bands])
    # The school's bell schedule: how many periods there are, what each is
    # called and when it runs. Drives every timetable grid in the portal.
    timetable_periods = models.JSONField(
        default=default_timetable_periods,
        blank=True,
        validators=[validate_timetable_periods],
    )
    security_settings = models.JSONField(default=dict, blank=True)
    notification_settings = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "School Settings"
        verbose_name_plural = "School Settings"

    def __str__(self):
        return self.school_name


class Notification(models.Model):
    TYPE_CHOICES = [
        ("warning", "Warning"),
        ("info", "Info"),
        ("success", "Success"),
        ("error", "Error"),
    ]
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications", null=True, blank=True)
    title = models.CharField(max_length=200)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="info")
    date = models.DateField(auto_now_add=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ("LOGIN", "Login"),
        ("LOGOUT", "Logout"),
        ("CREATE", "Create"),
        ("UPDATE", "Update"),
        ("DELETE", "Delete"),
        ("EXPORT", "Export"),
        ("SETTINGS", "Settings"),
        ("VIEW", "View"),
    ]
    STATUS_CHOICES = [("success", "Success"), ("failed", "Failed")]

    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, db_index=True)
    module = models.CharField(max_length=100, db_index=True)
    detail = models.TextField()
    ip = models.GenericIPAddressField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="success")

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.action} by {self.user} at {self.timestamp}"


class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_messages")
    body = models.TextField(max_length=2000)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender} → {self.recipient}: {self.body[:40]}"


# ── Team ──────────────────────────────────────────────────────────────────────

def team_photo_upload(instance, filename):
    import os
    ext = os.path.splitext(filename)[1].lower()
    return f"team/{instance.slug or 'member'}{ext}"


class TeamMember(models.Model):
    DEPARTMENT_CHOICES = [
        ("leadership",    "Leadership"),
        ("academic",      "Academic"),
        ("administration","Administration"),
        ("support",       "Support Staff"),
        ("board",         "Board of Directors"),
    ]

    first_name   = models.CharField(max_length=100)
    last_name    = models.CharField(max_length=100)
    title        = models.CharField(max_length=150, help_text="e.g. Chief Executive Officer")
    department   = models.CharField(max_length=30, choices=DEPARTMENT_CHOICES, default="academic")
    bio          = models.TextField(blank=True)
    email        = models.EmailField(blank=True)
    phone        = models.CharField(max_length=30, blank=True)
    linkedin_url = models.URLField(blank=True)
    photo        = models.ImageField(upload_to="team/", null=True, blank=True)
    is_active    = models.BooleanField(default=True)
    order        = models.PositiveIntegerField(default=0, help_text="Lower = appears first")
    slug         = models.SlugField(max_length=120, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} – {self.title}"

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(f"{self.first_name}-{self.last_name}")
        super().save(*args, **kwargs)


class CEOMessage(models.Model):
    """A singleton-style model for the CEO/Principal letter on the Team page."""
    heading     = models.CharField(max_length=200, default="A Message from Our CEO")
    body        = models.TextField(help_text="The full letter/message text (HTML supported)")
    author_name = models.CharField(max_length=200, default="")
    author_title= models.CharField(max_length=200, default="Chief Executive Officer")
    photo       = models.ImageField(upload_to="team/ceo/", null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "CEO Message"
        verbose_name_plural = "CEO Messages"

    def __str__(self):
        return self.heading


class Fundraiser(models.Model):
    CATEGORY_CHOICES = [
        ("building",    "Building & Infrastructure"),
        ("education",   "Education & Scholarships"),
        ("orphans",     "Orphan Support"),
        ("equipment",   "Equipment & Technology"),
        ("emergency",   "Emergency Relief"),
        ("general",     "General Fundraiser"),
    ]
    STATUS_CHOICES = [
        ("active",    "Active"),
        ("completed", "Completed"),
        ("paused",    "Paused"),
    ]

    title          = models.CharField(max_length=200)
    slug           = models.SlugField(max_length=220, blank=True, unique=True)
    category       = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default="general")
    description    = models.TextField(help_text="Full description of the fundraiser")
    short_desc     = models.CharField(max_length=300, blank=True, help_text="One-line summary shown on cards")
    goal_amount    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    raised_amount  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    donor_count    = models.PositiveIntegerField(default=0)
    image          = models.ImageField(upload_to="fundraisers/", null=True, blank=True)
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    is_featured    = models.BooleanField(default=False, help_text="Show on homepage / top of fundraisers page")
    start_date     = models.DateField(null=True, blank=True)
    end_date       = models.DateField(null=True, blank=True)
    donate_url     = models.URLField(blank=True, help_text="External payment / donation link")
    order          = models.PositiveIntegerField(default=0, help_text="Lower = appears first")
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name = "Fundraiser"
        verbose_name_plural = "Fundraisers"

    def __str__(self):
        return self.title

    @property
    def progress_percent(self):
        if self.goal_amount and self.goal_amount > 0:
            pct = (self.raised_amount / self.goal_amount) * 100
            return min(round(float(pct), 1), 100)
        return 0

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            import uuid
            base = slugify(self.title)[:200]
            self.slug = f"{base}-{str(uuid.uuid4())[:8]}"
        super().save(*args, **kwargs)


class Donation(models.Model):
    STATUS_CHOICES = [
        ("pending",   "Pending"),
        ("received",  "Received"),
        ("cancelled", "Cancelled"),
    ]

    fundraiser   = models.ForeignKey(Fundraiser, on_delete=models.CASCADE, related_name="donations")
    donor_name   = models.CharField(max_length=200)
    donor_email  = models.EmailField(blank=True)
    amount       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    message      = models.TextField(blank=True, help_text="Public message / comment from the donor")
    is_anonymous = models.BooleanField(default=False)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Donation"
        verbose_name_plural = "Donations"

    def __str__(self):
        name = "Anonymous" if self.is_anonymous else self.donor_name
        return f"{name} → {self.fundraiser.title} (${self.amount})"
