# 🚨 Sathi-SOS

**AI-assisted Accident Detection & Emergency Response System**

Sathi-SOS is a full-stack emergency response platform that automatically detects road accidents using on-device sensor fusion (G-force, sound, and speed analysis) and instantly dispatches the nearest hospital — cutting critical response time when it matters most.

🔗 **Live Dashboard:** [sathi-sos.vercel.app](https://sathi-sos.vercel.app)
📲 **Download Mobile App (Android):** [Download APK]([https://your-download-link-here.com/sathisos.apk](https://expo.dev/accounts/subhra07/projects/sathisos-mobile/builds/60bea918-0e19-4c6f-af16-ec73858c6078))

---

## 📱 How It Works

1. **Detection** — The mobile app continuously monitors accelerometer, microphone, and GPS speed data in the background.
2. **Confidence Scoring** — A weighted sensor-fusion algorithm cross-references G-force spikes, sudden loud sounds, and abrupt speed drops within a rolling time window to confirm a real accident (reducing false positives from phone drops or bumps).
3. **Countdown & Cancel** — On detection, a 10-second countdown lets the driver cancel if they're safe.
4. **Auto-Dispatch** — If not cancelled, an SOS is sent with GPS coordinates. The backend finds the nearest hospital using PostGIS geospatial queries and calculates real-time ETA.
5. **Live Dashboard** — Hospitals see incoming alerts instantly on a live map via SignalR (WebSockets), with driver info, location, and accident details.
6. **Manual SOS** — Drivers can also trigger an SOS manually at any time.

---

## 🏗️ Architecture

```
Sathi-SOS/
├── sathisos-mobile/       → React Native (Expo) driver app
├── sathisos-dashboard/    → React + Vite hospital dashboard
├── src/
│   ├── SathiSOS.API/            → ASP.NET Core Web API, Controllers, SignalR Hubs
│   ├── SathiSOS.Application/    → DTOs, service interfaces
│   ├── SathiSOS.Domain/         → Core entities (User, Hospital, Ambulance)
│   └── SathiSOS.Infrastructure/ → EF Core DbContext, repositories, migrations
└── Dockerfile
```

Built using **Clean Architecture** principles for separation of concerns and testability.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native, Expo, TypeScript |
| Sensors | `expo-sensors` (Accelerometer), `expo-location` (GPS), `expo-av` (Microphone) |
| Backend API | ASP.NET Core (.NET 10), C# |
| Real-time | SignalR (WebSockets) |
| Database | PostgreSQL + PostGIS (via Supabase) |
| ORM | Entity Framework Core (Npgsql) |
| Auth | JWT Bearer Authentication, BCrypt password hashing |
| Dashboard | React, Vite, Leaflet.js (maps) |
| Deployment | Docker, Vercel (dashboard), Render (API) |

---

## ✨ Key Features

- **Multi-sensor accident detection** with dynamic confidence scoring — adapts automatically based on which sensors are enabled
- **False-positive prevention** — filters out phone drops and low-speed bumps using combined G-force + speed heuristics
- **Real-time geospatial hospital matching** using PostGIS `ST_Distance` queries
- **Live SOS dashboard** for hospitals with map view, driver details, and accident metadata
- **Secure multi-user authentication** — JWT-based login/signup, hashed passwords, per-user driver identity (no more hardcoded test users)
- **Live location tracking** streamed via SignalR during an active SOS
- **Manual SOS override** for driver-initiated emergencies

---

## 🚀 Getting Started

### Backend
```bash
cd src/SathiSOS.API
dotnet restore
dotnet ef database update
dotnet run
```

### Mobile App
```bash
cd sathisos-mobile
npm install
npx expo start
```

### Dashboard
```bash
cd sathisos-dashboard
npm install
npm run dev
```

### Environment Setup
Create `appsettings.Development.json` in `SathiSOS.API` with your own database connection string and JWT secret:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require"
  },
  "Jwt": {
    "Key": "your-secret-key-min-32-chars",
    "Issuer": "SathiSOS",
    "Audience": "SathiSOS"
  }
}
```

---

## 📍 Roadmap

- [ ] Hospital-side authentication
- [ ] Push notifications for accepted dispatches
- [ ] Ambulance live tracking integration
- [ ] Production hosting migration (always-on backend)

---

## 👤 Author

**Subhra Pratim Mondal**
[LinkedIn](https://linkedin.com) · msubhra364@gmail.com
