/**
 * JetSetGo — Premium Flight Booking Application
 * script.js — Supabase + EmailJS powered
 */

"use strict";

/* ═══════════════════════════════════════════════════════════════
   1. SUPABASE CONFIG
   Setup: supabase.com → New Project → Settings → API
   Paste "Project URL" and "anon public" key below
═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL  = "";    
const SUPABASE_ANON = "";

// Zero-dependency Supabase helper using plain fetch()
const SB = {
  headers(extra={}) {
    const tok = localStorage.getItem("jsg_sb_token");
    return {
      "apikey":        SUPABASE_ANON,
      "Authorization": `Bearer ${tok || SUPABASE_ANON}`,
      "Content-Type":  "application/json",
      ...extra,
    };
  },

  // ── Auth ──────────────────────────────────────────────────
  async signUp(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method:"POST", headers: this.headers(),
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (d.error) throw { message: d.error.message || d.msg || JSON.stringify(d), code: d.error.status };
    return d;
  },
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:"POST", headers: this.headers(),
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (d.error || d.error_description) throw { message: d.error_description || d.msg || d.error, code: d.error };
    return d;  // { access_token, user, ... }
  },
  async signOut() {
    const tok = localStorage.getItem("jsg_sb_token");
    if (tok) await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method:"POST", headers: this.headers() }).catch(()=>{});
    localStorage.removeItem("jsg_sb_token");
    localStorage.removeItem("jsg_sb_uid");
  },

  // ── Database ──────────────────────────────────────────────
  async upsert(table, row) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:"POST",
      headers: this.headers({ "Prefer":"resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(row),
    });
    if (!r.ok) { const e=await r.text(); console.error(`SB upsert ${table}:`,e); throw new Error(e); }
  },
  async select(table, filters={}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    Object.entries(filters).forEach(([k,v])=>{ url+=`${k}=eq.${encodeURIComponent(v)}&`; });
    url += "order=created_at.desc";
    const r = await fetch(url, { headers: this.headers() });
    if (!r.ok) { console.error(`SB select ${table}:`, await r.text()); return []; }
    return r.json();
  },
  async patch(table, id, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method:"PATCH", headers: this.headers({ "Prefer":"return=minimal" }),
      body: JSON.stringify(data),
    });
    if (!r.ok) { const e=await r.text(); console.error(`SB patch ${table}:`,e); throw new Error(e); }
  },
  async getById(table, id) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { headers: this.headers() });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] || null;
  },
};

function isSupabaseConfigured() {
  return SUPABASE_URL !== "YOUR_SUPABASE_URL";
}
function isFirebaseConfigured() { return isSupabaseConfigured(); }
function loadFirebase() { return Promise.resolve(isSupabaseConfigured()); }

/* ═══════════════════════════════════════════════════════════════
   2. EMAILJS CONFIG
   Setup: emailjs.com → Gmail service → OTP template
   Template variables: {{to_email}}, {{to_name}}, {{otp_code}}
═══════════════════════════════════════════════════════════════ */

const EMAILJS_PUBLIC_KEY   = "";
const EMAILJS_SERVICE_ID   = "";
const EMAILJS_OTP_TEMPLATE     = "";
const EMAILJS_PAYMENT_TEMPLATE = ""; // ← paste your Order Confirmation template ID here

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
  if (!isEmailJsConfigured()) {
    console.log("Payment link for", toName, ":", paymentLink);
    showToast(`📧 Demo — link for ${toName} logged to console`, "info", 8000);
    return false;
  }
  const ready = await loadEmailJS();
  if (!ready) return false;
  try {
    // Use Order Confirmation template if configured, else fall back to OTP template
    const usePaymentTemplate = typeof EMAILJS_PAYMENT_TEMPLATE !== "undefined"
      && EMAILJS_PAYMENT_TEMPLATE !== "YOUR_ORDER_CONFIRMATION_TEMPLATE_ID";
    const templateId = usePaymentTemplate ? EMAILJS_PAYMENT_TEMPLATE : EMAILJS_OTP_TEMPLATE;
    const params = usePaymentTemplate
      ? {
          to_email:     toEmail,
          to_name:      toName,
          email:        toEmail,
          message:      `You've been added to group booking #${bookingId}.`,
          amount:       amount,
          payment_link: paymentLink,
          booking_id:   bookingId,
        }
      : {
          to_email: toEmail,
          to_name:  toName,
          otp_code: `You've been added to booking #${bookingId}.\nYour share: ${amount}\nPay here: ${paymentLink}`,
        };
    await window.emailjs.send(EMAILJS_SERVICE_ID, templateId, params);
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
      if (isSupabaseConfigured()) try { await SB.signOut(); } catch {}
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
      errEl.textContent = "⚠ Request timed out. Firebase may not be loading — check your API keys and internet connection.";
      errEl.classList.remove("hidden");
      console.error("Login timed out after 10s");
    }, 10000);

    if (isSupabaseConfigured()) {
      try {
        const data = await SB.signIn(email, password);
        // Supabase returns user inside data or data.user
        const user = data.user || data;
        const uid  = user?.id || user?.sub || generateId();
        // Store token and uid
        if (data.access_token) localStorage.setItem("jsg_sb_token", data.access_token);
        localStorage.setItem("jsg_sb_uid", uid);
        // Build profile — try users table, fall back to auth data
        let profile = { uid, email, name: email.split("@")[0] };
        try {
          const rows = await SB.select("users", { id: uid });
          if (rows.length) profile = { ...profile, name: rows[0].name || profile.name, phone: rows[0].phone || "" };
        } catch {}
        localStorage.setItem("jsg_user_profile", JSON.stringify(profile));
        clearTimeout(loginTimeout);
        _currentUserProfile = profile;
        showToast(`Welcome back, ${profile.name}! ✈`, "success");
        const redir = localStorage.getItem("jsg_splitpay_redirect") || sessionStorage.getItem("jsg_redirect") || "index.html";
        localStorage.removeItem("jsg_splitpay_redirect");
        sessionStorage.removeItem("jsg_redirect");
        setTimeout(() => { window.location.href = redir; }, 800);
      } catch (err) {
        clearTimeout(loginTimeout);
        btn.disabled = false; btn.textContent = "Sign In ✈";
        const errEl = document.getElementById("login-general-err");
        const msg = String(err.message || err.code || err);
        if (msg.includes("Invalid login"))          errEl.textContent = "⚠ Incorrect email or password.";
        else if (msg.includes("Email not confirmed")) errEl.textContent = "⚠ Please confirm your email first — check your inbox.";
        else if (msg.includes("network") || msg.includes("fetch")) errEl.textContent = "⚠ Network error. Check your connection.";
        else errEl.textContent = `⚠ Login failed: ${msg}`;
        errEl.classList.remove("hidden");
        console.error("Login error:", err);
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

    const errEl = document.getElementById("signup-general-err");

    if (!isSupabaseConfigured()) {
      clearTimeout(signupTimeout);
      btn.disabled = false; btn.textContent = "Create Account ✈";
      errEl.textContent = "⚠ Supabase not configured — paste your URL and anon key into script.js.";
      errEl.classList.remove("hidden");
      return;
    }

    try {
      const data = await SB.signUp(email, password);
      const token = data.access_token || data.session?.access_token;
      const uid   = data.user?.id;
      if (token) localStorage.setItem("jsg_sb_token", token);
      if (uid)   localStorage.setItem("jsg_sb_uid", uid);
      if (uid) SB.upsert("users", { id: uid, name, email, phone }).catch(()=>{});
      clearTimeout(signupTimeout);
      const profile = { uid: uid || generateId(), name, email, phone };
      localStorage.setItem("jsg_user_profile", JSON.stringify(profile));
      _currentUserProfile = profile;
      if (!token) {
        showToast("Account created! Check your email to confirm, then sign in. ✈", "success", 7000);
        setTimeout(() => { window.location.href = "login.html"; }, 2500);
      } else {
        showToast("Account created! Welcome aboard ✈", "success");
        setTimeout(() => { window.location.href = sessionStorage.getItem("jsg_redirect") || "index.html"; }, 800);
      }
    } catch (err) {
      clearTimeout(signupTimeout);
      btn.disabled = false; btn.textContent = "Create Account ✈";
      const msg = String(err.message || err);
      if (msg.toLowerCase().includes("already"))        errEl.textContent = "⚠ An account already exists with this email. Try logging in.";
      else if (msg.toLowerCase().includes("password"))  errEl.textContent = "⚠ Password must be at least 6 characters.";
      else if (msg.toLowerCase().includes("email"))     errEl.textContent = "⚠ Please enter a valid email address.";
      else                                               errEl.textContent = "⚠ Signup failed: " + msg;
      errEl.classList.remove("hidden");
      console.error("Signup error:", err);
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
    const returnDate = document.getElementById("search-return")?.value;
    const passengers = document.getElementById("search-passengers").value;
    const cls        = document.getElementById("search-class").value;
    const activeTab  = document.querySelector(".trip-tab.active")?.dataset.trip || "oneway";

    if (!from)       { showToast("Select a departure city.", "warning"); return; }
    if (!to)         { showToast("Select a destination city.", "warning"); return; }
    if (from === to) { showToast("From and To cannot be the same.", "warning"); return; }
    if (!depart)     { showToast("Select a departure date.", "warning"); return; }
    if (activeTab === "roundtrip" && !returnDate) {
      showToast("Select a return date.", "warning"); return;
    }
    if (activeTab === "roundtrip" && returnDate <= depart) {
      showToast("Return date must be after departure date.", "warning"); return;
    }
    const params = { from, to, depart, passengers, class: cls, trip: activeTab };
    if (activeTab === "roundtrip") params.returnDate = returnDate;
    window.location.href = `flights.html?${new URLSearchParams(params)}`;
  });
}

/* ═══════════════════════════════════════════════════════════════
   10. FLIGHT DATA & RESULTS
═══════════════════════════════════════════════════════════════ */

// ── Real domestic flight schedule ─────────────────────────────
// Each route has fixed flights with real-ish timings and durations
// Prices vary by class multiplier


// ═══════════════════════════════════════════════════════
//  FLIGHTS DATABASE  (from flights.js dataset)
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  FLIGHTS DATABASE  — from flights.js dataset (your friend's data)
//  All domestic routes, real flight numbers, real fares
// ═══════════════════════════════════════════════════════════════
const FLIGHTS_DB = [
  // ── DEL → BOM ─────────────────────────────────────────────
  { flight_id:"6E-204",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"BOM", dep:"06:00", arr:"08:10", dur:130, fares:{economy:4200,  premium_economy:7800,  business:14500}, meals:true  },
  { flight_id:"AI-101",  airline:"Air India",   code:"AI", aircraft:"Airbus A321",        origin:"DEL", destination:"BOM", dep:"08:30", arr:"10:45", dur:135, fares:{economy:4800,  premium_economy:9000,  business:17000}, meals:true  },
  { flight_id:"UK-945",  airline:"Vistara",     code:"UK", aircraft:"Boeing 737-800",     origin:"DEL", destination:"BOM", dep:"14:15", arr:"16:30", dur:135, fares:{economy:5200,  premium_economy:9500,  business:18000}, meals:true  },
  { flight_id:"SG-101",  airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"DEL", destination:"BOM", dep:"19:45", arr:"22:00", dur:135, fares:{economy:3800,  premium_economy:null,  business:null  }, meals:true  },
  { flight_id:"QP-2301", airline:"Akasa Air",   code:"QP", aircraft:"Boeing 737 MAX 8",   origin:"DEL", destination:"BOM", dep:"22:30", arr:"00:40", dur:130, fares:{economy:3500,  premium_economy:null,  business:null  }, meals:true  },
  // ── DEL → BLR ─────────────────────────────────────────────
  { flight_id:"6E-302",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A320neo",     origin:"DEL", destination:"BLR", dep:"05:45", arr:"08:30", dur:165, fares:{economy:5500,  premium_economy:10000, business:18500}, meals:true  },
  { flight_id:"AI-503",  airline:"Air India",   code:"AI", aircraft:"Airbus A321",        origin:"DEL", destination:"BLR", dep:"11:00", arr:"13:50", dur:170, fares:{economy:6000,  premium_economy:11000, business:20000}, meals:true  },
  { flight_id:"QP-1401", airline:"Akasa Air",   code:"QP", aircraft:"Boeing 737 MAX 8",   origin:"DEL", destination:"BLR", dep:"17:30", arr:"20:20", dur:170, fares:{economy:4900,  premium_economy:null,  business:null  }, meals:true  },
  // ── DEL → HYD ─────────────────────────────────────────────
  { flight_id:"6E-406",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"HYD", dep:"07:10", arr:"09:40", dur:150, fares:{economy:4500,  premium_economy:8500,  business:null  }, meals:true  },
  { flight_id:"UK-821",  airline:"Vistara",     code:"UK", aircraft:"Airbus A320neo",     origin:"DEL", destination:"HYD", dep:"15:20", arr:"17:55", dur:155, fares:{economy:5100,  premium_economy:9200,  business:17500}, meals:true  },
  // ── DEL → MAA ─────────────────────────────────────────────
  { flight_id:"6E-544",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A321",        origin:"DEL", destination:"MAA", dep:"06:30", arr:"09:20", dur:170, fares:{economy:5600,  premium_economy:10200, business:null  }, meals:true  },
  { flight_id:"AI-431",  airline:"Air India",   code:"AI", aircraft:"Boeing 787",         origin:"DEL", destination:"MAA", dep:"13:45", arr:"16:40", dur:175, fares:{economy:6200,  premium_economy:11500, business:21000}, meals:true  },
  // ── DEL → CCU ─────────────────────────────────────────────
  { flight_id:"6E-712",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A320neo",     origin:"DEL", destination:"CCU", dep:"06:15", arr:"08:40", dur:145, fares:{economy:4300,  premium_economy:8000,  business:null  }, meals:true  },
  { flight_id:"AI-231",  airline:"Air India",   code:"AI", aircraft:"Airbus A321",        origin:"DEL", destination:"CCU", dep:"10:30", arr:"13:00", dur:150, fares:{economy:4900,  premium_economy:9000,  business:16500}, meals:true  },
  { flight_id:"SG-1301", airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"DEL", destination:"CCU", dep:"21:00", arr:"23:25", dur:145, fares:{economy:4100,  premium_economy:null,  business:null  }, meals:true  },
  // ── DEL → COK ─────────────────────────────────────────────
  { flight_id:"6E-811",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"COK", dep:"08:00", arr:"11:10", dur:190, fares:{economy:6500,  premium_economy:11800, business:null  }, meals:true  },
  { flight_id:"UK-2211", airline:"Vistara",     code:"UK", aircraft:"Airbus A321",        origin:"DEL", destination:"COK", dep:"20:00", arr:"23:15", dur:195, fares:{economy:6700,  premium_economy:12200, business:22000}, meals:true  },
  // ── DEL → GOI ─────────────────────────────────────────────
  { flight_id:"UK-611",  airline:"Vistara",     code:"UK", aircraft:"Airbus A320neo",     origin:"DEL", destination:"GOI", dep:"07:30", arr:"09:55", dur:145, fares:{economy:4700,  premium_economy:8800,  business:16000}, meals:true  },
  { flight_id:"SG-201",  airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-900",     origin:"DEL", destination:"GOI", dep:"16:45", arr:"19:15", dur:150, fares:{economy:3900,  premium_economy:null,  business:null  }, meals:true  },
  // ── DEL → JAI ─────────────────────────────────────────────
  { flight_id:"6E-2201", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"DEL", destination:"JAI", dep:"07:00", arr:"08:05", dur:65,  fares:{economy:2500,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"SG-301",  airline:"SpiceJet",    code:"SG", aircraft:"Bombardier Q400",    origin:"DEL", destination:"JAI", dep:"14:30", arr:"15:35", dur:65,  fares:{economy:2300,  premium_economy:null,  business:null  }, meals:false },
  // ── DEL → AMD ─────────────────────────────────────────────
  { flight_id:"6E-905",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"AMD", dep:"09:00", arr:"10:30", dur:90,  fares:{economy:3200,  premium_economy:6000,  business:null  }, meals:true  },
  { flight_id:"UK-731",  airline:"Vistara",     code:"UK", aircraft:"Airbus A320neo",     origin:"DEL", destination:"AMD", dep:"18:00", arr:"19:35", dur:95,  fares:{economy:3600,  premium_economy:6800,  business:13000}, meals:true  },
  { flight_id:"QP-2401", airline:"Akasa Air",   code:"QP", aircraft:"Boeing 737 MAX 8",   origin:"DEL", destination:"AMD", dep:"07:00", arr:"08:35", dur:95,  fares:{economy:3000,  premium_economy:null,  business:null  }, meals:false },
  // ── DEL → LKO ─────────────────────────────────────────────
  { flight_id:"6E-2411", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"DEL", destination:"LKO", dep:"08:15", arr:"09:25", dur:70,  fares:{economy:2700,  premium_economy:null,  business:null  }, meals:false },
  // ── DEL → PNQ ─────────────────────────────────────────────
  { flight_id:"QP-1601", airline:"Akasa Air",   code:"QP", aircraft:"Boeing 737 MAX 8",   origin:"DEL", destination:"PNQ", dep:"10:15", arr:"12:30", dur:135, fares:{economy:4400,  premium_economy:null,  business:null  }, meals:true  },
  { flight_id:"AI-1711", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"DEL", destination:"PNQ", dep:"09:30", arr:"11:45", dur:135, fares:{economy:4600,  premium_economy:8600,  business:16200}, meals:true  },
  // ── DEL → VTZ ─────────────────────────────────────────────
  { flight_id:"AI-3001", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"DEL", destination:"VTZ", dep:"09:00", arr:"11:45", dur:165, fares:{economy:5300,  premium_economy:9800,  business:18000}, meals:true  },
  // ── DEL → GAU ─────────────────────────────────────────────
  { flight_id:"6E-5011", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"GAU", dep:"06:00", arr:"08:20", dur:140, fares:{economy:4800,  premium_economy:9000,  business:null  }, meals:true  },
  // ── DEL → PAT ─────────────────────────────────────────────
  { flight_id:"6E-5021", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"PAT", dep:"07:30", arr:"09:00", dur:90,  fares:{economy:3200,  premium_economy:6000,  business:null  }, meals:true  },
  // ── DEL → RPR ─────────────────────────────────────────────
  { flight_id:"6E-5031", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"RPR", dep:"08:00", arr:"10:00", dur:120, fares:{economy:3800,  premium_economy:7100,  business:null  }, meals:true  },
  // ── DEL → BBI ─────────────────────────────────────────────
  { flight_id:"6E-5041", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"BBI", dep:"06:30", arr:"08:40", dur:130, fares:{economy:4400,  premium_economy:8200,  business:null  }, meals:true  },
  // ── DEL → IXR ─────────────────────────────────────────────
  { flight_id:"6E-5051", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"IXR", dep:"07:00", arr:"09:00", dur:120, fares:{economy:3700,  premium_economy:7000,  business:null  }, meals:true  },
  // ── DEL → BHO ─────────────────────────────────────────────
  { flight_id:"6E-5061", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"BHO", dep:"08:30", arr:"10:00", dur:90,  fares:{economy:3100,  premium_economy:5800,  business:null  }, meals:true  },
  // ── DEL → ATQ ─────────────────────────────────────────────
  { flight_id:"6E-5071", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"ATQ", dep:"06:00", arr:"07:05", dur:65,  fares:{economy:2500,  premium_economy:null,  business:null  }, meals:false },
  // ── DEL → IXC ─────────────────────────────────────────────
  { flight_id:"6E-5081", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"DEL", destination:"IXC", dep:"07:00", arr:"07:55", dur:55,  fares:{economy:2400,  premium_economy:null,  business:null  }, meals:false },
  // ── DEL → DED ─────────────────────────────────────────────
  { flight_id:"6E-5091", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"DEL", destination:"DED", dep:"07:30", arr:"08:20", dur:50,  fares:{economy:2400,  premium_economy:null,  business:null  }, meals:false },
  // ── DEL → SXR ─────────────────────────────────────────────
  { flight_id:"6E-5111", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"SXR", dep:"06:30", arr:"07:45", dur:75,  fares:{economy:3200,  premium_economy:6000,  business:null  }, meals:false },
  // ── DEL → IXJ ─────────────────────────────────────────────
  { flight_id:"AI-3111", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"DEL", destination:"IXJ", dep:"10:00", arr:"11:10", dur:70,  fares:{economy:2900,  premium_economy:5500,  business:null  }, meals:false },
  // ── DEL → IXL ─────────────────────────────────────────────
  { flight_id:"6E-5121", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"DEL", destination:"IXL", dep:"06:00", arr:"07:35", dur:95,  fares:{economy:5500,  premium_economy:null,  business:null  }, meals:false },
  // ── DEL → IXA ─────────────────────────────────────────────
  { flight_id:"AI-3131", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"DEL", destination:"IXA", dep:"11:00", arr:"13:30", dur:150, fares:{economy:5200,  premium_economy:9600,  business:null  }, meals:true  },
  // ── DEL → IMF ─────────────────────────────────────────────
  { flight_id:"AI-3141", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"DEL", destination:"IMF", dep:"07:00", arr:"09:40", dur:160, fares:{economy:5500,  premium_economy:null,  business:null  }, meals:true  },
  // ── DEL → KUU ─────────────────────────────────────────────
  { flight_id:"9H-101",  airline:"Alliance Air", code:"9H", aircraft:"ATR 42-500",        origin:"DEL", destination:"KUU", dep:"09:00", arr:"10:10", dur:70,  fares:{economy:3500,  premium_economy:null,  business:null  }, meals:false },
  // ── BOM → BLR ─────────────────────────────────────────────
  { flight_id:"6E-501",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A320neo",     origin:"BOM", destination:"BLR", dep:"06:00", arr:"07:30", dur:90,  fares:{economy:3400,  premium_economy:6500,  business:null  }, meals:true  },
  { flight_id:"AI-619",  airline:"Air India",   code:"AI", aircraft:"Airbus A321",        origin:"BOM", destination:"BLR", dep:"09:30", arr:"11:05", dur:95,  fares:{economy:3900,  premium_economy:7200,  business:14000}, meals:true  },
  { flight_id:"UK-831",  airline:"Vistara",     code:"UK", aircraft:"Airbus A320",        origin:"BOM", destination:"BLR", dep:"18:45", arr:"20:20", dur:95,  fares:{economy:4200,  premium_economy:7800,  business:15000}, meals:true  },
  // ── BOM → HYD ─────────────────────────────────────────────
  { flight_id:"6E-603",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"BOM", destination:"HYD", dep:"07:00", arr:"08:30", dur:90,  fares:{economy:3100,  premium_economy:5800,  business:null  }, meals:true  },
  { flight_id:"SG-411",  airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"BOM", destination:"HYD", dep:"14:20", arr:"15:55", dur:95,  fares:{economy:2800,  premium_economy:null,  business:null  }, meals:true  },
  // ── BOM → MAA ─────────────────────────────────────────────
  { flight_id:"6E-722",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A320neo",     origin:"BOM", destination:"MAA", dep:"08:30", arr:"10:30", dur:120, fares:{economy:4000,  premium_economy:7500,  business:null  }, meals:true  },
  { flight_id:"AI-541",  airline:"Air India",   code:"AI", aircraft:"Airbus A321",        origin:"BOM", destination:"MAA", dep:"17:00", arr:"19:05", dur:125, fares:{economy:4500,  premium_economy:8500,  business:16000}, meals:true  },
  // ── BOM → CCU ─────────────────────────────────────────────
  { flight_id:"6E-834",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A321",        origin:"BOM", destination:"CCU", dep:"06:45", arr:"09:45", dur:180, fares:{economy:5800,  premium_economy:10500, business:null  }, meals:true  },
  { flight_id:"UK-2511", airline:"Vistara",     code:"UK", aircraft:"Airbus A321",        origin:"BOM", destination:"CCU", dep:"18:00", arr:"21:00", dur:180, fares:{economy:6000,  premium_economy:11000, business:20000}, meals:true  },
  // ── BOM → GOI ─────────────────────────────────────────────
  { flight_id:"6E-2501", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"BOM", destination:"GOI", dep:"10:00", arr:"11:10", dur:70,  fares:{economy:2600,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"QP-1701", airline:"Akasa Air",   code:"QP", aircraft:"Boeing 737 MAX 8",   origin:"BOM", destination:"GOI", dep:"16:00", arr:"17:15", dur:75,  fares:{economy:2900,  premium_economy:null,  business:null  }, meals:false },
  // ── BOM → COK ─────────────────────────────────────────────
  { flight_id:"AI-661",  airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"BOM", destination:"COK", dep:"09:15", arr:"11:15", dur:120, fares:{economy:3900,  premium_economy:7400,  business:14500}, meals:true  },
  { flight_id:"6E-921",  airline:"IndiGo",      code:"6E", aircraft:"Airbus A320neo",     origin:"BOM", destination:"COK", dep:"18:30", arr:"20:35", dur:125, fares:{economy:3600,  premium_economy:6800,  business:null  }, meals:true  },
  // ── BOM → AMD ─────────────────────────────────────────────
  { flight_id:"6E-2611", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"BOM", destination:"AMD", dep:"07:45", arr:"09:00", dur:75,  fares:{economy:2700,  premium_economy:null,  business:null  }, meals:false },
  // ── BOM → PNQ ─────────────────────────────────────────────
  { flight_id:"AI-761",  airline:"Air India",   code:"AI", aircraft:"ATR 72-600",         origin:"BOM", destination:"PNQ", dep:"08:00", arr:"08:55", dur:55,  fares:{economy:2500,  premium_economy:null,  business:null  }, meals:false },
  // ── BOM → JAI ─────────────────────────────────────────────
  { flight_id:"6E-3911", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"BOM", destination:"JAI", dep:"09:45", arr:"11:40", dur:115, fares:{economy:3700,  premium_economy:6900,  business:null  }, meals:true  },
  { flight_id:"UK-1611", airline:"Vistara",     code:"UK", aircraft:"Airbus A320neo",     origin:"BOM", destination:"JAI", dep:"18:30", arr:"20:25", dur:115, fares:{economy:4100,  premium_economy:7600,  business:14500}, meals:true  },
  // ── BOM → LKO ─────────────────────────────────────────────
  { flight_id:"6E-3611", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"BOM", destination:"LKO", dep:"10:00", arr:"12:05", dur:125, fares:{economy:4000,  premium_economy:7400,  business:null  }, meals:true  },
  // ── BOM → ATQ ─────────────────────────────────────────────
  { flight_id:"UK-2601", airline:"Vistara",     code:"UK", aircraft:"Airbus A320",        origin:"BOM", destination:"ATQ", dep:"11:00", arr:"13:15", dur:135, fares:{economy:4500,  premium_economy:8400,  business:16000}, meals:true  },
  // ── BOM → IXC ─────────────────────────────────────────────
  { flight_id:"AI-3081", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"BOM", destination:"IXC", dep:"10:00", arr:"12:15", dur:135, fares:{economy:4400,  premium_economy:8200,  business:15500}, meals:true  },
  // ── BOM → DED ─────────────────────────────────────────────
  { flight_id:"SG-1501", airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"BOM", destination:"DED", dep:"09:00", arr:"11:10", dur:130, fares:{economy:4300,  premium_economy:null,  business:null  }, meals:true  },
  // ── BOM → BHO ─────────────────────────────────────────────
  { flight_id:"AI-3061", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"BOM", destination:"BHO", dep:"17:00", arr:"18:30", dur:90,  fares:{economy:3200,  premium_economy:6000,  business:null  }, meals:true  },
  // ── BOM → RPR ─────────────────────────────────────────────
  { flight_id:"SG-1401", airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"BOM", destination:"RPR", dep:"13:00", arr:"15:00", dur:120, fares:{economy:3600,  premium_economy:null,  business:null  }, meals:true  },
  // ── BLR → HYD ─────────────────────────────────────────────
  { flight_id:"6E-1012", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"BLR", destination:"HYD", dep:"07:00", arr:"08:10", dur:70,  fares:{economy:2600,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"UK-541",  airline:"Vistara",     code:"UK", aircraft:"Airbus A320",        origin:"BLR", destination:"HYD", dep:"18:00", arr:"19:15", dur:75,  fares:{economy:3000,  premium_economy:5500,  business:11000}, meals:false },
  // ── BLR → MAA ─────────────────────────────────────────────
  { flight_id:"6E-2101", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"BLR", destination:"MAA", dep:"06:30", arr:"07:35", dur:65,  fares:{economy:2400,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"AI-811",  airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"BLR", destination:"MAA", dep:"17:30", arr:"18:40", dur:70,  fares:{economy:2800,  premium_economy:5200,  business:10000}, meals:false },
  // ── BLR → CCU ─────────────────────────────────────────────
  { flight_id:"6E-1123", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"BLR", destination:"CCU", dep:"09:00", arr:"11:40", dur:160, fares:{economy:5200,  premium_economy:9600,  business:null  }, meals:true  },
  // ── BLR → COK ─────────────────────────────────────────────
  { flight_id:"6E-2211", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"BLR", destination:"COK", dep:"11:00", arr:"12:10", dur:70,  fares:{economy:2700,  premium_economy:null,  business:null  }, meals:false },
  // ── BLR → GOI ─────────────────────────────────────────────
  { flight_id:"SG-501",  airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"BLR", destination:"GOI", dep:"13:00", arr:"14:20", dur:80,  fares:{economy:3000,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"AI-2611", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"GOI", destination:"BLR", dep:"16:30", arr:"17:55", dur:85,  fares:{economy:3100,  premium_economy:5900,  business:11500}, meals:false },
  // ── BLR → AMD ─────────────────────────────────────────────
  { flight_id:"6E-1811", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"BLR", destination:"AMD", dep:"06:30", arr:"08:30", dur:120, fares:{economy:3800,  premium_economy:7100,  business:null  }, meals:true  },
  { flight_id:"SG-901",  airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"BLR", destination:"AMD", dep:"08:00", arr:"10:00", dur:120, fares:{economy:3600,  premium_economy:null,  business:null  }, meals:true  },
  // ── BLR → LKO ─────────────────────────────────────────────
  { flight_id:"SG-1001", airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"BLR", destination:"LKO", dep:"07:30", arr:"10:30", dur:180, fares:{economy:5600,  premium_economy:null,  business:null  }, meals:true  },
  { flight_id:"AI-1311", airline:"Air India",   code:"AI", aircraft:"Airbus A321",        origin:"LKO", destination:"BLR", dep:"11:00", arr:"14:00", dur:180, fares:{economy:5800,  premium_economy:10600, business:19500}, meals:true  },
  // ── BLR → PNY ─────────────────────────────────────────────
  { flight_id:"6E-5221", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"BLR", destination:"PNY", dep:"08:30", arr:"09:30", dur:60,  fares:{economy:2500,  premium_economy:null,  business:null  }, meals:false },
  // ── HYD → MAA ─────────────────────────────────────────────
  { flight_id:"6E-1311", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"HYD", destination:"MAA", dep:"08:00", arr:"09:15", dur:75,  fares:{economy:2800,  premium_economy:null,  business:null  }, meals:false },
  // ── HYD → CCU ─────────────────────────────────────────────
  { flight_id:"AI-921",  airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"HYD", destination:"CCU", dep:"10:00", arr:"12:30", dur:150, fares:{economy:4200,  premium_economy:7900,  business:15000}, meals:true  },
  // ── HYD → COK ─────────────────────────────────────────────
  { flight_id:"6E-1421", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"HYD", destination:"COK", dep:"14:30", arr:"16:15", dur:105, fares:{economy:3600,  premium_economy:6800,  business:null  }, meals:true  },
  { flight_id:"AI-1911", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"COK", destination:"HYD", dep:"15:00", arr:"16:45", dur:105, fares:{economy:3600,  premium_economy:6700,  business:13000}, meals:true  },
  // ── HYD → GOI ─────────────────────────────────────────────
  { flight_id:"SG-601",  airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"HYD", destination:"GOI", dep:"11:30", arr:"13:00", dur:90,  fares:{economy:3100,  premium_economy:null,  business:null  }, meals:true  },
  // ── HYD → AMD ─────────────────────────────────────────────
  { flight_id:"6E-3511", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"HYD", destination:"AMD", dep:"13:30", arr:"15:15", dur:105, fares:{economy:3400,  premium_economy:6300,  business:null  }, meals:true  },
  { flight_id:"UK-1211", airline:"Vistara",     code:"UK", aircraft:"Airbus A320neo",     origin:"AMD", destination:"HYD", dep:"13:00", arr:"14:45", dur:105, fares:{economy:3500,  premium_economy:6500,  business:12500}, meals:true  },
  // ── HYD → PNQ ─────────────────────────────────────────────
  { flight_id:"6E-2811", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"PNQ", destination:"HYD", dep:"07:00", arr:"08:20", dur:80,  fares:{economy:2900,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"SG-811",  airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"PNQ", destination:"HYD", dep:"19:00", arr:"20:25", dur:85,  fares:{economy:2700,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"AI-2211", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"HYD", destination:"PNQ", dep:"17:00", arr:"18:25", dur:85,  fares:{economy:2900,  premium_economy:5500,  business:10500}, meals:false },
  // ── HYD → VTZ ─────────────────────────────────────────────
  { flight_id:"6E-5001", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"VTZ", destination:"HYD", dep:"07:00", arr:"08:10", dur:70,  fares:{economy:2800,  premium_economy:null,  business:null  }, meals:false },
  // ── MAA → CCU ─────────────────────────────────────────────
  { flight_id:"AI-1031", airline:"Air India",   code:"AI", aircraft:"Airbus A321",        origin:"MAA", destination:"CCU", dep:"07:30", arr:"09:45", dur:135, fares:{economy:4500,  premium_economy:8500,  business:16000}, meals:true  },
  { flight_id:"6E-1511", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"MAA", destination:"CCU", dep:"14:00", arr:"16:20", dur:140, fares:{economy:4200,  premium_economy:7800,  business:null  }, meals:true  },
  // ── MAA → COK ─────────────────────────────────────────────
  { flight_id:"6E-2311", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"MAA", destination:"COK", dep:"08:30", arr:"09:40", dur:70,  fares:{economy:2600,  premium_economy:null,  business:null  }, meals:false },
  // ── MAA → AMD ─────────────────────────────────────────────
  { flight_id:"UK-1811", airline:"Vistara",     code:"UK", aircraft:"Airbus A321",        origin:"MAA", destination:"AMD", dep:"07:30", arr:"10:00", dur:150, fares:{economy:5100,  premium_economy:9400,  business:17500}, meals:true  },
  { flight_id:"6E-3711", airline:"IndiGo",      code:"6E", aircraft:"Airbus A321",        origin:"AMD", destination:"MAA", dep:"12:00", arr:"14:30", dur:150, fares:{economy:4900,  premium_economy:9100,  business:null  }, meals:true  },
  // ── MAA → JAI ─────────────────────────────────────────────
  { flight_id:"AI-2411", airline:"Air India",   code:"AI", aircraft:"Airbus A321",        origin:"MAA", destination:"JAI", dep:"07:00", arr:"10:00", dur:180, fares:{economy:5700,  premium_economy:10500, business:19500}, meals:true  },
  { flight_id:"6E-3811", airline:"IndiGo",      code:"6E", aircraft:"Airbus A321",        origin:"JAI", destination:"MAA", dep:"06:00", arr:"09:00", dur:180, fares:{economy:5700,  premium_economy:10400, business:null  }, meals:true  },
  // ── MAA → LKO ─────────────────────────────────────────────
  { flight_id:"UK-2111", airline:"Vistara",     code:"UK", aircraft:"Airbus A321",        origin:"LKO", destination:"MAA", dep:"08:30", arr:"11:30", dur:180, fares:{economy:5900,  premium_economy:10800, business:19800}, meals:true  },
  { flight_id:"6E-4011", airline:"IndiGo",      code:"6E", aircraft:"Airbus A321",        origin:"MAA", destination:"LKO", dep:"14:30", arr:"17:30", dur:180, fares:{economy:5800,  premium_economy:10600, business:null  }, meals:true  },
  // ── MAA → IXZ ─────────────────────────────────────────────
  { flight_id:"6E-5201", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"MAA", destination:"IXZ", dep:"06:00", arr:"08:00", dur:120, fares:{economy:5500,  premium_economy:null,  business:null  }, meals:true  },
  // ── CCU → GOI ─────────────────────────────────────────────
  { flight_id:"6E-1621", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"CCU", destination:"GOI", dep:"10:00", arr:"13:00", dur:180, fares:{economy:5900,  premium_economy:10800, business:null  }, meals:true  },
  { flight_id:"6E-4111", airline:"IndiGo",      code:"6E", aircraft:"Airbus A321",        origin:"GOI", destination:"CCU", dep:"06:30", arr:"09:30", dur:180, fares:{economy:5900,  premium_economy:10800, business:null  }, meals:true  },
  // ── CCU → LKO ─────────────────────────────────────────────
  { flight_id:"AI-1141", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"CCU", destination:"LKO", dep:"09:00", arr:"11:00", dur:120, fares:{economy:3800,  premium_economy:7200,  business:13500}, meals:true  },
  { flight_id:"QP-2101", airline:"Akasa Air",   code:"QP", aircraft:"Boeing 737 MAX 8",   origin:"CCU", destination:"LKO", dep:"16:00", arr:"18:00", dur:120, fares:{economy:3700,  premium_economy:null,  business:null  }, meals:true  },
  // ── CCU → AMD ─────────────────────────────────────────────
  { flight_id:"AI-2011", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"CCU", destination:"AMD", dep:"09:30", arr:"12:45", dur:195, fares:{economy:6100,  premium_economy:11200, business:20500}, meals:true  },
  { flight_id:"6E-1911", airline:"IndiGo",      code:"6E", aircraft:"Airbus A321",        origin:"AMD", destination:"CCU", dep:"08:00", arr:"11:15", dur:195, fares:{economy:6200,  premium_economy:11400, business:null  }, meals:true  },
  // ── CCU → MAA ─────────────────────────────────────────────
  { flight_id:"QP-1901", airline:"Akasa Air",   code:"QP", aircraft:"Boeing 737 MAX 8",   origin:"CCU", destination:"MAA", dep:"11:30", arr:"14:00", dur:150, fares:{economy:4400,  premium_economy:null,  business:null  }, meals:true  },
  // ── CCU → IXZ ─────────────────────────────────────────────
  { flight_id:"AI-3201", airline:"Air India",   code:"AI", aircraft:"Boeing 737-800",     origin:"CCU", destination:"IXZ", dep:"08:00", arr:"10:20", dur:140, fares:{economy:5800,  premium_economy:10500, business:null  }, meals:true  },
  // ── CCU → GAU ─────────────────────────────────────────────
  { flight_id:"AI-3011", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"CCU", destination:"GAU", dep:"10:00", arr:"11:10", dur:70,  fares:{economy:2700,  premium_economy:null,  business:null  }, meals:false },
  // ── CCU → PAT ─────────────────────────────────────────────
  { flight_id:"AI-3021", airline:"Air India",   code:"AI", aircraft:"ATR 72-600",         origin:"CCU", destination:"PAT", dep:"14:00", arr:"15:20", dur:80,  fares:{economy:2900,  premium_economy:null,  business:null  }, meals:false },
  // ── CCU → BBI ─────────────────────────────────────────────
  { flight_id:"AI-3041", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"CCU", destination:"BBI", dep:"09:30", arr:"10:40", dur:70,  fares:{economy:2600,  premium_economy:null,  business:null  }, meals:false },
  // ── CCU → IXR ─────────────────────────────────────────────
  { flight_id:"AI-3051", airline:"Air India",   code:"AI", aircraft:"ATR 72-600",         origin:"CCU", destination:"IXR", dep:"13:00", arr:"14:10", dur:70,  fares:{economy:2600,  premium_economy:null,  business:null  }, meals:false },
  // ── CCU → IXA ─────────────────────────────────────────────
  { flight_id:"6E-5131", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"CCU", destination:"IXA", dep:"08:00", arr:"09:05", dur:65,  fares:{economy:2600,  premium_economy:null,  business:null  }, meals:false },
  // ── CCU → IMF ─────────────────────────────────────────────
  { flight_id:"6E-5141", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"CCU", destination:"IMF", dep:"09:00", arr:"10:20", dur:80,  fares:{economy:2900,  premium_economy:null,  business:null  }, meals:false },
  // ── CCU → DMU ─────────────────────────────────────────────
  { flight_id:"6E-5151", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"CCU", destination:"DMU", dep:"10:00", arr:"11:20", dur:80,  fares:{economy:3000,  premium_economy:null,  business:null  }, meals:false },
  // ── CCU → AJL ─────────────────────────────────────────────
  { flight_id:"6E-5161", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"CCU", destination:"AJL", dep:"08:30", arr:"10:00", dur:90,  fares:{economy:3100,  premium_economy:null,  business:null  }, meals:true  },
  // ── CCU → SHL ─────────────────────────────────────────────
  { flight_id:"6E-5171", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"CCU", destination:"SHL", dep:"09:30", arr:"10:40", dur:70,  fares:{economy:2700,  premium_economy:null,  business:null  }, meals:false },
  // ── CCU → PYG ─────────────────────────────────────────────
  { flight_id:"6E-5191", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"CCU", destination:"PYG", dep:"09:00", arr:"10:20", dur:80,  fares:{economy:3200,  premium_economy:null,  business:null  }, meals:false },
  // ── GOI ─────────────────────────────────────────────────────
  { flight_id:"SG-701",  airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"GOI", destination:"COK", dep:"11:00", arr:"12:20", dur:80,  fares:{economy:3000,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"6E-2711", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"GOI", destination:"PNQ", dep:"15:00", arr:"16:10", dur:70,  fares:{economy:2500,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"SG-1101", airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"GOI", destination:"AMD", dep:"13:30", arr:"15:15", dur:105, fares:{economy:3300,  premium_economy:null,  business:null  }, meals:true  },
  // ── AMD ─────────────────────────────────────────────────────
  { flight_id:"6E-4311", airline:"IndiGo",      code:"6E", aircraft:"ATR 72-600",         origin:"AMD", destination:"PNQ", dep:"10:00", arr:"11:20", dur:80,  fares:{economy:2900,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"SG-1201", airline:"SpiceJet",    code:"SG", aircraft:"Boeing 737-800",     origin:"AMD", destination:"LKO", dep:"11:30", arr:"13:30", dur:120, fares:{economy:3900,  premium_economy:null,  business:null  }, meals:true  },
  // ── PNQ ─────────────────────────────────────────────────────
  { flight_id:"UK-1411", airline:"Vistara",     code:"UK", aircraft:"Airbus A320",        origin:"PNQ", destination:"BLR", dep:"10:00", arr:"11:30", dur:90,  fares:{economy:3300,  premium_economy:6200,  business:12000}, meals:true  },
  { flight_id:"6E-2921", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"PNQ", destination:"COK", dep:"12:30", arr:"14:30", dur:120, fares:{economy:3700,  premium_economy:7000,  business:null  }, meals:true  },
  { flight_id:"QP-2001", airline:"Akasa Air",   code:"QP", aircraft:"Boeing 737 MAX 8",   origin:"PNQ", destination:"MAA", dep:"08:30", arr:"10:30", dur:120, fares:{economy:3700,  premium_economy:null,  business:null  }, meals:true  },
  { flight_id:"QP-2201", airline:"Akasa Air",   code:"QP", aircraft:"Boeing 737 MAX 8",   origin:"PNQ", destination:"JAI", dep:"14:00", arr:"16:00", dur:120, fares:{economy:3200,  premium_economy:null,  business:null  }, meals:true  },
  // ── LKO ─────────────────────────────────────────────────────
  { flight_id:"6E-3011", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"LKO", destination:"BOM", dep:"06:00", arr:"08:10", dur:130, fares:{economy:4000,  premium_economy:7500,  business:null  }, meals:true  },
  { flight_id:"6E-3111", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"LKO", destination:"HYD", dep:"16:00", arr:"18:30", dur:150, fares:{economy:4500,  premium_economy:8400,  business:null  }, meals:true  },
  { flight_id:"6E-4211", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"LKO", destination:"JAI", dep:"09:00", arr:"10:30", dur:90,  fares:{economy:3100,  premium_economy:5800,  business:null  }, meals:false },
  // ── JAI ─────────────────────────────────────────────────────
  { flight_id:"6E-3211", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"JAI", destination:"BOM", dep:"07:00", arr:"08:50", dur:110, fares:{economy:3600,  premium_economy:6800,  business:null  }, meals:true  },
  { flight_id:"QP-1801", airline:"Akasa Air",   code:"QP", aircraft:"Boeing 737 MAX 8",   origin:"JAI", destination:"BLR", dep:"10:00", arr:"12:30", dur:150, fares:{economy:4800,  premium_economy:null,  business:null  }, meals:true  },
  { flight_id:"6E-3311", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"JAI", destination:"HYD", dep:"14:00", arr:"16:15", dur:135, fares:{economy:4100,  premium_economy:7700,  business:null  }, meals:true  },
  // ── COK ─────────────────────────────────────────────────────
  { flight_id:"AI-1511", airline:"Air India",   code:"AI", aircraft:"Airbus A321",        origin:"COK", destination:"CCU", dep:"08:30", arr:"11:30", dur:180, fares:{economy:5700,  premium_economy:10400, business:19000}, meals:true  },
  { flight_id:"6E-3411", airline:"IndiGo",      code:"6E", aircraft:"Airbus A320",        origin:"COK", destination:"AMD", dep:"06:00", arr:"08:30", dur:150, fares:{economy:5000,  premium_economy:9200,  business:null  }, meals:true  },
  { flight_id:"UK-2311", airline:"Vistara",     code:"UK", aircraft:"Airbus A321",        origin:"COK", destination:"LKO", dep:"10:30", arr:"13:30", dur:180, fares:{economy:6000,  premium_economy:11000, business:20200}, meals:true  },
  { flight_id:"AI-3211", airline:"Air India",   code:"AI", aircraft:"ATR 72-600",         origin:"COK", destination:"AGX", dep:"08:00", arr:"09:05", dur:65,  fares:{economy:4500,  premium_economy:null,  business:null  }, meals:false },
  // ── GAU ─────────────────────────────────────────────────────
  { flight_id:"AI-3151", airline:"Air India",   code:"AI", aircraft:"ATR 72-600",         origin:"GAU", destination:"DMU", dep:"14:00", arr:"15:10", dur:70,  fares:{economy:2700,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"AI-3161", airline:"Air India",   code:"AI", aircraft:"ATR 72-600",         origin:"GAU", destination:"AJL", dep:"13:30", arr:"14:50", dur:80,  fares:{economy:2900,  premium_economy:null,  business:null  }, meals:false },
  { flight_id:"AI-3181", airline:"Air India",   code:"AI", aircraft:"ATR 72-600",         origin:"GAU", destination:"HGI", dep:"08:00", arr:"09:10", dur:70,  fares:{economy:3500,  premium_economy:null,  business:null  }, meals:false },
  // ── SXR ─────────────────────────────────────────────────────
  { flight_id:"AI-3121", airline:"Air India",   code:"AI", aircraft:"Airbus A320",        origin:"SXR", destination:"IXL", dep:"13:00", arr:"14:00", dur:60,  fares:{economy:4500,  premium_economy:null,  business:null  }, meals:false },
];

// ── City names for display ──────────────────────────────────────
const CITY_NAMES = {
  DEL:"Delhi", BOM:"Mumbai", BLR:"Bengaluru", MAA:"Chennai",
  HYD:"Hyderabad", CCU:"Kolkata", COK:"Kochi", GOI:"Goa",
  JAI:"Jaipur", AMD:"Ahmedabad", LKO:"Lucknow", PNQ:"Pune",
  VTZ:"Visakhapatnam", GAU:"Guwahati", PAT:"Patna", RPR:"Raipur",
  BBI:"Bhubaneswar", IXR:"Ranchi", BHO:"Bhopal", ATQ:"Amritsar",
  IXC:"Chandigarh", DED:"Dehradun", SXR:"Srinagar", IXJ:"Jammu",
  IXL:"Leh", IXA:"Agartala", IMF:"Imphal", DMU:"Dimapur",
  AJL:"Aizawl", SHL:"Shillong", HGI:"Pasighat", PYG:"Pakyong",
  IXZ:"Port Blair", AGX:"Agatti", KUU:"Kullu", PNY:"Puducherry",
};

// ── Build route index ───────────────────────────────────────────
const FLIGHTS_ROUTE_MAP = {};
FLIGHTS_DB.forEach(f => {
  const key = `${f.origin}-${f.destination}`;
  if (!FLIGHTS_ROUTE_MAP[key]) FLIGHTS_ROUTE_MAP[key] = [];
  FLIGHTS_ROUTE_MAP[key].push(f);
});

// ── Class multiplier for pricing ────────────────────────────────
const CLASS_MULTIPLIER = { Economy:1, "Premium Economy":1.85, Business:3.2, "First Class":5.5 };

// ═══════════════════════════════════════════════════════════════
//  MEALS DATABASE  — from meals.js dataset
// ═══════════════════════════════════════════════════════════════
const MEALS_DB = [
  // Vegetarian
  { id:"MEAL-VEG-001", name:"Veg Biryani",                  cat:"🌿 Vegetarian", price:380, cal:520,  veg:true,  vegan:false, jain:false, gf:false, airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-VEG-002", name:"Paneer Butter Masala with Naan",cat:"🌿 Vegetarian", price:420, cal:610,  veg:true,  vegan:false, jain:false, gf:false, airlines:["Air India","Vistara"] },
  { id:"MEAL-VEG-003", name:"Dal Tadka with Steamed Rice",   cat:"🌿 Vegetarian", price:320, cal:480,  veg:true,  vegan:true,  jain:false, gf:true,  airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-VEG-004", name:"Aloo Gobhi with Roti",          cat:"🌿 Vegetarian", price:290, cal:410,  veg:true,  vegan:true,  jain:false, gf:false, airlines:["IndiGo","SpiceJet","Akasa Air"] },
  { id:"MEAL-VEG-005", name:"Veg Club Sandwich",             cat:"🌿 Vegetarian", price:260, cal:390,  veg:true,  vegan:false, jain:false, gf:false, airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-VEG-006", name:"Masala Upma",                   cat:"🌿 Vegetarian", price:230, cal:340,  veg:true,  vegan:true,  jain:false, gf:false, airlines:["IndiGo","Air India","Vistara"] },
  { id:"MEAL-VEG-007", name:"Paneer Tikka Wrap",             cat:"🌿 Vegetarian", price:310, cal:440,  veg:true,  vegan:false, jain:false, gf:false, airlines:["IndiGo","Vistara","Akasa Air"] },
  { id:"MEAL-VEG-008", name:"Jain Thali",                    cat:"🙏 Jain",       price:370, cal:530,  veg:true,  vegan:true,  jain:true,  gf:false, airlines:["Air India","Vistara"] },
  { id:"MEAL-VEG-009", name:"Idli Sambar",                   cat:"🌿 Vegetarian", price:210, cal:310,  veg:true,  vegan:true,  jain:false, gf:true,  airlines:["IndiGo","Air India","Vistara","SpiceJet"] },
  // Non-Veg
  { id:"MEAL-NON-001", name:"Chicken Biryani",               cat:"🍗 Non-Veg",    price:450, cal:620,  veg:false, vegan:false, jain:false, gf:true,  airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-NON-002", name:"Butter Chicken with Naan",      cat:"🍗 Non-Veg",    price:490, cal:680,  veg:false, vegan:false, jain:false, gf:false, airlines:["Air India","Vistara"] },
  { id:"MEAL-NON-003", name:"Egg Bhurji with Toast",         cat:"🍗 Non-Veg",    price:270, cal:390,  veg:false, vegan:false, jain:false, gf:false, airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-NON-004", name:"Chicken Keema Wrap",            cat:"🍗 Non-Veg",    price:340, cal:470,  veg:false, vegan:false, jain:false, gf:false, airlines:["IndiGo","SpiceJet","Akasa Air"] },
  { id:"MEAL-NON-005", name:"Mutton Rogan Josh with Rice",   cat:"🍗 Non-Veg",    price:580, cal:720,  veg:false, vegan:false, jain:false, gf:true,  airlines:["Air India","Vistara"] },
  { id:"MEAL-NON-006", name:"Fish Curry with Steamed Rice",  cat:"🍗 Non-Veg",    price:520, cal:570,  veg:false, vegan:false, jain:false, gf:true,  airlines:["Air India","Vistara"] },
  { id:"MEAL-NON-007", name:"Chicken Sandwich",              cat:"🍗 Non-Veg",    price:290, cal:420,  veg:false, vegan:false, jain:false, gf:false, airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  // Vegan
  { id:"MEAL-VGN-001", name:"Mixed Fruit Bowl",              cat:"🌱 Vegan",      price:220, cal:180,  veg:true,  vegan:true,  jain:true,  gf:true,  airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-VGN-002", name:"Garden Veg Sandwich",           cat:"🌱 Vegan",      price:240, cal:320,  veg:true,  vegan:true,  jain:false, gf:false, airlines:["IndiGo","Vistara","Akasa Air"] },
  { id:"MEAL-VGN-003", name:"Vegan Khichdi",                 cat:"🌱 Vegan",      price:270, cal:380,  veg:true,  vegan:true,  jain:false, gf:true,  airlines:["Air India","Vistara"] },
  // Snacks
  { id:"MEAL-SNK-001", name:"Masala Peanuts & Chips Combo",  cat:"🍿 Snack",      price:120, cal:310,  veg:true,  vegan:true,  jain:true,  gf:false, airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-SNK-002", name:"Cookies Pack (3 pcs)",          cat:"🍿 Snack",      price:100, cal:240,  veg:true,  vegan:false, jain:false, gf:false, airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-SNK-003", name:"Cup Noodles",                   cat:"🍿 Snack",      price:130, cal:290,  veg:false, vegan:false, jain:false, gf:false, airlines:["IndiGo","SpiceJet","Akasa Air"] },
  // Beverages
  { id:"MEAL-BEV-001", name:"Fresh Lime Soda",               cat:"🥤 Beverage",   price:90,  cal:45,   veg:true,  vegan:true,  jain:true,  gf:true,  airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-BEV-002", name:"Masala Chai",                   cat:"🍵 Beverage",   price:80,  cal:90,   veg:true,  vegan:false, jain:true,  gf:true,  airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-BEV-003", name:"Orange Juice (250ml)",          cat:"🥤 Beverage",   price:110, cal:110,  veg:true,  vegan:true,  jain:true,  gf:true,  airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-BEV-004", name:"Soft Drink Can (330ml)",        cat:"🥤 Beverage",   price:100, cal:140,  veg:true,  vegan:true,  jain:true,  gf:true,  airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  { id:"MEAL-BEV-005", name:"Bottled Water (500ml)",         cat:"🥤 Beverage",   price:60,  cal:0,    veg:true,  vegan:true,  jain:true,  gf:true,  airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air"] },
  // Business Class
  { id:"MEAL-BIZ-001", name:"Business Thali (Veg)",          cat:"👔 Business",   price:0,   cal:850,  veg:true,  vegan:false, jain:false, gf:false, airlines:["Air India","Vistara"] },
  { id:"MEAL-BIZ-002", name:"Business Thali (Non-Veg)",      cat:"👔 Business",   price:0,   cal:920,  veg:false, vegan:false, jain:false, gf:false, airlines:["Air India","Vistara"] },
  { id:"MEAL-BIZ-003", name:"Continental Breakfast Plate",   cat:"👔 Business",   price:0,   cal:680,  veg:false, vegan:false, jain:false, gf:false, airlines:["Air India","Vistara"] },
  // No Meal
  { id:"MEAL-NONE",    name:"No Meal",                       cat:"⛔ No Meal",    price:0,   cal:0,    veg:true,  vegan:true,  jain:true,  gf:true,  airlines:["IndiGo","Air India","Vistara","SpiceJet","Akasa Air","Alliance Air"] },
];

// Meal policy per airline
const MEAL_POLICY = {
  "IndiGo":     { economy:{complimentary:false, discount:15}, business:{complimentary:true} },
  "Air India":  { economy:{complimentary:true,  items:1},     business:{complimentary:true} },
  "Vistara":    { economy:{complimentary:true,  items:1},     business:{complimentary:true} },
  "SpiceJet":   { economy:{complimentary:false, discount:10}, business:{complimentary:true} },
  "Akasa Air":  { economy:{complimentary:false, discount:12}, business:{complimentary:true} },
  "Alliance Air":{ economy:{complimentary:false, discount:0}, business:{complimentary:false} },
};

function getMealsForFlight(airlineName, travelClass, mealsAvailable) {
  if (!mealsAvailable) return [MEALS_DB.find(m => m.id === "MEAL-NONE")];
  const isBusinessComp = travelClass === "Business" || travelClass === "First Class";
  return MEALS_DB.filter(m => {
    if (!m.airlines.includes(airlineName) && m.id !== "MEAL-NONE") return false;
    if (m.cat === "👔 Business") return isBusinessComp;
    return true;
  });
}

function generateFlights(from, to, travelClass, passengers) {
  const classKey = travelClass === "First Class" ? "Business"
                 : travelClass === "Premium Economy" ? "premium_economy"
                 : travelClass === "Business" ? "business"
                 : "economy";
  const mult = CLASS_MULTIPLIER[travelClass] || 1;

  const key     = `${from}-${to}`;
  const revKey  = `${to}-${from}`;
  let   found   = FLIGHTS_ROUTE_MAP[key] || [];

  // For reverse routes, swap origin/destination display
  if (!found.length && FLIGHTS_ROUTE_MAP[revKey]) {
    found = FLIGHTS_ROUTE_MAP[revKey].map(f => ({...f, origin:to, destination:from, _reversed:true}));
  }

  if (!found.length) return [];

  return found.map(f => {
    const baseFare = f.fares[classKey] || f.fares["economy"] || 3000;
    const px = Math.round(baseFare * (0.92 + Math.random() * 0.16));
    return {
      id:           f.flight_id + "_" + generateId(),
      airline:      f.airline,
      airlineCode:  f.code,
      flightNumber: f.flight_id,
      aircraft:     f.aircraft,
      from,  to,
      depTime:      f.dep,
      arrTime:      f.arr,
      depHour:      parseInt(f.dep.split(":")[0])*60 + parseInt(f.dep.split(":")[1]),
      durationMins: f.dur,
      duration:     formatDuration(f.dur),
      price:        px,
      priceTotal:   px * passengers,
      travelClass,
      passengers,
      stops:        0,
      mealsAvailable: f.meals,
    };
  }).sort((a,b) => a.price - b.price);
}


let allFlights = [];

let allReturnFlights = [];
let _selectedOutbound = null;
let _isRoundTrip = false;

function initFlightsPage() {
  if (!document.getElementById("flight-list")) return;
  const p          = new URLSearchParams(window.location.search);
  const from       = p.get("from")||"DEL", to=p.get("to")||"BOM";
  const depart     = p.get("depart")||"";
  const returnDate = p.get("returnDate")||"";
  const passengers = parseInt(p.get("passengers")||"1");
  const travelClass= p.get("class")||"Economy";
  _isRoundTrip     = p.get("trip") === "roundtrip";

  const title = document.getElementById("results-title");
  const meta  = document.getElementById("results-meta");
  if (title) title.textContent = _isRoundTrip ? `${from} ⇌ ${to}` : `${from} → ${to}`;
  if (meta)  meta.textContent  = `${depart?formatDate(depart):"Flexible"}${_isRoundTrip&&returnDate?" → "+formatDate(returnDate):""} · ${passengers} Passenger${passengers>1?"s":""} · ${travelClass}`;

  setTimeout(() => {
    allFlights = generateFlights(from, to, travelClass, passengers);
    if (_isRoundTrip) {
      allReturnFlights = generateFlights(to, from, travelClass, passengers);
      sessionStorage.setItem("jsg_return_flights", JSON.stringify(allReturnFlights));
    }
    sessionStorage.setItem("jsg_flights", JSON.stringify(allFlights));
    sessionStorage.setItem("jsg_trip_type", _isRoundTrip ? "roundtrip" : "oneway");

    // Render outbound section
    const list = document.getElementById("flight-list");
    if (_isRoundTrip) {
      list.insertAdjacentHTML("beforebegin", `
        <div class="section-divider">
          <span>✈ Outbound — ${from} → ${to} &nbsp;·&nbsp; ${formatDate(depart)}</span>
        </div>`);
    }
    renderFlights(allFlights);

    // Render return section for round trip
    if (_isRoundTrip) {
      const returnSection = document.createElement("div");
      returnSection.id = "return-flight-section";
      returnSection.innerHTML = `
        <div class="section-divider" style="margin-top:2rem">
          <span>✈ Return — ${to} → ${from} &nbsp;·&nbsp; ${formatDate(returnDate)}</span>
        </div>
        <div id="return-flight-list"></div>`;
      list.parentNode.insertBefore(returnSection, list.nextSibling);
      renderReturnFlights(allReturnFlights);
    }

    const cnt = document.getElementById("results-count");
    if (cnt) cnt.textContent = `${allFlights.length} flights found${_isRoundTrip ? " (select one outbound + one return)" : ""}`;
  }, 900);

  let _activeSort   = null;   // "price" | "duration" | "departure" | null
  let _activeFilter = "all";  // "all" | "Economy" | "Business" | "First Class"

  function applyFilterAndSort() {
    // Filter
    let list = _activeFilter === "all"
      ? [...allFlights]
      : allFlights.filter(f => f.travelClass === _activeFilter);

    // Sort
    if (_activeSort === "price")     list.sort((a,b) => a.price - b.price);
    if (_activeSort === "duration")  list.sort((a,b) => a.durationMins - b.durationMins);
    if (_activeSort === "departure") list.sort((a,b) => a.depHour - b.depHour);

    renderFlights(list);

    // Same for return flights if round trip
    if (_isRoundTrip) {
      let retList = _activeFilter === "all"
        ? [...allReturnFlights]
        : allReturnFlights.filter(f => f.travelClass === _activeFilter);
      if (_activeSort === "price")     retList.sort((a,b) => a.price - b.price);
      if (_activeSort === "duration")  retList.sort((a,b) => a.durationMins - b.durationMins);
      if (_activeSort === "departure") retList.sort((a,b) => a.depHour - b.depHour);
      renderReturnFlights(retList);
    }
  }

  // Class filter chips (All / Economy / Business / First Class)
  document.querySelectorAll(".filter-chip[data-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip[data-filter]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      _activeFilter = chip.dataset.filter;
      applyFilterAndSort();
    });
  });

  // Sort chips
  document.querySelectorAll(".filter-chip[data-sort]").forEach(chip => {
    chip.addEventListener("click", () => {
      const isSameSort = _activeSort === chip.dataset.sort;
      document.querySelectorAll(".filter-chip[data-sort]").forEach(c => c.classList.remove("active"));
      if (isSameSort) {
        _activeSort = null; // toggle off
      } else {
        chip.classList.add("active");
        _activeSort = chip.dataset.sort;
      }
      applyFilterAndSort();
    });
  });
}

function renderReturnFlights(flights) {
  const list = document.getElementById("return-flight-list");
  if (!list) return;
  list.innerHTML = flights.map((f,idx)=>buildFlightCard(f, idx, true)).join("");
}

function buildFlightCard(f, idx, isReturn=false) {
  const btnLabel = _isRoundTrip ? (isReturn ? "Select Return ✈" : "Select Outbound ✈") : "Book Now";
  const btnFn    = _isRoundTrip
    ? (isReturn ? `selectReturnFlight('${f.id}')` : `selectOutboundFlight('${f.id}')`)
    : `bookFlight('${f.id}')`;
  return `
    <div class="flight-card" id="fcard-${f.id}" style="animation-delay:${idx*.06}s">
      <div class="airline-info">
        <div class="airline-logo">${f.airlineCode}</div>
        <div><div class="airline-name">${f.airline}</div><div class="flight-number">${f.flightNumber}</div></div>
      </div>
      <div class="time-block"><div class="time-big">${f.depTime}</div><div class="airport-code">${f.from}</div></div>
      <div class="flight-route">
        <div class="flight-duration">${f.duration}</div>
        <div class="route-line"><div class="route-dot"></div><div class="route-bar"></div><div class="route-dot"></div></div>
        <div class="flight-stops">${f.stops===0?"Non-stop":"1 Stop"}</div>
      </div>
      <div class="time-block"><div class="time-big">${f.arrTime}</div><div class="airport-code">${f.to}</div></div>
      <div class="price-block">
        <div class="price-amount">${formatPrice(f.price)}</div>
        <div class="price-per">per person</div>
        <div class="price-class">${f.travelClass}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">Total: ${formatPrice(f.priceTotal)}</div>
      </div>
      <div class="book-btn-wrap">
        <button class="btn btn-primary" onclick="${btnFn}">${btnLabel}</button>
      </div>
    </div>`;
}

let _rtOutboundId = null, _rtReturnId = null;

function selectOutboundFlight(id) {
  if (!requireLogin()) return;
  _rtOutboundId = id;
  document.querySelectorAll("#flight-list .flight-card").forEach(c => {
    c.classList.toggle("selected", c.id === `fcard-${id}`);
  });
  showToast("\u2705 Outbound selected! Now pick your return flight below.", "success");
  document.getElementById("return-flight-section")?.scrollIntoView({behavior:"smooth"});
}

function selectReturnFlight(id) {
  if (!requireLogin()) return;
  if (!_rtOutboundId) { showToast("Please select an outbound flight first.", "warning"); return; }
  _rtReturnId = id;
  document.querySelectorAll("#return-flight-list .flight-card").forEach(c => {
    c.classList.toggle("selected", c.id === `fcard-${id}`);
  });
  const outbound = allFlights.find(f => f.id === _rtOutboundId);
  const ret      = allReturnFlights.find(f => f.id === _rtReturnId);
  if (outbound && ret) {
    sessionStorage.setItem("jsg_selected_flight", _rtOutboundId);
    sessionStorage.setItem("jsg_selected_return", _rtReturnId);
    showToast("\u2705 Both flights selected! Proceeding to booking...", "success");
    setTimeout(() => { window.location.href = "booking.html"; }, 900);
  }
}

function renderFlights(flights) {
  const list = document.getElementById("flight-list");
  if (!list) return;
  if (!flights.length) {
    const filter = document.querySelector(".filter-chip[data-filter].active")?.dataset.filter || "all";
    const msg = filter !== "all"
      ? `No ${filter} flights on this route. Try a different class.`
      : "No flights found for this route.";
    list.innerHTML = `<div class="no-results"><div class="icon">✈</div><p>${msg}</p></div>`;
    return;
  }
  list.innerHTML = flights.map((f,idx)=>buildFlightCard(f,idx,false)).join("");
}

function renderReturnFlights(flights) {
  const list = document.getElementById("return-flight-list");
  if (!list) return;
  list.innerHTML = flights.map((f,idx)=>buildFlightCard(f,idx,true)).join("");
}


function bookFlight(flightId) {
  if (!requireLogin()) return;
  sessionStorage.setItem("jsg_selected_flight", flightId);
  sessionStorage.removeItem("jsg_selected_return");
  window.location.href = "booking.html";
}

/* ═══════════════════════════════════════════════════════════════
   11. BOOKING PAGE
═══════════════════════════════════════════════════════════════ */

function initBookingPage() {
  if (!document.getElementById("passenger-forms-container")) return;
  if (!requireLogin()) return;

  const flightId   = sessionStorage.getItem("jsg_selected_flight");
  const returnId   = sessionStorage.getItem("jsg_selected_return");
  const tripType   = sessionStorage.getItem("jsg_trip_type") || "oneway";
  const flights    = JSON.parse(sessionStorage.getItem("jsg_flights")||"[]");
  const retFlights = JSON.parse(sessionStorage.getItem("jsg_return_flights")||"[]");
  const flight     = flights.find(f=>f.id===flightId);
  const retFlight  = returnId ? retFlights.find(f=>f.id===returnId) : null;

  // If payment just completed, don't re-init (success modal is showing)
  if (sessionStorage.getItem("jsg_payment_done") === "1") return;

  if (!flight) {
    showToast("Flight lost. Please search again.","error");
    setTimeout(()=>{ window.location.href="index.html"; },1500);
    return;
  }

  // Attach return flight to flight object so it flows through booking
  flight.returnFlight = retFlight || null;
  flight.isRoundTrip  = tripType === "roundtrip" && !!retFlight;

  renderBookingSummary(flight);
  renderPassengerForms(flight.passengers, flight);
  renderFareSummary(flight);

  if (flight.passengers > 1) {
    document.getElementById("split-fare-section").style.display = "";
    document.getElementById("split-fare-checkbox")?.addEventListener("change", function () {
      document.getElementById("split-phones-container").classList.toggle("hidden", !this.checked);
      if (this.checked) {
        // Hide passenger forms 2..N — only booker fills their own details
        for (let i = 2; i <= flight.passengers; i++) {
          const card = document.querySelector(`#passenger-forms-container .passenger-form-card:nth-child(${i})`);
          if (card) card.style.display = "none";
        }
        // Show note that others only need email
        renderSplitEmailInputs(flight.passengers);
      } else {
        // Restore all passenger forms
        for (let i = 2; i <= flight.passengers; i++) {
          const card = document.querySelector(`#passenger-forms-container .passenger-form-card:nth-child(${i})`);
          if (card) card.style.display = "";
        }
        document.getElementById("split-phone-inputs").innerHTML = "";
      }
    });
  }

  // Clone proceed-btn to wipe any stale listeners from previous renders
  const proceedOld = document.getElementById("proceed-btn");
  if (proceedOld) {
    const proceedNew = proceedOld.cloneNode(true);
    proceedOld.parentNode.replaceChild(proceedNew, proceedOld);
  }
  document.getElementById("proceed-btn")?.addEventListener("click", () => {
    if (!validatePassengerForms(flight.passengers)) return;
    const splitChecked = document.getElementById("split-fare-checkbox")?.checked;
    if (splitChecked && !validateSplitEmails(flight.passengers)) return;
    // Collect passenger data NOW while forms are still in DOM
    flight._collectedPassengers = collectPassengerData(flight.passengers);
    openBookingOtpModal(flight, splitChecked);
  });
}

function renderBookingSummary(f) {
  const r = document.getElementById("booking-route");
  const d = document.getElementById("booking-details");
  if (r) r.innerHTML = f.isRoundTrip
    ? `<span>${f.from}</span><span>⇌</span><span>${f.to}</span>`
    : `<span>${f.from}</span><span>✈</span><span>${f.to}</span>`;

  let html = `
    <div class="detail-section-label" style="font-size:.75rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem">
      ${f.isRoundTrip ? "✈ Outbound" : "✈ Flight"}
    </div>
    <div class="detail-item"><span class="label">Airline</span><span class="value">${f.airline} · ${f.flightNumber}</span></div>
    <div class="detail-item"><span class="label">Departure</span><span class="value">${f.depTime}</span></div>
    <div class="detail-item"><span class="label">Arrival</span><span class="value">${f.arrTime}</span></div>
    <div class="detail-item"><span class="label">Duration</span><span class="value">${f.duration}</span></div>
    <div class="detail-item"><span class="label">Class</span><span class="value">${f.travelClass}</span></div>
    <div class="detail-item"><span class="label">Passengers</span><span class="value">${f.passengers}</span></div>`;

  if (f.isRoundTrip && f.returnFlight) {
    const rf = f.returnFlight;
    html += `
    <div style="margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--border)">
    <div class="detail-section-label" style="font-size:.75rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem">
      ✈ Return
    </div>
    <div class="detail-item"><span class="label">Airline</span><span class="value">${rf.airline} · ${rf.flightNumber}</span></div>
    <div class="detail-item"><span class="label">Departure</span><span class="value">${rf.depTime}</span></div>
    <div class="detail-item"><span class="label">Arrival</span><span class="value">${rf.arrTime}</span></div>
    <div class="detail-item"><span class="label">Duration</span><span class="value">${rf.duration}</span></div>
    </div>`;
  }
  if (d) d.innerHTML = html;
}

function renderPassengerForms(count, flight) {
  const airlineName  = flight?.airline || "IndiGo";
  const travelClass  = flight?.travelClass || "Economy";
  const mealsOk      = flight?.mealsAvailable !== false;
  const availMeals   = getMealsForFlight(airlineName, travelClass, mealsOk);
  const mealOptions  = availMeals.map(m =>
    `<option value="${m.id}">${m.cat} — ${m.name}${m.price>0?" (+₹"+m.price+")":m.price===0&&m.id!="MEAL-NONE"?" (Complimentary)":""}</option>`
  ).join("");

  const policy = MEAL_POLICY[airlineName];
  const classKey = travelClass.toLowerCase().replace(" ","_");
  const policyNote = policy?.[classKey]?.complimentary
    ? `<p style="font-size:.78rem;color:#22c55e;margin-bottom:.5rem">✅ 1 meal complimentary for ${airlineName} ${travelClass}</p>`
    : policy?.[classKey]?.discount
    ? `<p style="font-size:.78rem;color:var(--accent);margin-bottom:.5rem">🏷 Pre-order discount: ${policy[classKey].discount}% off</p>`
    : "";

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
          ${mealsOk ? `<div class="form-group">
            <label class="form-label">🍽 Meal Preference</label>
            ${policyNote}
            <select class="form-control" id="p${i}-meal">${mealOptions}</select>
          </div>` : `<p style="font-size:.8rem;color:var(--text-muted);margin-top:.25rem">⚠ No meals available on this flight</p>`}
        </div>
      </div>`; }).join("");
}

function validatePassengerForms(count) {
  const isSplit = document.getElementById("split-fare-checkbox")?.checked;
  // When split fare: only validate passenger 1 (others only provide email via split section)
  const validateCount = isSplit ? 1 : count;
  let valid = true;
  for (let i=1;i<=validateCount;i++) {
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
  // Primary passenger (i=1) already filled in passenger forms — skip
  // Only collect emails for passengers 2..N
  c.innerHTML = `<p style="font-size:.82rem;color:var(--text-muted);margin-bottom:.75rem">
    ✅ Your details are filled above. Enter email addresses for the other passengers to send their payment links.
  </p>` +
  Array.from({length:count-1},(_,idx)=>{const i=idx+2; return `
    <div class="split-phone-input">
      <span style="font-size:.85rem;font-weight:600;min-width:110px;color:var(--text-muted)">Passenger ${i}</span>
      <input type="email" class="form-control" id="split-email-${i}" placeholder="passenger${i}@email.com" />
      <span class="form-error hidden" id="split-email-${i}-err">⚠ Valid email required</span>
    </div>`;}).join("");
}

function validateSplitEmails(count) {
  let valid = true;
  for (let i=2;i<=count;i++) {  // start from 2 — passenger 1 uses their own email from form
    const e = document.getElementById(`split-email-${i}`)?.value.trim();
    if (!e||!isValidEmail(e)) {showError(`split-email-${i}-err`,true); valid=false;} else showError(`split-email-${i}-err`,false);
  }
  if (!valid) showToast("Enter valid emails for all passengers.", "warning");
  return valid;
}

function getMealTotal(paxCount) {
  let total = 0;
  for (let i=1;i<=paxCount;i++) {
    const mealId = document.getElementById(`p${i}-meal`)?.value || "MEAL-NONE";
    const meal   = MEALS_DB.find(m=>m.id===mealId);
    if (meal) total += meal.price;
  }
  return total;
}

function renderFareSummary(flight) {
  const el = document.getElementById("fare-rows");
  if (!el) return;
  const rf        = flight.returnFlight;
  const baseOut   = flight.price * flight.passengers;
  const baseRet   = rf ? rf.price * rf.passengers : 0;
  const baseTotal = baseOut + baseRet;
  const mealCost  = getMealTotal(flight.passengers);
  const tax       = Math.round((baseTotal + mealCost) * .18);
  const total     = baseTotal + mealCost + tax + 200;

  let html = `
    <div class="fare-row"><span class="fare-label">Outbound Fare (×${flight.passengers})</span><span>${formatPrice(baseOut)}</span></div>`;
  if (rf) html += `
    <div class="fare-row"><span class="fare-label">Return Fare (×${rf.passengers})</span><span>${formatPrice(baseRet)}</span></div>`;
  if (mealCost > 0) html += `
    <div class="fare-row"><span class="fare-label">Meal Charges</span><span>${formatPrice(mealCost)}</span></div>`;
  html += `
    <div class="fare-row"><span class="fare-label">Taxes & Fees (18%)</span><span>${formatPrice(tax)}</span></div>
    <div class="fare-row"><span class="fare-label">Convenience Fee</span><span>${formatPrice(200)}</span></div>
    <div class="fare-row total-row"><span>Total</span><span style="color:var(--accent)">${formatPrice(total)}</span></div>`;
  el.innerHTML = html;

  // Re-render on meal change
  for (let i=1;i<=flight.passengers;i++) {
    document.getElementById(`p${i}-meal`)?.addEventListener("change", ()=>renderFareSummary(flight));
  }
}

function collectPassengerData(count) {
  return Array.from({length:count},(_,idx)=>{const i=idx+1;
    const mealId = document.getElementById(`p${i}-meal`)?.value || "MEAL-NONE";
    const meal   = MEALS_DB.find(m=>m.id===mealId) || MEALS_DB.find(m=>m.id==="MEAL-NONE");
    return {
      name:  document.getElementById(`p${i}-name`)?.value.trim()||"",
      age:   document.getElementById(`p${i}-age`)?.value||"",
      gender:document.getElementById(`p${i}-gender`)?.value||"",
      phone: document.getElementById(`p${i}-phone`)?.value.trim()||"",
      email: document.getElementById(`p${i}-email`)?.value.trim()||"",
      meal:  meal ? `${meal.cat} — ${meal.name}` : "No Meal",
      mealId: mealId,
      mealPrice: meal ? meal.price : 0,
    };
  });
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

  // Correct total — include return flight if round trip
  const rf         = flight.returnFlight;
  const baseTotal  = (flight.price + (rf ? rf.price : 0)) * flight.passengers;
  const _pax       = flight._collectedPassengers || [];
  const mealCost   = _pax.reduce((sum,p)=>sum+(p.mealPrice||0),0);
  const tax        = Math.round((baseTotal + mealCost) * .18);
  const total      = baseTotal + mealCost + tax + 200;
  const user       = getLoggedInUser();

  // Build HTML — NO confirm-pay-btn here, we add it separately via JS
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
      <button class="btn btn-ghost" id="cancel-pay-btn">Cancel</button>
      <button class="btn btn-primary btn-lg" id="confirm-pay-btn">🔒 Pay ${formatPrice(total)}</button>
    </div>`;

  modal.classList.remove("hidden");

  // Wire cancel — fresh element so no cloning needed
  document.getElementById("cancel-pay-btn").addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  // Wire pay button — fresh element, just add listener directly
  document.getElementById("confirm-pay-btn").addEventListener("click", async () => {
    const card = document.getElementById("pay-card")?.value.replace(/\s/g,"");
    const exp  = document.getElementById("pay-expiry")?.value;
    const cvv  = document.getElementById("pay-cvv")?.value;
    const name = document.getElementById("pay-name")?.value.trim();
    if (!card||card.length<16) { showToast("Enter a valid card number.","warning"); return; }
    if (!exp||!exp.includes("/")) { showToast("Enter a valid expiry date.","warning"); return; }
    if (!cvv||cvv.length<3)    { showToast("Enter the CVV.","warning"); return; }
    if (!name)                 { showToast("Enter the card holder name.","warning"); return; }

    const btn = document.getElementById("confirm-pay-btn");
    btn.disabled = true;
    btn.textContent = "Processing…";

    await new Promise(r => setTimeout(r, 1800));
    modal.classList.add("hidden");
    await completeBooking(flight);
  });
}

async function completeBooking(flight) {
  const user       = getLoggedInUser();
  const passengers = flight._collectedPassengers || collectPassengerData(flight.passengers);
  const rf         = flight.returnFlight;
  const baseTotal  = (flight.price + (rf ? rf.price : 0)) * flight.passengers;
  const mealCost   = passengers.reduce((sum,p)=>sum+(p.mealPrice||0),0);
  const tax        = Math.round((baseTotal + mealCost) * .18);
  const total      = baseTotal + mealCost + tax + 200;
  const bookingId  = "JSG"+Date.now().toString().slice(-8).toUpperCase();
  const booking    = {
    id:bookingId, userId:user?.uid||user?.id||"guest",
    userName:user?.name||"Guest", userEmail:user?.email||"",
    flight, returnFlight: rf || null,
    isRoundTrip: flight.isRoundTrip || false,
    passengers, status:"Fully Paid", splitFare:false,
    totalAmount:total, createdAt:new Date().toISOString(),
  };
  await saveBooking(booking);

  // Set a flag so page reload guard knows payment is done
  sessionStorage.setItem("jsg_payment_done", "1");

  // Hide all modals
  document.getElementById("payment-modal")?.classList.add("hidden");
  document.getElementById("booking-otp-modal")?.classList.add("hidden");

  // Show success modal
  const sm = document.getElementById("success-modal");
  const si = document.getElementById("success-booking-id");
  if (sm) sm.classList.remove("hidden");
  if (si) si.textContent = `Booking ID: ${bookingId}`;

  // Redirect to My Bookings after 3s
  setTimeout(() => {
    sessionStorage.removeItem("jsg_selected_flight");
    sessionStorage.removeItem("jsg_selected_return");
    sessionStorage.removeItem("jsg_trip_type");
    sessionStorage.removeItem("jsg_payment_done");
    window.location.href = "mybookings.html";
  }, 3000);
}

async function showSplitFareFlow(flight) {
  const user      = getLoggedInUser();
  const p1Data    = collectPassengerData(1)[0]; // only passenger 1 filled in
  const tax       = Math.round(flight.price * .18);
  const total     = (flight.price + tax) * flight.passengers + 200;
  const perPax    = Math.ceil(total / flight.passengers);
  const bookingId = "JSG" + Date.now().toString().slice(-8).toUpperCase();

  // Co-passenger emails from split section
  const coEmails = Array.from({length: flight.passengers - 1}, (_, i) =>
    document.getElementById(`split-email-${i + 2}`)?.value.trim() || ""
  );

  // Build placeholder passengers for co-passengers (details unknown until they pay)
  const allPassengers = [
    {
      ...p1Data,
      splitEmail:    p1Data.email,
      paymentStatus: "Pending", // will be paid immediately after OTP
      shareAmount:   perPax,
      payToken:      generateId(),
      isPrimary:     true,
    },
    ...coEmails.map((email, i) => ({
      name:          `Passenger ${i + 2}`,
      age:           "",
      gender:        "",
      phone:         "",
      email:         email,
      splitEmail:    email,
      paymentStatus: "Pending",
      shareAmount:   perPax,
      payToken:      generateId(),
      isPrimary:     false,
    }))
  ];

  const booking = {
    id: bookingId,
    userId:    user?.uid || user?.id || "guest",
    userName:  user?.name || "Guest",
    userEmail: user?.email || "",
    flight,
    passengers: allPassengers,
    status:       "Pending",
    splitFare:    true,
    totalAmount:  total,
    perPaxAmount: perPax,
    createdAt:    new Date().toISOString(),
  };

  await saveBooking(booking);

  // Send payment links to co-passengers immediately
  const baseUrl = window.location.href.replace("booking.html", "splitpay.html");
  const coPromises = allPassengers.slice(1).map(p => {
    const link = `${baseUrl}?booking=${bookingId}&token=${p.payToken}&name=${encodeURIComponent(p.name)}`;
    return sendPaymentLinkEmail(p.splitEmail, p.name, link, formatPrice(perPax), bookingId);
  });
  await Promise.allSettled(coPromises);

  // Now let primary booker pay their share via email OTP
  showToast(`📧 Payment links sent to ${flight.passengers - 1} co-passenger(s)! Now verify your email to pay your share.`, "success", 4000);
  setTimeout(() => openSplitBookerPayment(booking), 1500);
}

// OTP verification + immediate payment for primary booker in split fare
async function openSplitBookerPayment(booking) {
  // OTP was already verified in the booking flow — go straight to payment
  const modal = document.getElementById("payment-modal");
  const body  = document.getElementById("payment-modal-body");
  if (!modal || !body) { window.location.href = "mybookings.html"; return; }

  const amount = formatPrice(booking.perPaxAmount);

  body.innerHTML = `
    <div style="text-align:center;margin-bottom:1.5rem">
      <div style="font-size:2.5rem;margin-bottom:.5rem">💳</div>
      <h3 style="font-family:'Syne';font-size:1.3rem;margin-bottom:.25rem">Pay Your Share</h3>
      <p style="color:var(--text-muted);font-size:.85rem">Co-passengers have been emailed their payment links.</p>
    </div>
    <div class="card-visual" style="text-align:left;margin-bottom:1.25rem">
      <div class="card-brand">JetSetGo Pay</div>
      <div class="card-number">•••• •••• •••• 4242</div>
      <div class="card-meta"><span>12/28</span><span>VISA</span></div>
    </div>
    <div style="text-align:center;margin-bottom:1.25rem">
      <div style="font-size:.85rem;color:var(--text-muted)">Your share</div>
      <div style="font-family:'Syne';font-size:2rem;font-weight:800;color:var(--accent)">${amount}</div>
    </div>
    <button class="btn btn-primary btn-lg w-full" id="split-booker-pay-btn">💳 Pay ${amount}</button>
  `;

  modal.classList.remove("hidden");

  document.getElementById("split-booker-pay-btn")?.addEventListener("click", async () => {
    const btn = document.getElementById("split-booker-pay-btn");
    btn.disabled = true; btn.textContent = "Processing…";
    await new Promise(r => setTimeout(r, 1800));

    booking.passengers[0].paymentStatus = "Paid";
    const allPaid = booking.passengers.every(p => p.paymentStatus === "Paid");
    booking.status = allPaid ? "Fully Paid" : "Partially Paid";
    await saveBooking(booking);

    modal.classList.add("hidden");
    showToast("✅ Your share is paid! Co-passengers will pay via their email links.", "success", 5000);
    setTimeout(() => { window.location.href = "mybookings.html"; }, 1500);
  });
}

/* ═══════════════════════════════════════════════════════════════
   14. FIREBASE / LOCALSTORAGE BOOKING CRUD
═══════════════════════════════════════════════════════════════ */

async function saveBooking(booking) {
  // Always save to localStorage first (instant, offline-safe)
  const all=JSON.parse(localStorage.getItem("jsg_bookings")||"[]");
  const idx=all.findIndex(b=>b.id===booking.id);
  if (idx>=0) all[idx]=booking; else all.push(booking);
  localStorage.setItem("jsg_bookings",JSON.stringify(all));

  // Also sync to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      // Flatten booking to a JSON-safe object for Supabase
      await SB.upsert("bookings", { id: booking.id, user_id: booking.userId, data: booking, created_at: booking.createdAt });
      console.log("✅ Booking synced to Supabase:", booking.id);
    } catch(e) {
      console.warn("Supabase sync failed (saved locally):", e.message);
    }
  }
}

async function loadBookingById(bookingId) {
  // Try localStorage first (fastest)
  const local = JSON.parse(localStorage.getItem("jsg_bookings")||"[]").find(b=>b.id===bookingId);
  if (local) return local;
  // Try Supabase
  if (isSupabaseConfigured()) {
    try {
      const row = await SB.getById("bookings", bookingId);
      if (row) {
        // data column is json type — already an object, no JSON.parse needed
        return typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      }
    } catch(e) { console.warn("Supabase loadBookingById failed:", e.message); }
  }
  return null;
}

async function updateBooking(booking) {
  await saveBooking(booking);
}


function getCancellationCharge(booking) {
  // Calculate charge based on how far the flight is
  const depDate = booking.flight?.depTime;
  const created = new Date(booking.createdAt);
  const now     = new Date();
  const hoursSinceBooking = (now - created) / (1000*60*60);

  // Simple rule based on hours since booking
  if (hoursSinceBooking < 24)  return { pct: 10, label: "Within 24h of booking — 10% charge" };
  if (hoursSinceBooking < 72)  return { pct: 25, label: "1–3 days after booking — 25% charge" };
  return                              { pct: 50, label: "More than 3 days — 50% charge" };
}

async function cancelBooking(bookingId) {
  const booking = _allBookings.find(b => b.id === bookingId);
  if (!booking) return;

  const charge  = getCancellationCharge(booking);
  const fee     = Math.round(booking.totalAmount * charge.pct / 100);
  const refund  = booking.totalAmount - fee;

  const confirmed = confirm(
    `Cancel booking ${bookingId}?\n\n` +
    `${charge.label}\n` +
    `Cancellation fee: ₹${fee.toLocaleString("en-IN")}\n` +
    `Refund amount:    ₹${refund.toLocaleString("en-IN")}\n\n` +
    `This cannot be undone.`
  );
  if (!confirmed) return;

  const now = new Date().toISOString();

  // Update in memory
  const idx = _allBookings.findIndex(b => b.id === bookingId);
  if (idx >= 0) {
    _allBookings[idx].status        = "Cancelled";
    _allBookings[idx].cancelledAt   = now;
    _allBookings[idx].cancellationFee = fee;
    _allBookings[idx].refundAmount  = refund;
  }

  // Update localStorage
  const all = JSON.parse(localStorage.getItem("jsg_bookings") || "[]");
  const li  = all.findIndex(b => b.id === bookingId);
  if (li >= 0) {
    all[li].status = "Cancelled"; all[li].cancelledAt = now;
    all[li].cancellationFee = fee; all[li].refundAmount = refund;
  }
  localStorage.setItem("jsg_bookings", JSON.stringify(all));

  // Sync cancellation to Supabase
  if (isSupabaseConfigured()) {
    const updated = _allBookings.find(b => b.id === bookingId);
    if (updated) SB.upsert("bookings", { id: bookingId, user_id: updated.userId, data: updated, created_at: updated.createdAt }).catch(()=>{});
  }

  showToast(`Booking cancelled. Refund of ₹${refund.toLocaleString("en-IN")} will be processed in 5–7 days.`, "success", 6000);
  renderBookings();
}

async function loadUserBookings() {
  const user = getLoggedInUser(); if (!user) return [];
  const uid   = user.uid || user.id || "guest";
  const email = user.email || "";

  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      const rows = await SB.select("bookings", { user_id: uid });
      const parsed = rows.map(r => typeof r.data === "string" ? JSON.parse(r.data) : r.data).filter(Boolean);
      if (parsed.length) {
        console.log("✅ Loaded", parsed.length, "bookings from Supabase");
        const all = JSON.parse(localStorage.getItem("jsg_bookings")||"[]");
        parsed.forEach(b => { const i=all.findIndex(x=>x.id===b.id); if(i>=0) all[i]=b; else all.push(b); });
        localStorage.setItem("jsg_bookings", JSON.stringify(all));
        return parsed;
      }
    } catch(e) { console.warn("Supabase load failed, using localStorage:", e.message); }
  }

  // Fallback: localStorage — also include split fare bookings where user is a co-passenger
  const all   = JSON.parse(localStorage.getItem("jsg_bookings")||"[]");
  const local = all.filter(b =>
    b.userId === uid ||
    (email && b.splitFare && b.passengers?.some(p => p.splitEmail === email || p.email === email))
  ).reverse();
  console.log("📦 Loaded", local.length, "bookings from localStorage");
  return local;
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
  // Clone chips to clear old listeners
  document.querySelectorAll(".filter-chip[data-status]").forEach(chip=>{
    const fresh = chip.cloneNode(true);
    chip.parentNode.replaceChild(fresh, chip);
  });
  document.querySelectorAll(".filter-chip[data-status]").forEach(chip=>{
    chip.addEventListener("click",()=>{
      document.querySelectorAll(".filter-chip[data-status]").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active"); _bookingFilter=chip.dataset.status; renderBookings();
    });
  });
}

function renderBookings() {
  const list = document.getElementById("bookings-list");
  if (!list) return;
  let bookings = _allBookings;
  if (_bookingFilter !== "all") bookings = bookings.filter(b => b.status === _bookingFilter);

  if (!bookings.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">✈</div>
      <h3>No bookings found</h3>
      <p>${_bookingFilter !== "all" ? "No bookings with this status." : "You haven\'t booked any flights yet."}</p>
      <a href="index.html" class="btn btn-primary" style="margin-top:1.25rem">Search Flights</a>
    </div>`;
    return;
  }

  const statusBadge = (b) => {
    if (b.status === "Cancelled")      return `<span class="badge badge-danger">❌ Cancelled</span>`;
    if (b.status === "Fully Paid")     return `<span class="badge badge-success">✅ Fully Paid</span>`;
    if (b.status === "Partially Paid") return `<span class="badge badge-warning">⏳ Partially Paid</span>`;
    if (b.status === "Pending")        return `<span class="badge badge-danger">🔴 Pending</span>`;
    return `<span class="badge badge-muted">${b.status}</span>`;
  };

  const infoRow = (label, value) => value ? `
    <div class="bk-info-row">
      <span class="bk-info-label">${label}</span>
      <span class="bk-info-value">${value}</span>
    </div>` : "";

  list.innerHTML = bookings.map(b => {
    const f = b.flight || {};
    const isCancelled = b.status === "Cancelled";

    // ── Flight details block ──────────────────────────────────
    const flightBlock = `
      <div class="bk-section">
        <div class="bk-section-title">✈ Outbound Flight</div>
        <div class="bk-flight-route">
          <div class="bk-time-block">
            <div class="bk-time">${f.depTime || "—"}</div>
            <div class="bk-city">${f.from || ""}</div>
          </div>
          <div class="bk-duration-block">
            <div class="bk-duration-line"></div>
            <div class="bk-duration-label">${f.duration || ""}</div>
          </div>
          <div class="bk-time-block" style="text-align:right">
            <div class="bk-time">${f.arrTime || "—"}</div>
            <div class="bk-city">${f.to || ""}</div>
          </div>
        </div>
        ${infoRow("Flight", `${f.airline || ""} ${f.flightNumber || ""}`)}
        ${infoRow("Date", b.travelDate || f.depDate || "")}
        ${infoRow("Class", f.travelClass || "")}
        ${infoRow("Aircraft", f.aircraft || "")}
        ${infoRow("Terminal", f.terminal || "")}
      </div>`;

    // ── Return flight block ────────────────────────────────────
    const rf = b.returnFlight || (b.isRoundTrip ? f.returnFlight : null);
    const returnBlock = rf ? `
      <div class="bk-section">
        <div class="bk-section-title">↩ Return Flight</div>
        <div class="bk-flight-route">
          <div class="bk-time-block">
            <div class="bk-time">${rf.depTime || "—"}</div>
            <div class="bk-city">${rf.from || f.to || ""}</div>
          </div>
          <div class="bk-duration-block">
            <div class="bk-duration-line"></div>
            <div class="bk-duration-label">${rf.duration || ""}</div>
          </div>
          <div class="bk-time-block" style="text-align:right">
            <div class="bk-time">${rf.arrTime || "—"}</div>
            <div class="bk-city">${rf.to || f.from || ""}</div>
          </div>
        </div>
        ${infoRow("Flight", `${rf.airline || ""} ${rf.flightNumber || ""}`)}
        ${infoRow("Class", rf.travelClass || f.travelClass || "")}
      </div>` : "";

    // ── Passenger rows ─────────────────────────────────────────
    const paxRows = b.passengers.map((p, idx) => {
      const paid    = p.paymentStatus === "Paid";
      const mealStr = p.meal && p.meal !== "No Meal" ? `🍽 ${p.meal}${p.mealPrice > 0 ? " (+₹" + p.mealPrice + ")" : " (Complimentary)"}` : "🚫 No Meal";
      const amtStr  = p.amountPaid ? formatPrice(p.amountPaid) : (b.splitFare ? formatPrice(b.perPaxAmount) : "");

      return `<div class="bk-pax-card">
        <div class="bk-pax-header">
          <div>
            <span class="bk-pax-num">${idx + 1}</span>
            <span class="bk-pax-name">${p.name || "Pending details"}</span>
            ${p.isPrimary ? `<span style="font-size:.7rem;color:var(--accent);margin-left:.4rem">(Primary)</span>` : ""}
          </div>
          ${b.splitFare
            ? (paid
                ? `<span class="badge badge-success">✅ Paid ${amtStr}</span>`
                : `<div style="display:flex;gap:.5rem;align-items:center">
                    <span class="badge badge-danger">💳 Pending</span>
                    <button class="btn btn-primary btn-sm"
                      onclick="resendPaymentLink('${b.id}','${p.payToken}','${p.name}','${p.splitEmail||p.email}',${b.perPaxAmount})">
                      Resend Link
                    </button>
                  </div>`)
            : `<span class="badge badge-success">✅ Paid</span>`}
        </div>
        ${p.name ? `<div class="bk-pax-details">
          ${p.age    ? `<span>🎂 Age ${p.age}</span>` : ""}
          ${p.gender ? `<span>👤 ${p.gender}</span>` : ""}
          ${p.phone  ? `<span>📞 ${p.phone}</span>` : ""}
          ${(p.email || p.splitEmail) ? `<span>✉ ${p.email || p.splitEmail}</span>` : ""}
          <span>${mealStr}</span>
        </div>` : `<div style="font-size:.8rem;color:var(--text-muted);padding:.4rem 0">Details will appear once passenger pays</div>`}
      </div>`;
    }).join("");

    // ── Fare breakdown ─────────────────────────────────────────
    const mealTotal  = (b.passengers || []).reduce((s, p) => s + (p.mealPrice || 0), 0);
    const fareBlock  = `
      <div class="bk-section">
        <div class="bk-section-title">💳 Fare Breakdown</div>
        ${infoRow("Base fare", formatPrice(b.totalAmount - Math.round(b.totalAmount * 0.18 / 1.18) - 200 - mealTotal))}
        ${mealTotal > 0 ? infoRow("Meals", `+${formatPrice(mealTotal)}`) : ""}
        ${infoRow("Taxes & fees", `+${formatPrice(Math.round(b.totalAmount * 0.18 / 1.18))}`)}
        ${infoRow("Convenience fee", "+₹200")}
        <div class="bk-info-row" style="border-top:1px solid var(--border);margin-top:.5rem;padding-top:.5rem">
          <span class="bk-info-label" style="font-weight:700">Total</span>
          <span class="bk-info-value" style="font-family:'Syne';font-weight:800;color:var(--accent)">${formatPrice(b.totalAmount)}</span>
        </div>
        ${b.splitFare ? `<div class="bk-info-row"><span class="bk-info-label">Per person</span><span class="bk-info-value">${formatPrice(b.perPaxAmount)}</span></div>` : ""}
      </div>`;

    // ── Cancellation info ──────────────────────────────────────
    const cancelInfo = isCancelled ? `
      <div style="padding:.75rem;background:rgba(239,68,68,.08);border-radius:8px;font-size:.83rem;color:#ef4444">
        ❌ Cancelled on ${b.cancelledAt ? new Date(b.cancelledAt).toLocaleDateString("en-IN") : "—"} &nbsp;·&nbsp;
        Fee: ₹${(b.cancellationFee||0).toLocaleString("en-IN")} &nbsp;·&nbsp;
        Refund: ₹${(b.refundAmount||0).toLocaleString("en-IN")}
      </div>` : "";

    const charge    = !isCancelled ? getCancellationCharge(b) : null;
    const cancelBtn = !isCancelled ? `
      <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
        <p style="font-size:.78rem;color:var(--text-muted);margin-bottom:.5rem">
          ⚠ Cancellation charge: ${charge.pct}% (${charge.label})
        </p>
        <button class="btn btn-danger w-full"
          onclick="event.stopPropagation();cancelBooking('${b.id}')">
          🚫 Cancel Booking
        </button>
      </div>` : "";

    return `<div class="booking-item ${isCancelled ? "booking-cancelled" : ""}" id="booking-${b.id}">
      <div class="booking-item-header" onclick="toggleBookingDetails('${b.id}')">
        <div>
          <div class="booking-id">#${b.id}</div>
          <div class="booking-route">
            <span>${f.from||""}</span>
            <span class="arrow">${b.isRoundTrip ? "⇌" : "✈"}</span>
            <span>${f.to||""}</span>
          </div>
          <div style="font-size:.82rem;color:var(--text-muted);margin-top:.2rem">
            ${f.airline||""} · ${f.flightNumber||""} · ${f.depTime||""}–${f.arrTime||""} · ${f.travelClass||""}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.4rem">
          ${statusBadge(b)}
          <span style="font-size:.78rem;color:var(--text-muted)">${b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN") : ""}</span>
          <span style="font-family:'Syne';font-weight:700;font-size:1.05rem;color:var(--accent)">${formatPrice(b.totalAmount)}</span>
        </div>
      </div>
      <div class="booking-item-body" id="details-${b.id}">
        ${flightBlock}
        ${returnBlock}
        <div class="bk-section">
          <div class="bk-section-title">👥 Passengers (${b.passengers.length})</div>
          <div class="bk-pax-list">${paxRows}</div>
        </div>
        ${fareBlock}
        ${cancelInfo}
        ${cancelBtn}
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
  const container = document.getElementById("splitpay-container");
  if (!container) return;

  const p         = new URLSearchParams(window.location.search);
  const bookingId = p.get("booking");
  const token     = p.get("token");

  if (!bookingId || !token) {
    container.innerHTML = `<div class="empty-state"><h3>Invalid Link</h3><p>This payment link is invalid or has expired.</p></div>`;
    return;
  }

  // ── Must be logged in ──────────────────────────────────────────
  const user = getLoggedInUser();
  if (!user) {
    // Store full URL in localStorage (survives mobile redirects better than sessionStorage)
    localStorage.setItem("jsg_splitpay_redirect", window.location.href);
    container.innerHTML = `
      <div class="empty-state" style="padding:3rem 1.5rem;text-align:center">
        <div style="font-size:3rem;margin-bottom:1rem">✈</div>
        <h3 style="margin-bottom:.5rem">Sign in to Pay</h3>
        <p style="color:var(--text-muted);margin-bottom:1.5rem">
          You need a JetSetGo account to complete your payment for booking <strong>#${bookingId}</strong>.
        </p>
        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
          <a href="login.html" class="btn btn-primary">Sign In</a>
          <a href="signup.html" class="btn btn-ghost">Create Account</a>
        </div>
        <p style="font-size:.8rem;color:var(--text-muted);margin-top:1rem">
          After signing in you'll be brought back here automatically.
        </p>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="loader-wrap"><div class="spinner"></div><p class="loader-text">Loading booking…</p></div>`;

  const booking = await loadBookingById(bookingId);
  if (!booking) {
    container.innerHTML = `<div class="empty-state"><h3>Booking Not Found</h3>
      <p>We couldn't find booking <strong>#${bookingId}</strong>. It may still be syncing — try again in a moment.</p>
      <a href="mybookings.html" class="btn btn-primary" style="margin-top:1rem">My Bookings</a></div>`;
    return;
  }

  const passenger = booking.passengers.find(p => p.payToken === token);
  if (!passenger) {
    container.innerHTML = `<div class="empty-state"><h3>Invalid Payment Link</h3><p>This link is not valid for this booking.</p></div>`;
    return;
  }

  if (passenger.paymentStatus === "Paid") {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem">
        <div style="font-size:3rem;margin-bottom:1rem">✅</div>
        <h3>Already Paid!</h3>
        <p>Your share for booking <strong>#${bookingId}</strong> is confirmed.</p>
        <a href="mybookings.html" class="btn btn-primary" style="margin-top:1.5rem">View My Bookings</a>
      </div>`;
    return;
  }

  _spState = { bookingId, token, generatedOtp: null, timerInterval: null, verifiedEmail: "", booking, passenger };

  // ── Get meal options for this flight ──────────────────────────
  const flight      = booking.flight;
  const airlineName = flight?.airline || "IndiGo";
  const travelClass = flight?.travelClass || "Economy";
  const mealsOk     = flight?.mealsAvailable !== false;
  const availMeals  = getMealsForFlight(airlineName, travelClass, mealsOk);
  const mealOptions = availMeals.map(m =>
    `<option value="${m.id}" data-price="${m.price}">${m.cat} — ${m.name}${m.price > 0 ? " (+₹" + m.price + ")" : m.price === 0 && m.id !== "MEAL-NONE" ? " (Complimentary)" : ""}</option>`
  ).join("");
  const basePax = booking.perPaxAmount;

  container.innerHTML = `
  <div class="split-link-card card">
    <div style="font-size:2.5rem;margin-bottom:.5rem">✈</div>
    <h2>Complete Your Payment</h2>
    <p>Hi <strong>${user.name || "Traveler"}</strong>! Fill in your details and pay your share.</p>

    <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:1rem;margin:1rem 0;text-align:left">
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.4rem;text-transform:uppercase;font-weight:600">Flight Details</div>
      <div><strong>${flight.from} → ${flight.to}</strong></div>
      <div style="font-size:.85rem;color:var(--text-muted)">${flight.airline} · ${flight.flightNumber} · ${flight.depTime}–${flight.arrTime} · ${flight.travelClass}</div>
    </div>

    <!-- Step 0: Passenger details + meal -->
    <div id="sp-step0" style="text-align:left">
      <h4 style="margin-bottom:1rem;font-size:.9rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted)">Your Details</h4>
      <div class="form-group">
        <label class="form-label">Full Name *</label>
        <input type="text" class="form-control" id="sp-name" placeholder="As on passport" value="${user.name || ""}" />
        <span class="form-error hidden" id="sp-name-err">⚠ Name required</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="form-group">
          <label class="form-label">Age *</label>
          <input type="number" class="form-control" id="sp-age" placeholder="28" min="1" max="120" />
          <span class="form-error hidden" id="sp-age-err">⚠ Valid age required</span>
        </div>
        <div class="form-group">
          <label class="form-label">Gender *</label>
          <select class="form-control" id="sp-gender">
            <option value="">Select</option>
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
          <span class="form-error hidden" id="sp-gender-err">⚠ Select gender</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Phone *</label>
        <input type="tel" class="form-control" id="sp-phone" placeholder="+91 9876543210" />
        <span class="form-error hidden" id="sp-phone-err">⚠ Valid phone required</span>
      </div>
      ${mealsOk ? `
      <div class="form-group">
        <label class="form-label">🍽 Meal Preference</label>
        <select class="form-control" id="sp-meal">${mealOptions}</select>
      </div>` : `<p style="font-size:.8rem;color:var(--text-muted);margin:.5rem 0">⚠ No meals on this flight</p>`}

      <div style="display:flex;justify-content:space-between;align-items:center;margin:1.25rem 0 .5rem;padding:1rem;background:var(--surface2);border-radius:var(--radius-sm)">
        <div>
          <div style="font-size:.78rem;color:var(--text-muted)">Base fare</div>
          <div style="font-family:'Syne';font-weight:700">${formatPrice(basePax)}</div>
        </div>
        <div id="sp-meal-cost-block" style="display:none">
          <div style="font-size:.78rem;color:var(--text-muted)">Meal add-on</div>
          <div style="font-family:'Syne';font-weight:700;color:var(--accent)" id="sp-meal-cost">+₹0</div>
        </div>
        <div>
          <div style="font-size:.78rem;color:var(--text-muted)">Total due</div>
          <div style="font-family:'Syne';font-size:1.4rem;font-weight:800;color:var(--accent)" id="sp-total-display">${formatPrice(basePax)}</div>
        </div>
      </div>
      <button class="btn btn-primary w-full" id="sp-details-next">Continue to Verify →</button>
    </div>

    <!-- Step 1: Email OTP -->
    <div id="sp-step1" class="hidden">
      <p style="font-size:.88rem;color:var(--text-muted);margin-bottom:1rem;text-align:center">
        We'll send a one-time password to verify your identity.
      </p>
      <div class="form-group" style="margin-bottom:1rem">
        <label class="form-label">Your Email Address</label>
        <input type="email" class="form-control" id="sp-email"
          placeholder="you@example.com" value="${user.email || passenger.splitEmail || ""}" />
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
        <div style="font-size:.85rem;color:var(--text-muted)">Total Amount Due</div>
        <div style="font-family:'Syne';font-size:2rem;font-weight:800;color:var(--accent)" id="sp-final-amount">${formatPrice(basePax)}</div>
      </div>
      <button class="btn btn-primary btn-lg w-full" id="sp-pay-btn">💳 Pay Now</button>
    </div>
  </div>`;

  // ── Meal price update ──────────────────────────────────────────
  let mealPrice = 0;
  document.getElementById("sp-meal")?.addEventListener("change", function() {
    const meal = availMeals.find(m => m.id === this.value);
    mealPrice  = meal?.price || 0;
    const total = basePax + mealPrice;
    document.getElementById("sp-total-display").textContent = formatPrice(total);
    document.getElementById("sp-final-amount") && (document.getElementById("sp-final-amount").textContent = formatPrice(total));
    const mealBlock = document.getElementById("sp-meal-cost-block");
    if (mealPrice > 0) {
      mealBlock.style.display = "";
      document.getElementById("sp-meal-cost").textContent = "+₹" + mealPrice;
    } else {
      mealBlock.style.display = "none";
    }
  });

  // ── Step 0 → 1: validate details ──────────────────────────────
  document.getElementById("sp-details-next")?.addEventListener("click", () => {
    const name   = document.getElementById("sp-name")?.value.trim();
    const age    = document.getElementById("sp-age")?.value;
    const gender = document.getElementById("sp-gender")?.value;
    const phone  = document.getElementById("sp-phone")?.value.trim();
    let valid = true;
    if (!name || name.length < 2)                    { showError("sp-name-err", true);   valid = false; } else showError("sp-name-err", false);
    if (!age || age < 1 || age > 120)                { showError("sp-age-err", true);    valid = false; } else showError("sp-age-err", false);
    if (!gender)                                     { showError("sp-gender-err", true); valid = false; } else showError("sp-gender-err", false);
    if (!phone || phone.replace(/\D/g,"").length < 7){ showError("sp-phone-err", true);  valid = false; } else showError("sp-phone-err", false);
    if (!valid) return;
    // Save details to state
    _spState.paxDetails = { name, age, gender, phone, meal: document.getElementById("sp-meal")?.value || "MEAL-NONE", mealPrice };
    document.getElementById("sp-step0").classList.add("hidden");
    document.getElementById("sp-step1").classList.remove("hidden");
  });

  // ── Step 1: send OTP ──────────────────────────────────────────
  document.getElementById("sp-send-btn")?.addEventListener("click", async () => {
    const email = document.getElementById("sp-email")?.value.trim();
    if (!email || !isValidEmail(email)) { showError("sp-email-err", true); return; }
    showError("sp-email-err", false);
    _spState.generatedOtp  = String(Math.floor(100000 + Math.random() * 900000));
    _spState.verifiedEmail = email;
    const btn = document.getElementById("sp-send-btn");
    btn.disabled = true; btn.textContent = "Sending…";
    await sendOtpEmail(email, _spState.paxDetails?.name || user.name || "Traveler", _spState.generatedOtp);
    btn.disabled = false; btn.innerHTML = "📧 Send OTP";
    document.getElementById("sp-step1").classList.add("hidden");
    document.getElementById("sp-step2").classList.remove("hidden");
    const s = document.getElementById("sp-sent-to");
    if (s) s.textContent = `OTP sent to ${email}`;
    setupOtpDigits("sp-otp-digit");
    startOtpTimer("sp-timer", _spState);
  });

  // ── Step 2: verify OTP ────────────────────────────────────────
  document.getElementById("sp-verify-btn")?.addEventListener("click", () => {
    const entered = getOtpValue("sp-otp-digit");
    if (entered.length < 6) { showError("sp-otp-err", true, "⚠ Enter all 6 digits."); return; }
    if (entered !== _spState.generatedOtp) { showError("sp-otp-err", true, "⚠ Incorrect OTP."); clearOtpDigits("sp-otp-digit"); return; }
    showError("sp-otp-err", false);
    clearInterval(_spState.timerInterval);
    const total = basePax + (_spState.paxDetails?.mealPrice || 0);
    const finalAmountEl = document.getElementById("sp-final-amount");
    if (finalAmountEl) finalAmountEl.textContent = formatPrice(total);
    document.getElementById("sp-step2").classList.add("hidden");
    document.getElementById("sp-step3").classList.remove("hidden");
    showToast("✅ OTP Verified!", "success");
  });

  document.getElementById("sp-resend-btn")?.addEventListener("click", async () => {
    _spState.generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    await sendOtpEmail(_spState.verifiedEmail, _spState.paxDetails?.name || user.name, _spState.generatedOtp);
    clearInterval(_spState.timerInterval);
    startOtpTimer("sp-timer", _spState);
    clearOtpDigits("sp-otp-digit");
    showError("sp-otp-err", false);
  });

  // ── Step 3: pay ───────────────────────────────────────────────
  document.getElementById("sp-pay-btn")?.addEventListener("click", async () => {
    const btn = document.getElementById("sp-pay-btn");
    btn.disabled = true; btn.textContent = "Processing…";
    await new Promise(r => setTimeout(r, 1800));

    const details   = _spState.paxDetails || {};
    const mealId    = details.meal || "MEAL-NONE";
    const mealData  = MEALS_DB.find(m => m.id === mealId);
    const totalPaid = basePax + (details.mealPrice || 0);

    const updated = { ..._spState.booking };
    updated.passengers = updated.passengers.map(p => {
      if (p.payToken !== token) return p;
      return {
        ...p,
        name:          details.name || p.name,
        age:           details.age  || p.age,
        gender:        details.gender || p.gender,
        phone:         details.phone || p.phone,
        meal:          mealData?.name || "No Meal",
        mealPrice:     details.mealPrice || 0,
        paymentStatus: "Paid",
        amountPaid:    totalPaid,
      };
    });
    const allPaid  = updated.passengers.every(p => p.paymentStatus === "Paid");
    const somePaid = updated.passengers.some(p => p.paymentStatus === "Paid");
    updated.status = allPaid ? "Fully Paid" : somePaid ? "Partially Paid" : "Pending";
    await updateBooking(updated);

    container.querySelector(".split-link-card").innerHTML = `
      <div style="text-align:center;padding:2rem">
        <div style="font-size:3rem;margin-bottom:1rem">✅</div>
        <h3>Payment Successful!</h3>
        <p>Your payment of <strong>${formatPrice(totalPaid)}</strong> for booking
           <strong>#${bookingId}</strong> is confirmed.</p>
        ${mealData && mealData.id !== "MEAL-NONE" ? `<p style="font-size:.85rem;color:var(--text-muted);margin-top:.5rem">Meal: ${mealData.name}</p>` : ""}
        <p style="margin-top:.75rem;color:var(--text-muted);font-size:.85rem">Have a great journey! ✈</p>
        <a href="mybookings.html" class="btn btn-primary" style="margin-top:1.5rem">View My Bookings</a>
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
  const raw  = window.location.pathname.split("/").pop() || "";
  const page = raw.replace(".html","") || "index";
  if(page==="index"||page===""||page==="/") initHomePage();
  if(page==="login")      initLoginPage();
  if(page==="signup")     initSignupPage();
  if(page==="flights")    initFlightsPage();
  if(page==="booking")    initBookingPage();
  if(page==="mybookings") initMyBookingsPage();
  if(page==="splitpay")   initSplitPayPage();
});
