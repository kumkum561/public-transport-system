from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from models.user import create_user_document
from utils.validators import validate_password, validate_email, validate_phone
from config import Config

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    mongo = current_app.mongo
    bcrypt = current_app.bcrypt

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    phone = data.get("phone", "").strip()

    # Validations
    if not all([name, email, password, phone]):
        return jsonify({"error": "All fields are required"}), 400

    if not validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400

    if not validate_phone(phone):
        return jsonify({"error": "Phone number must be 10 digits"}), 400

    is_valid, errors = validate_password(password)
    if not is_valid:
        return jsonify({"error": errors}), 400

    # Check if user exists
    if mongo.db.users.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    # Create user
    hashed = bcrypt.generate_password_hash(password).decode("utf-8")
    user_doc = create_user_document(name, email, hashed, phone)
    mongo.db.users.insert_one(user_doc)

    return jsonify({"message": "Registration successful! Please login."}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    mongo = current_app.mongo
    bcrypt = current_app.bcrypt

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = mongo.db.users.find_one({"email": email})
    if not user or not bcrypt.check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    # Generate JWT token
    token = jwt.encode({
        "user_id": str(user["_id"]),
        "email": user["email"],
        "role": "user",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, Config.SECRET_KEY, algorithm="HS256")

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "name": user["name"],
            "email": user["email"],
            "phone": user["phone"]
        }
    }), 200


@auth_bp.route("/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json()
    mongo = current_app.mongo
    bcrypt = current_app.bcrypt

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    admin = mongo.db.admins.find_one({"username": username})
    if not admin or not bcrypt.check_password_hash(admin["password"], password):
        return jsonify({"error": "Invalid admin credentials"}), 401

    token = jwt.encode({
        "admin_id": str(admin["_id"]),
        "username": admin["username"],
        "role": "admin",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12)
    }, Config.SECRET_KEY, algorithm="HS256")

    return jsonify({
        "message": "Admin login successful",
        "token": token
    }), 200


@auth_bp.route("/verify", methods=["GET"])
def verify_token():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return jsonify({"error": "Token missing"}), 401
    try:
        decoded = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
        return jsonify({"valid": True, "role": decoded.get("role")}), 200
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401