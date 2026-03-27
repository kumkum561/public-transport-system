from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timezone
import re

contact_bp = Blueprint("contact", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@contact_bp.route("", methods=["POST"])
def submit_contact():
    """Accept a contact-us message and store it in MongoDB."""
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip()
    subject = str(data.get("subject", "")).strip()
    message = str(data.get("message", "")).strip()

    # Validation
    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not EMAIL_RE.match(email):
        return jsonify({"error": "Invalid email address"}), 400
    if not subject:
        return jsonify({"error": "Subject is required"}), 400
    if not message:
        return jsonify({"error": "Message is required"}), 400

    mongo = current_app.mongo
    # TODO: configure an email backend to forward messages to support staff
    mongo.db.contact_messages.insert_one({
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
        "created_at": datetime.now(timezone.utc),
        "read": False,
    })

    return jsonify({"message": "Thank you! Your message has been received."}), 201
