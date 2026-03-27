"""
Payment gateway integration module.

The initiate/verify pattern used here is compatible with real payment gateways
(e.g. Razorpay, Stripe).  To integrate with a live provider:
  1. Replace the order-creation logic in `initiate_payment` with a call to
     the gateway SDK to create an order and return its ID.
  2. In `verify_payment`, validate the gateway's payment signature before
     marking the order as completed.
"""

import uuid
from flask import Blueprint, request, jsonify, current_app
import jwt
from datetime import datetime
from config import Config

payment_bp = Blueprint("payment", __name__)


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


@payment_bp.route("/initiate", methods=["POST"])
def initiate_payment():
    """
    Create a pending payment order and return its ID to the frontend.

    Expected JSON body:
        transport_id  – ID of the transport being booked
        amount        – total fare in INR (float)

    Returns:
        order_id   – unique identifier for this payment attempt
        amount     – amount in INR
        currency   – "INR"
        status     – "pending"
    """
    user = verify_user(request)
    if not user:
        return jsonify({"error": "Please login"}), 401

    data = request.get_json() or {}
    transport_id = data.get("transport_id")
    amount = data.get("amount")

    if not transport_id or amount is None:
        return jsonify({"error": "transport_id and amount are required"}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount"}), 400

    mongo = current_app.mongo

    order = {
        "user_id": user["user_id"],
        "user_email": user["email"],
        "transport_id": transport_id,
        "amount": amount,
        "currency": "INR",
        "status": "pending",
        "order_id": "order_" + uuid.uuid4().hex[:16],
        "created_at": datetime.utcnow(),
    }
    mongo.db.payment_orders.insert_one(order)

    return jsonify({
        "order_id": order["order_id"],
        "amount": amount,
        "currency": "INR",
        "status": "pending",
    }), 200


@payment_bp.route("/verify", methods=["POST"])
def verify_payment():
    """
    Verify a payment and mark the order as completed.

    Expected JSON body:
        order_id – the ID returned by /initiate

    In production, also accept and verify the gateway's payment/signature
    fields here before marking the order as completed.
    """
    user = verify_user(request)
    if not user:
        return jsonify({"error": "Please login"}), 401

    data = request.get_json() or {}
    order_id = data.get("order_id")

    if not order_id:
        return jsonify({"error": "order_id is required"}), 400

    mongo = current_app.mongo
    order = mongo.db.payment_orders.find_one({
        "order_id": order_id,
        "user_id": user["user_id"],
    })

    if not order:
        return jsonify({"error": "Payment order not found"}), 404

    if order["status"] == "completed":
        return jsonify({"error": "Payment already processed"}), 400

    mongo.db.payment_orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )

    return jsonify({
        "status": "success",
        "order_id": order_id,
        "amount": order["amount"],
    }), 200
