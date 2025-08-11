#!/bin/bash

echo "Setting up Meta-Prompter..."

# Install dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps

# Build the project
echo "Building project..."
npm run build

echo ""
echo "Setup complete!"