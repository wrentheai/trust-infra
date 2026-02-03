#!/bin/bash

# Trust Infrastructure Setup Script
# Automated setup for development environment

set -e

echo "🚀 Trust Infrastructure Setup"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 20+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js version must be 20 or higher (found: $(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm -v)${NC}"

# Check Docker (optional)
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker $(docker -v | cut -d' ' -f3 | tr -d ',')${NC}"
    HAS_DOCKER=true
else
    echo -e "${YELLOW}⚠ Docker not found (optional)${NC}"
    HAS_DOCKER=false
fi

echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Setup environment
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env

    # Generate secure keys
    SERVICE_KEY=$(openssl rand -base64 32)
    DB_PASSWORD=$(openssl rand -base64 24 | tr -d '=/+')

    # Update .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/dev-service-key-change-in-production/$SERVICE_KEY/" .env
        sed -i '' "s/trust_dev_password/$DB_PASSWORD/" .env
    else
        sed -i "s/dev-service-key-change-in-production/$SERVICE_KEY/" .env
        sed -i "s/trust_dev_password/$DB_PASSWORD/" .env
    fi

    echo -e "${GREEN}✓ .env file created with secure keys${NC}"
else
    echo -e "${YELLOW}⚠ .env file already exists, skipping${NC}"
fi
echo ""

# Start database
if [ "$HAS_DOCKER" = true ]; then
    echo "🐳 Starting PostgreSQL with Docker..."
    docker-compose up -d postgres

    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5

    # Check if PostgreSQL is ready
    MAX_RETRIES=30
    RETRIES=0
    until docker-compose exec -T postgres pg_isready -U trust &> /dev/null || [ $RETRIES -eq $MAX_RETRIES ]; do
        echo "   Waiting for PostgreSQL... ($RETRIES/$MAX_RETRIES)"
        sleep 2
        RETRIES=$((RETRIES+1))
    done

    if [ $RETRIES -eq $MAX_RETRIES ]; then
        echo -e "${RED}❌ PostgreSQL failed to start${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
else
    echo -e "${YELLOW}⚠ Docker not available. Please start PostgreSQL manually:${NC}"
    echo ""
    echo "  createdb trust_infra"
    echo "  createuser trust"
    echo ""
    read -p "Press Enter when PostgreSQL is ready..."
fi
echo ""

# Build packages
echo "🔨 Building packages..."
npm run build
echo -e "${GREEN}✓ Packages built${NC}"
echo ""

# Run migrations
echo "🗄️  Running database migrations..."
npm run migrate
echo -e "${GREEN}✓ Database migrated${NC}"
echo ""

# Done!
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start the server:"
echo "     ${YELLOW}npm run dev:server${NC}"
echo ""
echo "  2. In another terminal, run the example:"
echo "     ${YELLOW}npx tsx examples/basic-usage.ts${NC}"
echo ""
echo "  3. Access the API:"
echo "     ${YELLOW}http://localhost:3000${NC}"
echo ""
echo "  4. View logs:"
echo "     ${YELLOW}docker-compose logs -f${NC}"
echo ""
echo "📚 Documentation:"
echo "   - Quick start: README.md"
echo "   - API docs: API.md"
echo "   - Setup guide: SETUP.md"
echo ""
echo "Happy building! 🚀"
