# DedooExplorer

A modern, multi-coin blockchain explorer built with Node.js and Express. Features a beautiful dark theme with customizable branding for any cryptocurrency.

![Dashboard](https://raw.githubusercontent.com/dedooxyz/DedooExplorer/main/docs/screenshots/dashboard.png)

## Features

- 🌙 **Dark Theme** - Beautiful dark UI with customizable accent colors
- 🔧 **Multi-Coin Support** - Configure for any coin via `.env` file
- 📊 **Rich Analytics** - Transaction charts, network statistics
- 🔍 **Universal Search** - Search blocks, transactions, addresses
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- ⚡ **Fast** - Direct connection to electrs backend

## Requirements

### Backend - Electrs

DedooExplorer requires [dedoo-electrs-oldchain](https://github.com/dedooxyz/dedoo-electrs-oldchain) as the blockchain backend.

**Before running the explorer, you must:**

1. Clone and set up dedoo-electrs-oldchain for your blockchain
2. Ensure it's running and accessible (default: `http://127.0.0.1:50010`)
3. Configure the `ELECTRS_API` URL in your `.env` file

```bash
# Clone and setup electrs backend first
git clone https://github.com/dedooxyz/dedoo-electrs-oldchain.git
cd dedoo-electrs-oldchain
# Follow the setup instructions in that repository
```

### System Requirements

- Node.js 18+ 
- npm or yarn
- Running [dedoo-electrs-oldchain](https://github.com/dedooxyz/dedoo-electrs-oldchain) instance

## Installation

```bash
# Clone the repository
git clone https://github.com/dedooxyz/DedooExplorer.git
cd DedooExplorer

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit configuration for your coin
nano .env

# Start the explorer
npm start
```

## Configuration

Copy `.env.example` to `.env` and customize:

```bash
# Server
PORT=3001

# Electrs API (your dedoo-electrs-oldchain instance)
ELECTRS_API=http://127.0.0.1:50010

# Explorer Branding
EXPLORER_NAME=My Coin Explorer
COIN_NAME=MyCoin
COIN_TICKER=MYC
COIN_TAGLINE=The next generation cryptocurrency

# Logo (relative to /public or absolute URL)
LOGO_URL=/img/logo.png

# Social Links (leave empty to hide)
WEBSITE_URL=https://mycoin.com
GITHUB_URL=https://github.com/mycoin
TELEGRAM_URL=https://t.me/mycoin
TWITTER_URL=https://x.com/mycoin
DISCORD_URL=https://discord.gg/mycoin
```

## Project Structure

```
DedooExplorer/
├── server.js              # Express server & API routes
├── package.json           # Dependencies & metadata
├── .env                   # Configuration (create from .env.example)
├── .env.example           # Configuration template
├── public/
│   ├── css/
│   │   └── style.css      # Main stylesheet
│   ├── js/
│   │   └── app.js         # Frontend JavaScript
│   └── img/
│       └── logo.png       # Your coin logo
└── views/
    ├── partials/
    │   ├── header.ejs     # Navigation header
    │   └── footer.ejs     # Footer with links
    ├── index.ejs          # Dashboard
    ├── blocks.ejs         # Blocks list
    ├── block.ejs          # Block details
    ├── transactions.ejs   # Transactions list
    ├── transaction.ejs    # Transaction details
    ├── address.ejs        # Address details
    ├── statistics.ejs     # Statistics page
    └── error.ejs          # Error page
```

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Network stats, recent blocks, chart |
| Blocks | `/blocks` | Paginated block list |
| Block Detail | `/block/:hash` | Block info & transactions |
| Transactions | `/transactions` | Mempool + recent transactions |
| Transaction | `/tx/:txid` | Transaction inputs/outputs |
| Address | `/address/:addr` | Balance, UTXOs, history |
| Statistics | `/statistics` | Network analytics |
| Search | `/search?q=` | Universal search |

## API Proxy

The explorer proxies requests to electrs at `/api/*`:

```bash
# Examples
GET /api/blocks/tip/height
GET /api/block/:hash
GET /api/tx/:txid
GET /api/address/:address
```

## Customization

### Logo

Replace `public/img/logo.png` with your coin's logo (recommended: 200x200px PNG).

### Colors

Edit CSS variables in `public/css/style.css`:

```css
:root {
    --primary: #F5A623;        /* Main accent color */
    --primary-light: #FFD700;  /* Hover state */
    --primary-dark: #C88A1D;   /* Darker shade */
    --bg-dark: #0A0A0A;        /* Background */
    --bg-card: #111111;        /* Card background */
}
```

## Development

```bash
# Run with auto-reload (if nodemon installed)
npm run dev

# Or standard start
npm start
```

## Deployment

### PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name dedoo-explorer

# Auto-start on boot
pm2 startup
pm2 save
```

### Docker

```bash
# Clone repository
git clone https://github.com/dedooxyz/DedooExplorer.git
cd DedooExplorer

# Create your .env file
cp .env.example .env
nano .env

# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

The `.env` file and `logo.png` are mounted as volumes, so you can edit them without rebuilding:

```bash
# Edit configuration
nano .env

# Replace logo (PNG recommended)
cp /path/to/your/logo.png ./logo.png

# Restart to apply changes
docker-compose restart
```

#### Build manually

```bash
# Build image
docker build -t dedoo-explorer .

# Run container
docker run -d \
  --name dedoo-explorer \
  -p 3001:3001 \
  -v $(pwd)/.env:/app/.env:ro \
  dedoo-explorer
```

## Credits

- Built by [@senasgr](https://x.com/senasgr) at [Dedoo.xyz](https://dedoo.xyz)
- Backend: [dedoo-electrs-oldchain](https://github.com/dedooxyz/dedoo-electrs-oldchain)

## License

MIT License - see [LICENSE](LICENSE) file.

---

**DedooExplorer v2.0.0** - A [Dedoo.xyz](https://dedoo.xyz) Project
