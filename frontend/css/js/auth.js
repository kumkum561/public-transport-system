// ===== TOGGLE PASSWORD VISIBILITY =====
function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}

// ===== SHOW ERROR =====
function showError(msg) {
    const el = document.getElementById("errorMsg");
    if (Array.isArray(msg)) {
        el.innerHTML = msg.map(m => `• ${m}`).join("<br>");
    } else {
        el.textContent = msg;
    }
    el.classList.add("show");
}

function hideError() {
    const el = document.getElementById("errorMsg");
    if (el) {
        el.classList.remove("show");
        el.textContent = "";
    }
}

function showSuccess(msg) {
    const el = document.getElementById("successMsg");
    if (el) {
        el.textContent = msg;
        el.classList.add("show");
    }
}

// ===== USER LOGIN =====
async function handleLogin(e) {
    e.preventDefault();
    hideError();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        showError("Please fill in all fields");
        return;
    }

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("role", "user");
            localStorage.setItem("userName", data.user.name);
            localStorage.setItem("userEmail", data.user.email);
            window.location.href = "dashboard.html";
        } else {
            showError(data.error);
        }
    } catch (err) {
        showError("Server error. Please try again.");
    }
}

// ===== USER REGISTRATION =====
async function handleRegister(e) {
    e.preventDefault();
    hideError();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!name || !email || !phone || !password || !confirmPassword) {
        showError("Please fill in all fields");
        return;
    }

    if (password !== confirmPassword) {
        showError("Passwords do not match");
        return;
    }

    // Client-side password validation
    const errors = [];
    if (password.length < 8) errors.push("Password must be at least 8 characters");
    if (!/[A-Z]/.test(password)) errors.push("Need at least one uppercase letter");
    if (!/[a-z]/.test(password)) errors.push("Need at least one lowercase letter");
    if (!/\d/.test(password)) errors.push("Need at least one digit");
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push("Need at least one special character");

    if (errors.length > 0) {
        showError(errors);
        return;
    }

    if (!/^\d{10}$/.test(phone)) {
        showError("Phone number must be exactly 10 digits");
        return;
    }

    try {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, phone, password })
        });

        const data = await res.json();

        if (res.ok) {
            showSuccess(data.message);
            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);
        } else {
            showError(data.error);
        }
    } catch (err) {
        showError("Server error. Please try again.");
    }
}

// ===== ADMIN LOGIN =====
async function handleAdminLogin(e) {
    e.preventDefault();
    hideError();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("adminPassword").value;

    if (!username || !password) {
        showError("Please fill in all fields");
        return;
    }

    try {
        const res = await fetch("/api/auth/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("role", "admin");
            window.location.href = "admin-dashboard.html";
        } else {
            showError(data.error);
        }
    } catch (err) {
        showError("Server error. Please try again.");
    }
}

// ===== LOGOUT =====
function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}