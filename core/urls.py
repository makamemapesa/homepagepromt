from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, SchoolSettingsViewSet, NotificationViewSet, AuditLogViewSet,
    HomePageContentView,
    DashboardStatsView, ReportChartsView,
    ParentDashboardView, ParentAttendanceView, ParentTimetableView,
    PendingParentsView, PendingParentDeleteView,
    MessageListView, MessageContactsView,
    TeamMemberViewSet, CEOMessageViewSet, FundraiserViewSet, DonationViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet)
router.register("notifications", NotificationViewSet)
router.register("audit", AuditLogViewSet)
router.register("team/members", TeamMemberViewSet, basename="team-member")
router.register("team/ceo-message", CEOMessageViewSet, basename="ceo-message")
router.register("fundraisers", FundraiserViewSet, basename="fundraiser")
router.register("donations", DonationViewSet, basename="donation")

urlpatterns = [
    path("", include(router.urls)),
    path("settings/", SchoolSettingsViewSet.as_view({"get": "list", "patch": "update", "put": "update"})),
    path("homepage-content/", HomePageContentView.as_view(), name="homepage-content"),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("reports/charts/", ReportChartsView.as_view(), name="report-charts"),
    path("parent/dashboard/", ParentDashboardView.as_view(), name="parent-dashboard"),
    path("parent/attendance/", ParentAttendanceView.as_view(), name="parent-attendance"),
    path("parent/timetable/", ParentTimetableView.as_view(), name="parent-timetable"),
    path("parents/pending/", PendingParentsView.as_view(), name="parents-pending"),
    path("parents/pending/<int:pk>/", PendingParentDeleteView.as_view(), name="pending-parent-delete"),
    path("messages/", MessageListView.as_view(), name="messages"),
    path("messages/contacts/", MessageContactsView.as_view(), name="message-contacts"),
]
