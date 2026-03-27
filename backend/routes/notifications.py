from flask import Blueprint, request, jsonify, current_app
import jwt
from config import Config

notifications_bp = Blueprint("notifications", __name__)


def verify_user(req):
    token = req.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return None
    try:
        decoded = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
        if decoded.get("role") != "user":
            return None
        return decoded
    except Exception:
        return None


@notifications_bp.route("", methods=["GET"])
def get_notifications():
    """Return the latest notifications for the authenticated user."""
    user = verify_user(request)
    if not user:
        return jsonify({"error": "Please login"}), 401

    mongo = current_app.mongo
    notifications = list(
        mongo.db.notifications
        .find({"user_id": user["user_id"]})
        .sort("created_at", -1)
        .limit(20)
    )

    for n in notifications:
        n["_id"] = str(n["_id"])
        n["created_at"] = n["created_at"].strftime("%Y-%m-%d %H:%M")

    unread_count = mongo.db.notifications.count_documents(
        {"user_id": user["user_id"], "read": False}
    )

    return jsonify({"notifications": notifications, "unread_count": unread_count}), 200


@notifications_bp.route("/mark-read", methods=["PUT"])
def mark_all_read():
    """Mark all unread notifications as read for the authenticated user."""
    user = verify_user(request)
    if not user:
        return jsonify({"error": "Please login"}), 401

    mongo = current_app.mongo
    mongo.db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}}
    )

    return jsonify({"message": "All notifications marked as read"}), 200
