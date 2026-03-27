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

        container.innerHTML = bookings.map(b => {
            const seatsHtml = b.selected_seats && b.selected_seats.length > 0
                ? `<i class="fas fa-chair"></i> Seats: ${[...b.selected_seats].sort((a,c)=>a-c).join(", ")} |`
                : "";

            const qrBtn = (b.status === "confirmed" && b.qr_code)
                ? `<button class="btn btn-sm btn-secondary" onclick="showQr('${b._id}', '${escapeHtml(b.qr_code)}')">
                       <i class="fas fa-qrcode"></i> QR
                   </button>`
                : "";

            const cancelBtn = b.status === "confirmed"
                ? `<button class="btn btn-sm btn-danger" onclick="cancelBooking('${b._id}')">
                       <i class="fas fa-times"></i> Cancel
                   </button>`
                : "";

            const cancelledBadge = b.status === "cancelled"
                ? `<span class="cancelled-tag"><i class="fas fa-ban"></i> Cancelled</span>` : "";

            return `
            <div class="booking-item">
                <div class="booking-info">
                    <h3><i class="fas ${getModeIcon(b.mode)}"></i> ${b.mode} - ${b.route_number}</h3>
                    <p><i class="fas fa-circle" style="color:#27ae60; font-size:0.5rem;"></i> ${b.source}
                       → <i class="fas fa-map-marker-alt" style="color:#e74c3c;"></i> ${b.destination}</p>
                    <p><i class="fas fa-clock"></i> ${b.departure_time} - ${b.arrival_time} |
                       ${seatsHtml}
                       <i class="fas fa-users"></i> ${b.passengers} passenger(s) |
                       <i class="fas fa-calendar"></i> ${b.booked_at}</p>
                    ${cancelledBadge}
                </div>
                <span class="booking-status ${b.status}">${b.status.toUpperCase()}</span>
                <span class="booking-price">₹${b.total_price.toFixed(2)}</span>
                ${qrBtn}
                ${cancelBtn}
            </div>
            `;
        }).join("");

    } catch (err) {
        console.error("Error loading bookings:", err);
    }
}

function getModeIcon(mode) {
    const icons = { "Bus": "fa-bus", "Train": "fa-train", "Metro": "fa-subway" };
    return icons[mode] || "fa-bus";
}

function escapeHtml(str) {
    return (str || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
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
            loadNotifications();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert("Error cancelling booking");
    }
}

// ===== QR CODE =====
function showQr(bookingId, qrBase64) {
    document.getElementById("qrBookingId").textContent = `Booking ID: ${bookingId}`;
    document.getElementById("qrImage").src = `data:image/png;base64,${qrBase64}`;
    document.getElementById("qrModal").style.display = "flex";
}

function closeQrModal() {
    document.getElementById("qrModal").style.display = "none";
}

// ===== NOTIFICATIONS =====
async function loadNotifications() {
    try {
        const res = await fetch("/api/notifications", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) return;

        const data = await res.json();
        const badge = document.getElementById("notifBadge");

        if (data.unread_count > 0) {
            badge.textContent = data.unread_count;
            badge.style.display = "inline-block";
        } else {
            badge.style.display = "none";
        }

        const list = document.getElementById("notifList");
        if (!data.notifications || data.notifications.length === 0) {
            list.innerHTML = '<p class="no-data" style="padding:16px;">No notifications</p>';
            return;
        }

        list.innerHTML = data.notifications.map(n => {
            const icon = n.type === "booking_confirmed"
                ? "fa-check-circle notif-icon-success"
                : "fa-times-circle notif-icon-danger";
            const unreadClass = n.read ? "" : "notif-item-unread";
            return `
            <div class="notif-item ${unreadClass}">
                <i class="fas ${icon}"></i>
                <div class="notif-content">
                    <p>${n.message}</p>
                    <span class="notif-time">${n.created_at}</span>
                </div>
            </div>`;
        }).join("");
    } catch (err) {
        console.error("Error loading notifications:", err);
    }
}

function toggleNotifications(e) {
    e.preventDefault();
    const panel = document.getElementById("notifPanel");
    const overlay = document.getElementById("notifOverlay");
    const isVisible = panel.style.display !== "none";
    if (isVisible) {
        panel.style.display = "none";
        overlay.style.display = "none";
    } else {
        panel.style.display = "block";
        overlay.style.display = "block";
        loadNotifications();
    }
}

function closeNotifications() {
    document.getElementById("notifPanel").style.display = "none";
    document.getElementById("notifOverlay").style.display = "none";
}

async function markAllRead() {
    try {
        await fetch("/api/notifications/mark-read", {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });
        loadNotifications();
    } catch (err) {
        console.error("Error marking notifications as read:", err);
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

loadBookings();
loadNotifications();