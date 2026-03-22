def create_transport_document(mode, route_number, source, destination,
                               departure_time, arrival_time, price,
                               total_seats):
    return {
        "mode": mode,
        "route_number": route_number,
        "source": source,
        "destination": destination,
        "departure_time": departure_time,
        "arrival_time": arrival_time,
        "price": float(price),
        "seats_available": int(total_seats),
        "total_seats": int(total_seats),
        "status": "active"
    }