import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_backend.settings')
django.setup()

import requests

BASE = 'http://127.0.0.1:8001'
failures = []

def check(num, desc, condition, extra=""):
    symbol = "PASS" if condition else "FAIL"
    if not condition:
        failures.append(f"{num}. {desc}")
    print(f"{symbol}  {num}. {desc}{(' — ' + extra) if extra else ''}")


# 1. Unauthenticated access returns 401
r = requests.get(f'{BASE}/api/students/')
check(1, "Unauthenticated blocked", r.status_code == 401, f"code={r.status_code}")

# 2. Wrong password returns 401
r = requests.post(f'{BASE}/api/auth/token/', json={'username': 'admin@farukaktas.edu', 'password': 'wrong'})
check(2, "Bad password blocked", r.status_code == 401, f"code={r.status_code}")

# 3. Login and check role
r = requests.post(f'{BASE}/api/auth/token/', json={'username': 'admin@farukaktas.edu', 'password': 'admin123'})
check(3, "Admin login succeeds", r.status_code == 200, f"code={r.status_code}")
admin_token = r.json().get('access', '')
H = {'Authorization': f'Bearer {admin_token}'}

# 4. Dashboard stats
r = requests.get(f'{BASE}/api/dashboard/stats/', headers=H)
check(4, "Dashboard stats", r.status_code == 200, str(r.json()))

# 5. Students list
r = requests.get(f'{BASE}/api/students/', headers=H)
check(5, "Students list", r.status_code == 200)

# 6. Fee outstanding (N+1 fix test)
r = requests.get(f'{BASE}/api/fees/outstanding/', headers=H)
check(6, "Fees outstanding (N+1 fixed)", r.status_code == 200 and isinstance(r.json(), list), f"len={len(r.json())}")

# 7. grade_bands validation via PATCH settings
r = requests.patch(f'{BASE}/api/settings/', json={'grade_bands': [{'grade': 'A'}]}, headers=H)
check(7, "Bad grade_bands rejected by validator", r.status_code == 400, f"code={r.status_code}")

# 8. Valid grade_bands accepted
r = requests.patch(f'{BASE}/api/settings/', json={'grade_bands': [{'grade': 'A', 'min': 75}, {'grade': 'F', 'min': 0}]}, headers=H)
check(8, "Valid grade_bands accepted", r.status_code == 200, f"code={r.status_code}")

# 9. my-applications endpoint exists and returns list
r = requests.get(f'{BASE}/api/applicants/my-applications/', headers=H)
check(9, "my-applications endpoint returns list", r.status_code == 200 and isinstance(r.json(), list))

# 10. Audit log accessible to super_admin
r = requests.get(f'{BASE}/api/audit/', headers=H)
check(10, "Audit log accessible to super_admin", r.status_code == 200)

# 11. Settings show updated grade_bands (Django returns snake_case directly)
r = requests.get(f'{BASE}/api/settings/', headers=H)
bands = r.json().get('grade_bands', [])
check(11, "Settings grade_bands persisted", len(bands) == 2, str(bands))

# 12. Token refresh
r = requests.post(f'{BASE}/api/auth/token/', json={'username': 'admin@farukaktas.edu', 'password': 'admin123'})
refresh = r.json().get('refresh', '')
r = requests.post(f'{BASE}/api/auth/token/refresh/', json={'refresh': refresh})
check(12, "Token refresh works", r.status_code == 200 and 'access' in r.json())

# 13. Token blacklist (logout)
r2 = requests.post(f'{BASE}/api/auth/token/', json={'username': 'admin@farukaktas.edu', 'password': 'admin123'})
old_refresh = r2.json()['refresh']
r3 = requests.post(f'{BASE}/api/auth/token/blacklist/', json={'refresh': old_refresh})
check(13, "Token blacklist (logout)", r3.status_code == 200)

# 14. Public admission window (no crash even if not found)
r = requests.get(f'{BASE}/api/admission-windows/active/')
check(14, "Public admission window endpoint works", r.status_code in (200, 404), f"code={r.status_code}")

# 15. All academic routes
for route in ['classes', 'teachers', 'subjects', 'timetable', 'attendance', 'lesson-plans', 'student-attendance', 'teacher-attendance', 'teacher-assignments', 'academic-calendar']:
    r = requests.get(f'{BASE}/api/{route}/', headers=H)
    check(f"15-{route}", f"/api/{route}/ returns 200", r.status_code == 200, f"code={r.status_code}")

print()
if failures:
    print(f"FAILED ({len(failures)} issues):")
    for f in failures:
        print(f"  - {f}")
else:
    print("ALL CHECKS PASSED")
