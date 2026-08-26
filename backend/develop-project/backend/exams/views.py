from django.db import transaction
from django.db.models import Exists, OuterRef
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import CanReadExamRecords, IsTeacherOrAdmin
from core.utils import get_teacher_class_ids, get_teacher_for, get_user_role
from .models import ExamMark, ExamResult, SubjectResult, _compute_grade, _compute_division
from .serializers import ExamMarkSerializer, ExamResultSerializer, SubjectResultSerializer


def _rank_in_place(rows, key):
    """Assign standard competition ranks to ``rows``, already sorted best-first.

    Equal scores share a rank and the following row skips ahead — 90, 90, 50
    ranks as 1, 1, 3. Mutates ``row.position`` and returns the same list.
    """
    last_value = None
    last_rank = 0
    for index, row in enumerate(rows, start=1):
        value = key(row)
        if last_value is None or value != last_value:
            last_rank = index
            last_value = value
        row.position = last_rank
    return rows


class ExamMarkViewSet(viewsets.ModelViewSet):
    """
    Marks entry - Teachers can enter marks for their subjects, Admins manage all.
    Parents can view their children's marks only.
    Supports bulk upsert via POST /exam-marks/bulk_save/.
    """
    queryset = ExamMark.objects.select_related("student", "subject", "student_class").all()
    serializer_class = ExamMarkSerializer
    permission_classes = [CanReadExamRecords]
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
            class_ids = get_teacher_class_ids(get_teacher_for(user))
            return ExamMark.objects.filter(
                student_class_id__in=class_ids
            ).select_related("student", "subject", "student_class")

        elif role == 'accountant':
            # Read-only and unscoped: the bursar reconciles fees against every
            # class, so narrowing this would only hide half the ledger.
            return ExamMark.objects.select_related(
                "student", "subject", "student_class"
            ).all()
        
        elif role == 'parent':
            # Parents see their children's marks only for terms whose report card
            # has been released to them. The raw scores add up to the report, so
            # leaving them open would hand an unpaid family by another route
            # exactly what the fee gate on the report card holds back.
            released = ExamResult.objects.filter(
                student_id=OuterRef("student_id"),
                term=OuterRef("term"),
                academic_session=OuterRef("academic_session"),
                released_at__isnull=False,
            )
            return ExamMark.objects.filter(
                student__guardians__user=user
            ).filter(Exists(released)).select_related(
                "student", "subject", "student_class"
            ).distinct()
        
        return ExamMark.objects.none()

    def get_permissions(self):
        """Teachers and admins can create/update marks."""
        if self.action in ['create', 'update', 'partial_update', 'bulk_save']:
            return [IsTeacherOrAdmin()]
        return [CanReadExamRecords()]

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
        # .order_by() clears ExamMark's Meta ordering — otherwise Django adds the
        # ordering column to the SELECT and DISTINCT stops collapsing duplicates,
        # returning the same exam type once per mark.
        types = sorted(qs.order_by().values_list("exam_type", flat=True).distinct())
        return Response({"types": list(types)})

    @action(detail=False, methods=["post"])
    def bulk_save(self, request):
        """
        Accept a list of mark records and upsert them.
        Body: [{ student, subject, student_class, term, exam_type, academic_session, score }, ...]
        Teachers can only save marks for students in their assigned classes.

        Returns ``{"saved": n, "errors": [...]}``. A non-empty ``errors`` list means
        some rows were rejected — the caller must surface it rather than assume the
        whole batch landed.
        """
        marks = request.data if isinstance(request.data, list) else request.data.get("marks", [])
        if not isinstance(marks, list):
            return Response({"error": "Expected a list of marks."}, status=400)
        from core.models import SchoolSettings

        # Get teacher's allowed classes if user is a teacher
        user = request.user
        role = get_user_role(user)
        allowed_classes = None

        if role == 'teacher':
            allowed_classes = get_teacher_class_ids(get_teacher_for(user))
            if not allowed_classes:
                return Response(
                    {"error": "You are not assigned to any class. Ask an administrator to assign you one."},
                    status=403,
                )

        _cfg = SchoolSettings.objects.first()
        _default_session = (_cfg.academic_session if _cfg else None) or "2026"
        saved = 0
        errors = []
        with transaction.atomic():
            for item in marks:
                if not isinstance(item, dict):
                    errors.append({"error": "Each mark must be an object."})
                    continue
                item = dict(item)
                item.setdefault("academic_session", _default_session)
                if not item.get("academic_session"):
                    item["academic_session"] = _default_session

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

                # Re-saving a mark is a correction, not a duplicate. Handing the
                # existing row to the serializer as ``instance`` is what stops
                # unique_together from rejecting the very edit the user asked for —
                # without it every correction was silently dropped into ``errors``
                # while the screen still reported "Saved".
                existing = ExamMark.objects.filter(
                    student_id=item.get("student"),
                    subject_id=item.get("subject"),
                    term=(item.get("term") or "").strip(),
                    exam_type=(item.get("exam_type") or "").strip(),
                    academic_session=(item.get("academic_session") or "").strip(),
                ).first()

                serializer = ExamMarkSerializer(instance=existing, data=item)
                if serializer.is_valid():
                    serializer.save()
                    saved += 1
                else:
                    errors.append(serializer.errors)

            # An all-or-nothing batch is the wrong trade here (one bad row would
            # discard a whole class), but a batch where *nothing* landed is a
            # failure the caller should see as one.
            if saved == 0 and errors:
                transaction.set_rollback(True)
                return Response({"saved": 0, "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"saved": saved, "errors": errors}, status=status.HTTP_200_OK)


class ExamResultViewSet(viewsets.ModelViewSet):
    """
    Term-end results - Admins and teachers manage, parents view their children's results.
    Supports report card view with nested subject results.
    """
    queryset = ExamResult.objects.select_related("student", "student_class").prefetch_related("subject_results__subject").all()
    serializer_class = ExamResultSerializer
    permission_classes = [CanReadExamRecords]
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
            class_ids = get_teacher_class_ids(get_teacher_for(user))
            return ExamResult.objects.filter(
                student_class_id__in=class_ids
            ).select_related("student", "student_class").prefetch_related(
                "subject_results__subject"
            )

        elif role == 'accountant':
            # Every result, read-only. Unlike a parent this is not gated on
            # release: the accountant is the one who confirms the payment that
            # releases it, so they must see what is waiting.
            return ExamResult.objects.select_related(
                "student", "student_class"
            ).prefetch_related("subject_results__subject").all()
        
        elif role == 'parent':
            # Parents see only their children's results, and only once the school
            # has actually released them. Without the released_at filter the fee
            # gate on the Report Cards screen is decoration: a parent could read
            # the whole report straight off /api/exam-results/ regardless.
            return ExamResult.objects.filter(
                student__guardians__user=user,
                released_at__isnull=False,
            ).select_related("student", "student_class").prefetch_related(
                "subject_results__subject"
            ).distinct()
        
        return ExamResult.objects.none()

    def get_permissions(self):
        """Only admins and teachers can create/update results."""
        if self.action in ['create', 'update', 'partial_update', 'destroy',
                           'compute_results', 'send_to_parents']:
            return [IsTeacherOrAdmin()]
        return [CanReadExamRecords()]

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
        role = get_user_role(user)

        if role == 'teacher':
            if int(class_id) not in get_teacher_class_ids(get_teacher_for(user)):
                return Response({"error": "Access denied. You can only compute results for your assigned classes."}, status=403)

        cfg = SchoolSettings.objects.first()
        _default_session = (cfg.academic_session if cfg else None) or "2026"
        term            = term.strip()
        session         = (request.data.get("academic_session") or _default_session).strip()
        ca_types        = [str(t).strip() for t in (request.data.get("ca_types") or []) if str(t).strip()]
        final_exam_type = (request.data.get("final_exam_type") or "").strip()

        # A bad weight or a negative "best N" silently produced nonsense results
        # (negative exam weight, empty CA slice) instead of telling anyone.
        try:
            best_n = int(request.data.get("best_n") or 0)
            ca_weight = float(request.data.get("ca_weight") if request.data.get("ca_weight") is not None else 0.30)
        except (TypeError, ValueError):
            return Response({"error": "best_n must be a whole number and ca_weight a number."}, status=400)
        if best_n < 0:
            return Response({"error": "best_n cannot be negative."}, status=400)
        if not 0.0 <= ca_weight <= 1.0:
            return Response({"error": "ca_weight must be between 0 and 1."}, status=400)
        if final_exam_type and final_exam_type in ca_types:
            return Response(
                {"error": "The final exam type cannot also be counted as a CA assessment."},
                status=400,
            )
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
            # The band above the fail band is the pass mark.
            pass_threshold = float(sorted_asc[1].get("min", 0)) if len(sorted_asc) > 1 else 0
        else:
            pass_threshold = float(cfg.grade_d) if cfg else 45.0

        # Group marks: student_id → subject_id → exam_type → [scores]
        student_map: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
        for mark in marks_qs:
            student_map[mark.student_id][mark.subject_id][mark.exam_type].append(float(mark.score))

        results_computed = 0

        with transaction.atomic():
            for student_id, subject_map in student_map.items():
                exam_result, _ = ExamResult.objects.update_or_create(
                    student_id=student_id,
                    term=term,
                    academic_session=session,
                    defaults={"student_class_id": class_id},
                )

                subject_totals = []
                scored_subject_ids = set()

                for subject_id, type_map in subject_map.items():

                    # ── CA portion ──────────────────────────────────────
                    ca_raw = []
                    if ca_types:
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
                    final_scores = type_map.get(final_exam_type, []) if final_exam_type else []
                    final_avg = sum(final_scores) / len(final_scores) if final_scores else 0

                    # A subject the student sat none of the selected assessments in
                    # was not assessed under this configuration. Recording it as a
                    # zero would drag the average down for an exam that was never
                    # part of the scheme, so leave it out entirely.
                    if ca_types or final_exam_type:
                        if not ca_raw and not final_scores:
                            continue

                    # ── Subject score ────────────────────────────────────
                    if ca_types and final_exam_type:
                        ca_s        = round(ca_avg * ca_weight, 2)
                        exam_s      = round(final_avg * exam_weight, 2)
                        subject_score = round(ca_s + exam_s, 2)
                    elif ca_types:
                        subject_score = round(ca_avg, 2)
                        ca_s   = subject_score
                        exam_s = 0
                    elif final_exam_type:
                        subject_score = round(final_avg, 2)
                        ca_s   = 0
                        exam_s = subject_score
                    else:
                        # fallback: plain average of all marks, split along the
                        # configured weighting so ca + exam still add up to it
                        all_scores = [s for v in type_map.values() for s in v]
                        if not all_scores:
                            continue
                        subject_score = round(sum(all_scores) / len(all_scores), 2)
                        ca_s   = round(subject_score * ca_weight, 2)
                        exam_s = round(subject_score - ca_s, 2)

                    # SubjectResult.save() recomputes total & grade automatically
                    SubjectResult.objects.update_or_create(
                        exam_result=exam_result,
                        subject_id=subject_id,
                        defaults={"ca_score": ca_s, "exam_score": exam_s},
                    )
                    subject_totals.append(subject_score)
                    scored_subject_ids.add(subject_id)

                # Drop subject rows left over from a previous run — marks deleted
                # since, or a subject that no longer qualifies under this scheme.
                # Without this the report card kept showing a stale breakdown that
                # no longer added up to the average beside it.
                exam_result.subject_results.exclude(subject_id__in=scored_subject_ids).delete()

                if subject_totals:
                    avg = round(sum(subject_totals) / len(subject_totals), 2)
                    exam_result.total    = round(sum(subject_totals), 2)
                    exam_result.average  = avg
                    exam_result.grade    = _compute_grade(avg, cfg)
                    exam_result.division = _compute_division(avg)
                    exam_result.status   = "promoted" if avg >= pass_threshold else "repeat"
                    results_computed += 1
                else:
                    exam_result.total    = 0
                    exam_result.average  = 0
                    exam_result.grade    = ""
                    exam_result.division = ""
                    exam_result.status   = "pending"
                exam_result.save(update_fields=["total", "average", "grade", "division", "status"])

            # Students whose marks are gone should not keep last run's result.
            # Scoped to this class/term/session so other classes are untouched.
            ExamResult.objects.filter(
                student_class_id=class_id, term=term, academic_session=session,
            ).exclude(student_id__in=student_map.keys()).delete()

            # Rank students by average (descending). Equal averages share a
            # position and the next student takes the place after the tie
            # (90, 90, 50 → 1st, 1st, 3rd), rather than an arbitrary 1/2/3 split.
            class_results = list(
                ExamResult.objects.filter(
                    student_class_id=class_id, term=term, academic_session=session,
                ).order_by("-average", "student__last_name", "student__first_name")
            )
            _rank_in_place(class_results, key=lambda r: r.average)
            ExamResult.objects.bulk_update(class_results, ["position"])

            # Per-subject position within the class — shown on the report card and
            # previously left at 0 for every student.
            subject_rows = defaultdict(list)
            for row in SubjectResult.objects.filter(exam_result__in=class_results).order_by("-total"):
                subject_rows[row.subject_id].append(row)
            ranked_rows = []
            for rows in subject_rows.values():
                _rank_in_place(rows, key=lambda r: r.total)
                ranked_rows.extend(rows)
            if ranked_rows:
                SubjectResult.objects.bulk_update(ranked_rows, ["position"])

        return Response(
            {"computed": results_computed, "term": term, "session": session},
            status=200,
        )

    @action(detail=False, methods=["post"])
    def send_to_parents(self, request):
        """
        Release computed report cards to the parents of a class, for the parents
        of students whose fees for the term are settled.

        Body:
          student_class    : int | "all" — class id, or every class in scope
          term             : str
          academic_session : str  (defaults to the school's current session)
          student_ids      : list — optional, narrows the send to these students
          resend           : bool — re-send report cards already sent (default false)
          override_fees    : bool — release even where fees are outstanding
          override_reason  : str  — why the waiver was granted, recorded on the result

        ``override_fees`` is the deliberate exception to the fee gate: a head
        teacher waiving it for a sponsored pupil, a hardship case, or a family
        whose payment is genuinely in transit. Administrators only — a teacher
        cannot see the ledger, so they are in no position to forgive it.

        Releasing a report does two things: it stamps ``released_at``, which is
        what makes the report visible in the parent portal at all, and it drops a
        notification into each linked guardian's account.

        Returns ``{"sent": n, "notified": m, "skipped": [...]}``. Every student who
        did not receive their report appears in ``skipped`` with the reason, so an
        empty send is never mistaken for a successful one.
        """
        from django.utils import timezone

        from core.models import Notification, SchoolSettings
        from fees.services import term_fee_clearance

        class_id = request.data.get("student_class")
        term     = request.data.get("term")
        if not class_id or not term:
            return Response({"error": "student_class and term are required"}, status=400)

        cfg = SchoolSettings.objects.first()
        term    = str(term).strip()
        session = (request.data.get("academic_session")
                   or (cfg.academic_session if cfg else None) or "2026").strip()
        resend  = bool(request.data.get("resend"))
        override_fees = bool(request.data.get("override_fees"))
        override_reason = (request.data.get("override_reason") or "").strip()

        student_ids = request.data.get("student_ids")
        if student_ids is not None and not isinstance(student_ids, list):
            return Response({"error": "student_ids must be a list of student ids."}, status=400)

        user = request.user
        role = get_user_role(user)

        if override_fees and role not in ('super_admin', 'admin'):
            return Response(
                {"error": "Only an administrator can release a report card while fees are "
                          "outstanding."},
                status=403,
            )

        allowed_classes = None
        if role == 'teacher':
            allowed_classes = get_teacher_class_ids(get_teacher_for(user))
            if not allowed_classes:
                return Response(
                    {"error": "You are not assigned to any class. Ask an administrator to assign you one."},
                    status=403,
                )

        results = ExamResult.objects.filter(term=term, academic_session=session)
        if str(class_id).lower() == "all":
            # "All classes" still means all the classes *this user* is responsible
            # for, so a teacher cannot release another year group's reports.
            if allowed_classes is not None:
                results = results.filter(student_class_id__in=allowed_classes)
        else:
            try:
                class_id = int(class_id)
            except (TypeError, ValueError):
                return Response({"error": "student_class must be a class id or \"all\"."}, status=400)
            if allowed_classes is not None and class_id not in allowed_classes:
                return Response(
                    {"error": "Access denied. You can only send report cards for your assigned classes."},
                    status=403,
                )
            results = results.filter(student_class_id=class_id)

        if student_ids is not None:
            results = results.filter(student_id__in=student_ids)

        results = list(
            results.select_related("student", "student_class")
            .prefetch_related("subject_results", "student__guardians__user")
        )
        if not results:
            return Response(
                {"error": "No results found for the selected class / term / session. Compute results first."},
                status=404,
            )

        clearance = term_fee_clearance([r.student_id for r in results], term)

        school_name = (cfg.school_name if cfg else None) or "The school"
        now = timezone.now()
        released = []
        waived = []
        notifications = []
        skipped = []

        def skip(result, reason):
            skipped.append({
                "student": result.student_id,
                "studentName": result.student.full_name,
                "regNo": result.student.reg_no,
                "reason": reason,
            })

        for result in results:
            if not result.subject_results.all():
                skip(result, "No computed result yet — run Compute Results for this class first.")
                continue

            if result.released_at and not resend:
                skip(result, f"Already sent on {timezone.localtime(result.released_at).strftime('%d %b %Y')}.")
                continue

            cleared, reason = clearance[result.student_id]
            if not cleared and not override_fees:
                skip(result, reason)
                continue

            guardian_users = [g.user for g in result.student.guardians.all() if g.user_id]
            if not guardian_users:
                skip(result, "No parent portal account is linked to this student.")
                continue

            result.released_at = now
            result.released_by = user
            if not cleared:
                # Only stamp the waiver on the students it was actually needed
                # for, so a class-wide override does not mark paid-up families
                # as having been let off.
                result.fee_override = True
                result.fee_override_reason = override_reason
                waived.append(result)
            released.append(result)

            position = f"position {result.position} of {result.student_class.name}" if result.position else "position not ranked"
            for guardian_user in guardian_users:
                notifications.append(Notification(
                    recipient=guardian_user,
                    title=f"Report card available — {term}",
                    message=(
                        f"{result.student.full_name}'s report card for {term} is now available in "
                        f"the parent portal. Average {result.average}%, grade {result.grade or '—'}, "
                        f"{position}. — {school_name}"
                    ),
                    type="success",
                ))

        with transaction.atomic():
            if released:
                ExamResult.objects.bulk_update(
                    released,
                    ["released_at", "released_by", "fee_override", "fee_override_reason"],
                )
            if notifications:
                Notification.objects.bulk_create(notifications)
            if waived:
                # The middleware logs the send itself; a waiver is a policy
                # exception on top of it and is worth naming the pupils in, so
                # the bursar can see exactly who was let through and why.
                from core.models import AuditLog

                names = ", ".join(r.student.full_name for r in waived)
                AuditLog.objects.create(
                    user=user,
                    action="UPDATE",
                    module="Exams",
                    detail=(
                        f"Released {len(waived)} report card(s) for {term} despite unpaid fees: "
                        f"{names}." + (f" Reason: {override_reason}" if override_reason else
                                       " No reason given.")
                    ),
                    status="success",
                )

        return Response(
            {
                "sent": len(released),
                "notified": len(notifications),
                # How many of those went out on a waiver, so the screen can say
                # so rather than reporting a plain success.
                "waived": len(waived),
                "skipped": skipped,
                "term": term,
                "session": session,
            },
            status=200,
        )
