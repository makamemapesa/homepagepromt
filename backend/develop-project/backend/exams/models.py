from django.db import models
from students.models import Student
from academics.models import Subject, Class


def _compute_grade(score: float, cfg=None) -> str:
    """
    Compute grade from a numeric score using the school's configured grade bands.
    Pass ``cfg`` (a SchoolSettings instance) to avoid repeated DB queries when
    computing many grades in a loop.
    """
    if cfg is None:
        from core.models import SchoolSettings
        cfg = SchoolSettings.objects.first()
    bands = (cfg.grade_bands or []) if cfg else []
    if bands:
        sorted_bands = sorted(bands, key=lambda x: float(x.get("min", 0)), reverse=True)
        for band in sorted_bands:
            if score >= float(band.get("min", 0)):
                return band.get("grade", "?")
        return sorted_bands[-1].get("grade", "F")
    a = cfg.grade_a if cfg else 75
    b = cfg.grade_b if cfg else 65
    c = cfg.grade_c if cfg else 55
    d = cfg.grade_d if cfg else 45
    if score >= a: return "A"
    if score >= b: return "B"
    if score >= c: return "C"
    if score >= d: return "D"
    return "F"


def _compute_division(average: float) -> str:
    """
    Compute Tanzanian academic division from average score.
    Division I:   >= 75
    Division II:  >= 60
    Division III: >= 45
    Division IV:  >= 30
    Division 0:    < 30  (Fail)
    """
    if average >= 75: return "I"
    if average >= 60: return "II"
    if average >= 45: return "III"
    if average >= 30: return "IV"
    return "0"


class ExamMark(models.Model):
    """Individual score for one student in one subject for a specific exam type."""

    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="exam_marks")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE)
    term = models.CharField(max_length=50, db_index=True)
    exam_type = models.CharField(max_length=50)
    academic_session = models.CharField(max_length=20, default="2026", db_index=True)
    score = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        ordering = ["student__last_name"]
        unique_together = ["student", "subject", "term", "exam_type", "academic_session"]

    def __str__(self):
        return f"{self.student} — {self.subject} — {self.exam_type} ({self.term}): {self.score}"

    @property
    def grade(self):
        return _compute_grade(float(self.score))


class ExamResult(models.Model):
    """Term-end aggregate result for a student."""
    STATUS_CHOICES = [("promoted", "Promoted"), ("repeat", "Repeat"), ("pending", "Pending")]
    DIVISION_CHOICES = [("I", "Division I"), ("II", "Division II"), ("III", "Division III"), ("IV", "Division IV"), ("0", "Fail")]

    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="exam_results")
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE)
    term = models.CharField(max_length=50)
    academic_session = models.CharField(max_length=20, default="2026")
    total = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    average = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    grade = models.CharField(max_length=5, blank=True)
    division = models.CharField(max_length=5, choices=DIVISION_CHOICES, blank=True, default="")
    position = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    teacher_comment = models.TextField(blank=True, default="")
    # When this report card was released to the student's parents. Empty means
    # it has not been sent, and that is what the parent portal filters on — an
    # unreleased result is invisible to the family it belongs to.
    released_at = models.DateTimeField(null=True, blank=True)
    released_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="released_exam_results",
    )

    class Meta:
        ordering = ["position"]
        unique_together = ["student", "term", "academic_session"]

    def __str__(self):
        return f"{self.student} — {self.term} {self.academic_session}: {self.average}"


class SubjectResult(models.Model):
    """Per-subject breakdown within an ExamResult (CA + Exam = Total)."""
    exam_result = models.ForeignKey(ExamResult, on_delete=models.CASCADE, related_name="subject_results")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    ca_score = models.DecimalField(max_digits=5, decimal_places=2, help_text="Out of 30")
    exam_score = models.DecimalField(max_digits=5, decimal_places=2, help_text="Out of 70")
    total = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    grade = models.CharField(max_length=5, blank=True)
    position = models.IntegerField(default=0)

    class Meta:
        unique_together = ["exam_result", "subject"]

    def save(self, *args, **kwargs):
        self.total = self.ca_score + self.exam_score
        self.grade = _compute_grade(float(self.total))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.exam_result.student} — {self.subject}: {self.total}"
