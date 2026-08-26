from rest_framework import viewsets, generics
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Sum, Max, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from core.permissions import (
    CanReadExamRecords, IsAccountantOrAdmin, IsAccountantOrAdminOrParentReadOnly,
)
from core.utils import get_user_role
from .models import FeeStructure, Payment
from .serializers import FeeStructureSerializer, PaymentSerializer


class FeeStructureViewSet(viewsets.ModelViewSet):
    """
    Fee structure - Only Accountants and Admins can manage.
    """
    queryset = FeeStructure.objects.all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAccountantOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["session"]


class PaymentViewSet(viewsets.ModelViewSet):
    """
    Payment management - Accountants and Admins manage payments.
    Parents can view their children's payments.
    """
    queryset = Payment.objects.select_related("student__student_class").all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAccountantOrAdminOrParentReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["status", "method", "term", "category", "student"]
    search_fields = ["student__first_name", "student__last_name", "student__reg_no", "receipt_no"]

    def get_queryset(self):
        """Filter payments based on user role."""
        user = self.request.user
        role = get_user_role(user)

        if role in ['super_admin', 'admin', 'accountant']:
            return Payment.objects.select_related("student__student_class").all()
        
        elif role == 'parent':
            # Parents see only their children's payments
            return Payment.objects.filter(
                student__guardians__user=user
            ).select_related("student__student_class").distinct()
        
        return Payment.objects.none()

    def get_permissions(self):
        """Only accountants and admins can create/update payments."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAccountantOrAdmin()]
        if self.action == 'clearance':
            # Teachers need the yes/no, not the ledger — see the action below.
            return [CanReadExamRecords()]
        return [IsAccountantOrAdminOrParentReadOnly()]

    @action(detail=False, methods=["get"])
    def clearance(self, request):
        """Who is clear to receive term-end paperwork, without exposing amounts.

        GET /api/fees/payments/clearance/?term=<term>[&student_class=<id>]

        The Report Cards screen has to know which students are paid up before it
        will print or release anything. It used to work that out by reading every
        payment for the term, which a teacher is not allowed to do — so for them
        the whole class came back unpaid and every button stayed disabled.

        This returns the decision and a sentence explaining it, and nothing else:
        no amounts, no dates, no receipt numbers. Scoped per role, so a teacher
        sees their own classes and a parent only their own children.
        """
        from core.utils import get_teacher_class_ids, get_teacher_for
        from students.models import Student
        from .services import term_fee_clearance

        term = (request.query_params.get("term") or "").strip()
        if not term:
            return Response({"error": "term is required."}, status=400)

        students = Student.objects.all()
        class_id = request.query_params.get("student_class")
        if class_id and class_id != "all":
            students = students.filter(student_class_id=class_id)

        role = get_user_role(request.user)
        if role == "teacher":
            students = students.filter(
                student_class_id__in=get_teacher_class_ids(get_teacher_for(request.user))
            )
        elif role == "parent":
            students = students.filter(guardians__user=request.user).distinct()

        clearance = term_fee_clearance(students.values_list("id", flat=True), term)
        return Response({
            "term": term,
            "students": [
                {"student": student_id, "cleared": cleared, "reason": reason}
                for student_id, (cleared, reason) in sorted(clearance.items())
            ],
        })

    @action(detail=False, methods=["get"])
    def outstanding(self, request):
        """
        Returns students with outstanding balances.
        Compares total fees from FeeStructure against confirmed payments.
        Only accessible by Accountants and Admins.
        Uses bulk DB queries to avoid N+1.
        """
        user = request.user
        role = get_user_role(user)
        if role not in ['super_admin', 'admin', 'accountant']:
            return Response(
                {"error": "Only administrators and accountants can view outstanding balances."},
                status=403
            )

        from students.models import Student
        from datetime import date

        # --- Pre-fetch all fee structures keyed by class_level ---
        fee_map = {fs.class_level: fs for fs in FeeStructure.objects.all()}

        # --- Aggregate confirmed payments and latest payment date per student in one query ---
        payment_agg = (
            Payment.objects.filter(status="confirmed")
            .values("student_id")
            .annotate(total_paid=Sum("amount"))
        )
        paid_map = {row["student_id"]: float(row["total_paid"]) for row in payment_agg}

        last_payment_agg = (
            Payment.objects.values("student_id")
            .annotate(last_date=Max("date"))
        )
        last_payment_map = {row["student_id"]: row["last_date"] for row in last_payment_agg}

        # --- Fetch all active students with a class ---
        students = (
            Student.objects.filter(status="active")
            .exclude(student_class__isnull=True)
            .select_related("student_class")
        )

        results = []
        today = date.today()
        for student in students:
            level = student.student_class.level

            # Try exact match, then two-word prefix
            fee_struct = fee_map.get(level)
            if fee_struct is None:
                prefix = " ".join(level.split()[:2])
                fee_struct = fee_map.get(prefix)
            if fee_struct is None:
                continue

            total_fee = float(fee_struct.total)
            paid = paid_map.get(student.id, 0.0)
            balance = total_fee - paid
            if balance <= 0:
                continue

            last_payment = last_payment_map.get(student.id)
            if last_payment:
                days_overdue = (today - last_payment).days
            else:
                days_overdue = (today - student.admission_date).days if student.admission_date else None

            results.append(
                {
                    "id": student.id,
                    "studentName": student.full_name,
                    "regNo": student.reg_no,
                    "class": student.class_name,
                    "totalFee": total_fee,
                    "amountPaid": paid,
                    "balance": balance,
                    "collectionPct": round((paid / total_fee) * 100, 1),
                    "lastPayment": last_payment,
                    "daysOverdue": days_overdue,
                }
            )

        results.sort(key=lambda x: x["balance"], reverse=True)
        return Response(results)
