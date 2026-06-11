# MyHoldings — Property Manager

A standalone Windows desktop app for Malaysian property investors to track rental income, expenses, tenants, and generate tax reports.

---

## Download & Run

1. Go to [**Releases**](https://github.com/ewong-max/property-manager/releases/latest)
2. Download `PropertyManager-v1.0-windows.zip`
3. Extract to any folder
4. Double-click **`PropertyManager.exe`**
5. The app opens in your browser automatically — default PIN is **`1234`**

> No installation required. Works offline. All data is stored locally.

---

## Features

### Dashboard
- Year-by-year income and expense overview across all properties
- Per-property net income cards with quick-access shortcuts to add income or expenses
- 6-year trend chart

### Properties & Companies
- Manage properties under multiple holding companies
- Track property type, title type, purchase price, assessment and quit rent
- Individual property detail pages with full financial history

### Tenancy Management
- Create and manage tenancies with rent amount and lease dates
- Record monthly rental income against each tenancy
- Track active, expired and terminated leases

### Expenses
- Log expenses by category (maintenance, insurance, assessment, quit rent, etc.)
- Attach invoice/receipt images
- AI-powered invoice analysis — auto-fills amount, date and description using Google Gemini

### Tax Reports
- **Rental Income Statement** — annual income and expense summary per property
- **Capital Allowance Schedule** — furniture and renovation claims (ITA 1967)
- **Tax Computation Summary** — net statutory income across all properties
- Export all reports to **PDF**
- Export to **Excel**

### Backup & Restore
- One-click backup to any folder (USB drive, network share, cloud sync)
- Restore from a previous backup ZIP

---

## Configuration

Edit **`config.env`** (next to the exe) with Notepad:

```
PIN=1234              # Login PIN — change this
PORT=3001             # Port the server listens on
GEMINI_API_KEY=       # Optional: Google Gemini API key for invoice analysis
```

Restart `PropertyManager.exe` after saving changes.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, Prisma ORM |
| Database | SQLite (local file) |
| Packaging | `@yao-pkg/pkg` — bundles into a single `.exe` |
| PDF | `@react-pdf/renderer` |
| Excel | ExcelJS |
| AI | Google Gemini API |

---

## Development Setup

```bash
# Clone the repo
git clone https://github.com/ewong-max/property-manager.git
cd property-manager

# Install dependencies
cd server && npm install
cd ../client && npm install

# Set up the database
cd ../server
npx prisma db push

# Start both servers (runs on localhost:5174)
cd ..
start-app.bat
```

### Build a new Windows executable

```powershell
.\build-package.ps1
```

Output goes to `release\PropertyManager\` — zip that folder to distribute.

---

## Data Location

When running the packaged exe, all data is stored **in the same folder as the exe**:

| File / Folder | Contents |
|---------------|----------|
| `data.db` | All property, tenant and financial records |
| `uploads\` | Uploaded invoice and receipt images |
| `config.env` | App settings |

Back these up regularly using the **Backup & Restore** page inside the app.
