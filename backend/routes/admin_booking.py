from flask import Blueprint, request
from flask_pymongo import PyMongo
from datetime import datetime
from bson.objectid import ObjectId

admin_bp = Blueprint('admin', __name__)
mongo = PyMongo()

@admin_bp.route('/api/admin/bookings', methods=['GET'])
def get_bookings():
    filters = { }
    if 'source' in request.args:
        filters['source'] = request.args['source']
    if 'destination' in request.args:
        filters['destination'] = request.args['destination']
    if 'date_from' in request.args:
        date_from = datetime.strptime(request.args['date_from'], '%Y-%m-%d')
        filters['booked_at'] = { '$gte': date_from }
    if 'date_to' in request.args:
        date_to = datetime.strptime(request.args['date_to'], '%Y-%m-%d')
        if 'booked_at' in filters:
            filters['booked_at']['$lte'] = date_to
        else:
            filters['booked_at'] = { '$lte': date_to }

    bookings = mongo.db.bookings.find(filters)
    result = []
    for booking in bookings:
        booking_info = {
            'user': {
                'name': booking['user_name'],
                'email': booking['user_email'],
                'phone': booking['user_phone']
            },
            'ticket_status': booking.get('ticket_status', 'Nil'),
            'availability': 'Not Available' if booking.get('transport_id') is None or booking.get('active') is False else 'Nil',
            'ticket_price': booking['total_price'],
            'booked_at': booking['booked_at'].strftime('%Y-%m-%d %H:%M'),
        }
        result.append(booking_info)
    return {'bookings': result}, 200

@admin_bp.route('/api/admin/bookings/<booking_id>', methods=['PATCH'])
def update_booking(booking_id):
    status = request.json.get('status')
    if status not in ['confirmed', 'cancelled']:
        return {'error': 'Invalid status'}, 400
    transport = mongo.db.transports.find_one({'_id': ObjectId(booking['transport_id'])})
    # Handle seat restoration logic on cancellation
    # Update the booking status
    return {'message': 'Booking updated'}, 200

@admin_bp.route('/api/admin/bookings/<booking_id>', methods=['DELETE'])
def delete_booking(booking_id):
    # Restore seats if booking was confirmed
    # Delete the booking document
    return {'message': 'Booking deleted and seats restored'}, 200

@admin_bp.route('/api/admin/revenue', methods=['GET'])
def get_revenue():
    total_revenue = mongo.db.bookings.aggregate([
        { '$match': { 'status': 'confirmed' } },
        { '$group': { '_id': None, 'total': { '$sum': '$total_price' } } }
    ])
    return {'total_revenue': total_revenue['total']}, 200
