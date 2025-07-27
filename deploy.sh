#!/bin/bash

# KrishiSarathi Deployment Script
echo "🌾 KrishiSarathi Backend Deployment"
echo "==================================="

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please login to Firebase:"
    firebase login
fi

echo "📋 Available deployment options:"
echo "1. Deploy Functions only"
echo "2. Deploy Hosting only"
echo "3. Deploy Everything"
echo "4. Deploy with Emulators"
echo "5. Build Functions only"

read -p "Select option (1-5): " option

case $option in
    1)
        echo "🚀 Deploying Functions..."
        cd functions
        npm run build
        cd ..
        firebase deploy --only functions
        ;;
    2)
        echo "🌐 Deploying Hosting..."
        npm run export
        firebase deploy --only hosting
        ;;
    3)
        echo "🚀 Deploying Everything..."
        cd functions
        npm run build
        cd ..
        npm run export
        firebase deploy
        ;;
    4)
        echo "🛠️ Starting Emulators..."
        firebase emulators:start
        ;;
    5)
        echo "🔨 Building Functions..."
        cd functions
        npm run build
        echo "✅ Functions built successfully!"
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo "✅ Deployment completed!"
