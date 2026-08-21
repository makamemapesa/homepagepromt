from django.contrib import admin
from .models import FeeStructure, Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["student", "amount", "date", "method", "status", "category", "term"]
    list_filter = ["status", "method", "category", "term"]
    search_fields = ["student__first_name", "student__last_name", "receipt_no"]


admin.site.register(FeeStructure)
