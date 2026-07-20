from django.db import models


class Subject(models.Model):
    TYPE_CHOICES = [("core", "Core"), ("elective", "Elective")]
    STATUS_CHOICES = [("active", "Active"), ("inactive", "Inactive")]

    name = models.CharField(max_length=200, unique=True)
    code = models.CharField(max_length=10, unique=True)
    department = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="core")
    credit_units = models.IntegerField(default=2)
    description = models.TextField(blank=True)
    # e.g. ["JSS 1", "JSS 2", "SS 1"]
    classes_offered = models.JSONField(default=list)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Teacher(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("on_leave", "On Leave"),
        ("inactive", "Inactive"),
    ]
    GENDER_CHOICES = [("Male", "Male"), ("Female", "Female")]

    name = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    qualification = models.CharField(max_length=200, blank=True)
    join_date = models.DateField(null=True, blank=True)
    department = models.CharField(max_length=100, blank=True)
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    years_of_experience = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    subjects = models.ManyToManyField(Subject, blank=True, related_name="teachers")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Class(models.Model):
    STATUS_CHOICES = [("active", "Active"), ("inactive", "Inactive")]

    name = models.CharField(max_length=50, unique=True)
    section = models.CharField(max_length=50)
    level = models.CharField(max_length=20, help_text="e.g. Std 1, Form 2")
    arm = models.CharField(max_length=5, help_text="e.g. A, B, C")
    capacity = models.IntegerField(default=40)
    room = models.CharField(max_length=100, blank=True)
    class_teacher = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="class_teacher_of",
    )
    subjects = models.ManyToManyField(Subject, blank=True, related_name="classes")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    class Meta:
        ordering = ["section", "level", "arm"]
        verbose_name_plural = "Classes"

    def __str__(self):
        return self.name

    @property
    def student_count(self):
        return self.students.filter(status="active").count()


class TeacherAssignment(models.Model):
    STATUS_CHOICES = [("active", "Active"), ("inactive", "Inactive")]

    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name="assignments")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    class Meta:
        unique_together = ["teacher", "subject", "student_class"]
        ordering = ["student_class", "subject"]

    def __str__(self):
        return f"{self.teacher} — {self.subject} — {self.student_class}"


class Timetable(models.Model):
    DAY_CHOICES = [
        ("Monday", "Monday"),
        ("Tuesday", "Tuesday"),
        ("Wednesday", "Wednesday"),
        ("Thursday", "Thursday"),
        ("Friday", "Friday"),
    ]

    day = models.CharField(max_length=10, choices=DAY_CHOICES)
    period = models.IntegerField()
    time = models.CharField(max_length=20, help_text="e.g. 8:00 - 8:45")
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE, related_name="timetable_slots")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True)
    room = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["day", "period"]
        unique_together = ["day", "period", "student_class"]

    def __str__(self):
        return f"{self.student_class} — {self.day} P{self.period} — {self.subject}"


class Attendance(models.Model):
    date = models.DateField()
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE, related_name="attendance_records")
    present = models.IntegerField(default=0)
    absent = models.IntegerField(default=0)
    late = models.IntegerField(default=0)

    class Meta:
        ordering = ["-date"]
        unique_together = ["date", "student_class"]

    def __str__(self):
        return f"{self.student_class} — {self.date}"

    @property
    def total_students(self):
        return self.present + self.absent

    @property
    def attendance_rate(self):
        total = self.total_students
        return round((self.present / total) * 100, 1) if total > 0 else 0


class StudentAttendance(models.Model):
    STATUS_CHOICES = [
        ("present", "Present"),
        ("absent", "Absent"),
        ("late", "Late"),
    ]
    date = models.DateField()
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    student_class = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name="student_attendance_records",
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="present")
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-date", "student__last_name", "student__first_name"]
        unique_together = ["date", "student"]

    def __str__(self):
        return f"{self.student.full_name} — {self.date} — {self.status}"


class TeacherAttendance(models.Model):
    STATUS_CHOICES = [
        ("present", "Present"),
        ("absent", "Absent"),
        ("late", "Late"),
        ("on_leave", "On Leave"),
    ]
    date = models.DateField()
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="present")
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-date", "teacher__name"]
        unique_together = ["date", "teacher"]

    def __str__(self):
        return f"{self.teacher.name} — {self.date} — {self.status}"


class LessonPlan(models.Model):
    STATUS_CHOICES = [
        ("upcoming", "Upcoming"),
        ("completed", "Completed"),
        ("draft", "Draft"),
    ]

    topic = models.CharField(max_length=200)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE)
    week = models.CharField(max_length=20, help_text="e.g. Week 5")
    date = models.DateField()
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="upcoming")
    objectives = models.TextField(blank=True)
    resources = models.TextField(blank=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.topic} — {self.subject} — {self.student_class}"


class AcademicCalendar(models.Model):
    EVENT_TYPE_CHOICES = [
        ("term", "Term"),
        ("break", "Break"),
        ("exam", "Exam"),
        ("event", "Event"),
        ("holiday", "Holiday"),
    ]

    event = models.CharField(max_length=200)
    date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"{self.event} ({self.date})"
