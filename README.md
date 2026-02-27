# JetSetGo
Full stack , user-friendly web application to book flight tickets 

# ✈ JetSetGo — Premium Flight Booking Web Application

A fully functional, multi-page flight booking web application built with vanilla HTML, CSS, and JavaScript.
Features real authentication via Firebase, OTP verification via EmailJS, split fare payments, and a standalone passenger payment portal.

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Live Features

- User Authentication — Sign up, log in, log out via Firebase Auth
- Flight Search — Search flights by city, date, passengers, and class
- Flight Booking — Multi-step booking flow with passenger details
- Payment Flow — OTP-verified card payment simulation
- Split Fare — Split booking cost among passengers via email payment links
- Email OTP — Real OTP delivery via EmailJS
- Standalone Payment Page — Passengers pay their share from a unique link
- My Bookings — View all bookings with live payment status
- Dark / Light Mode — Persistent theme toggle
- Responsive Design — Works on mobile, tablet, and desktop

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

📁 Project Structure
JetSetGo/
├── index.html          # Home page with flight search
├── login.html          # Login page
├── signup.html         # Sign up page
├── flights.html        # Flight results page
├── booking.html        # Passenger details + payment flow
├── mybookings.html     # User's booking dashboard
├── splitpay.html       # Standalone split fare payment page
├── style.css           # Complete design system
├── script.js           # All application logic
└── README.md

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 🛠 Tech Stack

| Technology | Usage |
|---|---|
| HTML5 / CSS3 | Structure and styling |
| Vanilla JavaScript (ES6+) | All application logic |
| Firebase Auth | User authentication |
| Firebase Firestore | Real-time database for bookings |
| EmailJS | OTP and payment link emails |
| Google Fonts | Syne + DM Sans typography |


----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Setup & Configuration

1. Clone the repository

```bash
git clone https://github.com/yourusername/jetsetgo.git
cd jetsetgo
```

2. Set up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project → Register a Web App
3. Enable **Authentication** → Sign-in method → **Email/Password**
4. Create **Firestore Database** → Start in test mode
5. Copy your config and paste it into `script.js`:

```js
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
```

3. Set up EmailJS

1. Go to [emailjs.com](https://emailjs.com) → Sign up free
2. Add a **Gmail service** → connect your Gmail account → copy the **Service ID**
3. Create an **Email Template** with these fields:
   - **To Email:** `{{to_email}}`
   - **Subject:** `Your JetSetGo OTP: {{otp_code}}`
   - **Body:**
     ```
     Hi {{to_name}},
     
     {{otp_code}}
     
     — JetSetGo Team
     ```
4. Copy your **Public Key** from Account settings
5. Paste all three into `script.js`:

```js
const EMAILJS_PUBLIC_KEY   = "YOUR_PUBLIC_KEY";
const EMAILJS_SERVICE_ID   = "YOUR_SERVICE_ID";
const EMAILJS_OTP_TEMPLATE = "YOUR_TEMPLATE_ID";
```

4. Run the project

No server needed — just open `index.html` in your browser:

```bash
# Option 1: Double-click index.html
# Option 2: Use VS Code Live Server extension
# Option 3: Python simple server
python -m http.server 8000
# Then open http://localhost:8000
```

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

 User Flow

Normal Booking
```
Search Flights → Select Flight → Fill Passenger Details
→ OTP Verification (email) → Payment → Booking Confirmed
```

Split Fare Booking
```
Search Flights → Select Flight → Fill Passenger Details
→ Enable Split Fare → Enter each passenger's email
→ OTP Verification → Payment links emailed to all passengers
→ Each passenger opens their link → OTP → Pay their share
→ Booking status updates: Pending → Partially Paid → Fully Paid
```

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Key Implementation Details

Flight Data Generation
Flights are dynamically generated on each search using randomized data:
- 8 airlines: IndiGo, Air India, SpiceJet, Vistara, Emirates, Singapore Airlines, GoFirst, AirAsia India
- Price ranges: Economy (₹2,500–₹18,000), Business (₹12,000–₹60,000), First Class (₹30,000–₹1,20,000)
- 14 cities: Chennai, Bengaluru, Mumbai, Delhi, Hyderabad, Kolkata, Ahmedabad, Kochi, Pune, Goa, Dubai, London, New York, Singapore

OTP Flow
- 6-digit OTP generated client-side
- Sent to user's email via EmailJS
- 5-minute countdown timer
- Auto-advances between digit inputs
- Falls back to toast notification in demo mode (no EmailJS keys)

Split Fare Payment Links
- Each passenger gets a unique token (`payToken`) stored in Firestore
- Payment link format: `splitpay.html?booking=JSG12345&token=ABC123&name=Raj`
- Link works on any browser, any device — data loaded from Firestore
- Payment status synced in real time across all devices

Data Storage
- Firebase Firestore** — bookings, user profiles (when configured)
- localStorage — session cache, theme preference, fallback when Firebase not configured
- sessionStorage — flight search results, selected flight (temporary)

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Design System

| Token | Value |
|---|---|
| Primary Font | Syne 800 (headings, prices) |
| Body Font | DM Sans 400/600 |
| Accent Color | `#3d5bff` (light) / `#6379ff` (dark) |
| Border Radius | 20px (cards), 12px (inputs) |
| Dark Background | `#080e22` |
| Light Background | `#f0f4ff` |

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Free Tier Limits

| Service | Free Limit | Typical Usage |
|---|---|---|
| Firebase Auth | 10,000 logins/month | Way more than enough |
| Firestore reads | 50,000/day | ~5 reads per booking view |
| Firestore writes | 20,000/day | ~1 write per booking |
| EmailJS | 200 emails/month | ~2 emails per booking |

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Future Improvements

- [ ] Real flight data via Amadeus or Skyscanner API
- [ ] Real payment gateway (Razorpay / Stripe)
- [ ] Booking cancellation and refunds
- [ ] Email booking confirmation with PDF ticket
- [ ] Admin dashboard for managing flights
- [ ] Push notifications for flight status
- [ ] Multi-language support

