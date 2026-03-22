// ===== CHECK AUTH =====
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token || role !== "user") {
    window.location.href = "login.html";
}

// Set user name
document.getElementById("userName").textContent = localStorage.getItem("userName") || "User";

// ===== LOAD BOOKINGS =====
async function loadBookings() {
    try {
        const res = await fetch("/api/booking/my-bookings", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();

        if (!res.ok) {
            if (res.status === 401) {
                localStorage.clear();
                window.location.href = "login.html";
            }
            return;
        }

        const bookings = data.bookings;

        // Update stats
        document.getElementById("totalBookings").textContent = bookings.length;
        document.getElementById("activeBookings").textContent =
            bookings.filter(b => b.status === "confirmed").length;
        document.getElementById("cancelledBookings").textContent =
            bookings.filter(b => b.status === "cancelled").length;

        // Render bookings
        const container = document.getElementById("bookingsList");

        if (bookings.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-ticket-alt" style="font-size:3rem; color:#ccc; margin-bottom:15px;"></i>
                    <p>No bookings yet. <a href="search.html" style="color:#3a7bd5;">Search routes</a> to book your first ride!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = bookings.map(b => `
            <div class="booking-item">
                <div class="booking-info">
                    <h3><i class="fas ${getModeIcon(b.mode)}"></i> ${b.mode} - ${b.route_number}</h3>
                    <p><i class="fas fa-circle" style="color:#27ae60; font-size:0.5rem;"></i> ${b.source}
                       → <i class="fas fa-map-marker-alt" style="color:#e74c3c;"></i> ${b.destination}</p>
                    <p><i class="fas fa-clock"></i> ${b.departure_time} - ${b.arrival_time} |
                       <i class="fas fa-users"></i> ${b.passengers} passenger(s) |
                       <i class="fas fa-calendar"></i> ${b.booked_at}</p>
                </div>
                <span class="booking-status ${b.status}">${b.status.toUpperCase()}</span>
                <span class="booking-price">₹${b.total_price.toFixed(2)}</span>
                ${b.status === "confirmed" ? `
                    <button class="btn btn-sm btn-danger" onclick="cancelBooking('${b._id}')">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                ` : ""}
            </div>
        `).join("");

    } catch (err) {
        console.error("Error loading bookings:", err);
    }
}

function getModeIcon(mode) {
    const icons = { "Bus": "fa-bus", "Train": "fa-train", "Metro": "fa-subway", "Ferry": "fa-ship" };
    return icons[mode] || "fa-bus";
}

// ===== CANCEL BOOKING =====
async function cancelBooking(bookingId) {
    if (!confirm("Are you sure you want to cancel this booking?")) return;

    try {
        const res = await fetch(`/api/booking/cancel/${bookingId}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            loadBookings();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert("Error cancelling booking");
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

loadBookings();