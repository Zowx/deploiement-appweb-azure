#!/bin/bash
echo "Starting backend application..."
cd /home/site/wwwroot

echo "Installing dependencies..."
npm ci --only=production

echo "Generating Prisma client..."
npx prisma generate

echo "Starting Node.js server..."
node dist/index.js
