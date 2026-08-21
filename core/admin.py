from django.contrib import admin
from .models import UserProfile, SchoolSettings, Notification, AuditLog, TeamMember, CEOMessage, Fundraiser, Donation, HomePageContent

admin.site.register(UserProfile)
admin.site.register(SchoolSettings)
admin.site.register(Notification)
admin.site.register(AuditLog)
admin.site.register(TeamMember)
admin.site.register(CEOMessage)
admin.site.register(Fundraiser)
admin.site.register(Donation)
admin.site.register(HomePageContent)
