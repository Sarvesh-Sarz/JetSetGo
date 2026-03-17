
   ```
         ██╗███████╗████████╗███████╗███████╗████████╗ ██████╗  ██████╗ 
         ██║██╔════╝╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝██╔════╝ ██╔═══██╗
         ██║█████╗     ██║   ███████╗█████╗     ██║   ██║  ███╗██║   ██║
██    ██║██╔══╝     ██║   ╚════██║██╔══╝     ██║   ██║   ██║██║   ██║
    ╚█████╔╝███████╗   ██║   ███████║███████╗   ██║   ╚██████╔╝╚██████╔╝
     ╚════╝ ╚══════╝   ╚═╝   ╚══════╝╚══════╝   ╚═╝    ╚═════╝  ╚═════╝ 
```



###  &nbsp; *Book smarter. Fly together. Split the fare.*  &nbsp; 



#  JetSetGo — Flight Booking Web App

A fully functional, full-stack, user-friendly multi-page flight booking web application built with vanilla HTML, CSS, and JavaScript. Features real authentication via Supabase, OTP verification via EmailJS, split fare payments, and a standalone passenger payment portal.


---

## Features

- **User Authentication** — Sign up, log in, log out via Supabase Auth
- **Flight Search** — Search by city, date, passengers, and class
- **Real Flight Data** — 140+ real domestic flights across 36 Indian cities with actual airline schedules
- **Flight Booking** — Multi-step booking flow with passenger details and meal selection
- **Payment Flow** — OTP-verified card payment simulation
- **Split Fare** — Book for a group, each passenger pays their own share via a unique email link
- **Email OTP** — Real OTP delivery via EmailJS
- **Standalone Payment Page** — Co-passengers pay their share after signing in
- **My Bookings** — View all bookings with live payment status
- **Dark / Light Mode** — Persistent theme toggle
- **Responsive Design** — Works on mobile, tablet, and desktop

---

## Project Structure

```
JetSetGo/
├── index.html          # Home page with flight search
├── login.html          # Login page
├── signup.html         # Sign up page
├── flights.html        # Flight results page
├── booking.html        # Passenger details + payment flow
├── mybookings.html     # User booking dashboard
├── splitpay.html       # Standalone split fare payment page
├── style.css           # Complete design system
├── script.js           # All application logic
├── netlify.toml        # Netlify routing config
└── README.md
```

---

## Tech Stack

| Technology | Usage |
|---|---|
| HTML5 / CSS3 | Structure and styling |
| Vanilla JavaScript (ES6+) | All application logic |
| Supabase Auth | User authentication |
| Supabase Database | Bookings and user profiles |
| EmailJS | OTP and payment link emails |
| Netlify | Hosting and deployment |
| Google Fonts | Syne + DM Sans typography |

---

## Setup & Configuration

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/jetsetgo.git
cd jetsetgo
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → Create a new project
2. Go to **Settings → API Keys → Legacy anon, service_role API keys**
3. Copy your **Project URL** and **anon** key
4. Go to **Table Editor** and create two tables:

**`users` table:**
| Column | Type |
|---|---|
| `id` | text (primary key) |
| `name` | text |
| `email` | text |
| `phone` | text |

**`bookings` table:**
| Column | Type |
|---|---|
| `id` | text (primary key) |
| `user_id` | text |
| `data` | json |
| `created_at` | text |

> Disable Row Level Security (RLS) on both tables.

5. Paste your keys into `script.js`:

```js
const SUPABASE_URL  = "https://xxxx.supabase.co";
const SUPABASE_ANON = "eyJ...your anon key...";
```

### 3. Set up EmailJS

1. Go to [emailjs.com](https://emailjs.com) → Sign up free
2. Add a **Gmail service** → connect your Gmail → copy the **Service ID**
3. Create an **OTP template** with these variables:
   - **To Email:** `{{to_email}}`
   - **Subject:** `Your JetSetGo OTP: {{otp_code}}`
   - **Body:**
     ```
     Hi {{to_name}},
     Your OTP is: {{otp_code}}
     This code expires in 5 minutes.
     — JetSetGo Team
     ```
4. Create a **payment link template**:
   - **Subject:** `Complete your JetSetGo payment — #{{booking_id}}`
   - **Body:**
     ```
     Hi {{to_name}},
     You've been added to a group flight booking (#{{booking_id}}).
     Your share: {{amount}}
     Click here to pay: {{payment_link}}
     — JetSetGo Team
     ```
5. Paste all keys into `script.js`:

```js
const EMAILJS_PUBLIC_KEY       = "YOUR_PUBLIC_KEY";
const EMAILJS_SERVICE_ID       = "YOUR_SERVICE_ID";
const EMAILJS_OTP_TEMPLATE     = "YOUR_OTP_TEMPLATE_ID";
const EMAILJS_PAYMENT_TEMPLATE = "YOUR_PAYMENT_TEMPLATE_ID";
```

### 4. Deploy to Netlify

1. Go to [netlify.com](https://netlify.com) → Add new site → Deploy manually
2. Drag your entire project folder onto the deploy area
3. Your site goes live instantly at a `*.netlify.app` URL

> The `netlify.toml` handles URL routing so both `/login` and `/login.html` work.

### 5. Run locally

```bash
# Option 1: Double-click index.html
# Option 2: VS Code Live Server extension
# Option 3: Python
python -m http.server 8000
```

---

## User Flows

### Normal Booking
```
Search → Select Flight → Fill Passenger Details
→ Email OTP → Pay → Booking Confirmed
```

### Split Fare Booking
```
Search → Select Flight → Enable Split Fare
→ Fill your details → Enter co-passenger emails
→ Email OTP → Pay your share immediately
→ Co-passengers get email links → Sign in → OTP → Pay
→ Status: Pending → Partially Paid → Fully Paid
```

---

## Key Details

### Flight Data
- 140+ real domestic flights, 36 Indian cities
- Airlines: IndiGo, Air India, Vistara, SpiceJet, Akasa Air, Alliance Air
- Real flight numbers, timings, and fare tiers
- Filter by class, sort by price / duration / departure

### Meal Selection
- 30 meal options: Vegetarian, Non-Veg, Vegan, Snack, Beverage, Business
- Airline-specific menus per flight
- Complimentary meals for Business class on eligible airlines

### Split Fare
- Primary booker fills their own details only
- Pays their share immediately after OTP (no second verification)
- Co-passengers must sign in before paying
- Payment status synced via Supabase

---

## Free Tier Limits

| Service | Free Limit |
|---|---|
| Supabase Auth | 50,000 MAU |
| Supabase Storage | 500MB |
| EmailJS | 200 emails/month |
| Netlify | 100GB bandwidth/month |

---

## Future Improvements

- [ ] Real payment gateway (Razorpay / Stripe)
- [ ] PDF booking confirmation email
- [ ] Seat selection map
- [ ] Real flight data via Amadeus API
- [ ] Admin dashboard
- [ ] International flights
- [ ] Multi-language support (Hindi, Tamil, Telugu)
