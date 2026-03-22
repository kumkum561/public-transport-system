from datetime import datetime

def create_user_document(name, email, hashed_password, phone):
    return {
        "name": name,
        "email": email,
        "password": hashed_password,
        "phone": phone,
        "role": "user",
        "created_at": datetime.utcnow(),
        "bookings": []
    }