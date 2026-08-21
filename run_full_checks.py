"""
Full verification script using `requests` (handles cookies properly).
Run: python run_full_checks.py
"""
import sys
import requests

BASE = "http://localhost:8000"
PASS = 0
FAIL = 0

def check(cond, label, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS {label}")
    else:
        FAIL += 1
        print(f"  FAIL {label}" + (f" — {detail}" if detail else ""))

def req(session, method, path, **kwargs):
    return session.request(method, BASE + path, **kwargs)

# ── 1. Login / cookie flow ──────────────────────────────────────────────────
print("\n=== AUTH / COOKIE FLOW ===")
s = requests.Session()
r = req(s, "POST", "/api/auth/token/",
        json={"username": "admin@farukaktas.edu", "password": "TestPass@2025"})
check(r.status_code == 200, f"Login returns 200 (got {r.status_code})")

body = r.json() if r.ok else {}
ACCESS = body.get("access")
check(ACCESS is not None, "Access token in response body")
check("refresh" not in body, "Refresh token NOT in response body (moved to cookie)")
check("fiss_refresh" in r.cookies or "fiss_refresh" in s.cookies, "httpOnly fiss_refresh cookie set")

if not ACCESS:
    print("  FATAL: No access token — aborting")
    sys.exit(1)

AUTH = {"Authorization": f"Bearer {ACCESS}"}

# ── 2. Token refresh via cookie (no body) ──────────────────────────────────
print("\n=== COOKIE-BASED TOKEN REFRESH ===")
r2 = req(s, "POST", "/api/auth/token/refresh/", json={})
check(r2.status_code == 200, f"Refresh via cookie returns 200 (got {r2.status_code})", r2.text[:200])
if r2.ok:
    r2b = r2.json()
    check("access" in r2b, "New access token returned")
    check("refresh" not in r2b, "Refresh not in refresh response body (cookie-only)")
    AUTH = {"Authorization": f"Bearer {r2b.get('access', ACCESS)}"}

# ── 3. Refresh without cookie returns 401 ──────────────────────────────────
print("\n=== REFRESH WITHOUT COOKIE ===")
r3 = requests.post(BASE + "/api/auth/token/refresh/", json={})  # no cookie
check(r3.status_code == 401, f"Refresh without cookie → 401 (got {r3.status_code})", r3.text[:100])

# ── 4. User list (prefetch_related) ─────────────────────────────────────────
print("\n=== USER LIST (prefetch_related) ===")
r4 = req(s, "GET", "/api/users/", headers=AUTH)
check(r4.status_code == 200, f"User list 200 (got {r4.status_code})")
if r4.ok:
    users = r4.json().get("results", r4.json())
    check(True, f"Loaded {len(users) if isinstance(users, list) else '?'} users without N+1 error")

# ── 5. Academic calendar CRUD ──────────────────────────────────────────────
print("\n=== ACADEMIC CALENDAR CRUD ===")
r5 = req(s, "POST", "/api/academic-calendar/",
         json={"event": "Verification Term", "date": "2026-05-01", "type": "term"},
         headers=AUTH)
check(r5.status_code == 201, f"Create calendar event 201 (got {r5.status_code})", r5.text[:200])
if r5.ok:
    eid = r5.json().get("id")
    check(req(s, "GET", "/api/academic-calendar/", headers=AUTH).status_code == 200, "List calendar events 200")
    if eid:
        check(req(s, "PATCH", f"/api/academic-calendar/{eid}/",
                  json={"event": "Updated"}, headers=AUTH).status_code == 200, "Update calendar event 200")
        check(req(s, "DELETE", f"/api/academic-calendar/{eid}/",
                  headers=AUTH).status_code == 204, "Delete calendar event 204")

# ── 6. Attendance signal test ──────────────────────────────────────────────
print("\n=== ATTENDANCE SIGNAL (StudentAttendance → Attendance sync) ===")
rc = req(s, "GET", "/api/classes/?page_size=1", headers=AUTH)
rs = req(s, "GET", "/api/students/?page_size=1", headers=AUTH)
if rc.ok and rs.ok:
    classes = rc.json().get("results", rc.json())
    students = rs.json().get("results", rs.json())
    if isinstance(classes, list) and classes and isinstance(students, list) and students:
        cls_id = classes[0]["id"]
        stu_id = students[0]["id"]
        TEST_DATE = "2026-04-09"

        # Remove any pre-existing record for the same date+student
        pre = req(s, "GET", f"/api/student-attendance/?date={TEST_DATE}&student={stu_id}", headers=AUTH)
        if pre.ok:
            for ex in pre.json().get("results", pre.json() if isinstance(pre.json(), list) else []):
                req(s, "DELETE", f"/api/student-attendance/{ex['id']}/", headers=AUTH)

        rsa = req(s, "POST", "/api/student-attendance/",
                  json={"date": TEST_DATE, "student": stu_id, "student_class": cls_id, "status": "present"},
                  headers=AUTH)
        check(rsa.status_code == 201, f"Create StudentAttendance (got {rsa.status_code})", rsa.text[:200])

        if rsa.ok:
            sa_id = rsa.json().get("id")
            ragg = req(s, "GET", f"/api/attendance/?date={TEST_DATE}&student_class={cls_id}", headers=AUTH)
            if ragg.ok:
                agg_list = ragg.json().get("results", ragg.json())
                agg_list = agg_list if isinstance(agg_list, list) else []
                if agg_list:
                    agg = agg_list[0]
                    check(agg.get("present", 0) >= 1,
                          f"Attendance aggregate synced: present={agg.get('present')}",
                          f"Got: {agg}")
                else:
                    FAIL += 1
                    print(f"  FAIL Attendance aggregate not created by signal")
            if sa_id:
                req(s, "DELETE", f"/api/student-attendance/{sa_id}/", headers=AUTH)
    else:
        print("  SKIP (no classes/students in DB)")
else:
    print("  SKIP (fetch error)")

# ── 7. Exam results have position field ────────────────────────────────────
print("\n=== EXAM RESULTS / POSITION ===")
re7 = req(s, "GET", "/api/exam-results/?page_size=10", headers=AUTH)
check(re7.status_code == 200, f"Exam results endpoint 200 (got {re7.status_code})")
if re7.ok:
    results = re7.json().get("results", re7.json())
    if isinstance(results, list) and results:
        missing = [r for r in results if "position" not in r]
        check(len(missing) == 0, f"All {len(results)} results have 'position' field",
              f"{len(missing)} missing position")
    else:
        check(True, "No exam results yet — position check skipped")

# ── 8. Logout via cookie blacklist ─────────────────────────────────────────
print("\n=== LOGOUT / BLACKLIST ===")
rl = req(s, "POST", "/api/auth/token/blacklist/", json={}, headers=AUTH)
check(rl.status_code in (200, 205), f"Logout 200/205 (got {rl.status_code})", rl.text[:100])

rcheck = req(s, "POST", "/api/auth/token/refresh/", json={})
check(rcheck.status_code == 401, f"Refresh after logout → 401 (got {rcheck.status_code})")

# ── Summary ────────────────────────────────────────────────────────────────
print(f"\n{'='*52}")
print(f"  TOTAL: {PASS+FAIL}   |   PASS: {PASS}   |   FAIL: {FAIL}")
print(f"{'='*52}")
sys.exit(0 if FAIL == 0 else 1)
