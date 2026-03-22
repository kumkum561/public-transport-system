// ===== AUTH CHECK =====
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token || role !== "user") {
    alert("Please login to book a ticket");
    window.location.href = "login.html";
}

let currentTransport = null;

// ===== LOAD TRANSPORT INFO =====
async function loadTransport() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
        document.getElementById("transportInfo").innerHTML =
            '<p class="no-data">No transport selected. <a href="search.html">Search routes</a></p>';
        return;
    }

    try {
        const res = await fetch("/api/transport/list");
        const data = await res.json();

        currentTransport = data.transports.find(t => t._id === id);

        if (!currentTransport) {
            document.getElementById("transportInfo").innerHTML =
                '<p class="no-data">Transport not found.</p>';
            return;
        }

        const t = currentTransport;
        document.getElementById("transportInfo").innerHTML = `
            <div class="info-row">
                <span class="info-label">Mode</span>
                <span class="info-value"><i class="fas ${getModeIcon(t.mode)}"></i> ${t.mode}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Route</span>
                <span class="info-value">${t.route_number}</span>
            </div>
            <div class="info-row">
                <span class="info-label">From</span>
                <span class="info-value">${t.source}</span>
            </div>
            <div class="info-row">
                <span class="info-label">To</span>
                <span class="info-value">${t.destination}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Departure</span>
                <span class="info-value">${t.departure_time}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Arrival</span>
                <span class="info-value">${t.arrival_time}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Available Seats</span>
                <span class="info-value">${t.seats_available}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Price per Ticket</span>
                <span class="info-value" style="font-weight:700; color:#27ae60;">₹${t.price.toFixed(2)}</span>
            </div>
        `;

        document.getElementById("passengers").max = t.seats_available;
        updateTotal();
    } catch (err) {
        console.error("Error loading transport:", err);
    }
}

function getModeIcon(mode) {
    const icons = { "Bus": "fa-bus", "Train": "fa-train", "Metro": "fa-subway", "Ferry": "fa-ship" };
    return icons[mode] || "fa-bus";
}

// ===== UPDATE TOTAL =====
function updateTotal() {
    if (!currentTransport) return;
    const passengers = parseInt(document.getElementById("passengers").value) || 1;
    const total = currentTransport.price * passengers;
    document.getElementById("totalPrice").textContent = total.toFixed(2);
}

// ===== CONFIRM BOOKING =====
async function confirmBooking() {
    if (!currentTransport) return;

    const passengers = parseInt(document.getElementById("passengers").value) || 1;
    const msgEl = document.getElementById("bookingMsg");
    const errEl = document.getElementById("bookingError");

    if (passengers < 1) {
        errEl.textContent = "At least 1 passenger required";
        errEl.classList.add("show");
        return;
    }

    if (passengers > currentTransport.seats_available) {
        errEl.textContent = `Only ${currentTransport.seats_available} seats available`;
        errEl.classList.add("show");
        return;
    }

    if (!confirm(`Confirm booking for ${passengers} passenger(s)? Total: ₹${(currentTransport.price * passengers).toFixed(2)}`)) {
        return;
    }

    try {
        const res = await fetch("/api/booking/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                transport_id: currentTransport._id,
                passengers: passengers
            })
        });

        const data = await res.json();

        if (res.ok) {
            msgEl.innerHTML = `
                ✅ ${data.message}<br>
                Booking ID: <strong>${data.booking_id}</strong><br>
                Total Paid: <strong>₹${data.total_price.toFixed(2)}</strong>
            `;
            msgEl.classList.add("show");
            errEl.classList.remove("show");

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 3000);
        } else {
            errEl.textContent = data.error;
            errEl.classList.add("show");
            msgEl.classList.remove("show");
        }
    } catch (err) {
        errEl.textContent = "Server error. Please try again.";
        errEl.classList.add("show");
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

loadTransport();