from flask import Blueprint, request, jsonify, current_app
import jwt
from bson import ObjectId
from models.transport import create_transport_document
from config import Config

transport_bp = Blueprint("transport", __name__)


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


@transport_bp.route("/list", methods=["GET"])
def list_transports():
    mongo = current_app.mongo
    transports = list(mongo.db.transports.find({"status": "active"}))

    for t in transports:
        t["_id"] = str(t["_id"])

    return jsonify({"transports": transports}), 200


@transport_bp.route("/all", methods=["GET"])
def list_all_transports():
    """Admin endpoint - lists ALL transports including inactive"""
    admin = verify_admin(request)
    if not admin:
        return jsonify({"error": "Unauthorized"}), 403

    mongo = current_app.mongo
    transports = list(mongo.db.transports.find())
    for t in transports:
        t["_id"] = str(t["_id"])

    return jsonify({"transports": transports}), 200


@transport_bp.route("/search", methods=["GET"])
def search_transports():
    mongo = current_app.mongo

    source = request.args.get("source", "").strip()
    destination = request.args.get("destination", "").strip()
    mode = request.args.get("mode", "").strip()

    query = {"status": "active"}

    if source:
        query["source"] = {"$regex": source, "$options": "i"}
    if destination:
        query["destination"] = {"$regex": destination, "$options": "i"}
    if mode:
        query["mode"] = {"$regex": mode, "$options": "i"}

    transports = list(mongo.db.transports.find(query))
    for t in transports:
        t["_id"] = str(t["_id"])

    return jsonify({"transports": transports}), 200


@transport_bp.route("/add", methods=["POST"])
def add_transport():
    admin = verify_admin(request)
    if not admin:
        return jsonify({"error": "Unauthorized - Admin access required"}), 403

    data = request.get_json()
    mongo = current_app.mongo

    required = ["mode", "route_number", "source", "destination",
                 "departure_time", "arrival_time", "price", "total_seats"]

    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    transport_doc = create_transport_document(
        data["mode"], data["route_number"], data["source"],
        data["destination"], data["departure_time"], data["arrival_time"],
        data["price"], data["total_seats"]
    )

    result = mongo.db.transports.insert_one(transport_doc)
    return jsonify({
        "message": "Transport added successfully",
        "id": str(result.inserted_id)
    }), 201


@transport_bp.route("/update/<transport_id>", methods=["PUT"])
def update_transport(transport_id):
    admin = verify_admin(request)
    if not admin:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    mongo = current_app.mongo

    try:
        obj_id = ObjectId(transport_id)
    except:
        return jsonify({"error": "Invalid transport ID"}), 400

    update_fields = {}
    allowed = ["mode", "route_number", "source", "destination",
                "departure_time", "arrival_time", "price",
                "total_seats", "seats_available", "status"]

    for field in allowed:
        if field in data:
            if field == "price":
                update_fields[field] = float(data[field])
            elif field in ["total_seats", "seats_available"]:
                update_fields[field] = int(data[field])
            else:
                update_fields[field] = data[field]

    if not update_fields:
        return jsonify({"error": "No valid fields to update"}), 400

    result = mongo.db.transports.update_one(
        {"_id": obj_id},
        {"$set": update_fields}
    )

    if result.matched_count == 0:
        return jsonify({"error": "Transport not found"}), 404

    return jsonify({"message": "Transport updated successfully"}), 200


@transport_bp.route("/delete/<transport_id>", methods=["DELETE"])
def delete_transport(transport_id):
    admin = verify_admin(request)
    if not admin:
        return jsonify({"error": "Unauthorized"}), 403

    mongo = current_app.mongo

    try:
        obj_id = ObjectId(transport_id)
    except:
        return jsonify({"error": "Invalid transport ID"}), 400

    result = mongo.db.transports.delete_one({"_id": obj_id})

    if result.deleted_count == 0:
        return jsonify({"error": "Transport not found"}), 404

    return jsonify({"message": "Transport deleted successfully"}), 200