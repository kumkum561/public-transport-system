from flask import Flask, send_from_directory
from flask_pymongo import PyMongo
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from config import Config
import os

app = Flask(__name__, static_folder="../frontend", static_url_path="")
app.config.from_object(Config)

mongo = PyMongo(app)
bcrypt = Bcrypt(app)
CORS(app)

# Make mongo and bcrypt accessible to routes
app.mongo = mongo
app.bcrypt = bcrypt

# Register blueprints
from routes.auth import auth_bp
from routes.transport import transport_bp
from routes.booking import booking_bp

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(transport_bp, url_prefix="/api/transport")
app.register_blueprint(booking_bp, url_prefix="/api/booking")

# Serve frontend pages
@app.route("/")
def index():
    return send_from_directory("../frontend", "index.html")

@app.route("/<path:path>")
def serve_frontend(path):
    return send_from_directory("../frontend", path)

# Create indexes and seed admin on startup
def init_db():
    with app.app_context():
        # Create indexes
        mongo.db.users.create_index("email", unique=True)
        mongo.db.transports.create_index([("source", 1), ("destination", 1)])

        # Seed admin if not exists
        admin = mongo.db.admins.find_one({"username": Config.ADMIN_USERNAME})
        if not admin:
            hashed = bcrypt.generate_password_hash(Config.ADMIN_PASSWORD).decode("utf-8")
            mongo.db.admins.insert_one({
                "username": Config.ADMIN_USERNAME,
                "password": hashed,
                "role": "admin"
            })
            print("✅ Admin account created")

        # Seed sample transport data if empty
        if mongo.db.transports.count_documents({}) == 0:
            sample_data = [
                {
                    "mode": "Bus",
                    "route_number": "B-101",
                    "source": "Central Station",
                    "destination": "Airport Terminal",
                    "departure_time": "06:00",
                    "arrival_time": "07:30",
                    "price": 45.00,
                    "seats_available": 40,
                    "total_seats": 50,
                    "status": "active"
                },
                {
                    "mode": "Train",
                    "route_number": "T-202",
                    "source": "Downtown",
                    "destination": "Suburb North",
                    "departure_time": "08:00",
                    "arrival_time": "09:15",
                    "price": 75.00,
                    "seats_available": 150,
                    "total_seats": 200,
                    "status": "active"
                },
                {
                    "mode": "Metro",
                    "route_number": "M-303",
                    "source": "University",
                    "destination": "City Center",
                    "departure_time": "07:30",
                    "arrival_time": "08:00",
                    "price": 25.00,
                    "seats_available": 80,
                    "total_seats": 100,
                    "status": "active"
                },
                {
                    "mode": "Bus",
                    "route_number": "B-105",
                    "source": "Mall Plaza",
                    "destination": "Tech Park",
                    "departure_time": "10:00",
                    "arrival_time": "11:00",
                    "price": 30.00,
                    "seats_available": 35,
                    "total_seats": 50,
                    "status": "active"
                }
            ]
            mongo.db.transports.insert_many(sample_data)
            print("✅ Sample transport data seeded")

init_db()

if __name__ == "__main__":
    print("🚌 Public Transport System running at http://localhost:5000")
    app.run(debug=True, port=5000)