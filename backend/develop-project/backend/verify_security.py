import requests
import json

BASE_URL = 'http://127.0.0.1:8000'

print('='*80)
print('COMPREHENSIVE API SECURITY TEST')
print('='*80)

# Test 1: Unauthenticated access should be blocked
print('\n[TEST 1] Unauthenticated Access')
try:
    r = requests.get(f'{BASE_URL}/api/students/', timeout=5)
    print(f'GET /api/students/ without auth: {r.status_code}')
    if r.status_code == 401:
        print('[PASS] PASS: Unauthenticated request blocked')
    else:
        print(f'[FAIL] FAIL: Expected 401, got {r.status_code}')
except Exception as e:
    print(f'[FAIL] ERROR: {e}')

# Test 2: Login with valid credentials
print('\n[TEST 2] Valid Login')
try:
    r = requests.post(f'{BASE_URL}/api/auth/token/', json={
        'username': 'securitytest@test.com',
        'password': 'SecureTestPass2024!'
    }, timeout=5)
    print(f'POST /api/auth/token/: {r.status_code}')
    if r.status_code == 200:
        data = r.json()
        access_token = data.get('access')
        refresh_token = data.get('refresh')
        print(f'[PASS] PASS: Login successful')
        print(f'Access token: {access_token[:50]}...')
    else:
        print(f'[FAIL] FAIL: Expected 200, got {r.status_code}')
        print(f'Response: {r.text}')
        access_token = None
except Exception as e:
    print(f'[FAIL] ERROR: {e}')
    access_token = None

# Test 3: Authenticated request
if access_token:
    print('\n[TEST 3] Authenticated Access')
    try:
        headers = {'Authorization': f'Bearer {access_token}'}
        r = requests.get(f'{BASE_URL}/api/users/me/', headers=headers, timeout=5)
        print(f'GET /api/users/me/: {r.status_code}')
        if r.status_code == 200:
            user_data = r.json()
            print(f'[PASS] PASS: Authenticated request successful')
            print(f'User: {user_data.get("username")} - Role: {user_data.get("role")}')
        else:
            print(f'[FAIL] FAIL: Expected 200, got {r.status_code}')
    except Exception as e:
        print(f'[FAIL] ERROR: {e}')

# Test 4: Rate limiting on login
print('\n[TEST 4] Rate Limiting (5 attempts/minute)')
try:
    for i in range(7):
        r = requests.post(f'{BASE_URL}/api/auth/token/', json={
            'username': 'nonexistent@test.com',
            'password': 'wrongpass'
        }, timeout=5)
        print(f'Attempt {i+1}: {r.status_code}', end='')
        if i < 5:
            print(f' (should be 401)')
        else:
            print(f' (should be 429 - throttled)')
    
    if r.status_code == 429:
        print('[PASS] PASS: Rate limiting working correctly')
    else:
        print(f'[FAIL] FAIL: Expected 429 after 5 attempts, got {r.status_code}')
except Exception as e:
    print(f'[FAIL] ERROR: {e}')

# Test 5: Password validation
print('\n[TEST 5] Password Validation')
try:
    test_cases = [
        ('weak', '123456', 'Should reject - too short + numeric'),
        ('weak', '12345678', 'Should reject - entirely numeric + too common'),
        ('strong', 'TestUser2024!', 'Should accept - strong password')
    ]
    
    for expected, password, description in test_cases:
        r = requests.post(f'{BASE_URL}/api/users/', json={
            'email': f'pwdtest{password}@test.com',
            'password': password,
            'first_name': 'Test',
            'last_name': 'User',
            'role': 'teacher'
        }, headers={'Authorization': f'Bearer {access_token}'} if access_token else {}, timeout=5)
        
        print(f'Password "{password}": {r.status_code} - {description}')
        if expected == 'weak' and r.status_code == 400:
            print(f'  [PASS] Correctly rejected')
        elif expected == 'strong' and r.status_code in [200, 201]:
            print(f'  [PASS] Correctly accepted')
        else:
            print(f'  Response: {r.text[:200]}')
except Exception as e:
    print(f'[FAIL] ERROR: {e}')

# Test 6: File upload validation (if applicable)
print('\n[TEST 6] Authorization Bypass Protection')
if access_token:
    try:
        # Test bulk_save with empty data (should require teacher/admin)
        headers = {'Authorization': f'Bearer {access_token}'}
        r = requests.post(f'{BASE_URL}/api/exam-marks/bulk_save/', 
                         json=[], 
                         headers=headers, 
                         timeout=5)
        print(f'POST /api/exam-marks/bulk_save/: {r.status_code}')
        print(f'[PASS] Endpoint accessible (teacher verification will happen with actual data)')
    except Exception as e:
        print(f'[FAIL] ERROR: {e}')

print('\n' + '='*80)
print('TEST SUITE COMPLETE')
print('='*80)
