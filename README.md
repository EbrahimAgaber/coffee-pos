<div align="center">

# ☕ Smart Barista POS | البارستا الذكي
### High-Velocity Mobile-First POS & Kitchen Display System (KDS)

**Part of the Smart Suite Family:**  
`Smart Touch POS` • `Smart Tailor POS` • `Smart Daftar` • **`Smart Barista POS`**

![Smart Barista Icon](./public/app-icon.jpg)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![ZATCA](https://img.shields.io/badge/ZATCA-Phase%201%20%26%202%20Compliant-emerald.svg)](https://zatca.gov.sa/)
[![Verification](https://img.shields.io/badge/Tests-78%2F78%20Passed-brightgreen.svg)](#testing--verification)

</div>

---

## 🌟 Overview | نظرة عامة

**Smart Barista POS (البارستا الذكي)** is a standalone, mobile-first Point-of-Sale and Kitchen Display System designed specifically for specialty coffee shops, drive-thrus, and roasteries. It operates 100% on smartphones and tablets (zero desktop hardware required) with sub-second real-time sync across Drive-Thru Attendants, Kitchen Baristas, Cashiers, and Owners.

---

## 🚀 Core Stations | محطات التشغيل الأربعة

| Station | Role | Key Capabilities |
|---|---|---|
| 🚗 **Drive-Thru Ordering** | Attendant | Sub-5 tap ordering, Saudi vehicle plate / token tagger, full coffee customizer (sizes, milks, sweetness, extra shots, barista notes). |
| 👨‍🍳 **Kitchen Display (KDS)** | Barista | Dark-mode Kanban cards, live MM:SS ticking stopwatches, 3-tier color urgency (Green < 3m, Yellow 3-5m, Red > 5m), Web Audio chime ding, 1-tap bump, 60s undo drawer. |
| 💳 **Cashier & Dispatch** | Cashier | Ready-for-pickup queue, 1-tap Mada checkout, Quick-Cash change calculator, regional customer debt (آجل) enforcement, split payment (Cash + Mada), thermal & WhatsApp receipt generation. |
| 📊 **Owner Back-Office** | Manager | Real-time sales velocity, average prep time KPIs, Mid-shift X-Report, End-of-day Z-Report with cash variance reconciliation, recipe-based raw ingredient depletion (BOM), regional credit customer ledger & settlements. |

---

## 🧾 Saudi ZATCA & ESC/POS Thermal Printing

- **Dual Thermal Formats**: 58mm (32 chars) and 80mm (48 chars) pure ESC/POS binary command generator.
- **Arabic Typography**: Pure TypeScript Arabic RTL glyph shaping with Unicode Presentation Forms-B mapping (`arabicShaper.ts`).
- **ZATCA TLV QR**: Instant Phase 1 & 2 Base64 TLV QR generation compliant with ZATCA regulations.
- **WhatsApp Direct Receipts**: 1-click sharing to customer WhatsApp (`wa.me/<phone>?text=...`) and downloadable PDF receipts with lazy-loaded Amiri Arabic fonts.

---

## 🧪 Testing & Verification

Comprehensive 4-tier test suite covering 15 test suites and 78 automated test cases:

```bash
# Run all 78 automated tests
npm run test

# Run TypeScript strict type check
npm run check

# Compile production bundle
npm run build
```

---

## 💻 Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4, Lucide React
- **Sync**: Supabase Realtime + BroadcastChannel local fallback
- **Printing**: Native ESC/POS generator, jsPDF, QRCode
- **Architecture**: Deterministic 4-stage order state machine (`NEW_ORDER` ⟶ `IN_PREPARATION` ⟶ `READY_FOR_PICKUP` ⟶ `COMPLETED` / `VOIDED`)

---

## 📄 License

Proprietary © 2026 Ebrahim Agaber. All rights reserved.
Part of the Smart Suite product line.
