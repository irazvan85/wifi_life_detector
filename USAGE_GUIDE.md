# VitalScan — WiFi Life Detector Usage Guide

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
- [Installing on Your Phone](#installing-on-your-phone)
  - [Android (Chrome)](#android-chrome)
  - [iOS (Safari)](#ios-safari)
- [Using the App](#using-the-app)
  - [Starting Monitoring](#starting-monitoring)
  - [Dashboard Overview](#dashboard-overview)
  - [Radar Display](#radar-display)
  - [Vital Signs Cards](#vital-signs-cards)
  - [Waveform Charts](#waveform-charts)
  - [Detected Subjects](#detected-subjects)
  - [Stopping Monitoring](#stopping-monitoring)
- [Understanding the Data](#understanding-the-data)
  - [Heart Rate](#heart-rate)
  - [Respiratory Rate](#respiratory-rate)
  - [Movement Index](#movement-index)
  - [Confidence Score](#confidence-score)
- [Deploying for Production](#deploying-for-production)
- [Troubleshooting](#troubleshooting)

---

## Overview

VitalScan is a WiFi CSI (Channel State Information) based vital signs monitoring application. It uses WiFi signal variations reflected off the human body to detect presence and extract vital signs — heart rate, respiratory rate, and body movement — without any wearable sensors.

The app is a Progressive Web App (PWA) that can be installed directly on your phone's home screen and used like a native application.

> **Note:** The current version uses simulated CSI data for demonstration purposes. In a production deployment, the simulation engine would be replaced with a real WiFi CSI data source.

---

## Getting Started

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- A modern web browser (Chrome, Safari, Firefox, Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/irazvan85/wifi_life_detector.git
cd wifi_life_detector

# Install dependencies
npm install

# (Optional) Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY if using AI features
```

### Running the App

```bash
# Start the development server (accessible on your local network)
npm run dev
```

The app starts at `http://localhost:3000` and is accessible from any device on the same network via your computer's IP address (e.g., `http://192.168.1.100:3000`).

To find your local IP address:
- **macOS/Linux:** `ifconfig | grep "inet "`
- **Windows:** `ipconfig`

---

## Installing on Your Phone

VitalScan is a Progressive Web App (PWA) — you can install it on your phone's home screen for a native app-like experience with offline support.

### Android (Chrome)

1. Open Chrome on your Android device
2. Navigate to the app URL (e.g., `http://192.168.1.100:3000`)
3. Tap the **three-dot menu** (⋮) in the top-right corner
4. Tap **"Add to Home screen"** or **"Install app"**
5. Confirm the installation
6. The app icon will appear on your home screen

### iOS (Safari)

1. Open Safari on your iPhone/iPad
2. Navigate to the app URL (e.g., `http://192.168.1.100:3000`)
3. Tap the **Share button** (□↑) at the bottom of the screen
4. Scroll down and tap **"Add to Home Screen"**
5. Tap **"Add"** in the top-right corner
6. The app icon will appear on your home screen

Once installed, the app opens in fullscreen mode without browser UI and supports offline caching of static assets.

---

## Using the App

### Starting Monitoring

1. Open the app on your phone
2. You will see the idle dashboard with all sections in standby mode
3. Tap the green **"Start Monitor"** button in the header
4. The status will briefly show **"Calibrating..."** while the system initializes (~1.5 seconds)
5. Once ready, the status changes to show the number of detected subjects (e.g., "2 Subjects")

### Dashboard Overview

The dashboard is organized in a single-column scrollable layout on phones:

| Section | Description |
|---------|-------------|
| **Header** | App title, WiFi status indicator, and Start/Stop button |
| **Radar Display** | Spatial map showing sensor and detected subjects |
| **Detected Subjects** | List of subjects with individual vital readings |
| **Vital Signs Cards** | Heart Rate, Respiratory Rate, Movement, and Confidence |
| **Life Presence Indicator** | Confidence bar for presence detection |
| **Waveform Charts** | Real-time signal visualizations (CSI, Breathing, Heartbeat) |
| **Technical Info** | Sample rate, subcarriers, buffer size, detection range |

### Radar Display

The circular radar shows:
- **Green center dot** — WiFi sensor position
- **Cyan blips** — Detected human subjects with pulsing animation
- **Concentric rings** — Distance markers (2m, 4m, 6m)
- **Sweep animation** — Rotating radar sweep when actively monitoring

Subjects are plotted based on their estimated distance and angle from the sensor.

### Vital Signs Cards

Four cards display real-time metrics for the primary detected subject:

| Card | Normal Range | Warning Threshold |
|------|-------------|-------------------|
| **Heart Rate** | 50–110 bpm | < 50 or > 110 bpm (amber) |
| **Resp. Rate** | 10–24 br/min | < 10 or > 24 br/min (amber) |
| **Movement** | 0–50 idx | > 50 idx (amber) |
| **Confidence** | 0–100% | Always green when active |

- **Green glow** = normal readings
- **Amber glow** = warning (values outside normal range)
- **Gray** = inactive (monitoring not started)

### Waveform Charts

Three real-time charts show the signal processing pipeline:

1. **CSI Amplitude (Raw)** — Raw WiFi channel state information signal (green)
2. **Breathing (0.1–0.5 Hz)** — Bandpass-filtered breathing component (blue)
3. **Heartbeat (0.8–2.0 Hz)** — Bandpass-filtered heartbeat component (red)

Each chart displays the current value in the top-right corner. The waveforms scroll in real-time at 20 Hz sample rate with UI updates at 4 Hz.

### Detected Subjects

The subjects list shows each detected person with:
- **Label** (e.g., "Subject A")
- **Distance** from sensor (in meters)
- **Individual vitals** — HR, RR, and Confidence per subject

### Stopping Monitoring

Tap the red **"Stop"** button in the header to end monitoring. All readings reset to standby values.

---

## Understanding the Data

### Heart Rate

- **Source:** Extracted from CSI signal variations in the 0.8–2.0 Hz frequency band
- **Unit:** Beats per minute (bpm)
- **Normal range:** 60–100 bpm at rest
- **Display:** Updates every 250ms

### Respiratory Rate

- **Source:** Extracted from CSI signal variations in the 0.1–0.5 Hz frequency band
- **Unit:** Breaths per minute (br/min)
- **Normal range:** 12–20 br/min at rest
- **Display:** Updates every 250ms

### Movement Index

- **Source:** Derived from large-amplitude CSI signal changes
- **Scale:** 0–100 (0 = still, 100 = significant movement)
- **Use:** Indicates body movement activity level

### Confidence Score

- **Source:** Based on signal quality and subject distance
- **Scale:** 0–100%
- **Factors:** Decreases with distance from sensor, affected by signal noise

---

## Deploying for Production

### Build the App

```bash
# Create an optimized production build
npm run build

# Preview the production build locally
npm run preview
```

The `dist/` folder contains the complete deployable app with:
- Minified HTML, CSS, and JavaScript
- PWA manifest and service worker
- App icons

### Deploy to a Static Host

The built app can be deployed to any static hosting service:

- **Netlify:** Drag and drop the `dist/` folder
- **Vercel:** Connect the repository and set build command to `npm run build`
- **GitHub Pages:** Push the `dist/` folder contents to a `gh-pages` branch
- **Firebase Hosting:** Use `firebase deploy` with the `dist/` directory
- **Any web server:** Serve the `dist/` folder as static files

### HTTPS Requirement

For the PWA service worker and "Add to Home Screen" to work on phones, the app must be served over **HTTPS** in production. Most hosting platforms provide this automatically. During local development, HTTP is sufficient.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **App won't install on phone** | Ensure you're using HTTPS in production, or access via local network IP during development |
| **"Add to Home Screen" not showing** | On iOS, use Safari (not Chrome). On Android, use Chrome. The option may appear after visiting the site a few times |
| **Blank screen on phone** | Clear browser cache and reload. Ensure JavaScript is enabled |
| **Waveforms not updating** | Check that monitoring is started (green "Start Monitor" button). The waveform buffer takes a few seconds to fill |
| **Small text on phone** | The app is optimized for phones with 360px+ width. On very small screens, use landscape orientation |
| **Service worker not registering** | Service workers require HTTPS in production. During development on localhost, they work over HTTP |
| **Battery drain concerns** | The app samples at 20 Hz and updates UI at 4 Hz. For extended use, keep the phone plugged in |
