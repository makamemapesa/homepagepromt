"""
One-time script to create a parent user for testing.
Run with: python manage.py shell < create_parent_user.py
"""
from django.contrib.auth.models import User
from core.models import UserProfile
from students.models import Student

# Create parent user
parent_user, created = User.objects.get_or_create(
    username="amina.bello@gmail.com",
    defaults={
        "email": "amina.bello@gmail.com",
        "first_name": "Amina",
        "last_name": "Bello",
    }
)

if created:
    parent_user.set_password("parent123")
    parent_user.save()
    print(f"✓ Created parent user: {parent_user.username}")
else:
    print(f"✓ Parent user already exists: {parent_user.username}")

# Create/update profile
profile, _ = UserProfile.objects.update_or_create(
    user=parent_user,
    defaults={"role": "parent"}
)
print(f"✓ Set role to: {profile.role}")

# Link to a student (Amina Bello from JSS 1A)
try:
    student = Student.objects.get(first_name="Amina", last_name="Bello")
    student.parent_email = "amina.bello@gmail.com"
    student.save()
    print(f"✓ Linked to student: {student.first_name} {student.last_name} (Reg: {student.reg_no})")
except Student.DoesNotExist:
    print("⚠ No student named 'Amina Bello' found in database")

print("\n=== Parent User Created ===")
print("Email: amina.bello@gmail.com")
print("Password: parent123")
print("Role: parent")
