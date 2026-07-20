from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import IsTeacherOrAdmin, IsTeacherOrAdminOrParentReadOnly
from core.utils import get_user_role
from .models import ExamMark, ExamResult, SubjectResult, _compute_grade, _compute_division
from .serializers import ExamMarkSerializer, ExamResultSerializer, SubjectResultSerializer


class ExamMarkViewSet(viewsets.ModelViewSet):
    """
    Marks entry - Teachers can enter marks for their subjects, Admins manage all.
    Parents can view their children's marks only.
    Supports bulk upsert via POST /exam-marks/bulk_save/.
    """
    queryset = ExamMark.objects.select_related("student", "subject", "student_class").all()
    serializer_class = ExamMarkSerializer
    permission_classes = [IsTeacherOrAdminOrParentReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["student_class", "subject", "term", "exam_type", "academic_session"]

    def get_queryset(self):
        """Filter marks based on user role."""
        user = self.request.user
        role = get_user_role(user)

        if role in ['super_admin', 'admin']:
            return ExamMark.objects.select_related("student", "subject", "student_class").all()
        
        elif role == 'teacher':
            # Teachers see marks for classes they are homeroom or subject teacher of
            from academics.models import Teacher, Class, TeacherAssignment
            try:
                teacher = Teacher.objects.get(email=user.email)
                homeroom_ids = set(Class.objects.filter(class_teacher=teacher).values_list('id', flat=True))
                assigned_ids = set(TeacherAssignment.objects.filter(teacher=teacher, status='active').values_list('student_class_id', flat=True))
                class_ids = homeroom_ids | assigned_ids
                return ExamMark.objects.filter(
                    student_class_id__in=class_ids
                ).select_related("student", "subject", "student_class")
            except Teacher.DoesNotExist:
                return ExamMark.objects.none()
        
        elif role == 'parent':
            # Parents see only their children's marks
            from students.models import Student
            return ExamMark.objects.filter(
                student__parent__user=user
            ).select_related("student", "subject", "student_class")
        
        return ExamMark.objects.none()

    def get_permissions(self):
        """Teachers and admins can create/update marks."""
        if self.action in ['create', 'update', 'partial_update', 'bulk_save']:
            return [IsTeacherOrAdmin()]
        return [IsTeacherOrAdminOrParentReadOnly()]

    @action(detail=False, methods=["get"])
    def available_types(self, request):
        """
        Return distinct exam_type values for a given class/term/session.
        GET /api/exam-marks/available_types/?student_class=<id>&term=<str>&academic_session=<str>
        """
        class_id = request.query_params.get("student_class")
        term     = request.query_params.get("term")
        session  = request.query_params.get("academic_session")
        if not session:
            from core.models import SchoolSettings
            _cfg = SchoolSettings.objects.first()
            session = (_cfg.academic_session if _cfg else None) or "2026"
        qs = ExamMark.objects.all()
        if class_id:
            qs = qs.filter(student_class_id=class_id)
        if term:
            qs = qs.filter(term=term)
        if session:
            qs = qs.filter(academic_session=session)
        types = sorted(qs.values_list("exam_type", flat=True).distinct())
        return Response({"types": list(types)})

    @action(detail=False, methods=["post"])
    def bulk_save(self, request):
        """
        Accept a list of mark records and upsert them.
        Body: [{ student, subject, student_class, term, exam_type, academic_session, score }, ...]
        Teachers can only save marks for students in their assigned classes.
        """
        marks = request.data if isinstance(request.data, list) else request.data.get("marks", [])
        from core.models import SchoolSettings
        
        # Get teacher's allowed classes if user is a teacher
        user = request.user
        role = getattr(getattr(user, 'profile', None), 'role', None)
        allowed_classes = None
        
        if role == 'teacher':
            from academics.models import Teacher, Class, TeacherAssignment
            try:
                teacher = Teacher.objects.get(email=user.email)
                homeroom_ids = set(Class.objects.filter(class_teacher=teacher).values_list('id', flat=True))
                assigned_ids = set(TeacherAssignment.objects.filter(teacher=teacher, status='active').values_list('student_class_id', flat=True))
                allowed_classes = homeroom_ids | assigned_ids
                if not allowed_classes:
                    return Response({"error": "You are not assigned to any class."}, status=403)
            except Teacher.DoesNotExist:
                return Response({"error": "Teacher record not found."}, status=403)
        
        _cfg = SchoolSettings.objects.first()
        _default_session = (_cfg.academic_session if _cfg else None) or "2026"
        saved = []
        errors = []
        for item in marks:
            # Verify teacher has access to this class
            if allowed_classes is not None:
                student_class_id = item.get("student_class")
                try:
                    if int(student_class_id) not in allowed_classes:
                        errors.append({"student": item.get("student"), "error": "Access denied to this class"})
                        continue
                except (TypeError, ValueError):
                    errors.append({"student": item.get("student"), "error": "Invalid student_class value"})
                    continue
            
            serializer = ExamMarkSerializer(data=item)
            if serializer.is_valid():
                obj, _ = ExamMark.objects.update_or_create(
                    student_id=item["student"],
                    subject_id=item["subject"],
                    term=item["term"],
                    exam_type=item["exam_type"],
                    academic_session=item.get("academic_session") or _default_session,
                    defaults={
                        "score": item["score"],
                        "student_class_id": item["student_class"],
                    },
                )
                saved.append(ExamMarkSerializer(obj).data)
            else:
                errors.append(serializer.errors)
        return Response({"saved": len(saved), "errors": errors}, status=status.HTTP_200_OK)


class ExamResultViewSet(viewsets.ModelViewSet):
    """
    Term-end results - Admins and teachers manage, parents view their children's results.
    Supports report card view with nested subject results.
    """
    queryset = ExamResult.objects.select_related("student", "student_class").prefetch_related("subject_results__subject").all()
    serializer_class = ExamResultSerializer
    permission_classes = [IsTeacherOrAdminOrParentReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["student_class", "term", "academic_session", "grade", "status"]
    search_fields = ["student__first_name", "student__last_name", "student__reg_no"]
    ordering_fields = ["average", "total", "position", "student__last_name"]
    ordering = ["position"]

    def get_queryset(self):
        """Filter results based on user role."""
        user = self.request.user
        role = get_user_role(user)

        if role in ['super_admin', 'admin']:
            return ExamResult.objects.select_related("student", "student_class").prefetch_related(
                "subject_results__subject"
            ).all()
        
        elif role == 'teacher':
            # Teachers see results for classes they are homeroom or subject teacher of
            from academics.models import Teacher, Class, TeacherAssignment
            try:
                teacher = Teacher.objects.get(email=user.email)
                homeroom_ids = set(Class.objects.filter(class_teacher=teacher).values_list('id', flat=True))
                assigned_ids = set(TeacherAssignment.objects.filter(teacher=teacher, status='active').values_list('student_class_id', flat=True))
                class_ids = homeroom_ids | assigned_ids
                return ExamResult.objects.filter(
                    student_class_id__in=class_ids
                ).select_related("student", "student_class").prefetch_related(
                    "subject_results__subject"
                )
            except Teacher.DoesNotExist:
                return ExamResult.objects.none()
        
        elif role == 'parent':
            # Parents see only their children's results
            return ExamResult.objects.filter(
                student__parent__user=user
            ).select_related("student", "student_class").prefetch_related(
                "subject_results__subject"
            )
        
        return ExamResult.objects.none()

    def get_permissions(self):
        """Only admins and teachers can create/update results."""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'compute_results']:
            return [IsTeacherOrAdmin()]
        return [IsTeacherOrAdminOrParentReadOnly()]

    @action(detail=False, methods=["post"])
    def compute_results(self, request):
        """
        Compute (or recompute) ExamResult + SubjectResult rows from ExamMark data.
        Teachers can only compute results for their assigned classes.

        Body:
          student_class    : int   — class id
          term             : str
          academic_session : str   (default "2026")
          ca_types         : list  — exam_type strings counted as CA  ([] = use all)
          best_n           : int   — keep best N CA scores per student/subject  (0 = all)
          final_exam_type  : str   — exam_type counted as the final exam  (null/"" = none)
          ca_weight        : float — fraction assigned to CA portion  (default 0.30)

        Subject score formula (out of 100):
          • Both CA + Final:  subject_score = ca_avg_best_n * ca_weight + final_avg * (1-ca_weight)
          • CA only:          subject_score = ca_avg_best_n
          • Final only:       subject_score = final_avg
          • Neither set:      subject_score = mean of all marks for that subject
        """
        from collections import defaultdict
        from core.models import SchoolSettings

        class_id        = request.data.get("student_class")
        term            = request.data.get("term")

        # Validate required fields before any role check
        if not class_id or not term:
            return Response({"error": "student_class and term are required"}, status=400)

        # Verify teacher has access to this class
        user = request.user
        role = getattr(getattr(user, 'profile', None), 'role', None)
        
        if role == 'teacher':
            from academics.models import Teacher, Class, TeacherAssignment
            try:
                teacher = Teacher.objects.get(email=user.email)
                homeroom_ids = set(Class.objects.filter(class_teacher=teacher).values_list('id', flat=True))
                assigned_ids = set(TeacherAssignment.objects.filter(teacher=teacher, status='active').values_list('student_class_id', flat=True))
                teacher_class_ids = homeroom_ids | assigned_ids
                if int(class_id) not in teacher_class_ids:
                    return Response({"error": "Access denied. You can only compute results for your assigned classes."}, status=403)
            except Teacher.DoesNotExist:
                return Response({"error": "Teacher record not found."}, status=403)
        
        cfg = SchoolSettings.objects.first()
        _default_session = (cfg.academic_session if cfg else None) or "2026"
        session         = request.data.get("academic_session") or _default_session
        ca_types        = request.data.get("ca_types") or []
        best_n          = int(request.data.get("best_n") or 0)
        final_exam_type = (request.data.get("final_exam_type") or "").strip()
        ca_weight       = float(request.data.get("ca_weight") or 0.30)
        exam_weight     = 1.0 - ca_weight

        marks_qs = ExamMark.objects.filter(
            student_class_id=class_id,
            term=term,
            academic_session=session,
        ).select_related("student", "subject")

        if not marks_qs.exists():
            return Response(
                {"error": "No marks found for the selected class / term / session."},
                status=404,
            )

        # Determine passing threshold
        bands = (cfg.grade_bands or []) if cfg else []
        if bands:
            sorted_asc  = sorted(bands, key=lambda x: float(x.get("min", 0)))
            pass_threshold = float(sorted_asc[1]["min"]) if len(sorted_asc) > 1 else 0
        else:
            pass_threshold = float(cfg.grade_d) if cfg else 45.0

        # Group marks: student_id → subject_id → exam_type → [scores]
        student_map: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
        for mark in marks_qs:
            student_map[mark.student_id][mark.subject_id][mark.exam_type].append(float(mark.score))

        results_computed = 0

        for student_id, subject_map in student_map.items():
            exam_result, _ = ExamResult.objects.update_or_create(
                student_id=student_id,
                term=term,
                academic_session=session,
                defaults={"student_class_id": class_id},
            )

            subject_totals = []

            for subject_id, type_map in subject_map.items():

                # ── CA portion ──────────────────────────────────────
                if ca_types:
                    ca_raw = []
                    for t in ca_types:
                        scores = type_map.get(t, [])
                        if scores:
                            ca_raw.append(sum(scores) / len(scores))
                    # pick best N
                    ca_raw_sorted = sorted(ca_raw, reverse=True)
                    if best_n and best_n < len(ca_raw_sorted):
                        ca_raw_sorted = ca_raw_sorted[:best_n]
                    ca_avg = sum(ca_raw_sorted) / len(ca_raw_sorted) if ca_raw_sorted else 0
                else:
                    ca_avg = 0

                # ── Final exam portion ───────────────────────────────
                if final_exam_type:
                    final_scores = type_map.get(final_exam_type, [])
                    final_avg = sum(final_scores) / len(final_scores) if final_scores else 0
                else:
                    final_avg = 0

                # ── Subject score ────────────────────────────────────
                if ca_types and final_exam_type:
                    ca_s        = round(ca_avg * ca_weight, 2)
                    exam_s      = round(final_avg * exam_weight, 2)
                    subject_score = ca_s + exam_s
                elif ca_types:
                    subject_score = round(ca_avg, 2)
                    ca_s   = subject_score
                    exam_s = 0
                elif final_exam_type:
                    subject_score = round(final_avg, 2)
                    ca_s   = 0
                    exam_s = subject_score
                else:
                    # fallback: plain average of all marks
                    all_scores = [s for v in type_map.values() for s in v]
                    subject_score = round(sum(all_scores) / len(all_scores), 2) if all_scores else 0
                    ca_s   = round(subject_score * 0.30, 2)
                    exam_s = round(subject_score - ca_s, 2)

                # SubjectResult.save() recomputes total & grade automatically
                SubjectResult.objects.update_or_create(
                    exam_result=exam_result,
                    subject_id=subject_id,
                    defaults={"ca_score": ca_s, "exam_score": exam_s},
                )
                subject_totals.append(subject_score)

            if subject_totals:
                avg = round(sum(subject_totals) / len(subject_totals), 2)
                exam_result.total    = round(sum(subject_totals), 2)
                exam_result.average  = avg
                exam_result.grade    = _compute_grade(avg, cfg)
                exam_result.division = _compute_division(avg)
                exam_result.status   = "promoted" if avg >= pass_threshold else "repeat"
                exam_result.save(update_fields=["total", "average", "grade", "division", "status"])

            results_computed += 1

        # Rank students by average (descending)
        class_results = ExamResult.objects.filter(
            student_class_id=class_id,
            term=term,
            academic_session=session,
        ).order_by("-average")
        for pos, result in enumerate(class_results, start=1):
            result.position = pos
            result.save(update_fields=["position"])

        return Response(
            {"computed": results_computed, "term": term, "session": session},
            status=200,
        )
