#!/bin/bash

# Watch Together - Installation Script
# This script installs all dependencies and sets up the project

set -e

echo "🎬 Watch Together - Installation"
echo "================================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js 20 or higher is required"
    echo "   Current version: $(node -v)"
    echo "   Please upgrade Node.js: https://nodejs.org/"
    exit 1
fi
echo "✓ Node.js version OK: $(node -v)"

# Check if .env exists
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and fill in your Discord credentials:"
    echo "   - DISCORD_APP_ID"
    echo "   - DISCORD_CLIENT_SECRET"
    echo "   - CLIENT_URL (HTTPS URL for your tunnel)"
    echo ""
    read -p "Press Enter after you've configured .env..."
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install
echo "✓ Dependencies installed"

# Create logs directory
mkdir -p logs
echo "✓ Created logs directory"

# Create data directory for SQLite
mkdir -p data
echo "✓ Created data directory"

echo ""
echo "================================="
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Configure your Discord Application (see README.md)"
echo "2. Set up a HTTPS tunnel for local development:"
echo "   cloudflared tunnel --url http://localhost:3000"
echo "3. Update CLIENT_URL in .env with your tunnel URL"
echo "4. Start the server: npm start"
echo ""
echo "Documentation:"
echo "  - README.md - Setup and usage guide"
echo "  - ARCHITECTURE.md - System design"
echo "  - RISKS.md - Known risks and mitigations"
echo ""
