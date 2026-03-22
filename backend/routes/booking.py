from flask import Blueprint, request, jsonify, current_app
import jwt
from bson import ObjectId
from datetime import datetime
from config import Config

booking_bp = Blueprint("booking", __name__)


def verify_user(req):
    token = req.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return None
    try:
        decoded = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
        if decoded.get("role") != "user":
            return None
        return decoded
    except:
        return None


@booking_bp.route("/create", methods=["POST"])
def create_booking():
    user = verify_user(request)
    if not user:
        return jsonify({"error": "Please login to book"}), 401

    data = request.get_json()
    mongo = current_app.mongo

    transport_id = data.get("transport_id")
    passengers = int(data.get("passengers", 1))

    if not transport_id:
        return jsonify({"error": "Transport ID is required"}), 400

    try:
        obj_id = ObjectId(transport_id)
    except:
        return jsonify({"error": "Invalid transport ID"}), 400

    transport = mongo.db.transports.find_one({"_id": obj_id, "status": "active"})
    if not transport:
        return jsonify({"error": "Transport not found or inactive"}), 404

    if transport["seats_available"] < passengers:
        return jsonify({"error": f"Only {transport['seats_available']} seats available"}), 400

    base_price = transport["price"]
    offer = data.get("offer", "")

    if offer == "offer1":
        # 10% discount
        total_price = round(base_price * passengers * 0.90, 2)
        discount_amount = round(base_price * passengers * 0.10, 2)
    elif offer == "offer2":
        # Buy 1 get 2nd at 50% off (applies to every pair)
        pairs = passengers // 2
        remaining = passengers % 2
        total_price = round(pairs * base_price * 1.5 + remaining * base_price, 2)
        discount_amount = round(base_price * passengers - total_price, 2)
    else:
        total_price = round(base_price * passengers, 2)
        discount_amount = 0.0
        offer = ""

    booking = {
        "user_id": user["user_id"],
        "user_email": user["email"],
        "transport_id": transport_id,
        "mode": transport["mode"],
        "route_number": transport["route_number"],
        "source": transport["source"],
        "destination": transport["destination"],
        "departure_time": transport["departure_time"],
        "arrival_time": transport["arrival_time"],
        "passengers": passengers,
        "base_price": round(base_price * passengers, 2),
        "discount_amount": discount_amount,
        "offer_applied": offer,
        "total_price": total_price,
        "status": "confirmed",
        "booked_at": datetime.utcnow()
    }

    result = mongo.db.bookings.insert_one(booking)

    # Update available seats
    mongo.db.transports.update_one(
        {"_id": obj_id},
        {"$inc": {"seats_available": -passengers}}
    )

    return jsonify({
        "message": "Booking confirmed!",
        "booking_id": str(result.inserted_id),
        "discount_amount": discount_amount,
        "total_price": total_price
    }), 201


@booking_bp.route("/my-bookings", methods=["GET"])
def my_bookings():
    user = verify_user(request)
    if not user:
        return jsonify({"error": "Please login"}), 401

    mongo = current_app.mongo
    bookings = list(mongo.db.bookings.find(
        {"user_id": user["user_id"]}
    ).sort("booked_at", -1))

    for b in bookings:
        b["_id"] = str(b["_id"])
        b["booked_at"] = b["booked_at"].strftime("%Y-%m-%d %H:%M")

    return jsonify({"bookings": bookings}), 200


@booking_bp.route("/cancel/<booking_id>", methods=["PUT"])
def cancel_booking(booking_id):
    user = verify_user(request)
    if not user:
        return jsonify({"error": "Please login"}), 401

    mongo = current_app.mongo

    try:
        obj_id = ObjectId(booking_id)
    except:
        return jsonify({"error": "Invalid booking ID"}), 400

    booking = mongo.db.bookings.find_one({
        "_id": obj_id,
        "user_id": user["user_id"]
    })

    if not booking:
        return jsonify({"error": "Booking not found"}), 404

    if booking["status"] == "cancelled":
        return jsonify({"error": "Booking already cancelled"}), 400

    # Cancel booking
    mongo.db.bookings.update_one(
        {"_id": obj_id},
        {"$set": {"status": "cancelled"}}
    )

    # Restore seats
    mongo.db.transports.update_one(
        {"_id": ObjectId(booking["transport_id"])},
        {"$inc": {"seats_available": booking["passengers"]}}
    )

    return jsonify({"message": "Booking cancelled successfully"}), 200