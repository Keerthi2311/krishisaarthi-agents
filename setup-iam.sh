#!/bin/bash

# KrishiSarathi IAM Setup Script
echo "🔐 Setting up IAM permissions for KrishiSarathi"
echo "=============================================="

# Use full path to gcloud
GCLOUD_PATH="/Users/sudarsanan/Downloads/KrishiSarathi-Agents:Backend/n/google-cloud-sdk/bin/gcloud"

# Check if gcloud is accessible
if [ ! -f "$GCLOUD_PATH" ]; then
    echo "❌ gcloud CLI not found at $GCLOUD_PATH"
    exit 1
fi

# Set the project
echo "📋 Setting project to krishisaarathi"
$GCLOUD_PATH config set project krishisaarathi

# The correct IAM roles for KrishiSarathi Functions
echo "🚀 Adding IAM permissions..."

echo "1. Adding Text-to-Speech permissions..."
$GCLOUD_PATH projects add-iam-policy-binding krishisaarathi \
    --member="serviceAccount:krishisaarthi-functions@krishisaarathi.iam.gserviceaccount.com" \
    --role="roles/cloudtts.user"

echo "2. Adding Speech-to-Text permissions..."
$GCLOUD_PATH projects add-iam-policy-binding krishisaarathi \
    --member="serviceAccount:krishisaarthi-functions@krishisaarathi.iam.gserviceaccount.com" \
    --role="roles/speech.client"

echo "3. Adding Vertex AI permissions..."
$GCLOUD_PATH projects add-iam-policy-binding krishisaarathi \
    --member="serviceAccount:krishisaarthi-functions@krishisaarathi.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

echo "4. Adding Storage permissions..."
$GCLOUD_PATH projects add-iam-policy-binding krishisaarathi \
    --member="serviceAccount:krishisaarthi-functions@krishisaarathi.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

echo "5. Adding Firestore permissions..."
$GCLOUD_PATH projects add-iam-policy-binding krishisaarathi \
    --member="serviceAccount:krishisaarthi-functions@krishisaarathi.iam.gserviceaccount.com" \
    --role="roles/datastore.user"

echo "6. Adding Firebase Authentication permissions..."
$GCLOUD_PATH projects add-iam-policy-binding krishisaarathi \
    --member="serviceAccount:krishisaarthi-functions@krishisaarathi.iam.gserviceaccount.com" \
    --role="roles/firebase.admin"

echo "✅ IAM permissions setup completed!"
echo ""
echo "📝 Summary of roles added:"
echo "   - roles/cloudtts.user (Text-to-Speech)"
echo "   - roles/speech.client (Speech-to-Text)"
echo "   - roles/aiplatform.user (Vertex AI)"
echo "   - roles/storage.admin (Cloud Storage)"
echo "   - roles/datastore.user (Firestore)"
echo "   - roles/firebase.admin (Firebase Admin)"
echo ""
echo "🎯 Your service account is now ready for KrishiSarathi Functions!"
