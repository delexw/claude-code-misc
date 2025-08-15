#!/bin/bash

echo "Setting up Meta-Prompter..."

# Install dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps

# Build the project
echo "Building project..."
npm run build

echo "Copy eval-viewer.html"
cp eval-viewer.html dist/

echo ""
echo "Setup complete!"