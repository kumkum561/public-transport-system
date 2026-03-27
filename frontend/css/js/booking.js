// ===== AUTH CHECK =====
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token || role !== "user") {
    alert("Please login to book a ticket");
    window.location.href = "login.html";
}

let currentTransport = null;
let selectedOffer = "";
let selectedSeats = [];   // array of seat numbers (integers) chosen by the user
let currentOrderId = null; // payment order ID from /api/payment/initiate

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

        await loadSeatMap(id);
        updateTotal();
    } catch (err) {
        console.error("Error loading transport:", err);
    }
}

function getModeIcon(mode) {
    const icons = { "Bus": "fa-bus", "Train": "fa-train", "Metro": "fa-subway" };
    return icons[mode] || "fa-bus";
}

// ===== SEAT MAP =====
async function loadSeatMap(transportId) {
    try {
        const res = await fetch(`/api/booking/seats/${transportId}`);
        const data = await res.json();

        if (!res.ok) {
            document.getElementById("seatMap").innerHTML =
                '<p class="no-data">Unable to load seat map.</p>';
            return;
        }

        renderSeatMap(data.seats);
    } catch (err) {
        console.error("Error loading seats:", err);
        document.getElementById("seatMap").innerHTML =
            '<p class="no-data">Unable to load seat map.</p>';
    }
}

function renderSeatMap(seats) {
    const map = document.getElementById("seatMap");
    // Display all seats; use a scrollable grid for large transports
    map.innerHTML = seats.map(s => {
        const cls = s.status === "booked" ? "seat seat-booked" : "seat seat-available";
        const disabled = s.status === "booked" ? "disabled" : "";
        const title = s.status === "booked" ? `Seat ${s.seat_number} (Booked)` : `Seat ${s.seat_number}`;
        return `<button class="${cls}" id="seat_${s.seat_number}"
                        onclick="toggleSeat(${s.seat_number}, '${s.status}')"
                        title="${title}" ${disabled}>${s.seat_number}</button>`;
    }).join("");
}

function toggleSeat(seatNum, status) {
    if (status === "booked") return;

    const btn = document.getElementById(`seat_${seatNum}`);
    const idx = selectedSeats.indexOf(seatNum);

    if (idx === -1) {
        selectedSeats.push(seatNum);
        btn.classList.add("seat-selected");
        btn.classList.remove("seat-available");
    } else {
        selectedSeats.splice(idx, 1);
        btn.classList.remove("seat-selected");
        btn.classList.add("seat-available");
    }

    updateSeatInfo();
    updateTotal();
}

function updateSeatInfo() {
    const info = document.getElementById("seatSelectionInfo");
    if (selectedSeats.length === 0) {
        info.textContent = "No seats selected";
        info.className = "seat-selection-info";
    } else {
        const sorted = [...selectedSeats].sort((a, b) => a - b);
        info.textContent = `Selected ${selectedSeats.length} seat(s): ${sorted.join(", ")}`;
        info.className = "seat-selection-info has-selection";
    }
}

// ===== OFFER SELECTION =====
function selectOffer(offer) {
    selectedOffer = selectedOffer === offer ? "" : offer;
    document.querySelectorAll(".offer-card").forEach(card => card.classList.remove("selected"));
    if (selectedOffer) {
        document.getElementById("offerCard_" + selectedOffer).classList.add("selected");
    }
    updateTotal();
}

// ===== CALCULATE DISCOUNTED TOTAL =====
function calcTotal(price, passengers, offer) {
    let base = price * passengers;
    let discount = 0;
    if (offer === "offer1") {
        discount = base * 0.10;
    } else if (offer === "offer2") {
        const pairs = Math.floor(passengers / 2);
        discount = pairs * price * 0.5;
    }
    return { base: base, discount: discount, total: base - discount };
}

// ===== UPDATE TOTAL =====
function updateTotal() {
    if (!currentTransport) return;
    const passengers = selectedSeats.length || 0;
    if (passengers === 0) {
        document.getElementById("priceBreakdown").style.display = "none";
        document.getElementById("totalPrice").textContent = "0.00";
        return;
    }

    const { base, discount, total } = calcTotal(currentTransport.price, passengers, selectedOffer);

    const breakdownEl = document.getElementById("priceBreakdown");
    if (discount > 0) {
        breakdownEl.innerHTML = `
            <div class="breakdown-row">
                <span>Base amount (${passengers} × ₹${currentTransport.price.toFixed(2)})</span>
                <span>₹${base.toFixed(2)}</span>
            </div>
            <div class="breakdown-row discount-row">
                <span><i class="fas fa-tag"></i> Discount applied</span>
                <span>− ₹${discount.toFixed(2)}</span>
            </div>
        `;
        breakdownEl.style.display = "block";
    } else {
        breakdownEl.style.display = "none";
    }

    document.getElementById("totalPrice").textContent = total.toFixed(2);
}

// ===== OPEN PAYMENT MODAL =====
async function openPaymentModal() {
    if (!currentTransport) return;

    const errEl = document.getElementById("bookingError");

    if (selectedSeats.length === 0) {
        errEl.textContent = "Please select at least one seat";
        errEl.classList.add("show");
        return;
    }
    if (selectedSeats.length > currentTransport.seats_available) {
        errEl.textContent = `Only ${currentTransport.seats_available} seats available`;
        errEl.classList.add("show");
        return;
    }
    errEl.classList.remove("show");

    const { total } = calcTotal(currentTransport.price, selectedSeats.length, selectedOffer);
    const amtStr = total.toFixed(2);

    // Initiate payment order via backend
    try {
        const res = await fetch("/api/payment/initiate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                transport_id: currentTransport._id,
                amount: total
            })
        });

        const orderData = await res.json();
        if (!res.ok) {
            errEl.textContent = orderData.error || "Failed to initiate payment";
            errEl.classList.add("show");
            return;
        }

        currentOrderId = orderData.order_id;
        document.getElementById("rzpOrderId").textContent = currentOrderId;
        document.getElementById("rzpOrderDisplay").style.display = "block";
    } catch (err) {
        errEl.textContent = "Server error. Please try again.";
        errEl.classList.add("show");
        return;
    }

    const sorted = [...selectedSeats].sort((a, b) => a - b);
    document.getElementById("rzpAmount").textContent = amtStr;
    document.getElementById("rzpBtnAmt").textContent = amtStr;
    document.getElementById("rzpRouteInfo").textContent =
        `${currentTransport.source} → ${currentTransport.destination} (${selectedSeats.length} seat(s): ${sorted.join(", ")})`;
    document.getElementById("razorpayModal").style.display = "flex";
}

function closePaymentModal() {
    document.getElementById("razorpayModal").style.display = "none";
    const payBtn = document.getElementById("rzpPayBtn");
    payBtn.disabled = false;
    const amt = document.getElementById("rzpAmount").textContent;
    payBtn.innerHTML = `<i class="fas fa-lock"></i> Pay ₹<span id="rzpBtnAmt">${amt}</span>`;
    currentOrderId = null;
}

// ===== PROCESS PAYMENT (verify then confirm booking) =====
async function processPayment() {
    const payBtn = document.getElementById("rzpPayBtn");
    payBtn.disabled = true;
    payBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    // Simulate brief processing delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Verify payment order
    try {
        const verifyRes = await fetch("/api/payment/verify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ order_id: currentOrderId })
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) {
            document.getElementById("razorpayModal").style.display = "none";
            const errEl = document.getElementById("bookingError");
            errEl.textContent = verifyData.error || "Payment verification failed";
            errEl.classList.add("show");
            return;
        }
    } catch (err) {
        document.getElementById("razorpayModal").style.display = "none";
        const errEl = document.getElementById("bookingError");
        errEl.textContent = "Payment error. Please try again.";
        errEl.classList.add("show");
        return;
    }

    document.getElementById("razorpayModal").style.display = "none";
    await confirmBooking();
}

// ===== CONFIRM BOOKING (called after payment verification) =====
async function confirmBooking() {
    if (!currentTransport) return;

    const msgEl = document.getElementById("bookingMsg");
    const errEl = document.getElementById("bookingError");

    try {
        const res = await fetch("/api/booking/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                transport_id: currentTransport._id,
                selected_seats: selectedSeats,
                offer: selectedOffer,
                payment_method: "online"
            })
        });

        const data = await res.json();

        if (res.ok) {
            let discountLine = "";
            if (data.discount_amount > 0) {
                discountLine = `<br>You saved: <strong>₹${data.discount_amount.toFixed(2)}</strong>`;
            }
            const sortedSeats = [...selectedSeats].sort((a, b) => a - b);
            msgEl.innerHTML = `
                ✅ Payment successful! ${data.message}<br>
                Booking ID: <strong>${data.booking_id}</strong><br>
                Seats: <strong>${sortedSeats.join(", ")}</strong><br>
                Total Paid: <strong>₹${data.total_price.toFixed(2)}</strong>${discountLine}
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