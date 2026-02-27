/**
 * JetSetGo — Premium Flight Booking Application
 * script.js — Firebase + EmailJS powered
 */

"use strict";

/* ═══════════════════════════════════════════════════════════════
   1. FIREBASE CONFIG
   Setup: console.firebase.google.com → New Project → Web App
   → Authentication (Email/Password) → Firestore Database (test mode)
═══════════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBr0u1BEMjq0vb4DcSCIGsVaCj87CW06-k",
    authDomain: "jetsetgo-49591.firebaseapp.com",
    projectId: "jetsetgo-49591",
    storageBucket: "jetsetgo-49591.firebasestorage.app",
    messagingSenderId: "409166319561",
    appId: "1:409166319561:web:9afae5e1811d17eb6ca218",
    measurementId: "G-0V4771TR8Q"
};

let db, auth;
let _firebaseReady   = false;
let _firebaseLoading = false;

function loadFirebase() {
  return new Promise((resolve) => {
    if (_firebaseReady) { resolve(true); return; }
    if (_firebaseLoading) {
      const t = setInterval(() => { if (_firebaseReady) { clearInterval(t); resolve(true); } }, 100);
      return;
    }
    _firebaseLoading = true;
    const scripts = [
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js",
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js",
    ];
    let loaded = 0;
    scripts.forEach((src) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => {
        loaded++;
        if (loaded === scripts.length) {
          try {
            firebase.initializeApp(FIREBASE_CONFIG);
            auth = firebase.auth();
            db   = firebase.firestore();
            _firebaseReady = true;
            resolve(true);
          } catch (e) { console.error("Firebase init:", e); resolve(false); }
        }
      };
      s.onerror = () => { loaded++; if (loaded === scripts.length) resolve(false); };
      document.head.appendChild(s);
    });
  });
}

function isFirebaseConfigured() {
  return FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";
}

/* ═══════════════════════════════════════════════════════════════
   2. EMAILJS CONFIG
   Setup: emailjs.com → Gmail service → OTP template
   Template variables: {{to_email}}, {{to_name}}, {{otp_code}}
═══════════════════════════════════════════════════════════════ */

const EMAILJS_PUBLIC_KEY   = "zNnCUudcTC7T85FCQ";
const EMAILJS_SERVICE_ID   = "service_259r3rj";
const EMAILJS_OTP_TEMPLATE = "template_p12pyi4";

let _emailJsReady = false;

function loadEmailJS() {
  return new Promise((resolve) => {
    if (_emailJsReady) { resolve(true); return; }
    if (window.emailjs) {
      try { window.emailjs.init(EMAILJS_PUBLIC_KEY); _emailJsReady = true; resolve(true); } catch { resolve(false); }
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    s.onload = () => {
      try { window.emailjs.init(EMAILJS_PUBLIC_KEY); _emailJsReady = true; resolve(true); }
      catch (e) { resolve(false); }
    };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

function isEmailJsConfigured() {
  return EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY_HERE" &&
         EMAILJS_SERVICE_ID !== "YOUR_SERVICE_ID_HERE" &&
         EMAILJS_OTP_TEMPLATE !== "YOUR_OTP_TEMPLATE_ID";
}

async function sendOtpEmail(toEmail, toName, otp) {
  if (!isEmailJsConfigured()) {
    showToast(`✅ OTP (demo mode): ${otp}`, "success", 20000);
    return false;
  }
  const ready = await loadEmailJS();
  if (!ready) { showToast(`✅ OTP (fallback): ${otp}`, "warning", 20000); return false; }
  try {
    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_OTP_TEMPLATE, {
      to_email: toEmail, to_name: toName || "Traveler", otp_code: otp,
    });
    showToast(`📧 OTP sent to ${toEmail}!`, "success");
    return true;
  } catch (err) {
    console.error("EmailJS error:", err);
    showToast(`✅ OTP (fallback): ${otp}`, "warning", 20000);
    return false;
  }
}

async function sendPaymentLinkEmail(toEmail, toName, paymentLink, amount, bookingId) {
  const body = `Booking ID: ${bookingId}\nYour share: ${amount}\n\nPay here:\n${paymentLink}`;
  if (!isEmailJsConfigured()) {
    console.log("Payment link for", toName, ":", paymentLink);
    showToast(`📧 Demo — link for ${toName} logged to console`, "info", 8000);
    return false;
  }
  const ready = await loadEmailJS();
  if (!ready) return false;
  try {
    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_OTP_TEMPLATE, {
      to_email: toEmail, to_name: toName, otp_code: body,
    });
    showToast(`📧 Payment link sent to ${toEmail}!`, "success");
    return true;
  } catch (err) {
    console.error("EmailJS payment link error:", err);
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   3. THEME
═══════════════════════════════════════════════════════════════ */

function applyTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = mode === "dark" ? "☀️" : "🌙";
  localStorage.setItem("jsg_theme", mode);
}

function initTheme() {
  applyTheme(localStorage.getItem("jsg_theme") || "dark");
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    applyTheme(document.body.classList.contains("dark") ? "light" : "dark");
  });
}

/* ═══════════════════════════════════════════════════════════════
   4. TOAST
═══════════════════════════════════════════════════════════════ */

function showToast(msg, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const icons = { info:"ℹ️", success:"✅", error:"❌", warning:"⚠️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]||"ℹ️"}</span><span>${msg}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.cssText += "opacity:0;transform:translateX(100px);transition:all .4s ease";
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

/* ═══════════════════════════════════════════════════════════════
   5. AUTH
═══════════════════════════════════════════════════════════════ */

let _currentUserProfile = null;

function getLoggedInUser() {
  return _currentUserProfile || JSON.parse(localStorage.getItem("jsg_user_profile") || "null");
}

function requireLogin() {
  if (!getLoggedInUser()) {
    showToast("Please log in to continue.", "warning");
    sessionStorage.setItem("jsg_redirect", window.location.href);
    setTimeout(() => { window.location.href = "login.html"; }, 800);
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   6. NAV
═══════════════════════════════════════════════════════════════ */

function initNav() {
  const user      = getLoggedInUser();
  const loginLink = document.getElementById("nav-login");
  const logoutBtn = document.getElementById("nav-logout");
  if (loginLink)  loginLink.style.display  = user ? "none" : "";
  if (logoutBtn) {
    logoutBtn.style.display = user ? "" : "none";
    logoutBtn.onclick = async () => {
      if (isFirebaseConfigured() && auth) try { await auth.signOut(); } catch {}
      localStorage.removeItem("jsg_user_profile");
      _currentUserProfile = null;
      window.location.href = "login.html";
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
   7. LOGIN PAGE
═══════════════════════════════════════════════════════════════ */

function initLoginPage() {
  const form = document.getElementById("login-form");
  if (!form) return;
  if (getLoggedInUser()) { window.location.href = "index.html"; return; }

  document.getElementById("toggle-pw")?.addEventListener("click", function () {
    const pw = document.getElementById("login-password");
    pw.type = pw.type === "password" ? "text" : "password";
    this.textContent = pw.type === "password" ? "👁" : "🔒";
  });

  document.getElementById("demo-login")?.addEventListener("click", () => {
    const demo = { uid:"demo", name:"Demo User", email:"demo@jetsetgo.com", phone:"" };
    localStorage.setItem("jsg_user_profile", JSON.stringify(demo));
    _currentUserProfile = demo;
    showToast("Welcome, Demo User! ✈", "success");
    setTimeout(() => { window.location.href = sessionStorage.getItem("jsg_redirect") || "index.html"; }, 800);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    let valid = true;
    if (!isValidEmail(email)) { showError("login-email-err", true); valid = false; } else showError("login-email-err", false);
    if (password.length < 6)  { showError("login-pw-err", true);    valid = false; } else showError("login-pw-err", false);
    if (!valid) return;

    const btn = document.getElementById("login-submit");
    btn.disabled = true; btn.textContent = "Signing in…";

    const loginTimeout = setTimeout(() => {
      btn.disabled = false; btn.textContent = "Sign In ✈";
      const errEl = document.getElementById("login-general-err");
      errEl.textContent = "⚠ Request timed out. Check your Firebase config and internet connection.";
      errEl.classList.remove("hidden");
    }, 10000);

    if (isFirebaseConfigured()) {
      const firebaseReady = await loadFirebase();
      if (!firebaseReady) {
        btn.disabled = false; btn.textContent = "Sign In ✈";
        showToast("⚠ Could not connect to server. Check your Firebase config.", "error", 6000);
        return;
      }
      try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        // Build profile from Firebase Auth data (no Firestore read needed)
        let profile = { uid: cred.user.uid, name: cred.user.displayName || email.split("@")[0], email };
        // Try to get extra profile data from Firestore, but don't block on it
        try {
          const snap = await Promise.race([
            db.collection("users").doc(cred.user.uid).get(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
          ]);
          if (snap.exists) profile = { ...profile, ...snap.data() };
        } catch (firestoreErr) {
          console.warn("Firestore profile fetch skipped:", firestoreErr.message);
        }
        localStorage.setItem("jsg_user_profile", JSON.stringify(profile));
        clearTimeout(loginTimeout);
        _currentUserProfile = profile;
        showToast(`Welcome back, ${profile.name}! ✈`, "success");
        const redir = sessionStorage.getItem("jsg_redirect") || "index.html";
        sessionStorage.removeItem("jsg_redirect");
        setTimeout(() => { window.location.href = redir; }, 800);
      } catch (err) {
        clearTimeout(loginTimeout);
        btn.disabled = false; btn.textContent = "Sign In ✈";
        const errEl = document.getElementById("login-general-err");
        const msgs = {
          "auth/user-not-found":    "⚠ No account with this email.",
          "auth/wrong-password":    "⚠ Incorrect password.",
          "auth/invalid-credential":"⚠ Invalid email or password.",
          "auth/too-many-requests": "⚠ Too many attempts. Try later.",
          "auth/network-request-failed": "⚠ Network error. Check your connection.",
        };
        errEl.textContent = msgs[err.code] || `⚠ Login failed: ${err.message} (code: ${err.code})`;
        errEl.classList.remove("hidden");
        console.error("Login error:", err.code, err.message);
      }
    } else {
      // Fallback localStorage
      const users = JSON.parse(localStorage.getItem("jsg_users") || "[]");
      const user  = users.find(u => u.email === email && u.password === password);
      btn.disabled = false; btn.textContent = "Sign In ✈";
      if (!user) {
        const errEl = document.getElementById("login-general-err");
        errEl.textContent = "⚠ Invalid email or password."; errEl.classList.remove("hidden");
        return;
      }
      localStorage.setItem("jsg_user_profile", JSON.stringify(user));
      _currentUserProfile = user;
      showToast(`Welcome back, ${user.name}! ✈`, "success");
      const redir = sessionStorage.getItem("jsg_redirect") || "index.html";
      sessionStorage.removeItem("jsg_redirect");
      setTimeout(() => { window.location.href = redir; }, 800);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   8. SIGNUP PAGE
═══════════════════════════════════════════════════════════════ */

function initSignupPage() {
  const form = document.getElementById("signup-form");
  if (!form) return;
  if (getLoggedInUser()) { window.location.href = "index.html"; return; }

  document.getElementById("signup-password")?.addEventListener("input", function () { updatePwStrength(this.value); });
  document.getElementById("toggle-pw")?.addEventListener("click", function () {
    const pw = document.getElementById("signup-password");
    pw.type = pw.type === "password" ? "text" : "password";
    this.textContent = pw.type === "password" ? "👁" : "🔒";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name     = document.getElementById("signup-name").value.trim();
    const email    = document.getElementById("signup-email").value.trim();
    const phone    = document.getElementById("signup-phone").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirm  = document.getElementById("signup-confirm").value;
    let valid = true;
    if (name.length<2)                      { showError("signup-name-err",true);    valid=false; } else showError("signup-name-err",false);
    if (!isValidEmail(email))               { showError("signup-email-err",true);   valid=false; } else showError("signup-email-err",false);
    if (phone.replace(/\D/g,"").length<7)   { showError("signup-phone-err",true);   valid=false; } else showError("signup-phone-err",false);
    if (password.length<6)                  { showError("signup-pw-err",true);      valid=false; } else showError("signup-pw-err",false);
    if (password!==confirm)                 { showError("signup-confirm-err",true); valid=false; } else showError("signup-confirm-err",false);
    if (!valid) return;

    const btn = document.getElementById("signup-submit");
    btn.disabled = true; btn.textContent = "Creating account…";

    // Safety timeout — re-enable button after 10s no matter what
    const signupTimeout = setTimeout(() => {
      btn.disabled = false; btn.textContent = "Create Account ✈";
      const errEl = document.getElementById("signup-general-err");
      errEl.textContent = "⚠ Request timed out. Check your Firebase config and internet connection.";
      errEl.classList.remove("hidden");
    }, 10000);

    if (isFirebaseConfigured()) {
      const firebaseReady = await loadFirebase();
      if (!firebaseReady) {
        clearTimeout(signupTimeout);
        btn.disabled = false; btn.textContent = "Create Account ✈";
        showToast("⚠ Could not connect to server. Check your Firebase config.", "error", 6000);
        return;
      }
      try {
        const cred    = await auth.createUserWithEmailAndPassword(email, password);
        const profile = { uid: cred.user.uid, name, email, phone };
        // Save to Firestore but don't block signup if it fails
        db.collection("users").doc(cred.user.uid).set(profile).catch(e => {
          console.warn("Firestore profile save failed (non-critical):", e.message);
        });
        clearTimeout(signupTimeout);
        localStorage.setItem("jsg_user_profile", JSON.stringify(profile));
        _currentUserProfile = profile;
        showToast("Account created! Welcome aboard ✈", "success");
        setTimeout(() => { window.location.href = "index.html"; }, 800);
      } catch (err) {
        clearTimeout(signupTimeout);
        btn.disabled = false; btn.textContent = "Create Account ✈";
        const errEl = document.getElementById("signup-general-err");
        const msgs = {
          "auth/email-already-in-use": "⚠ Account already exists with this email.",
          "auth/weak-password":        "⚠ Password must be at least 6 characters.",
          "auth/network-request-failed": "⚠ Network error. Check your connection.",
          "auth/configuration-not-found": "⚠ Firebase not configured correctly. Check your config keys.",
          "auth/invalid-api-key":         "⚠ Invalid Firebase API key.",
        };
        errEl.textContent = msgs[err.code] || `⚠ Signup failed: ${err.message} (code: ${err.code})`;
        errEl.classList.remove("hidden");
        console.error("Signup error:", err.code, err.message);
      }
    } else {
      const users = JSON.parse(localStorage.getItem("jsg_users") || "[]");
      if (users.find(u => u.email === email)) {
        btn.disabled = false; btn.textContent = "Create Account ✈";
        const errEl = document.getElementById("signup-general-err");
        errEl.textContent = "⚠ Account already exists."; errEl.classList.remove("hidden");
        return;
      }
      const profile = { uid:generateId(), name, email, phone, password };
      users.push(profile);
      localStorage.setItem("jsg_users", JSON.stringify(users));
      localStorage.setItem("jsg_user_profile", JSON.stringify(profile));
      _currentUserProfile = profile;
      showToast("Account created! Welcome aboard ✈", "success");
      setTimeout(() => { window.location.href = "index.html"; }, 800);
    }
  });
}

function updatePwStrength(pw) {
  const bars  = [1,2,3,4].map(i => document.getElementById(`pw-bar-${i}`));
  const label = document.getElementById("pw-label");
  if (!bars[0]) return;
  let score = 0;
  if (pw.length>=6) score++;
  if (pw.length>=10) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const cls = ["filled-weak","filled-fair","filled-fair","filled-strong"];
  const lbl = ["","Weak","Fair","Strong","Very Strong"];
  bars.forEach((b,i) => { b.className="pw-bar"; if (i<score) b.classList.add(cls[Math.min(score-1,3)]); });
  if (label) label.textContent = pw.length>0 ? lbl[score] : "";
}

/* ═══════════════════════════════════════════════════════════════
   9. HOME PAGE
═══════════════════════════════════════════════════════════════ */

function initHomePage() {
  if (!document.getElementById("search-btn")) return;
  const today       = new Date().toISOString().split("T")[0];
  const departInput = document.getElementById("search-depart");
  const returnInput = document.getElementById("search-return");
  if (departInput) departInput.min = today;
  if (returnInput) returnInput.min = today;

  document.querySelectorAll(".trip-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".trip-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const rg = document.getElementById("return-date-group");
      if (rg) rg.style.display = tab.dataset.trip === "roundtrip" ? "" : "none";
    });
  });

  document.getElementById("search-btn").addEventListener("click", () => {
    const from       = document.getElementById("search-from").value;
    const to         = document.getElementById("search-to").value;
    const depart     = departInput?.value;
    const passengers = document.getElementById("search-passengers").value;
    const cls        = document.getElementById("search-class").value;
    if (!from)       { showToast("Select a departure city.", "warning"); return; }
    if (!to)         { showToast("Select a destination city.", "warning"); return; }
    if (from === to) { showToast("From and To cannot be the same.", "warning"); return; }
    if (!depart)     { showToast("Select a departure date.", "warning"); return; }
    window.location.href = `flights.html?${new URLSearchParams({from,to,depart,passengers,class:cls})}`;
  });
}

/* ═══════════════════════════════════════════════════════════════
   10. FLIGHT DATA & RESULTS
═══════════════════════════════════════════════════════════════ */

const AIRLINES = [
  {name:"IndiGo",code:"6E"},{name:"Air India",code:"AI"},{name:"SpiceJet",code:"SG"},
  {name:"Vistara",code:"UK"},{name:"Emirates",code:"EK"},{name:"Singapore Airlines",code:"SQ"},
  {name:"GoFirst",code:"G8"},{name:"AirAsia India",code:"I5"},
];
const BASE_PRICES = { Economy:{min:2500,max:18000}, Business:{min:12000,max:60000}, "First Class":{min:30000,max:120000} };

function generateFlights(from, to, travelClass, passengers) {
  return Array.from({length: Math.floor(Math.random()*5)+5}, () => {
    const a   = AIRLINES[Math.floor(Math.random()*AIRLINES.length)];
    const dH  = Math.floor(Math.random()*18)+5, dM = [0,15,30,45][Math.floor(Math.random()*4)];
    const dur = Math.floor(Math.random()*180)+60;
    const arr = dH*60+dM+dur;
    const r   = BASE_PRICES[travelClass]||BASE_PRICES.Economy;
    const px  = Math.floor(Math.random()*(r.max-r.min)+r.min);
    return {
      id:generateId(), airline:a.name, airlineCode:a.code,
      flightNumber:`${a.code}${Math.floor(Math.random()*9000)+1000}`,
      from, to,
      depTime:formatTime(dH,dM), arrTime:formatTime(Math.floor(arr/60)%24,arr%60),
      depHour:dH*60+dM, durationMins:dur, duration:formatDuration(dur),
      price:px, priceTotal:px*passengers, travelClass, passengers,
      stops: Math.random()>0.65?1:0,
    };
  }).sort((a,b)=>a.price-b.price);
}

let allFlights = [];

function initFlightsPage() {
  if (!document.getElementById("flight-list")) return;
  const p          = new URLSearchParams(window.location.search);
  const from       = p.get("from")||"DEL", to=p.get("to")||"BOM";
  const depart     = p.get("depart")||"";
  const passengers = parseInt(p.get("passengers")||"1");
  const travelClass= p.get("class")||"Economy";

  const title = document.getElementById("results-title");
  const meta  = document.getElementById("results-meta");
  if (title) title.textContent = `${from} → ${to}`;
  if (meta)  meta.textContent  = `${depart?formatDate(depart):"Flexible"} · ${passengers} Passenger${passengers>1?"s":""} · ${travelClass}`;

  setTimeout(() => {
    allFlights = generateFlights(from, to, travelClass, passengers);
    sessionStorage.setItem("jsg_flights", JSON.stringify(allFlights));
    renderFlights(allFlights);
    const cnt = document.getElementById("results-count");
    if (cnt) cnt.textContent = `${allFlights.length} flights found`;
  }, 900);

  document.querySelectorAll(".filter-chip[data-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip[data-filter]").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      const filtered = chip.dataset.filter==="all" ? allFlights : allFlights.filter(f=>f.travelClass===chip.dataset.filter);
      renderFlights(filtered);
      const cnt = document.getElementById("results-count");
      if (cnt) cnt.textContent = `${filtered.length} flights found`;
    });
  });

  document.querySelectorAll(".filter-chip[data-sort]").forEach(chip => {
    chip.addEventListener("click", () => {
      const s = chip.dataset.sort, list=[...allFlights];
      if (s==="price")     list.sort((a,b)=>a.price-b.price);
      if (s==="duration")  list.sort((a,b)=>a.durationMins-b.durationMins);
      if (s==="departure") list.sort((a,b)=>a.depHour-b.depHour);
      renderFlights(list);
    });
  });
}

function renderFlights(flights) {
  const list = document.getElementById("flight-list");
  if (!list) return;
  if (!flights.length) { list.innerHTML=`<div class="no-results"><div class="icon">✈</div><p>No flights found.</p></div>`; return; }
  list.innerHTML = flights.map((f,idx)=>`
    <div class="flight-card" style="animation-delay:${idx*.06}s">
      <div class="airline-info">
        <div class="airline-logo">${f.airlineCode}</div>
        <div><div class="airline-name">${f.airline}</div><div class="flight-number">${f.flightNumber}</div></div>
      </div>
      <div class="time-block"><div class="time-big">${f.depTime}</div><div class="airport-code">${f.from}</div></div>
      <div class="flight-route">
        <div class="flight-duration">${f.duration}</div>
        <div class="route-line"><div class="route-dot"></div><div class="route-bar"></div><div class="route-dot"></div></div>
        <div class="flight-stops ${f.stops>0?"has-stop":""}">${f.stops===0?"Non-stop":`${f.stops} Stop`}</div>
      </div>
      <div class="time-block"><div class="time-big">${f.arrTime}</div><div class="airport-code">${f.to}</div></div>
      <div class="price-block">
        <div class="price-amount">${formatPrice(f.price)}</div>
        <div class="price-per">per person</div>
        <div class="price-class">${f.travelClass}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">Total: ${formatPrice(f.priceTotal)}</div>
      </div>
      <div class="book-btn-wrap">
        <button class="btn btn-primary" onclick="bookFlight('${f.id}')">Book Now</button>
      </div>
    </div>`).join("");
}

function bookFlight(flightId) {
  if (!requireLogin()) return;
  sessionStorage.setItem("jsg_selected_flight", flightId);
  window.location.href = "booking.html";
}

/* ═══════════════════════════════════════════════════════════════
   11. BOOKING PAGE
═══════════════════════════════════════════════════════════════ */

function initBookingPage() {
  if (!document.getElementById("passenger-forms-container")) return;
  if (!requireLogin()) return;

  const flightId = sessionStorage.getItem("jsg_selected_flight");
  const flights  = JSON.parse(sessionStorage.getItem("jsg_flights")||"[]");
  const flight   = flights.find(f=>f.id===flightId);
  if (!flight) { showToast("Flight lost. Search again.","error"); setTimeout(()=>{window.location.href="index.html";},1000); return; }

  renderBookingSummary(flight);
  renderPassengerForms(flight.passengers);
  renderFareSummary(flight);

  if (flight.passengers > 1) {
    document.getElementById("split-fare-section").style.display = "";
    document.getElementById("split-fare-checkbox")?.addEventListener("change", function () {
      document.getElementById("split-phones-container").classList.toggle("hidden", !this.checked);
      if (this.checked) renderSplitEmailInputs(flight.passengers);
    });
  }

  document.getElementById("proceed-btn")?.addEventListener("click", () => {
    if (!validatePassengerForms(flight.passengers)) return;
    const splitChecked = document.getElementById("split-fare-checkbox")?.checked;
    if (splitChecked && !validateSplitEmails(flight.passengers)) return;
    openBookingOtpModal(flight, splitChecked);
  });
}

function renderBookingSummary(f) {
  const r = document.getElementById("booking-route");
  const d = document.getElementById("booking-details");
  if (r) r.innerHTML = `<span>${f.from}</span><span>✈</span><span>${f.to}</span>`;
  if (d) d.innerHTML = `
    <div class="detail-item"><span class="label">Airline</span><span class="value">${f.airline} · ${f.flightNumber}</span></div>
    <div class="detail-item"><span class="label">Departure</span><span class="value">${f.depTime}</span></div>
    <div class="detail-item"><span class="label">Arrival</span><span class="value">${f.arrTime}</span></div>
    <div class="detail-item"><span class="label">Duration</span><span class="value">${f.duration}</span></div>
    <div class="detail-item"><span class="label">Class</span><span class="value">${f.travelClass}</span></div>
    <div class="detail-item"><span class="label">Passengers</span><span class="value">${f.passengers}</span></div>`;
}

function renderPassengerForms(count) {
  document.getElementById("passenger-forms-container").innerHTML =
    Array.from({length:count},(_,idx)=>{const i=idx+1; return `
      <div class="passenger-form-card">
        <div class="p-header"><div class="p-num">${i}</div><span>Passenger ${i}${i===1?" (Primary)":""}</span></div>
        <div class="p-body">
          <div class="form-group"><label class="form-label">Full Name *</label>
            <input type="text" class="form-control" id="p${i}-name" placeholder="As on passport" />
            <span class="form-error hidden" id="p${i}-name-err">⚠ Name required.</span></div>
          <div class="form-group"><label class="form-label">Age *</label>
            <input type="number" class="form-control" id="p${i}-age" placeholder="28" min="1" max="120" />
            <span class="form-error hidden" id="p${i}-age-err">⚠ Valid age required.</span></div>
          <div class="form-group"><label class="form-label">Gender *</label>
            <select class="form-control" id="p${i}-gender">
              <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
            <span class="form-error hidden" id="p${i}-gender-err">⚠ Select gender.</span></div>
          <div class="form-group"><label class="form-label">Phone *</label>
            <input type="tel" class="form-control" id="p${i}-phone" placeholder="+91 9876543210" />
            <span class="form-error hidden" id="p${i}-phone-err">⚠ Valid phone required.</span></div>
          <div class="form-group"><label class="form-label">Email *</label>
            <input type="email" class="form-control" id="p${i}-email" placeholder="passenger@email.com" />
            <span class="form-error hidden" id="p${i}-email-err">⚠ Valid email required.</span></div>
        </div>
      </div>`; }).join("");
}

function validatePassengerForms(count) {
  let valid = true;
  for (let i=1;i<=count;i++) {
    const name  = document.getElementById(`p${i}-name`)?.value.trim();
    const age   = document.getElementById(`p${i}-age`)?.value;
    const gender= document.getElementById(`p${i}-gender`)?.value;
    const phone = document.getElementById(`p${i}-phone`)?.value.trim();
    const email = document.getElementById(`p${i}-email`)?.value.trim();
    if (!name||name.length<2)                    {showError(`p${i}-name-err`,true);   valid=false;} else showError(`p${i}-name-err`,false);
    if (!age||age<1||age>120)                    {showError(`p${i}-age-err`,true);    valid=false;} else showError(`p${i}-age-err`,false);
    if (!gender)                                 {showError(`p${i}-gender-err`,true); valid=false;} else showError(`p${i}-gender-err`,false);
    if (!phone||phone.replace(/\D/g,"").length<7){showError(`p${i}-phone-err`,true);  valid=false;} else showError(`p${i}-phone-err`,false);
    if (!isValidEmail(email))                    {showError(`p${i}-email-err`,true);  valid=false;} else showError(`p${i}-email-err`,false);
  }
  if (!valid) showToast("Please fill all passenger details correctly.", "warning");
  return valid;
}

function renderSplitEmailInputs(count) {
  const c = document.getElementById("split-phone-inputs");
  if (!c) return;
  c.innerHTML = Array.from({length:count},(_,idx)=>{const i=idx+1; return `
    <div class="split-phone-input">
      <span style="font-size:.85rem;font-weight:600;min-width:90px;color:var(--text-muted)">Passenger ${i}</span>
      <input type="email" class="form-control" id="split-email-${i}" placeholder="passenger@email.com" />
      <span class="form-error hidden" id="split-email-${i}-err">⚠ Valid email required</span>
    </div>`;}).join("");
}

function validateSplitEmails(count) {
  let valid = true;
  for (let i=1;i<=count;i++) {
    const e = document.getElementById(`split-email-${i}`)?.value.trim();
    if (!e||!isValidEmail(e)) {showError(`split-email-${i}-err`,true); valid=false;} else showError(`split-email-${i}-err`,false);
  }
  if (!valid) showToast("Enter valid emails for all passengers.", "warning");
  return valid;
}

function renderFareSummary(flight) {
  const el = document.getElementById("fare-rows");
  if (!el) return;
  const tax=Math.round(flight.price*.18), total=(flight.price+tax)*flight.passengers+200;
  el.innerHTML=`
    <div class="fare-row"><span class="fare-label">Base Fare (×${flight.passengers})</span><span>${formatPrice(flight.price*flight.passengers)}</span></div>
    <div class="fare-row"><span class="fare-label">Taxes & Fees (18%)</span><span>${formatPrice(tax*flight.passengers)}</span></div>
    <div class="fare-row"><span class="fare-label">Convenience Fee</span><span>${formatPrice(200)}</span></div>
    <div class="fare-row"><span>Total</span><span style="color:var(--accent)">${formatPrice(total)}</span></div>`;
}

function collectPassengerData(count) {
  return Array.from({length:count},(_,idx)=>{const i=idx+1; return {
    name:  document.getElementById(`p${i}-name`)?.value.trim()||"",
    age:   document.getElementById(`p${i}-age`)?.value||"",
    gender:document.getElementById(`p${i}-gender`)?.value||"",
    phone: document.getElementById(`p${i}-phone`)?.value.trim()||"",
    email: document.getElementById(`p${i}-email`)?.value.trim()||"",
  };});
}

/* ═══════════════════════════════════════════════════════════════
   12. BOOKING OTP MODAL
═══════════════════════════════════════════════════════════════ */

let _bookingOtpState = {flight:null,isSplit:false,generatedOtp:null,timerInterval:null,otpEmail:""};

function openBookingOtpModal(flight, isSplit) {
  _bookingOtpState = {flight, isSplit, generatedOtp:null, timerInterval:null, otpEmail:""};
  const modal = document.getElementById("booking-otp-modal");
  if (!modal) return;
  document.getElementById("booking-otp-step1").classList.remove("hidden");
  document.getElementById("booking-otp-step2").classList.add("hidden");
  showError("booking-otp-email-err", false);
  showError("booking-otp-err", false);
  const user = getLoggedInUser();
  const inp  = document.getElementById("booking-otp-email");
  if (inp && user?.email) inp.value = user.email;
  modal.classList.remove("hidden");

  // Clone to remove old listeners
  ["booking-otp-send-btn","booking-otp-verify-btn","booking-otp-resend-btn","close-booking-otp"].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const c=el.cloneNode(true); el.parentNode.replaceChild(c,el);
  });

  document.getElementById("close-booking-otp")?.addEventListener("click",()=>{
    modal.classList.add("hidden"); clearInterval(_bookingOtpState.timerInterval);
  });

  document.getElementById("booking-otp-send-btn")?.addEventListener("click", async ()=>{
    const emailVal = document.getElementById("booking-otp-email")?.value.trim();
    if (!emailVal||!isValidEmail(emailVal)) { showError("booking-otp-email-err",true); return; }
    showError("booking-otp-email-err",false);
    _bookingOtpState.generatedOtp = String(Math.floor(100000+Math.random()*900000));
    _bookingOtpState.otpEmail = emailVal;
    const btn = document.getElementById("booking-otp-send-btn");
    if (btn) { btn.disabled=true; btn.textContent="Sending…"; }
    const user = getLoggedInUser();
    await sendOtpEmail(emailVal, user?.name||"Traveler", _bookingOtpState.generatedOtp);
    if (btn) { btn.disabled=false; btn.innerHTML="📧 Send OTP"; }
    document.getElementById("booking-otp-step1").classList.add("hidden");
    document.getElementById("booking-otp-step2").classList.remove("hidden");
    const sentTo = document.getElementById("booking-otp-sent-to");
    if (sentTo) sentTo.textContent=`OTP sent to ${emailVal}`;
    setupOtpDigits("booking-otp-digit");
    startOtpTimer("booking-otp-timer", _bookingOtpState);
  });

  document.getElementById("booking-otp-verify-btn")?.addEventListener("click",()=>{
    const entered = getOtpValue("booking-otp-digit");
    if (entered.length<6) { showError("booking-otp-err",true,"⚠ Enter all 6 digits."); return; }
    if (entered!==_bookingOtpState.generatedOtp) {
      showError("booking-otp-err",true,"⚠ Incorrect OTP."); clearOtpDigits("booking-otp-digit"); return;
    }
    showError("booking-otp-err",false);
    clearInterval(_bookingOtpState.timerInterval);
    // Capture flight/split before hiding modal (closures can go stale)
    const flightToBook = _bookingOtpState.flight;
    const isSplitFare  = _bookingOtpState.isSplit;
    document.getElementById("booking-otp-modal").classList.add("hidden");
    showToast("✅ OTP Verified! Proceeding to payment.","success");
    setTimeout(()=>openPaymentModal(flightToBook, isSplitFare), 400);
  });

  document.getElementById("booking-otp-resend-btn")?.addEventListener("click", async ()=>{
    _bookingOtpState.generatedOtp = String(Math.floor(100000+Math.random()*900000));
    const user = getLoggedInUser();
    await sendOtpEmail(_bookingOtpState.otpEmail, user?.name||"Traveler", _bookingOtpState.generatedOtp);
    clearInterval(_bookingOtpState.timerInterval);
    startOtpTimer("booking-otp-timer",_bookingOtpState);
    clearOtpDigits("booking-otp-digit");
    showError("booking-otp-err",false);
  });
}

/* ═══════════════════════════════════════════════════════════════
   13. PAYMENT MODAL & BOOKING COMPLETION
═══════════════════════════════════════════════════════════════ */

function openPaymentModal(flight, isSplit) {
  if (isSplit) { showSplitFareFlow(flight); return; }
  const modal = document.getElementById("payment-modal");
  const body  = document.getElementById("payment-modal-body");
  if (!modal||!body) return;
  const tax=Math.round(flight.price*.18), total=(flight.price+tax)*flight.passengers+200;
  const user=getLoggedInUser();
  body.innerHTML = `
    <div class="card-visual">
      <div class="card-brand">JetSetGo Pay — Secure</div>
      <div class="card-number">•••• •••• •••• 4242</div>
      <div class="card-meta"><span>12/28</span><span>VISA</span></div>
    </div>
    <div class="form-group"><label class="form-label">Card Number</label>
      <input type="text" class="form-control" id="pay-card" maxlength="19" value="4242 4242 4242 4242"
        oninput="this.value=this.value.replace(/\\D/g,'').replace(/(.{4})/g,'$1 ').trim().slice(0,19)" /></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem">
      <div class="form-group"><label class="form-label">Expiry</label>
        <input type="text" class="form-control" id="pay-expiry" maxlength="5" value="12/28"
          oninput="let v=this.value.replace(/\\D/g,'');if(v.length>=2)v=v.slice(0,2)+'/'+v.slice(2);this.value=v.slice(0,5)" /></div>
      <div class="form-group"><label class="form-label">CVV</label>
        <input type="text" class="form-control" id="pay-cvv" maxlength="3" value="123" /></div>
    </div>
    <div class="form-group" style="margin-top:1rem"><label class="form-label">Card Holder</label>
      <input type="text" class="form-control" id="pay-name" value="${user?.name||""}" /></div>
    <div style="margin-top:1.5rem;padding:1rem;background:var(--surface2);border-radius:var(--radius-sm);text-align:center">
      <p style="font-size:.85rem;color:var(--text-muted)">Total Amount</p>
      <p style="font-family:'Syne';font-size:1.8rem;font-weight:800;color:var(--accent)">${formatPrice(total)}</p>
    </div>
    <div class="modal-footer" style="padding-top:1rem">
      <button class="btn btn-ghost" onclick="document.getElementById('payment-modal').classList.add('hidden')">Cancel</button>
      <button class="btn btn-primary btn-lg" id="confirm-pay-btn">🔒 Pay ${formatPrice(total)}</button>
    </div>`;
  modal.classList.remove("hidden");

  // Wire up close button
  const closeBtn = document.getElementById("close-payment");
  if (closeBtn) {
    const newClose = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newClose, closeBtn);
    newClose.addEventListener("click", () => modal.classList.add("hidden"));
  }

  // Clone confirm button to avoid duplicate listeners
  const oldConfirm = document.getElementById("confirm-pay-btn");
  if (oldConfirm) {
    const newConfirm = oldConfirm.cloneNode(true);
    oldConfirm.parentNode.replaceChild(newConfirm, oldConfirm);
  }

  document.getElementById("confirm-pay-btn")?.addEventListener("click", async ()=>{
    const card=document.getElementById("pay-card")?.value.replace(/\s/g,"");
    const exp =document.getElementById("pay-expiry")?.value;
    const cvv =document.getElementById("pay-cvv")?.value;
    const name=document.getElementById("pay-name")?.value.trim();
    if (!card||card.length<16) { showToast("Enter valid card number.","warning"); return; }
    if (!exp||!exp.includes("/")) { showToast("Enter valid expiry.","warning"); return; }
    if (!cvv||cvv.length<3)    { showToast("Enter CVV.","warning"); return; }
    if (!name)                 { showToast("Enter card holder name.","warning"); return; }
    const btn=document.getElementById("confirm-pay-btn");
    btn.disabled=true; btn.textContent="Processing…";
    await new Promise(r=>setTimeout(r,1800));
    document.getElementById("payment-modal").classList.add("hidden");
    await completeBooking(flight);
  });
}

async function completeBooking(flight) {
  const user       = getLoggedInUser();
  const passengers = collectPassengerData(flight.passengers);
  const tax        = Math.round(flight.price*.18);
  const total      = (flight.price+tax)*flight.passengers+200;
  const bookingId  = "JSG"+Date.now().toString().slice(-8).toUpperCase();
  const booking    = {
    id:bookingId, userId:user?.uid||user?.id||"guest",
    userName:user?.name||"Guest", userEmail:user?.email||"",
    flight, passengers, status:"Fully Paid", splitFare:false,
    totalAmount:total, createdAt:new Date().toISOString(),
  };
  await saveBooking(booking);
  const sm=document.getElementById("success-modal"), si=document.getElementById("success-booking-id");
  if (sm) sm.classList.remove("hidden");
  if (si) si.textContent=`Booking ID: ${bookingId}`;
}

async function showSplitFareFlow(flight) {
  const user       = getLoggedInUser();
  const passengers = collectPassengerData(flight.passengers);
  const tax        = Math.round(flight.price*.18);
  const total      = (flight.price+tax)*flight.passengers+200;
  const perPax     = Math.ceil(total/flight.passengers);
  const bookingId  = "JSG"+Date.now().toString().slice(-8).toUpperCase();

  const splitEmails = Array.from({length:flight.passengers},(_,i)=>
    document.getElementById(`split-email-${i+1}`)?.value.trim()||""
  );

  const booking = {
    id:bookingId, userId:user?.uid||user?.id||"guest",
    userName:user?.name||"Guest", userEmail:user?.email||"",
    flight,
    passengers: passengers.map((p,i)=>({
      ...p,
      splitEmail:   splitEmails[i]||p.email,
      paymentStatus:"Pending",
      shareAmount:  perPax,
      payToken:     generateId(),
    })),
    status:"Pending", splitFare:true,
    totalAmount:total, perPaxAmount:perPax,
    createdAt:new Date().toISOString(),
  };

  await saveBooking(booking);

  // Send individual payment links
  const baseUrl = window.location.href.replace("booking.html","splitpay.html");
  const promises = booking.passengers.map(p=>{
    const link = `${baseUrl}?booking=${bookingId}&token=${p.payToken}&name=${encodeURIComponent(p.name)}`;
    return sendPaymentLinkEmail(p.splitEmail, p.name, link, formatPrice(perPax), bookingId);
  });
  await Promise.allSettled(promises);
  showToast(`📧 Payment links sent to all ${flight.passengers} passengers!`,"success");
  setTimeout(()=>{ window.location.href="mybookings.html"; },1200);
}

/* ═══════════════════════════════════════════════════════════════
   14. FIREBASE / LOCALSTORAGE BOOKING CRUD
═══════════════════════════════════════════════════════════════ */

async function saveBooking(booking) {
  if (isFirebaseConfigured()) {
    await loadFirebase();
    try { await db.collection("bookings").doc(booking.id).set(booking); return; } catch(e) { console.error(e); }
  }
  const all=JSON.parse(localStorage.getItem("jsg_bookings")||"[]");
  const idx=all.findIndex(b=>b.id===booking.id);
  if (idx>=0) all[idx]=booking; else all.push(booking);
  localStorage.setItem("jsg_bookings",JSON.stringify(all));
}

async function loadBookingById(bookingId) {
  if (isFirebaseConfigured()) {
    await loadFirebase();
    try { const s=await db.collection("bookings").doc(bookingId).get(); return s.exists?s.data():null; } catch(e){console.error(e);}
  }
  return JSON.parse(localStorage.getItem("jsg_bookings")||"[]").find(b=>b.id===bookingId)||null;
}

async function updateBooking(booking) {
  await saveBooking(booking);
}

async function loadUserBookings() {
  const user=getLoggedInUser(); if (!user) return [];
  if (isFirebaseConfigured()) {
    await loadFirebase();
    try {
      const snap=await db.collection("bookings").where("userId","==",user.uid||user.id||"guest").orderBy("createdAt","desc").get();
      return snap.docs.map(d=>d.data());
    } catch(e) { console.error(e); }
  }
  return JSON.parse(localStorage.getItem("jsg_bookings")||"[]")
    .filter(b=>b.userId===(user.uid||user.id)).reverse();
}

/* ═══════════════════════════════════════════════════════════════
   15. MY BOOKINGS PAGE
═══════════════════════════════════════════════════════════════ */

let _allBookings=[], _bookingFilter="all";

async function initMyBookingsPage() {
  if (!document.getElementById("bookings-list")) return;
  if (!requireLogin()) return;
  document.getElementById("bookings-list").innerHTML=`
    <div class="loader-wrap"><div class="spinner"></div><p class="loader-text">Loading bookings…</p></div>`;
  _allBookings = await loadUserBookings();
  renderBookings();
  document.querySelectorAll(".filter-chip[data-status]").forEach(chip=>{
    chip.addEventListener("click",()=>{
      document.querySelectorAll(".filter-chip[data-status]").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active"); _bookingFilter=chip.dataset.status; renderBookings();
    });
  });
}

function renderBookings() {
  const list=document.getElementById("bookings-list"); if (!list) return;
  let bookings=_allBookings;
  if (_bookingFilter!=="all") bookings=bookings.filter(b=>b.status===_bookingFilter);
  if (!bookings.length) {
    list.innerHTML=`<div class="empty-state"><div class="empty-icon">✈</div>
      <h3>No bookings found</h3>
      <p>${_bookingFilter!=="all"?"No bookings with this status.":"You haven't booked any flights yet."}</p>
      <a href="index.html" class="btn btn-primary" style="margin-top:1.25rem">Search Flights</a></div>`;
    return;
  }
  const badges={"Fully Paid":`<span class="badge badge-success">✅ Fully Paid</span>`,
    "Partially Paid":`<span class="badge badge-warning">⏳ Partially Paid</span>`,
    "Pending":`<span class="badge badge-danger">🔴 Pending</span>`};

  list.innerHTML=bookings.map(b=>{
    const paxHtml=b.passengers.map(p=>{
      if (b.splitFare) {
        const paid=p.paymentStatus==="Paid";
        return `<div class="passenger-status-row">
          <div class="p-name">👤 ${p.name}</div>
          <div style="font-size:.8rem;color:var(--text-muted)">${p.splitEmail||p.email}</div>
          ${paid ? `<span class="badge badge-success">✅ Paid</span>`
            : `<div style="display:flex;gap:.5rem;align-items:center">
                <span class="badge badge-danger">💳 Pending</span>
                <button class="btn btn-primary btn-sm"
                  onclick="resendPaymentLink('${b.id}','${p.payToken}','${p.name}','${p.splitEmail||p.email}',${b.perPaxAmount})">
                  Resend Link
                </button></div>`}
        </div>`;
      }
      return `<div class="passenger-status-row">
        <div class="p-name">👤 ${p.name}</div>
        <div style="font-size:.8rem;color:var(--text-muted)">${p.gender}·Age ${p.age}</div>
        <span class="badge badge-success">✅ Paid</span></div>`;
    }).join("");

    return `<div class="booking-item" id="booking-${b.id}">
      <div class="booking-item-header" onclick="toggleBookingDetails('${b.id}')">
        <div>
          <div class="booking-id">#${b.id}</div>
          <div class="booking-route"><span>${b.flight.from}</span><span class="arrow">✈</span><span>${b.flight.to}</span></div>
          <div style="font-size:.82rem;color:var(--text-muted);margin-top:.25rem">
            ${b.flight.airline}·${b.flight.depTime}–${b.flight.arrTime}·${b.flight.travelClass}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.5rem">
          ${badges[b.status]||`<span class="badge badge-muted">${b.status}</span>`}
          <span style="font-size:.78rem;color:var(--text-muted)">${formatDate(b.createdAt?.split("T")[0])}</span>
          <span style="font-family:'Syne';font-weight:700;font-size:1.1rem;color:var(--accent)">${formatPrice(b.totalAmount)}</span>
        </div>
      </div>
      <div class="booking-item-body" id="details-${b.id}">
        <h4 style="margin-bottom:.75rem;font-size:.9rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">
          Passengers (${b.passengers.length})</h4>
        <div class="passenger-status-list">${paxHtml}</div>
        ${b.splitFare?`<p style="font-size:.78rem;color:var(--text-muted);margin-top:.75rem">Each share: ${formatPrice(b.perPaxAmount)}</p>`:""}
      </div>
    </div>`;
  }).join("");
}

function toggleBookingDetails(id) {
  document.getElementById(`details-${id}`)?.classList.toggle("open");
}

async function resendPaymentLink(bookingId, token, name, email, amount) {
  const baseUrl = window.location.href.replace("mybookings.html","splitpay.html");
  const link    = `${baseUrl}?booking=${bookingId}&token=${token}&name=${encodeURIComponent(name)}`;
  await sendPaymentLinkEmail(email, name, link, formatPrice(amount), bookingId);
}

/* ═══════════════════════════════════════════════════════════════
   16. SPLIT PAY PAGE  (splitpay.html)
   The standalone page passengers open from their email link
═══════════════════════════════════════════════════════════════ */

let _spState={bookingId:null,token:null,generatedOtp:null,timerInterval:null,verifiedEmail:""};

async function initSplitPayPage() {
  const container=document.getElementById("splitpay-container"); if(!container) return;
  const p=new URLSearchParams(window.location.search);
  const bookingId=p.get("booking"), token=p.get("token"), pName=decodeURIComponent(p.get("name")||"");

  if (!bookingId||!token) {
    container.innerHTML=`<div class="empty-state"><h3>Invalid Link</h3><p>This link is invalid or has expired.</p></div>`;
    return;
  }
  container.innerHTML=`<div class="loader-wrap"><div class="spinner"></div><p class="loader-text">Loading…</p></div>`;

  const booking=await loadBookingById(bookingId);
  if (!booking) { container.innerHTML=`<div class="empty-state"><h3>Booking Not Found</h3></div>`; return; }

  const passenger=booking.passengers.find(p=>p.payToken===token);
  if (!passenger) { container.innerHTML=`<div class="empty-state"><h3>Invalid Token</h3></div>`; return; }

  if (passenger.paymentStatus==="Paid") {
    container.innerHTML=`<div class="payment-success-anim" style="text-align:center;padding:3rem">
      <div class="circle">✅</div><h3>Already Paid!</h3>
      <p>Your payment for <strong>#${bookingId}</strong> is complete.</p></div>`;
    return;
  }

  _spState={bookingId,token,generatedOtp:null,timerInterval:null,verifiedEmail:"",booking,passenger};

  container.innerHTML=`
  <div class="split-link-card card">
    <div style="font-size:2.5rem;margin-bottom:1rem">✈</div>
    <h2>Complete Your Payment</h2>
    <p>Hi <strong>${passenger.name}</strong>! You've been added to a group booking.</p>
    <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:1rem;margin:1.5rem 0;text-align:left">
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.5rem;text-transform:uppercase;font-weight:600">Booking Details</div>
      <div><strong>${booking.flight.from} → ${booking.flight.to}</strong></div>
      <div style="font-size:.85rem;color:var(--text-muted)">${booking.flight.airline} · ${booking.flight.depTime}–${booking.flight.arrTime} · ${booking.flight.travelClass}</div>
      <div style="margin-top:.75rem;font-family:'Syne';font-size:1.5rem;font-weight:800;color:var(--accent)">
        Your share: ${formatPrice(booking.perPaxAmount)}</div>
    </div>

    <!-- Step 1: Email input -->
    <div id="sp-step1">
      <div class="form-group" style="text-align:left;margin-bottom:1rem">
        <label class="form-label">Your Email Address (to receive OTP)</label>
        <input type="email" class="form-control" id="sp-email"
          placeholder="you@example.com" value="${passenger.splitEmail||""}" />
        <span class="form-error hidden" id="sp-email-err">⚠ Valid email required.</span>
      </div>
      <button class="btn btn-primary w-full" id="sp-send-btn">📧 Send OTP</button>
    </div>

    <!-- Step 2: OTP verify -->
    <div id="sp-step2" class="hidden" style="text-align:center">
      <p class="otp-title" style="margin-top:1rem">Enter OTP</p>
      <p class="otp-subtitle" id="sp-sent-to"></p>
      <div class="otp-inputs">
        <input type="text" maxlength="1" class="sp-otp-digit" />
        <input type="text" maxlength="1" class="sp-otp-digit" />
        <input type="text" maxlength="1" class="sp-otp-digit" />
        <input type="text" maxlength="1" class="sp-otp-digit" />
        <input type="text" maxlength="1" class="sp-otp-digit" />
        <input type="text" maxlength="1" class="sp-otp-digit" />
      </div>
      <div class="otp-timer">Expires in <span id="sp-timer">5:00</span></div>
      <span class="form-error hidden text-center" id="sp-otp-err">⚠ Incorrect OTP.</span>
      <button class="btn btn-primary w-full" id="sp-verify-btn">Verify OTP →</button>
      <button class="btn btn-ghost w-full mt-1" id="sp-resend-btn">Resend OTP</button>
    </div>

    <!-- Step 3: Payment -->
    <div id="sp-step3" class="hidden">
      <div class="card-visual" style="text-align:left;margin-top:1rem">
        <div class="card-brand">JetSetGo Pay</div>
        <div class="card-number">•••• •••• •••• 4242</div>
        <div class="card-meta"><span>12/28</span><span>VISA</span></div>
      </div>
      <div style="text-align:center;margin:1rem 0">
        <div style="font-size:.85rem;color:var(--text-muted)">Amount Due</div>
        <div style="font-family:'Syne';font-size:2rem;font-weight:800;color:var(--accent)">${formatPrice(booking.perPaxAmount)}</div>
      </div>
      <button class="btn btn-primary btn-lg w-full" id="sp-pay-btn">💳 Pay Now</button>
    </div>
  </div>`;

  // Step 1: send OTP
  document.getElementById("sp-send-btn")?.addEventListener("click", async ()=>{
    const email=document.getElementById("sp-email")?.value.trim();
    if (!email||!isValidEmail(email)) { showError("sp-email-err",true); return; }
    showError("sp-email-err",false);
    _spState.generatedOtp=String(Math.floor(100000+Math.random()*900000));
    _spState.verifiedEmail=email;
    const btn=document.getElementById("sp-send-btn");
    btn.disabled=true; btn.textContent="Sending…";
    await sendOtpEmail(email, passenger.name, _spState.generatedOtp);
    btn.disabled=false; btn.innerHTML="📧 Send OTP";
    document.getElementById("sp-step1").classList.add("hidden");
    document.getElementById("sp-step2").classList.remove("hidden");
    const s=document.getElementById("sp-sent-to");
    if(s) s.textContent=`OTP sent to ${email}`;
    setupOtpDigits("sp-otp-digit");
    startOtpTimer("sp-timer", _spState);
  });

  // Step 2: verify OTP
  document.getElementById("sp-verify-btn")?.addEventListener("click",()=>{
    const entered=getOtpValue("sp-otp-digit");
    if (entered.length<6) { showError("sp-otp-err",true,"⚠ Enter all 6 digits."); return; }
    if (entered!==_spState.generatedOtp) { showError("sp-otp-err",true,"⚠ Incorrect OTP."); clearOtpDigits("sp-otp-digit"); return; }
    showError("sp-otp-err",false);
    clearInterval(_spState.timerInterval);
    document.getElementById("sp-step2").classList.add("hidden");
    document.getElementById("sp-step3").classList.remove("hidden");
    showToast("✅ OTP Verified!","success");
  });

  document.getElementById("sp-resend-btn")?.addEventListener("click", async ()=>{
    _spState.generatedOtp=String(Math.floor(100000+Math.random()*900000));
    await sendOtpEmail(_spState.verifiedEmail, passenger.name, _spState.generatedOtp);
    clearInterval(_spState.timerInterval);
    startOtpTimer("sp-timer",_spState);
    clearOtpDigits("sp-otp-digit");
    showError("sp-otp-err",false);
  });

  // Step 3: pay
  document.getElementById("sp-pay-btn")?.addEventListener("click", async ()=>{
    const btn=document.getElementById("sp-pay-btn");
    btn.disabled=true; btn.textContent="Processing…";
    await new Promise(r=>setTimeout(r,1800));

    // Mark this passenger as paid and update booking
    const updated={..._spState.booking};
    updated.passengers=updated.passengers.map(p=>
      p.payToken===token ? {...p,paymentStatus:"Paid"} : p
    );
    const allPaid =updated.passengers.every(p=>p.paymentStatus==="Paid");
    const somePaid=updated.passengers.some(p=>p.paymentStatus==="Paid");
    updated.status=allPaid?"Fully Paid":somePaid?"Partially Paid":"Pending";
    await updateBooking(updated);

    container.querySelector(".split-link-card").innerHTML=`
      <div class="payment-success-anim" style="text-align:center;padding:2rem">
        <div class="circle">✅</div>
        <h3>Payment Successful!</h3>
        <p>Your payment of <strong>${formatPrice(_spState.booking.perPaxAmount)}</strong> for booking
           <strong>#${bookingId}</strong> is confirmed.</p>
        <p style="margin-top:.75rem;color:var(--text-muted);font-size:.85rem">Have a great journey! ✈</p>
      </div>`;
  });
}

/* ═══════════════════════════════════════════════════════════════
   OTP HELPERS
═══════════════════════════════════════════════════════════════ */

function setupOtpDigits(cls) {
  const digits=document.querySelectorAll(`.${cls}`);
  digits.forEach((d,i)=>{
    d.value="";
    d.oninput=()=>{ d.value=d.value.replace(/\D/g,"").slice(-1); if(d.value&&i<digits.length-1) digits[i+1].focus(); };
    d.onkeydown=e=>{ if(e.key==="Backspace"&&!d.value&&i>0) digits[i-1].focus(); };
  });
  digits[0]?.focus();
}
function getOtpValue(cls) { return Array.from(document.querySelectorAll(`.${cls}`)).map(d=>d.value).join(""); }
function clearOtpDigits(cls) {
  const ds=document.querySelectorAll(`.${cls}`);
  ds.forEach(d=>{d.value="";d.style.borderColor="";}); ds[0]?.focus();
}
function startOtpTimer(elId, stateObj) {
  let secs=300; const el=document.getElementById(elId);
  clearInterval(stateObj.timerInterval);
  stateObj.timerInterval=setInterval(()=>{
    secs--;
    if(el) el.textContent=`${Math.floor(secs/60)}:${String(secs%60).padStart(2,"0")}`;
    if(secs<=0){clearInterval(stateObj.timerInterval);if(el)el.textContent="Expired";}
  },1000);
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */

function generateId()  { return Math.random().toString(36).slice(2,10).toUpperCase(); }
function isValidEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function formatPrice(n) { return "₹"+Number(n||0).toLocaleString("en-IN"); }
function formatDate(s)  { try{return new Date(s).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});}catch{return s||"";} }
function formatTime(h,m){ return `${String(h%24).padStart(2,"0")}:${String(m).padStart(2,"0")}`; }
function formatDuration(m){ return `${Math.floor(m/60)}h ${m%60}m`; }
function showError(id,show,msg){
  const el=document.getElementById(id); if(!el) return;
  el.classList.toggle("hidden",!show); if(show&&msg) el.textContent=msg;
}

/* ═══════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded",()=>{
  initTheme();
  initNav();
  const page=window.location.pathname.split("/").pop()||"index.html";
  if(page==="index.html"||page===""||page==="/") initHomePage();
  if(page==="login.html")      initLoginPage();
  if(page==="signup.html")     initSignupPage();
  if(page==="flights.html")    initFlightsPage();
  if(page==="booking.html")    initBookingPage();
  if(page==="mybookings.html") initMyBookingsPage();
  if(page==="splitpay.html")   initSplitPayPage();
});
