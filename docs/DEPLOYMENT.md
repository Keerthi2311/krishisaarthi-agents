# 🚀 Deployment Guide

## 📋 Prerequisites

### Required Tools
- **Node.js 18+** - Runtime environment
- **Firebase CLI** - `npm install -g firebase-tools`
- **Google Cloud CLI** - [Installation Guide](https://cloud.google.com/sdk/docs/install)
- **Git** - Version control

### Google Cloud Setup
1. **Create Google Cloud Project**
2. **Enable Required APIs**
3. **Set up Service Account**
4. **Configure IAM Permissions**

## 🔧 Environment Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd KrishiSarathi-Backend
```

### 2. Install Dependencies
```bash
cd functions
npm install
```

### 3. Configure Environment Variables

Create `functions/.env`:
```bash
# Cloud Functions Environment
VERTEX_AI_LOCATION=us-central1
SPEECH_API_KEY=your-speech-api-key
TTS_API_KEY=your-tts-api-key
```

Create `.env.local` (for frontend):
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Cloud Functions URL
NEXT_PUBLIC_FUNCTIONS_URL=https://us-central1-your-project.cloudfunctions.net/api

# Google Cloud APIs
SPEECH_TO_TEXT_API_KEY=your-speech-api-key
TEXT_TO_SPEECH_API_KEY=your-tts-api-key
```

## ☁️ Google Cloud Configuration

### Enable Required APIs
```bash
# Enable all required APIs
gcloud services enable aiplatform.googleapis.com
gcloud services enable speech.googleapis.com
gcloud services enable texttospeech.googleapis.com
gcloud services enable storage-component.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable firebase.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### Set up IAM Permissions
Run the included setup script:
```bash
chmod +x setup-iam.sh
./setup-iam.sh
```

Or manually configure:
```bash
# Create service account (if not exists)
gcloud iam service-accounts create krishisaarthi-functions \
  --display-name="KrishiSaarathi Functions"

# Grant required roles
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:krishisaarthi-functions@your-project-id.iam.gserviceaccount.com" \
  --role="roles/speech.client"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:krishisaarthi-functions@your-project-id.iam.gserviceaccount.com" \
  --role="roles/speech.editor"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:krishisaarthi-functions@your-project-id.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:krishisaarthi-functions@your-project-id.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:krishisaarthi-functions@your-project-id.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:krishisaarthi-functions@your-project-id.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"
```

## 🔥 Firebase Configuration

### Initialize Firebase
```bash
firebase login
firebase use your-project-id
```

### Configure Firebase Services
The project includes pre-configured files:
- `firebase.json` - Firebase project configuration
- `firestore.rules` - Database security rules
- `storage.rules` - Storage security rules
- `firestore.indexes.json` - Database indexes

## 🏗️ Build and Deploy

### 1. Build Functions
```bash
cd functions
npm run build
```

### 2. Deploy to Firebase
```bash
# Deploy all services
firebase deploy

# Or deploy specific services
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### 3. Verify Deployment
```bash
# Test health endpoint
curl https://us-central1-your-project.cloudfunctions.net/api/health

# Expected response:
# {"status":"healthy","timestamp":"2025-07-27T..."}
```

## 🧪 Testing the Deployment

### 1. Create Test User
```bash
curl -X POST https://us-central1-your-project.cloudfunctions.net/api/users \
-H "Content-Type: application/json" \
-d '{
  "uid": "test_farmer_001",
  "profileData": {
    "name": "Test Farmer",
    "phone": "+91-1234567890",
    "location": "Bangalore, Karnataka",
    "farmSize": 3.5,
    "crops": ["wheat", "rice", "tomato"],
    "preferredLanguage": "en",
    "soilType": "red",
    "irrigationType": "drip",
    "experience": "5"
  }
}'
```

### 2. Test AI Query
```bash
curl -X POST https://us-central1-your-project.cloudfunctions.net/api/query \
-H "Content-Type: application/json" \
-d '{
  "uid": "test_farmer_001",
  "queryText": "What is the best fertilizer for tomato plants?"
}'
```

### 3. Test Image Analysis
```bash
curl -X POST https://us-central1-your-project.cloudfunctions.net/api/query \
-H "Content-Type: application/json" \
-d '{
  "uid": "test_farmer_001",
  "queryText": "What disease does my crop have?",
  "imageUrl": "https://example.com/crop-image.jpg"
}'
```

## 📊 Monitoring and Logging

### Firebase Console
- **Functions**: Monitor function execution, errors, and performance
- **Firestore**: View database operations and security rules
- **Storage**: Monitor file uploads and downloads

### Google Cloud Console
- **Vertex AI**: Monitor AI model usage and costs
- **Speech APIs**: Track speech-to-text and text-to-speech usage
- **Cloud Logging**: View detailed application logs

### Health Monitoring
```bash
# Set up monitoring alerts
gcloud alpha monitoring policies create \
  --policy-from-file=monitoring-policy.yaml
```

## 🔒 Security Checklist

### ✅ API Security
- [x] Environment variables secured
- [x] Service account permissions minimized
- [x] Firebase security rules configured
- [x] CORS properly configured
- [x] Input validation implemented

### ✅ Data Protection
- [x] Firestore security rules active
- [x] Storage security rules active
- [x] User data encryption
- [x] Audio file access controls
- [x] Personal data anonymization

## 🚨 Troubleshooting

### Common Issues

#### 1. **"GCLOUD_PROJECT is reserved"**
```bash
# Remove GCLOUD_PROJECT from .env file
# Use firebase project ID instead
```

#### 2. **"Model not found" Error**
```bash
# Check if Vertex AI API is enabled
gcloud services list --enabled | grep aiplatform

# Verify model availability
gcloud ai models list --region=us-central1
```

#### 3. **"Permission denied" Error**
```bash
# Check service account permissions
gcloud projects get-iam-policy your-project-id \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:krishisaarthi-functions@your-project-id.iam.gserviceaccount.com"
```

#### 4. **Functions timeout**
```bash
# Increase timeout in firebase.json
{
  "functions": {
    "runtime": "nodejs18",
    "timeout": "540s"
  }
}
```

### Debug Commands
```bash
# View function logs
firebase functions:log

# View real-time logs
firebase functions:log --follow

# View specific function logs
firebase functions:log --only api

# Check function status
firebase functions:list
```

## 🔄 CI/CD Pipeline

### GitHub Actions Setup
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Firebase
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        cd functions
        npm install
    
    - name: Build functions
      run: |
        cd functions
        npm run build
    
    - name: Deploy to Firebase
      uses: FirebaseExtended/action-hosting-deploy@v0
      with:
        repoToken: '${{ secrets.GITHUB_TOKEN }}'
        firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
        projectId: your-project-id
```

## 📈 Performance Optimization

### Function Configuration
```typescript
// Optimize function resources
export const api = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 300,
    memory: '2GB',
    minInstances: 1,    // Keep warm
    maxInstances: 100,  // Scale limit
  })
  .https.onRequest(app);
```

### Database Optimization
- **Indexes**: Pre-configured in `firestore.indexes.json`
- **Security Rules**: Optimized for performance
- **Data Structure**: Denormalized for read efficiency

### Storage Optimization
- **CDN**: Automatic via Firebase Hosting
- **Compression**: Audio files compressed
- **Cleanup**: Automated old file removal

## 🌍 Multi-Region Deployment

### Setup Multiple Regions
```bash
# Deploy to multiple regions
firebase functions:config:set region.primary=us-central1
firebase functions:config:set region.fallback=asia-south1

# Update function deployment
export const api = functions
  .region('us-central1', 'asia-south1')
  .https.onRequest(app);
```

---

## 📞 Support

If you encounter issues during deployment:

1. **Check logs**: `firebase functions:log`
2. **Verify configuration**: Review all environment variables
3. **Test APIs**: Ensure all Google Cloud APIs are enabled
4. **Check permissions**: Verify IAM roles are correctly assigned
5. **Contact support**: Create an issue in the repository

**🎉 Deployment Complete!** Your KrishiSarathi backend is now live and ready to help farmers! 🌾
