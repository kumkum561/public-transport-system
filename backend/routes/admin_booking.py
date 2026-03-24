from flask import Blueprint, request, jsonify, current_app
import jwt
from bson import ObjectId
from datetime import datetime
from config import Config

admin_bp = Blueprint('admin', __name__)

def verify_admin(req):
    token = req.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return None
    try:
        decoded = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
        if decoded.get("role") != "admin":
            return None
        return decoded
    except:
        return None

def parse_date_yyyy_mm_dd(s):
    return datetime.strptime(s, "%Y-%m-%d")

@admin_bp.route('/api/admin/bookings', methods=['GET'])
def get_bookings():
    admin = verify_admin(request)
    if not admin:
        return jsonify({"error": "Unauthorized"}), 403

    mongo = current_app.mongo

    query = {}
    source = request.args.get('source', '').strip()
    destination = request.args.get('destination', '').strip()
    date_from = request.args.get('date_from', '').strip()
    date_to = request.args.get('date_to', '').strip()

    if source:
        query['source'] = {"$regex": source, "$options": "i"}
    if destination:
        query['destination'] = {"$regex": destination, "$options": "i"}

    if date_from or date_to:
        booked_at = {}
        if date_from:
            booked_at['$gte'] = parse_date_yyyy_mm_dd(date_from)
        if date_to:
            # include full day
            booked_at['$lte'] = parse_date_yyyy_mm_dd(date_to)
        query['booked_at'] = booked_at

    bookings = list(mongo.db.bookings.find(query).sort('booked_at', -1))

    results = []
    for b in bookings:
        # Normalize IDs
        booking_id = str(b.get('_id'))

        # Lookup user (best-effort)
        user_doc = None
        try:
            user_doc = mongo.db.users.find_one({"_id": ObjectId(b.get('user_id'))})
        except Exception:
            user_doc = mongo.db.users.find_one({"email": b.get('user_email')})

        user_name = (user_doc or {}).get('name') or "Nil / Not Available"
        user_email = (user_doc or {}).get('email') or b.get('user_email') or "Nil / Not Available"
        user_phone = (user_doc or {}).get('phone') or "Nil / Not Available"

        status = b.get('status')
        if not status:
            ticket_status = "Nil / Not Available"
        elif status == "confirmed":
            ticket_status = "Booked"
        elif status == "cancelled":
            ticket_status = "Cancelled"
        else:
            ticket_status = status

        booked_at = b.get('booked_at')
        booked_at_str = booked_at.strftime('%Y-%m-%d %H:%M') if booked_at else "Nil / Not Available"

        results.append({
            "_id": booking_id,
            "user_name": user_name,
            "email": user_email,
            "phone": user_phone,
            "source": b.get('source') or "Nil / Not Available",
            "destination": b.get('destination') or "Nil / Not Available",
            "mode": b.get('mode') or "Nil / Not Available",
            "ticket_price": float(b.get('total_price', 0) or 0),
            "number_of_tickets": int(b.get('passengers', 0) or 0),
            "booking_date_time": booked_at_str,
            "ticket_status": ticket_status,
            "transport_id": b.get('transport_id')
        })

    return jsonify({"bookings": results, "count": len(results)}), 200

@admin_bp.route('/api/admin/bookings/<booking_id>', methods=['PATCH'])
def update_booking(booking_id):
    admin = verify_admin(request)
    if not admin:
        return jsonify({"error": "Unauthorized"}), 403

    mongo = current_app.mongo

    try:
        obj_id = ObjectId(booking_id)
    except Exception:
        return jsonify({"error": "Invalid booking ID"}), 400

    booking = mongo.db.bookings.find_one({"_id": obj_id})
    if not booking:
        return jsonify({"error": "Booking not found"}), 404

    data = request.get_json() or {}

    update_fields = {}

    if 'status' in data:
        status = (data.get('status') or '').strip().lower()
        if status not in ['confirmed', 'cancelled']:
            return jsonify({"error": "Invalid status"}), 400
        update_fields['status'] = status

    if 'passengers' in data:
        try:
            passengers = int(data.get('passengers'))
            if passengers < 1:
                return jsonify({"error": "passengers must be >= 1"}), 400
            update_fields['passengers'] = passengers
        except Exception:
            return jsonify({"error": "Invalid passengers"}), 400

    if not update_fields:
        return jsonify({"error": "No valid fields to update"}), 400

    mongo.db.bookings.update_one({"_id": obj_id}, {"$set": update_fields})
    return jsonify({"message": "Booking updated successfully"}), 200

@admin_bp.route('/api/admin/bookings/<booking_id>', methods=['DELETE'])
def delete_booking(booking_id):
    admin = verify_admin(request)
    if not admin:
        return jsonify({"error": "Unauthorized"}), 403

    mongo = current_app.mongo

    try:
        obj_id = ObjectId(booking_id)
    except Exception:
        return jsonify({"error": "Invalid booking ID"}), 400

    booking = mongo.db.bookings.find_one({"_id": obj_id})
    if not booking:
        return jsonify({"error": "Booking not found"}), 404

    # Restore seats if booking was confirmed
    try:
        if booking.get('status') == 'confirmed' and booking.get('transport_id'):
            mongo.db.transports.update_one(
                {"_id": ObjectId(booking['transport_id'])},
                {"$inc": {"seats_available": int(booking.get('passengers', 0) or 0)}}
            )
    except Exception:
        # don't block deletion
        pass

    mongo.db.bookings.delete_one({"_id": obj_id})
    return jsonify({"message": "Booking deleted successfully"}), 200

@admin_bp.route('/api/admin/revenue', methods=['GET'])
def get_revenue():
    admin = verify_admin(request)
    if not admin:
        return jsonify({"error": "Unauthorized"}), 403

    mongo = current_app.mongo

    pipeline = [
        {"$match": {"status": "confirmed"}},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$total_price"}}}
    ]

    agg = list(mongo.db.bookings.aggregate(pipeline))
    total = float(agg[0]["total_revenue"]) if agg else 0.0

    return jsonify({"total_revenue": total}), 200
