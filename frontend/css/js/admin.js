// ===== CHECK ADMIN AUTH =====
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token || role !== "admin") {
    window.location.href = "admin-login.html";
}

// ===== TOGGLE SECTION =====
function toggleSection(id) {
    const el = document.getElementById(id);
    el.style.display = el.style.display === "none" ? "block" : (el.style.display === "" ? "none" : el.style.display === "block" ? "none" : "block");
}

// ===== LOAD ALL TRANSPORTS =====
async function loadAdminTransports() {
    try {
        const res = await fetch("/api/transport/all", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();

        if (!res.ok) {
            if (res.status === 403 || res.status === 401) {
                localStorage.clear();
                window.location.href = "admin-login.html";
            }
            return;
        }

        const container = document.getElementById("adminTransportList");

        if (data.transports.length === 0) {
            container.innerHTML = '<p class="no-data">No transports found. Add one above!</p>';
            return;
        }

        container.innerHTML = data.transports.map(t => `
            <div class="admin-transport-item">
                <div class="item-info">
                    <h4>
                        <span class="transport-mode ${t.mode.toLowerCase()}" style="display:inline-flex; padding:3px 10px; font-size:0.75rem;">
                            ${t.mode}
                        </span>
                        ${t.route_number} — ${t.source} → ${t.destination}
                    </h4>
                    <p>
                        <i class="fas fa-clock"></i> ${t.departure_time} - ${t.arrival_time} |
                        <i class="fas fa-chair"></i> ${t.seats_available}/${t.total_seats} seats |
                        <strong>₹${t.price.toFixed(2)}</strong> |
                        <span class="status-badge ${t.status}">${t.status.toUpperCase()}</span>
                    </p>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-warning" onclick='openEdit(${JSON.stringify(t)})'>
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTransport('${t._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join("");

    } catch (err) {
        console.error("Error loading transports:", err);
    }
}

// ===== ADD TRANSPORT =====
async function addTransport(e) {
    e.preventDefault();

    const transport = {
        mode: document.getElementById("addMode").value,
        route_number: document.getElementById("addRouteNumber").value.trim(),
        source: document.getElementById("addSource").value.trim(),
        destination: document.getElementById("addDestination").value.trim(),
        departure_time: document.getElementById("addDeparture").value,
        arrival_time: document.getElementById("addArrival").value,
        price: parseFloat(document.getElementById("addPrice").value),
        total_seats: parseInt(document.getElementById("addSeats").value)
    };

    try {
        const res = await fetch("/api/transport/add", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(transport)
        });

        const data = await res.json();
        const msgEl = document.getElementById("addMsg");
        const errEl = document.getElementById("addError");

        if (res.ok) {
            msgEl.textContent = data.message;
            msgEl.classList.add("show");
            errEl.classList.remove("show");
            document.getElementById("addTransportForm").reset();
            loadAdminTransports();
            setTimeout(() => msgEl.classList.remove("show"), 3000);
        } else {
            errEl.textContent = data.error;
            errEl.classList.add("show");
            msgEl.classList.remove("show");
        }
    } catch (err) {
        document.getElementById("addError").textContent = "Server error";
        document.getElementById("addError").classList.add("show");
    }
}

// ===== EDIT MODAL =====
function openEdit(transport) {
    document.getElementById("editId").value = transport._id;
    document.getElementById("editMode").value = transport.mode;
    document.getElementById("editRouteNumber").value = transport.route_number;
    document.getElementById("editSource").value = transport.source;
    document.getElementById("editDestination").value = transport.destination;
    document.getElementById("editDeparture").value = transport.departure_time;
    document.getElementById("editArrival").value = transport.arrival_time;
    document.getElementById("editPrice").value = transport.price;
    document.getElementById("editSeats").value = transport.total_seats;
    document.getElementById("editAvailable").value = transport.seats_available;
    document.getElementById("editStatus").value = transport.status;

    document.getElementById("editModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("editModal").style.display = "none";
    document.getElementById("editMsg").classList.remove("show");
    document.getElementById("editError").classList.remove("show");
}

// ===== UPDATE TRANSPORT =====
async function updateTransport(e) {
    e.preventDefault();

    const id = document.getElementById("editId").value;
    const update = {
        mode: document.getElementById("editMode").value,
        route_number: document.getElementById("editRouteNumber").value.trim(),
        source: document.getElementById("editSource").value.trim(),
        destination: document.getElementById("editDestination").value.trim(),
        departure_time: document.getElementById("editDeparture").value,
        arrival_time: document.getElementById("editArrival").value,
        price: parseFloat(document.getElementById("editPrice").value),
        total_seats: parseInt(document.getElementById("editSeats").value),
        seats_available: parseInt(document.getElementById("editAvailable").value),
        status: document.getElementById("editStatus").value
    };

    try {
        const res = await fetch(`/api/transport/update/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(update)
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById("editMsg").textContent = data.message;
            document.getElementById("editMsg").classList.add("show");
            document.getElementById("editError").classList.remove("show");
            loadAdminTransports();
            setTimeout(() => closeModal(), 1500);
        } else {
            document.getElementById("editError").textContent = data.error;
            document.getElementById("editError").classList.add("show");
        }
    } catch (err) {
        document.getElementById("editError").textContent = "Server error";
        document.getElementById("editError").classList.add("show");
    }
}

// ===== DELETE TRANSPORT =====
async function deleteTransport(id) {
    if (!confirm("Are you sure you want to delete this transport route? This cannot be undone.")) return;

    try {
        const res = await fetch(`/api/transport/delete/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            loadAdminTransports();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert("Error deleting transport");
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

// Load on page ready
loadAdminTransports();
// ===== ADMIN BOOKINGS =====
async function loadAdminBookings() {
    const source = document.getElementById("filterSource").value.trim();
    const dest = document.getElementById("filterDestination").value.trim();
    const dateFrom = document.getElementById("filterDateFrom").value;
    const dateTo = document.getElementById("filterDateTo").value;

    const params = new URLSearchParams();
    if (source) params.append("source", source);
    if (dest) params.append("destination", dest);
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);

    const container = document.getElementById("adminBookingsList");
    container.innerHTML = '<p class="no-data"><i class="fas fa-spinner fa-spin"></i> Loading...</p>';

    try {
        const res = await fetch(`/api/admin/bookings?${params.toString()}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            container.innerHTML = `<p class="no-data">Error: ${data.error || "Failed to load bookings"}</p>`;
            return;
        }

        if (!data.bookings || data.bookings.length === 0) {
            container.innerHTML = '<p class="no-data">No bookings found.</p>';
            return;
        }

        container.innerHTML = `
            <p style="font-size:0.85rem; color:#666; margin-bottom:10px;">
                Showing ${data.count} booking(s)
            </p>` +
            data.bookings.map(b => {
                const seatsHtml = b.selected_seats && b.selected_seats.length > 0
                    ? `<span><i class="fas fa-chair"></i> Seats: ${b.selected_seats.sort((a,c)=>a-c).join(", ")}</span>`
                    : `<span><i class="fas fa-users"></i> Passengers: ${b.number_of_tickets}</span>`;

                const qrBadge = b.has_qr
                    ? `<span class="admin-badge qr-badge"><i class="fas fa-qrcode"></i> QR</span>`
                    : "";

                const statusClass = b.ticket_status === "Booked" ? "confirmed" : "cancelled";
                const payBadge = b.payment_status && b.payment_status !== "Nil / Not Available"
                    ? `<span class="admin-badge pay-badge"><i class="fas fa-rupee-sign"></i> ${b.payment_status}</span>`
                    : "";

                return `
                <div class="admin-booking-item">
                    <div class="booking-user-info">
                        <strong>${b.user_name}</strong>
                        <span>${b.email}</span>
                        <span><i class="fas fa-phone"></i> ${b.phone}</span>
                    </div>
                    <div class="booking-route-info">
                        <span><i class="fas fa-route"></i> ${b.mode} ${b.route_number}</span>
                        <span>${b.source} → ${b.destination}</span>
                        <span><i class="fas fa-clock"></i> ${b.departure_time} - ${b.arrival_time}</span>
                    </div>
                    <div class="booking-ticket-info">
                        ${seatsHtml}
                        <span><i class="fas fa-calendar"></i> ${b.booking_date_time}</span>
                        <span class="booking-status ${statusClass}">${b.ticket_status}</span>
                        ${qrBadge}${payBadge}
                    </div>
                    <div class="booking-price-col">
                        <strong>₹${b.ticket_price.toFixed(2)}</strong>
                        <button class="btn btn-sm btn-danger" onclick="adminDeleteBooking('${b._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`;
            }).join("");
    } catch (err) {
        container.innerHTML = '<p class="no-data">Server error loading bookings.</p>';
        console.error(err);
    }
}

function clearBookingFilters() {
    document.getElementById("filterSource").value = "";
    document.getElementById("filterDestination").value = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    document.getElementById("adminBookingsList").innerHTML = '<p class="no-data">Click Search to load bookings.</p>';
}

async function adminDeleteBooking(bookingId) {
    if (!confirm("Delete this booking permanently?")) return;
    try {
        const res = await fetch(`/api/admin/bookings/${bookingId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            loadAdminBookings();
        } else {
            alert(data.error || "Failed to delete booking");
        }
    } catch (err) {
        alert("Server error");
    }
}

// ===== REVENUE =====
async function loadRevenue() {
    try {
        const res = await fetch("/api/admin/revenue", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById("revenueDisplay").textContent =
                `Total Revenue: ₹${data.total_revenue.toFixed(2)}`;
        }
    } catch (err) {
        console.error("Error loading revenue:", err);
    }
}
