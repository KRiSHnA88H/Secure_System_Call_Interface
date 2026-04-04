#!/bin/bash

echo "🔐 SecureSysCall — Setup & Start"
echo "================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js $(node -v) found"

# Check MongoDB
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB not found locally. Make sure MONGODB_URI in backend/.env points to a running instance."
fi

# Setup backend
echo ""
echo "📦 Installing backend dependencies..."
cd backend
cp -n .env.example .env 2>/dev/null && echo "  ✅ Created .env from .env.example (edit it!)" || echo "  ✅ .env already exists"
npm install --silent
echo "✅ Backend ready"

# Setup frontend
echo ""
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install --silent
echo "✅ Frontend ready"

echo ""
echo "🚀 Starting servers..."
echo "   Backend  → http://localhost:5000"
echo "   Frontend → http://localhost:3000"
echo ""
echo "Open TWO terminals and run:"
echo "  Terminal 1: cd backend && npm run dev"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Or install 'concurrently' and use: npm run dev:all"
