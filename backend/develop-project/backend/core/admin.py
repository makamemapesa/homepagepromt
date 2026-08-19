from django.contrib import admin
from .models import UserProfile, SchoolSettings, Notification, AuditLog, TeamMember, CEOMessage, Fundraiser, Donation, HomePageContent


class HomePageContentAdmin(admin.ModelAdmin):
    fieldsets = (
        ("1. Hero/Banner Section", {
            "fields": (
                "hero_title", "hero_subtitle", "hero_description",
                "hero_image", "hero_image_upload", "hero_video_url", "hero_video_upload",
                "hero_primary_cta", "hero_primary_cta_link",
                "hero_secondary_cta", "hero_secondary_cta_link",
                "hero_background_color",
                "announcement_banner_enabled", "announcement_banner_text"
            ),
            "description": "Configure the hero/banner section at the top of the homepage"
        }),
        ("2. Statistics Section", {
            "fields": (
                "show_statistics_section", "total_students", "total_teachers",
                "established_year", "academic_programs_count",
                "statistics_custom_label1", "statistics_custom_value1",
                "statistics_custom_label2", "statistics_custom_value2"
            ),
            "description": "Display key school statistics"
        }),
        ("3. About School", {
            "fields": (
                "about_title", "about_description", "about_highlights",
                "why_choose_us_section_enabled", "why_choose_us_points",
                "school_story_section_enabled", "school_story_title",
                "school_story_description", "school_story_image"
            ),
            "description": "About school, why choose us, and school story"
        }),
        ("4. Academics & Programs", {
            "fields": (
                "academics_section_enabled", "academics_section_title",
                "academics_section_subtitle", "featured_subjects",
                "programs_overview", "grade_levels_offered"
            ),
            "description": "Academic programs and featured subjects"
        }),
        ("5. Admissions", {
            "fields": (
                "admissions_section_enabled", "admissions_section_title",
                "admissions_section_subtitle", "current_application_window_info",
                "admission_requirements", "application_button_text",
                "application_button_link", "admission_timeline"
            ),
            "description": "Admissions information and call-to-action"
        }),
        ("6. Leadership & Team", {
            "fields": (
                "leadership_section_enabled", "leadership_section_title",
                "principal_message_enabled", "featured_staff_count", "staff_directory_link"
            ),
            "description": "Leadership section with staff directory"
        }),
        ("7. Testimonials & Success Stories", {
            "fields": (
                "testimonials_section_enabled", "testimonials_section_title",
                "testimonials_section_subtitle", "testimonials_list",
                "success_stories_enabled", "success_stories"
            ),
            "description": "Student/parent testimonials and success stories"
        }),
        ("8. News & Announcements", {
            "fields": (
                "news_section_title", "news_section_subtitle",
                "featured_news_post", "news_cards", "news_max_display", "news_categories"
            ),
            "description": "News, updates, and announcements"
        }),
        ("9. Facilities & Campus", {
            "fields": (
                "facilities_section_enabled", "facilities_section_title",
                "facilities_list", "campus_gallery_enabled", "campus_gallery_photos"
            ),
            "description": "Campus facilities and gallery"
        }),
        ("10. Fundraising & Donations", {
            "fields": (
                "fundraising_section_enabled", "fundraising_section_title",
                "featured_fundraisers_count", "donation_call_to_action_text",
                "donation_call_to_action_link"
            ),
            "description": "Fundraising campaigns section"
        }),
        ("11. Accreditations", {
            "fields": (
                "accreditations_section_enabled", "accreditations_section_title",
                "accreditations_list"
            ),
            "description": "School accreditations and certifications"
        }),
        ("12. Contact & Footer", {
            "fields": (
                "contact_section_enabled", "footer_title", "footer_description",
                "display_contact_form", "map_location_embed_url",
                "office_hours", "quick_links"
            ),
            "description": "Contact information and footer links"
        }),
        ("13. Social Media & Messaging", {
            "fields": (
                "social_media_links", "share_enabled",
                "whatsapp_number", "whatsapp_enabled"
            ),
            "description": "Social media links and contact options"
        }),
        ("14. SEO & Metadata", {
            "fields": (
                "meta_title", "meta_description", "meta_keywords",
                "og_title", "og_description", "og_image", "canonical_url"
            ),
            "description": "Search engine optimization and social media metadata"
        }),
        ("15. Call-to-Action Sections", {
            "fields": (
                "secondary_cta_section_enabled", "secondary_cta_title",
                "secondary_cta_description", "secondary_cta_button_text",
                "secondary_cta_button_link", "secondary_cta_image",
                "tertiary_cta_enabled", "tertiary_cta_title",
                "tertiary_cta_description", "tertiary_cta_button_text",
                "tertiary_cta_button_link"
            ),
            "description": "Additional call-to-action sections"
        }),
        ("16. Events & Calendar", {
            "fields": (
                "events_section_enabled", "events_section_title",
                "upcoming_events_count", "link_to_full_calendar"
            ),
            "description": "Upcoming events section"
        }),
        ("17. Achievements & Performance", {
            "fields": (
                "achievements_section_enabled", "achievements_section_title",
                "exam_performance_enabled", "university_placements_enabled",
                "awards_recognitions_list"
            ),
            "description": "School achievements and performance metrics"
        }),
        ("18. Admin Controls", {
            "fields": (
                "sections_display_order", "maintenance_mode_enabled",
                "maintenance_mode_message", "show_beta_features",
                "homepage_theme", "custom_css"
            ),
            "description": "Administrative controls and settings",
            "classes": ("collapse",)
        }),
        ("19. Metadata", {
            "fields": (
                "vision_title", "vision_description",
                "mission_title", "mission_description", "updated_at"
            ),
            "classes": ("collapse",)
        }),
    )

    readonly_fields = ("updated_at",)

    def has_delete_permission(self, request):
        """Prevent accidental deletion of homepage content"""
        return False

    def has_add_permission(self, request):
        """Allow only one homepage content instance"""
        return not HomePageContent.objects.exists()


admin.site.register(UserProfile)
admin.site.register(SchoolSettings)
admin.site.register(Notification)
admin.site.register(AuditLog)
admin.site.register(TeamMember)
admin.site.register(CEOMessage)
admin.site.register(Fundraiser)
admin.site.register(Donation)
admin.site.register(HomePageContent, HomePageContentAdmin)
