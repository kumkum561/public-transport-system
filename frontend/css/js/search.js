// Check login state for nav
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (token && role === "user") {
    const loginBtn = document.getElementById("loginBtn");
    const dashBtn = document.getElementById("dashboardBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    if (loginBtn) loginBtn.style.display = "none";
    if (dashBtn) dashBtn.style.display = "inline";
    if (logoutBtn) logoutBtn.style.display = "inline";
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

function getModeIcon(mode) {
    const icons = { "Bus": "fa-bus", "Train": "fa-train", "Metro": "fa-subway", "Ferry": "fa-ship" };
    return icons[mode] || "fa-bus";
}

// ===== SEARCH =====
async function searchRoutes() {
    const source = document.getElementById("searchSource").value.trim();
    const dest = document.getElementById("searchDest").value.trim();
    const mode = document.getElementById("searchMode").value;

    const params = new URLSearchParams();
    if (source) params.append("source", source);
    if (dest) params.append("destination", dest);
    if (mode) params.append("mode", mode);

    try {
        const res = await fetch(`/api/transport/search?${params.toString()}`);
        const data = await res.json();
        renderResults(data.transports);
    } catch (err) {
        console.error("Search error:", err);
    }
}

function renderResults(transports) {
    const container = document.getElementById("searchResults");

    if (transports.length === 0) {
        container.innerHTML = `
            <div class="no-data" style="grid-column: 1/-1;">
                <i class="fas fa-search" style="font-size:3rem; color:#ccc; display:block; margin-bottom:15px;"></i>
                <p>No routes found. Try different search criteria.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transports.map(t => `
        <div class="transport-card">
            <div class="transport-mode ${t.mode.toLowerCase()}">
                <i class="fas ${getModeIcon(t.mode)}"></i>
                <span>${t.mode}</span>
            </div>
            <div class="transport-details">
                <div class="route-info">
                    <span class="route-number">${t.route_number}</span>
                </div>
                <div class="route-path">
                    <span class="source"><i class="fas fa-circle"></i> ${t.source}</span>
                    <span class="arrow"><i class="fas fa-long-arrow-alt-right"></i></span>
                    <span class="dest"><i class="fas fa-map-marker-alt"></i> ${t.destination}</span>
                </div>
                <div class="transport-meta">
                    <span><i class="fas fa-clock"></i> ${t.departure_time} - ${t.arrival_time}</span>
                    <span><i class="fas fa-chair"></i> ${t.seats_available} seats</span>
                    <span class="price">₹${t.price.toFixed(2)}</span>
                </div>
            </div>
            <a href="booking.html?id=${t._id}" class="btn btn-sm btn-primary">Book Now</a>
        </div>
    `).join("");
}

function clearSearch() {
    document.getElementById("searchSource").value = "";
    document.getElementById("searchDest").value = "";
    document.getElementById("searchMode").value = "";
    searchRoutes();
}

// ===== LOAD FROM URL PARAMS (from hero search) =====
window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source") || "";
    const dest = params.get("destination") || "";
    const mode = params.get("mode") || "";

    document.getElementById("searchSource").value = source;
    document.getElementById("searchDest").value = dest;
    document.getElementById("searchMode").value = mode;

    searchRoutes();
});