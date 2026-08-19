# AL NAMAA ACADEMY — School Management System

Django REST backend + Next.js frontend: a public school website plus a role-based
admin portal covering students, academics, exams, fees, donors and admissions.

```
homepagepromt/
├── backend/develop-project/backend/   ← Django project (manage.py lives here)
└── frontend/frontend-project/         ← Next.js app
```

---

## Requirements

| | Version | Note |
|---|---|---|
| Python | **3.10 or newer** | 3.8 will not work — its bundled SQLite lacks the JSON1 extension the app's JSON fields need, and `Pillow` no longer builds for it |
| Node.js | 20.9 or newer | Next.js 16 requirement |

---

## Running it

### 1. Backend — http://localhost:8000

```bash
cd backend/develop-project/backend

python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

pip install -r requirements.txt

copy .env.example .env         # then set a real SECRET_KEY
python manage.py migrate
python manage.py seed_data     # demo data + the logins below
python manage.py runserver
```

### 2. Frontend — http://localhost:3000

```bash
cd frontend/frontend-project

pnpm install                   # or npm install

# point the app at the API
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local

pnpm dev
```

Open **http://localhost:3000**, then sign in at **/login**.

---

## Demo logins (created by `seed_data`)

| Email | Password | Role | Can do |
|---|---|---|---|
| admin@farukaktas.edu | admin123 | Super Admin | Everything, incl. user management, audit log, imports |
| zawadi@farukaktas.edu | admin123 | Admin | Students, academics, exams, fees, content |
| jhassan@farukaktas.edu | teacher123 | Teacher | Marks and results **for their own classes only** |
| omari@farukaktas.edu | accountant123 | Accountant | Fees and payments |

Parents get a login from **User Management → Parents awaiting login**.

> These are demo credentials for local use. Change them before exposing this anywhere.

---

## Entering marks and results

1. **Dashboard → Examinations → Marks Entry**
   - Pick the **class**, **subject**, **term** and **exam type** (e.g. `Midterm`, `Final Exam`).
     Exam type is free text — whatever you type becomes a reusable type for that term.
   - Enter a score out of 100 per student, then **Save Marks**.
   - Repeat for each exam type you assess (a CA/midterm and a final, typically), and for each subject.

2. **Dashboard → Examinations → Results**
   - Pick the class and term. The exam types you entered appear as checkboxes.
   - Tick which types count as **continuous assessment**, choose the **final exam** type,
     set the **CA weight** (default 30% CA / 70% final) and optionally **best N** of the CA scores.
   - **Compute Results** — this produces, per student: a per-subject CA/exam/total breakdown,
     an overall total and average, a letter grade, a Tanzanian division (I–IV/0),
     a class position, and a promoted/repeat status.

3. **Report Cards** shows the per-subject breakdown and takes a teacher's comment.
   **Merit List** ranks the class by position.

Recomputing is safe — it overwrites the results for that class/term/session rather than duplicating them.

Grade boundaries are configurable under **Settings → Academic**; timetable periods under
**Academics → Timetable → Edit Periods**.

---

## Useful management commands

```bash
python manage.py seed_data     # (re)load demo data — safe to re-run
python manage.py sync_roles    # reconcile portal roles with teacher/guardian records
python manage.py createsuperuser
python manage.py test          # 61 tests
```

---

## Notes

- The database is SQLite at `backend/develop-project/backend/db.sqlite3`. Delete it and
  re-run `migrate` + `seed_data` for a clean slate.
- Uploaded files (photos, documents, homepage media) go to `backend/.../media/`.
- `.env`, `db.sqlite3`, `media/` and `logs/` are gitignored — none of them are shared.
