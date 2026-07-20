import csv
import io
import datetime
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.dateparse import parse_date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import (
    IsSuperAdmin,
    IsSuperAdminOrAdmin,
    IsTeacherOrAdmin,
    IsTeacherOrAdminOrParentReadOnly,
)
from core.utils import get_user_role
from donors.models import Donor
from .models import Student, StudentDocument, AcademicHistory
from .serializers import (
    StudentListSerializer,
    StudentDetailSerializer,
    StudentCreateSerializer,
    StudentDocumentSerializer,
    AcademicHistorySerializer,
)


class StudentViewSet(viewsets.ModelViewSet):
    """
    Student management with role-based access:
    - Super Admin/Admin: Full access to all students
    - Teacher: View students in their classes only
    - Parent: View only their own children
    - Accountant: View all students (for fee management)
    """
    queryset = Student.objects.select_related("student_class", "donor").all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "fee_status", "student_type", "gender", "is_orphan", "student_class"]
    search_fields = ["first_name", "last_name", "reg_no", "student_class__name"]
    ordering_fields = ["last_name", "first_name", "admission_date", "reg_no"]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        """
        Set permissions based on action:
        - Create/Update/Delete: Only admins
        - Import students: Only super admins
        - View: Admins, teachers (their classes), parents (their children), accountants
        """
        if self.action == 'import_students':
            return [IsSuperAdmin()]
        if self.action in ['create', 'destroy', 'promote']:
            return [IsSuperAdminOrAdmin()]
        elif self.action in ['update', 'partial_update']:
            return [IsSuperAdminOrAdmin()]
        return [IsTeacherOrAdminOrParentReadOnly()]

    def get_queryset(self):
        """
        Filter students based on user role.
        """
        user = self.request.user
        role = get_user_role(user)

        if role in ['super_admin', 'admin', 'accountant']:
            # Admins and accountants see all students
            return Student.objects.select_related("student_class", "donor").all()
        
        elif role == 'teacher':
            # Teachers see students in their classes (homeroom + subject-assigned)
            from academics.models import Teacher, Class, TeacherAssignment
            try:
                teacher = Teacher.objects.get(email=user.email)
                homeroom_ids = set(Class.objects.filter(class_teacher=teacher).values_list('id', flat=True))
                assigned_ids = set(TeacherAssignment.objects.filter(teacher=teacher, status='active').values_list('student_class_id', flat=True))
                all_ids = homeroom_ids | assigned_ids
                return Student.objects.filter(
                    student_class_id__in=all_ids
                ).select_related("student_class", "donor")
            except Teacher.DoesNotExist:
                return Student.objects.none()
        
        elif role == 'parent':
            # Parents see only their own children
            return Student.objects.filter(
                parent__user=user
            ).select_related("student_class", "donor")
        
        # Default: no access
        return Student.objects.none()

    def get_serializer_class(self):
        if self.action == "list":
            return StudentListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return StudentCreateSerializer
        return StudentDetailSerializer

    def _normalize_header(self, header):
        if not header:
            return ""
        return str(header).strip().lower().replace(" ", "_").replace("-", "_").replace("/", "_")

    def _parse_bool(self, value):
        if value is None:
            return False
        if isinstance(value, bool):
            return value
        normalized = str(value).strip().lower()
        return normalized in ["1", "true", "yes", "y", "t", "on"]

    def _parse_date(self, value):
        if value is None or str(value).strip() == "":
            return None
        if isinstance(value, datetime.date):
            return value
        normalized = str(value).strip()
        parsed = parse_date(normalized)
        if parsed:
            return parsed
        for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d", "%d.%m.%Y"]:
            try:
                return datetime.datetime.strptime(normalized, fmt).date()
            except ValueError:
                continue
        raise ValidationError(f"Invalid date format: {normalized}")

    def _parse_student_class(self, value):
        if value is None or str(value).strip() == "":
            return None
        normalized = str(value).strip()
        from academics.models import Class
        if normalized.isdigit():
            try:
                return int(normalized)
            except ValueError:
                pass
        cls = Class.objects.filter(name__iexact=normalized).first()
        if cls:
            return cls.id
        if normalized.isdigit() and Class.objects.filter(pk=int(normalized)).exists():
            return int(normalized)
        raise ValidationError(f"Student class not found: {normalized}")

    def _parse_donor(self, value):
        if value is None or str(value).strip() == "":
            return None
        normalized = str(value).strip()
        if normalized.isdigit():
            donor = Donor.objects.filter(pk=int(normalized)).first()
            if donor:
                return donor.id
        donor = Donor.objects.filter(name__iexact=normalized).first()
        if donor:
            return donor.id
        raise ValidationError(f"Donor not found: {normalized}")

    def _parse_import_rows(self, file):
        file_name = getattr(file, "name", "")
        if file_name.lower().endswith(".xlsx"):
            from openpyxl import load_workbook
            workbook = load_workbook(filename=file, read_only=True, data_only=True)
            sheet = workbook.active
            rows = list(sheet.iter_rows(values_only=True))
            if not rows:
                return []
            headers = [self._normalize_header(c) for c in rows[0]]
            return [
                {headers[idx]: cell for idx, cell in enumerate(row) if idx < len(headers)}
                for row in rows[1:]
            ]

        text = file.read().decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows = []
        for raw_row in reader:
            row = {}
            for raw_key, value in raw_row.items():
                key = self._normalize_header(raw_key)
                if key:
                    row[key] = value
            rows.append(row)
        return rows

    def _build_import_payload(self, row):
        row = {self._normalize_header(key): value for key, value in row.items()}
        def get_val(key):
            return row.get(self._normalize_header(key), "")

        payload = {
            "reg_no": str(get_val("reg_no") or get_val("registration_number") or "").strip(),
            "first_name": str(get_val("first_name") or "").strip(),
            "last_name": str(get_val("last_name") or "").strip(),
            "middle_name": str(get_val("middle_name") or "").strip(),
            "date_of_birth": self._parse_date(get_val("date_of_birth")),
            "gender": self._normalize_gender(get_val("gender")),
            "blood_group": str(get_val("blood_group") or "").strip(),
            "religion": str(get_val("religion") or "").strip(),
            "state_of_origin": str(get_val("state_of_origin") or "").strip(),
            "residential_address": str(get_val("residential_address") or "").strip(),
            "is_orphan": self._parse_bool(get_val("is_orphan")),
            "student_type": self._normalize_student_type(get_val("student_type")),
            "admission_date": self._parse_date(get_val("admission_date")),
            "academic_session": str(get_val("academic_session") or "2026").strip(),
            "student_class_id": self._parse_student_class(get_val("student_class")),
            "previous_school": str(get_val("previous_school") or "").strip(),
            "previous_class": str(get_val("previous_class") or "").strip(),
            "status": self._normalize_status(get_val("status")),
            "fee_status": self._normalize_fee_status(get_val("fee_status")),
            "donor_id": self._parse_donor(get_val("donor")),
            "donor_number": str(get_val("donor_number") or "").strip(),
        }

        parent_name = str(get_val("parent_name") or "").strip()
        parent_phone = str(get_val("parent_phone") or "").strip()
        relationship = str(get_val("relationship") or "").strip()
        if parent_name or parent_phone or relationship:
            if not parent_name or not parent_phone or not relationship:
                raise ValidationError("Parent data must include name, phone, and relationship.")
            payload["parent"] = {
                "full_name": parent_name,
                "phone": parent_phone,
                "relationship": relationship,
                "email": str(get_val("parent_email") or "").strip(),
                "occupation": str(get_val("occupation") or "").strip(),
                "office_address": str(get_val("office_address") or "").strip(),
                "home_address": str(get_val("home_address") or "").strip(),
            }
            parent_user_id = get_val("parent_user_id")
            if str(parent_user_id).strip():
                try:
                    payload["parent_user_id"] = int(str(parent_user_id).strip())
                except ValueError:
                    raise ValidationError("parent_user_id must be an integer")

        if not payload["reg_no"]:
            raise ValidationError("reg_no is required")
        if not payload["first_name"]:
            raise ValidationError("first_name is required")
        if not payload["last_name"]:
            raise ValidationError("last_name is required")
        if not payload["date_of_birth"]:
            raise ValidationError("date_of_birth is required")
        if not payload["gender"]:
            raise ValidationError("gender is required")
        if not payload["admission_date"]:
            raise ValidationError("admission_date is required")

        return payload

    def _normalize_gender(self, value):
        if not value:
            return ""
        value_str = str(value).strip().lower()
        if value_str in ["male", "m"]:
            return "Male"
        if value_str in ["female", "f"]:
            return "Female"
        raise ValidationError(f"Gender must be Male or Female: {value}")

    def _normalize_student_type(self, value):
        if not value:
            return "Day"
        normalized = str(value).strip().lower()
        if normalized in ["day", "d"]:
            return "Day"
        if normalized in ["boarding", "b"]:
            return "Boarding"
        raise ValidationError(f"Student type must be Day or Boarding: {value}")

    def _normalize_status(self, value):
        if not value:
            return "active"
        normalized = str(value).strip().lower()
        if normalized in ["active"]:
            return "active"
        if normalized in ["suspended"]:
            return "suspended"
        if normalized in ["graduated"]:
            return "graduated"
        if normalized in ["withdrawn"]:
            return "withdrawn"
        raise ValidationError(f"Invalid status: {value}")

    def _normalize_fee_status(self, value):
        if not value:
            return "unpaid"
        normalized = str(value).strip().lower()
        if normalized in ["paid"]:
            return "paid"
        if normalized in ["partial"]:
            return "partial"
        if normalized in ["unpaid"]:
            return "unpaid"
        raise ValidationError(f"Invalid fee_status: {value}")

    def _parse_bool(self, value):
        if value is None:
            return False
        if isinstance(value, bool):
            return value
        normalized = str(value).strip().lower()
        return normalized in ["1", "true", "yes", "y", "t", "on"]

    def _parse_date(self, value):
        if value is None or str(value).strip() == "":
            return None
        if isinstance(value, datetime.date):
            return value
        normalized = str(value).strip()
        parsed = parse_date(normalized)
        if parsed:
            return parsed
        for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d", "%d.%m.%Y"]:
            try:
                return datetime.datetime.strptime(normalized, fmt).date()
            except ValueError:
                continue
        raise ValidationError(f"Invalid date format: {normalized}")

    def _parse_student_class(self, value):
        if value is None or str(value).strip() == "":
            return None
        normalized = str(value).strip()
        from academics.models import Class
        if normalized.isdigit():
            try:
                return int(normalized)
            except ValueError:
                pass
        try:
            cls = Class.objects.filter(name__iexact=normalized).first()
            if cls:
                return cls.id
        except Exception:
            pass
        if normalized.isdigit():
            if Class.objects.filter(pk=int(normalized)).exists():
                return int(normalized)
        raise ValidationError(f"Student class not found: {normalized}")

    def _parse_donor(self, value):
        if value is None or str(value).strip() == "":
            return None
        normalized = str(value).strip()
        if normalized.isdigit():
            donor = Donor.objects.filter(pk=int(normalized)).first()
            if donor:
                return donor.id
        donor = Donor.objects.filter(name__iexact=normalized).first()
        if donor:
            return donor.id
        raise ValidationError(f"Donor not found: {normalized}")

    def _parse_import_rows(self, file):
        file_name = getattr(file, "name", "")
        if file_name.lower().endswith(".xlsx"):
            from openpyxl import load_workbook
            workbook = load_workbook(filename=file, read_only=True, data_only=True)
            sheet = workbook.active
            rows = list(sheet.iter_rows(values_only=True))
            if not rows:
                return []
            headers = [self._normalize_header(c) for c in rows[0]]
            return [
                {headers[idx]: cell for idx, cell in enumerate(row) if idx < len(headers)}
                for row in rows[1:]
            ]

        text = file.read().decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        headers = [self._normalize_header(h) for h in reader.fieldnames or []]
        rows = []
        for raw_row in reader:
            row = {}
            for raw_key, value in raw_row.items():
                key = self._normalize_header(raw_key)
                if key:
                    row[key] = value
            rows.append(row)
        return rows

    def _build_import_payload(self, row):
        row = {self._normalize_header(key): value for key, value in row.items()}
        def get_val(key):
            return row.get(self._normalize_header(key), "")

        payload = {
            "reg_no": str(get_val("reg_no") or get_val("registration_number") or "").strip(),
            "first_name": str(get_val("first_name") or "").strip(),
            "last_name": str(get_val("last_name") or "").strip(),
            "middle_name": str(get_val("middle_name") or "").strip(),
            "date_of_birth": self._parse_date(get_val("date_of_birth")),
            "gender": self._normalize_gender(get_val("gender")),
            "blood_group": str(get_val("blood_group") or "").strip(),
            "religion": str(get_val("religion") or "").strip(),
            "state_of_origin": str(get_val("state_of_origin") or "").strip(),
            "residential_address": str(get_val("residential_address") or "").strip(),
            "is_orphan": self._parse_bool(get_val("is_orphan")),
            "student_type": self._normalize_student_type(get_val("student_type")),
            "admission_date": self._parse_date(get_val("admission_date")),
            "academic_session": str(get_val("academic_session") or "2026").strip(),
            "student_class_id": self._parse_student_class(get_val("student_class")),
            "previous_school": str(get_val("previous_school") or "").strip(),
            "previous_class": str(get_val("previous_class") or "").strip(),
            "status": self._normalize_status(get_val("status")),
            "fee_status": self._normalize_fee_status(get_val("fee_status")),
            "donor_id": self._parse_donor(get_val("donor")),
            "donor_number": str(get_val("donor_number") or "").strip(),
        }

        parent_name = str(get_val("parent_name") or "").strip()
        parent_phone = str(get_val("parent_phone") or "").strip()
        relationship = str(get_val("relationship") or "").strip()
        if parent_name or parent_phone or relationship:
            if not parent_name or not parent_phone or not relationship:
                raise ValidationError("Parent data must include name, phone, and relationship.")
            payload["parent"] = {
                "full_name": parent_name,
                "phone": parent_phone,
                "relationship": relationship,
                "email": str(get_val("parent_email") or "").strip(),
                "occupation": str(get_val("occupation") or "").strip(),
                "office_address": str(get_val("office_address") or "").strip(),
                "home_address": str(get_val("home_address") or "").strip(),
            }
            parent_user_id = get_val("parent_user_id")
            if str(parent_user_id).strip():
                try:
                    payload["parent_user_id"] = int(str(parent_user_id).strip())
                except ValueError:
                    raise ValidationError("parent_user_id must be an integer")

        if not payload["reg_no"]:
            raise ValidationError("reg_no is required")
        if not payload["first_name"]:
            raise ValidationError("first_name is required")
        if not payload["last_name"]:
            raise ValidationError("last_name is required")
        if not payload["date_of_birth"]:
            raise ValidationError("date_of_birth is required")
        if not payload["gender"]:
            raise ValidationError("gender is required")
        if not payload["admission_date"]:
            raise ValidationError("admission_date is required")

        return payload

    def _normalize_gender(self, value):
        if not value:
            return ""
        value_str = str(value).strip().lower()
        if value_str in ["male", "m"]:
            return "Male"
        if value_str in ["female", "f"]:
            return "Female"
        raise ValidationError(f"Gender must be Male or Female: {value}")

    def _normalize_student_type(self, value):
        if not value:
            return "Day"
        normalized = str(value).strip().lower()
        if normalized in ["day", "d"]:
            return "Day"
        if normalized in ["boarding", "b"]:
            return "Boarding"
        raise ValidationError(f"Student type must be Day or Boarding: {value}")

    def _normalize_status(self, value):
        if not value:
            return "active"
        normalized = str(value).strip().lower()
        if normalized in ["active"]:
            return "active"
        if normalized in ["suspended"]:
            return "suspended"
        if normalized in ["graduated"]:
            return "graduated"
        if normalized in ["withdrawn"]:
            return "withdrawn"
        raise ValidationError(f"Invalid status: {value}")

    def _normalize_fee_status(self, value):
        if not value:
            return "unpaid"
        normalized = str(value).strip().lower()
        if normalized in ["paid"]:
            return "paid"
        if normalized in ["partial"]:
            return "partial"
        if normalized in ["unpaid"]:
            return "unpaid"
        raise ValidationError(f"Invalid fee_status: {value}")

    @action(detail=False, methods=["post"], url_path="import-students")
    def import_students(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "Please upload a CSV or XLSX file."}, status=status.HTTP_400_BAD_REQUEST)

        if not file.name.lower().endswith((".csv", ".xlsx")):
            return Response({"detail": "Unsupported file format. Upload a .csv or .xlsx file."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows = self._parse_import_rows(file)
        except ValidationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({"detail": f"Failed to read import file: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

        created = 0
        errors = []
        for index, row in enumerate(rows, start=2):
            try:
                payload = self._build_import_payload(row)
                serializer = StudentCreateSerializer(data=payload)
                if serializer.is_valid():
                    with transaction.atomic():
                        serializer.save()
                    created += 1
                else:
                    errors.append({"row": index, "errors": serializer.errors})
            except ValidationError as exc:
                errors.append({"row": index, "errors": str(exc)})
            except Exception as exc:
                errors.append({"row": index, "errors": str(exc)})

        return Response({"created": created, "errors": errors}, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def upload_document(self, request, pk=None):
        """Upload student document - Only admins."""
        if get_user_role(request.user) not in ['super_admin', 'admin']:
            return Response(
                {"error": "Only administrators can upload documents."},
                status=status.HTTP_403_FORBIDDEN
            )
        student = self.get_object()
        serializer = StudentDocumentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(student=student)
        return Response(
            StudentDocumentSerializer(serializer.instance, context={"request": request}).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"])
    def promote(self, request, pk=None):
        """
        Move student to a new class. Supports all movement types:
          - promotion:     move up (e.g. Form 1 → Form 2)
          - stream_change: same level different section (e.g. Form 1A → Form 1B)
          - repetition:    stay in same class (fail / attendance)
          - demotion:      move down (parent/school decision)
        Records the movement in AcademicHistory.
        Only admins can perform this action.
        """
        student = self.get_object()
        new_class_id = request.data.get("new_class")
        movement_type = request.data.get("movement_type", "promotion")
        reason = request.data.get("reason", "")
        academic_session = request.data.get("academic_session", "")
        term = request.data.get("term", "")

        VALID_MOVEMENTS = ["promotion", "stream_change", "repetition", "demotion"]
        if movement_type not in VALID_MOVEMENTS:
            return Response({"error": f"movement_type must be one of: {', '.join(VALID_MOVEMENTS)}"}, status=400)

        if not new_class_id:
            return Response({"error": "new_class is required"}, status=400)

        from academics.models import Class
        from .models import AcademicHistory
        from core.models import SchoolSettings

        try:
            new_class = Class.objects.get(pk=new_class_id)
        except Class.DoesNotExist:
            return Response({"error": "Class not found"}, status=404)

        # Resolve session/term if not provided
        if not academic_session or not term:
            cfg = SchoolSettings.objects.first()
            academic_session = academic_session or (cfg.academic_session if cfg else "2026")
            term = term or (cfg.current_term if cfg else "Term 3")

        old_class_name = student.class_name

        # Record academic history before moving
        try:
            from exams.models import ExamResult
            result = ExamResult.objects.filter(
                student=student,
                academic_session=academic_session,
                term=term,
            ).first()
            AcademicHistory.objects.update_or_create(
                student=student,
                term=term,
                academic_session=academic_session,
                defaults={
                    "position": result.position if result else 0,
                    "average": result.average if result else 0,
                    "grade": result.grade if result else "",
                    "division": result.division if result else "",
                    "previous_class": old_class_name,
                    "new_class": new_class.name,
                    "movement_type": movement_type,
                    "reason": reason,
                },
            )
        except Exception:
            pass  # History recording is best-effort; never block the move

        # Perform the move
        student.student_class = new_class
        if movement_type == "repetition":
            student.status = "active"
        elif movement_type == "demotion":
            student.status = "active"
        student.save()

        return Response({
            "detail": f"Student moved to {new_class.name} ({movement_type})",
            **StudentDetailSerializer(student).data,
        })


class AcademicHistoryViewSet(viewsets.ModelViewSet):
    """
    Academic history per student - Admins manage, teachers/parents can read their own.
    """
    queryset = AcademicHistory.objects.select_related("student").all()
    serializer_class = AcademicHistorySerializer
    permission_classes = [IsTeacherOrAdminOrParentReadOnly]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["student", "term", "academic_session"]
    ordering_fields = ["academic_session", "term"]
    ordering = ["-academic_session", "term"]

    def get_queryset(self):
        user = self.request.user
        role = get_user_role(user)
        if role in ['super_admin', 'admin']:
            return AcademicHistory.objects.select_related("student").all()
        elif role == 'teacher':
            from academics.models import Teacher, Class, TeacherAssignment
            try:
                teacher = Teacher.objects.get(email=user.email)
                homeroom_ids = set(Class.objects.filter(class_teacher=teacher).values_list('id', flat=True))
                assigned_ids = set(TeacherAssignment.objects.filter(teacher=teacher, status='active').values_list('student_class_id', flat=True))
                all_ids = homeroom_ids | assigned_ids
                return AcademicHistory.objects.filter(
                    student__student_class_id__in=all_ids
                ).select_related("student")
            except Teacher.DoesNotExist:
                return AcademicHistory.objects.none()
        elif role == 'parent':
            return AcademicHistory.objects.filter(
                student__parent__user=user
            ).select_related("student")
        return AcademicHistory.objects.none()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdminOrAdmin()]
        return [IsTeacherOrAdminOrParentReadOnly()]
