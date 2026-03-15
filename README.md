# 👶 Pe Thúi Tracker

> *Lưu giữ hành trình khôn lớn* — A personal baby growth tracking application backed by Google Sheets.

**Live App:** [https://pethuitracker.vercel.app/](https://pethuitracker.vercel.app/)

---

## 📖 About

**Pe Thúi Tracker** is a mobile-friendly web application designed to help parents track and visualize their baby's growth journey — including weight, height, and other milestones over time. Each baby gets a unique code-based profile, and all data is stored securely in Google Sheets, making it simple to manage without a dedicated database.

## ✨ Features

- **Code-based Access** — Enter your baby's personal code to instantly access their profile. No login required.
- **Profile Creation** — Set up a new baby profile in seconds with name, birth date, and other details.
- **Growth Dashboard** — View comprehensive stats on weight, height, and other tracked metrics at a glance.
- **Growth Charts** — Beautiful, interactive charts to visualize progress over time using Recharts.
- **Add / Edit Records** — Log new health records and update or correct previous entries anytime.
- **Mobile-Optimized** — Designed for use on phones with smooth keyboard-aware scrolling.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **UI Library** | React 19 |
| **Styling** | Tailwind CSS v4 |
| **Charts** | [Recharts](https://recharts.org/) |
| **Backend / Database** | Google Sheets via [Google APIs](https://googleapis.dev/) |
| **Icons** | React Icons |
| **Deployment** | [Vercel](https://vercel.com/) |

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 18+
- A Google Cloud project with **Google Sheets API** enabled
- A Google Service Account with credentials

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/dangochinh/pethuitracker.git
   cd pethuitracker/pe-thui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file at the root of the `pe-thui` folder with the following variables:
   ```env
   GOOGLE_SHEET_ID=your_google_sheet_id
   GOOGLE_CLIENT_EMAIL=your_service_account_email
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
pe-thui/
├── app/
│   ├── [code]/         # Dynamic route: baby's dashboard page
│   ├── api/            # Next.js API routes (Google Sheets integration)
│   ├── components/     # UI components (Dashboard, Charts, Modals...)
│   ├── lib/            # Utility functions and Google API helpers
│   ├── globals.css     # Global styles
│   └── page.js         # Landing / login page
├── public/             # Static assets
├── scripts/            # Utility scripts
└── package.json
```

## 👤 Author

**Đặng Ngọc Chính**
- Portfolio: [dangochinh.github.io](https://dangochinh.github.io/)
- GitHub: [@dangochinh](https://github.com/dangochinh)
