# FISS School Management System — Django Backend

REST API backend for the FISS Next.js frontend. Mirrors every page in the frontend exactly.

## Tech Stack
- **Django 4.2** + **Django REST Framework 3.15**
- **SQLite** (dev) / **PostgreSQL** (prod)
- **JWT auth** via `djangorestframework-simplejwt`
- **CORS** via `django-cors-headers`

---

## Quick Start

### 1. Create virtual environment
```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure environment
```bash
copy .env.example .env
# Edit .env if needed (SECRET_KEY, DATABASE_URL, etc.)
```

### 4. Run migrations
```bash
python manage.py migrate
```

### 5. Seed with mock data (matches mock-data.ts exactly)
```bash
python manage.py seed_data
```

### 6. Start the server
```bash
python manage.py runserver
```

API is now available at **http://localhost:8000/api/**

---

## Default Login Credentials (after seed_data)

| Email | Password | Role |
|---|---|---|
| admin@farukaktas.edu | admin123 | Super Admin |
| zawadi@farukaktas.edu | admin123 | Admin |
| jhassan@farukaktas.edu | teacher123 | Teacher |
| omari@farukaktas.edu | accountant123 | Accountant |

---

## API Endpoints

### Auth
| Method | URL | Description |
|---|---|---|
| POST | `/api/auth/token/` | Login — returns `access` + `refresh` JWT tokens |
| POST | `/api/auth/token/refresh/` | Refresh access token |

### Dashboard
| Method | URL | Description |
|---|---|---|
| GET | `/api/dashboard/stats/` | Summary counts (students, teachers, revenue) |

### Students
| Method | URL | Description |
|---|---|---|
| GET | `/api/students/` | List all students (filterable by status, fee_status, class) |
| POST | `/api/students/` | Register new student (with nested parent data) |
| GET | `/api/students/{id}/` | Student detail with parent, documents, academic history |
| PATCH | `/api/students/{id}/` | Update student |
| DELETE | `/api/students/{id}/` | Delete student |
| POST | `/api/students/{id}/promote/` | Promote to new class `{ new_class: id }` |
| POST | `/api/students/{id}/upload_document/` | Upload document file |

**Filters:** `?status=active`, `?fee_status=paid`, `?is_orphan=true`  
**Search:** `?search=amina` (name, reg_no, class name)

### Academics
| Method | URL | Description |
|---|---|---|
| GET/POST | `/api/classes/` | List / create classes |
| GET/PATCH/DELETE | `/api/classes/{id}/` | Class detail |
| GET/POST | `/api/subjects/` | List / create subjects |
| GET/PATCH/DELETE | `/api/subjects/{id}/` | Subject detail |
| GET/POST | `/api/teachers/` | List / create teachers |
| GET/PATCH/DELETE | `/api/teachers/{id}/` | Teacher detail |
| GET/POST | `/api/teacher-assignments/` | List / create assignments |
| DELETE | `/api/teacher-assignments/{id}/` | Remove assignment |
| GET/POST | `/api/timetable/` | List (filter by `?student_class=&day=`) / add slot |
| GET/POST | `/api/attendance/` | List / record attendance |
| GET/POST | `/api/lesson-plans/` | List / create lesson plans |
| PATCH/DELETE | `/api/lesson-plans/{id}/` | Update / delete |
| GET/POST | `/api/academic-calendar/` | List / create calendar events |

### Exams
| Method | URL | Description |
|---|---|---|
| GET | `/api/exam-marks/` | List marks (filter by class/subject/term/exam_type) |
| POST | `/api/exam-marks/bulk_save/` | Bulk upsert marks array |
| GET | `/api/exam-results/` | Results (filter by class/term/grade) with subject breakdown |
| POST | `/api/exam-results/` | Create term result with subject results |

### Fees
| Method | URL | Description |
|---|---|---|
| GET | `/api/fees/structure/` | Fee structure per class level |
| PATCH | `/api/fees/structure/{id}/` | Update fees |
| GET | `/api/fees/payments/` | All payments (filterable/searchable) |
| POST | `/api/fees/payments/` | Record new payment |
| GET | `/api/fees/outstanding/` | Students with outstanding balances (computed) |

### Donors
| Method | URL | Description |
|---|---|---|
| GET/POST | `/api/donors/` | List / create donors |
| GET/PATCH/DELETE | `/api/donors/{id}/` | Donor detail |

### Users & Notifications
| Method | URL | Description |
|---|---|---|
| GET/POST | `/api/users/` | List / create users |
| PATCH/DELETE | `/api/users/{id}/` | Update / delete |
| GET | `/api/users/me/` | Current logged-in user |
| GET | `/api/notifications/` | All notifications |
| PATCH | `/api/notifications/{id}/mark_read/` | Mark single as read |
| POST | `/api/notifications/mark_all_read/` | Mark all read |
| DELETE | `/api/notifications/clear_all/` | Clear all |
| GET | `/api/audit/` | Audit log (read-only) |
| GET/PATCH | `/api/settings/` | School settings |

---

## Connecting the Next.js Frontend

In your Next.js project, replace `lib/mock-data.ts` imports with API calls.
Add to your `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Use the JWT token from `/api/auth/token/` in the `Authorization: Bearer <token>` header for all requests.

---

## Django Admin
Available at **http://localhost:8000/admin/** — login with the super admin credentials above.

backend/
├── manage.py
├── requirements.txt
├── .env.example
├── README.md
├── school_backend/     ← Django project config
├── core/               ← Users, settings, notifications, audit log
├── students/           ← Students, parents, documents, academic history
├── academics/          ← Classes, subjects, teachers, assignments, timetable, attendance, lesson plans
├── exams/              ← Marks entry, exam results, subject breakdown (CA + Exam)
├── fees/               ← Payments, fee structure, outstanding calculator
└── donors/             ← Donor management
