from flask import Blueprint, request, jsonify
from flask_pymongo import PyMongo
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity

mongo = PyMongo()
admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# JWT verification decorator
def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        current_user = get_jwt_identity()
        if current_user['role'] != 'admin':
            return jsonify({'msg': 'Access forbidden: Admins only'}), 403
        return fn(*args, **kwargs)
    return wrapper

@admin_bp.route('/bookings', methods=['GET'])
@admin_required
def get_bookings():
    filters = {"source": request.args.get('source'),
               "destination": request.args.get('destination'),
               "date_from": request.args.get('date_from'),
               "date_to": request.args.get('date_to')}
    bookings = mongo.db.bookings.find(filters)
    bookings_list = []
    for booking in bookings:
        user = mongo.db.users.find_one({"_id": booking['user_id']})
        booking['user_name'] = user['name']
        booking['user_phone'] = user['phone']
        booking['status'] = 'Booked' if booking['status'] else 'Cancelled'
        bookings_list.append(booking)
    return jsonify(bookings_list), 200

@admin_bp.route('/bookings/<id>', methods=['PATCH'])
@admin_required
def update_booking_status(id):
    status = request.json.get('status')
    booking = mongo.db.bookings.find_one({"_id": id})
    if status == 'confirmed':
        if booking['seats'] > 0:
            mongo.db.bookings.update_one({"_id": id}, {"$set": {"status": True, "seats": booking['seats'] - 1}})
            return jsonify({'msg': 'Booking confirmed'}), 200
        else:
            return jsonify({'msg': 'Not enough seats available'}), 400
    elif status == 'cancelled':
        mongo.db.bookings.update_one({"_id": id}, {"$set": {"status": False, "seats": booking['seats'] + 1}})
        return jsonify({'msg': 'Booking cancelled'}), 200
    return jsonify({'msg': 'Invalid status'}), 400

@admin_bp.route('/bookings/<id>', methods=['DELETE'])
@admin_required
def delete_booking(id):
    booking = mongo.db.bookings.find_one({"_id": id})
    if booking['status']:
        mongo.db.bookings.update_one({"_id": id}, {"$set": {"seats": booking['seats'] + 1}})
    mongo.db.bookings.delete_one({"_id": id})
    return jsonify({'msg': 'Booking deleted'}), 200

@admin_bp.route('/revenue', methods=['GET'])
@admin_required
def get_revenue():
    revenue = mongo.db.bookings.aggregate([
        {"$match": {"status": True}},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$total_price"}}}
    ])
    total_revenue = next(revenue, {}).get('total_revenue', 0)
    return jsonify({'total_revenue': total_revenue}), 200
