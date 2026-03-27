from flask import Blueprint, request, jsonify, current_app
import jwt
import qrcode
import io
import base64
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
    except Exception:
        return None


def generate_qr_code(booking_id, route_number, source, destination, passengers, total_price):
    qr_data = (
        f"BookingID:{booking_id}\n"
        f"Route:{route_number}\n"
        f"From:{source}\n"
        f"To:{destination}\n"
        f"Passengers:{passengers}\n"
        f"Amount:Rs{total_price:.2f}"
    )
    qr = qrcode.QRCode(version=1, box_size=6, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def create_notification(mongo, user_id, user_email, notif_type, message, booking_id):
    mongo.db.notifications.insert_one({
        "user_id": user_id,
        "user_email": user_email,
        "type": notif_type,
        "message": message,
        "booking_id": str(booking_id),
        "read": False,
        "created_at": datetime.utcnow()
    })


@booking_bp.route("/seats/<transport_id>", methods=["GET"])
def get_seats(transport_id):
    """Return seat map for a transport, showing available and booked seats."""
    try:
        obj_id = ObjectId(transport_id)
    except Exception:
        return jsonify({"error": "Invalid transport ID"}), 400

    mongo = current_app.mongo
    transport = mongo.db.transports.find_one({"_id": obj_id, "status": "active"})
    if not transport:
        return jsonify({"error": "Transport not found"}), 404

    total = int(transport["total_seats"])
    booked = set(transport.get("booked_seats", []))

    seats = [
        {"seat_number": i, "status": "booked" if i in booked else "available"}
        for i in range(1, total + 1)
    ]

    return jsonify({
        "seats": seats,
        "total_seats": total,
        "seats_available": transport["seats_available"]
    }), 200


@booking_bp.route("/create", methods=["POST"])
def create_booking():
    user = verify_user(request)
    if not user:
        return jsonify({"error": "Please login to book"}), 401

    data = request.get_json()
    mongo = current_app.mongo

    transport_id = data.get("transport_id")
    selected_seats = data.get("selected_seats", [])
    passengers_raw = data.get("passengers")

    if not transport_id:
        return jsonify({"error": "Transport ID is required"}), 400

    # Determine passenger count from seat selection or explicit count
    if selected_seats:
        if not isinstance(selected_seats, list) or len(selected_seats) == 0:
            return jsonify({"error": "Invalid seat selection"}), 400
        passengers = len(selected_seats)
    elif passengers_raw is not None:
        try:
            passengers = int(passengers_raw)
            if passengers < 1:
                raise ValueError
        except (ValueError, TypeError):
            return jsonify({"error": "At least 1 passenger required"}), 400
    else:
        return jsonify({"error": "Please select seats or specify passenger count"}), 400

    try:
        obj_id = ObjectId(transport_id)
    except Exception:
        return jsonify({"error": "Invalid transport ID"}), 400

    transport = mongo.db.transports.find_one({"_id": obj_id, "status": "active"})
    if not transport:
        return jsonify({"error": "Transport not found or inactive"}), 404

    if transport["seats_available"] < passengers:
        return jsonify({"error": f"Only {transport['seats_available']} seats available"}), 400

    # Validate individual seat availability when seats are explicitly selected
    if selected_seats:
        booked_seats = set(transport.get("booked_seats", []))
        total_seats = int(transport["total_seats"])
        for seat in selected_seats:
            if not isinstance(seat, int) or seat < 1 or seat > total_seats:
                return jsonify({"error": f"Invalid seat number: {seat}"}), 400
            if seat in booked_seats:
                return jsonify({"error": f"Seat {seat} is already booked"}), 409

    base_price = transport["price"]
    offer = data.get("offer", "")

    if offer == "offer1":
        total_price = round(base_price * passengers * 0.90, 2)
        discount_amount = round(base_price * passengers * 0.10, 2)
    elif offer == "offer2":
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
        "selected_seats": selected_seats if selected_seats else [],
        "base_price": round(base_price * passengers, 2),
        "discount_amount": discount_amount,
        "offer_applied": offer,
        "total_price": total_price,
        "status": "confirmed",
        "booked_at": datetime.utcnow(),
        "payment_status": "paid",
        "payment_method": data.get("payment_method", "online")
    }

    result = mongo.db.bookings.insert_one(booking)
    booking_id = str(result.inserted_id)

    # Generate QR code for the confirmed booking
    qr_b64 = generate_qr_code(
        booking_id,
        transport["route_number"],
        transport["source"],
        transport["destination"],
        passengers,
        total_price
    )
    mongo.db.bookings.update_one(
        {"_id": result.inserted_id},
        {"$set": {"qr_code": qr_b64}}
    )

    # Update transport: decrement available seats and record booked seat numbers
    update_op = {"$inc": {"seats_available": -passengers}}
    if selected_seats:
        update_op["$push"] = {"booked_seats": {"$each": selected_seats}}
    mongo.db.transports.update_one({"_id": obj_id}, update_op)

    # Notify the user about the confirmed booking
    seats_info = (
        f" (Seats: {', '.join(str(s) for s in selected_seats)})"
        if selected_seats else ""
    )
    create_notification(
        mongo,
        user["user_id"],
        user["email"],
        "booking_confirmed",
        (
            f"Booking confirmed for {transport['source']} \u2192 {transport['destination']} "
            f"on route {transport['route_number']}{seats_info}. "
            f"Amount: \u20b9{total_price:.2f}"
        ),
        booking_id
    )

    return jsonify({
        "message": "Booking confirmed!",
        "booking_id": booking_id,
        "discount_amount": discount_amount,
        "total_price": total_price,
        "qr_code": qr_b64,
        "selected_seats": selected_seats
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
    except Exception:
        return jsonify({"error": "Invalid booking ID"}), 400

    booking = mongo.db.bookings.find_one({
        "_id": obj_id,
        "user_id": user["user_id"]
    })

    if not booking:
        return jsonify({"error": "Booking not found"}), 404

    if booking["status"] == "cancelled":
        return jsonify({"error": "Booking already cancelled"}), 400

    mongo.db.bookings.update_one(
        {"_id": obj_id},
        {"$set": {"status": "cancelled"}}
    )

    # Restore seats: increment available count and remove specific seat numbers
    selected_seats = booking.get("selected_seats", [])
    restore_op = {"$inc": {"seats_available": booking["passengers"]}}
    if selected_seats:
        restore_op["$pullAll"] = {"booked_seats": selected_seats}
    mongo.db.transports.update_one(
        {"_id": ObjectId(booking["transport_id"])},
        restore_op
    )

    # Notify the user about the cancellation
    create_notification(
        mongo,
        user["user_id"],
        user["email"],
        "booking_cancelled",
        (
            f"Booking cancelled for {booking['source']} \u2192 {booking['destination']} "
            f"on route {booking['route_number']}. "
            f"Booking ID: {booking_id}"
        ),
        booking_id
    )

    return jsonify({"message": "Booking cancelled successfully"}), 200