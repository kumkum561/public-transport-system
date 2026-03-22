import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "your-super-secret-key-change-this")
    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/public_transport")
    ADMIN_USERNAME = "admin"
    ADMIN_PASSWORD = "Admin@12345"  # Change this in production