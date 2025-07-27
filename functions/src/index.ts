import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { queryHandler } from './handlers/queryHandler';
import { getRecommendations } from './handlers/recommendationsHandler';
import { dailySummaryPush } from './handlers/dailySummaryHandler';
import { firestoreService } from './services/firestore';

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.post('/query', queryHandler);
app.get('/recommendations/:uid', getRecommendations);

// User management routes
app.post('/users', async (req, res) => {
  try {
    const { uid, profileData } = req.body;
    
    if (!uid) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const userProfile = {
      fullName: profileData?.name || '',
      phoneNumber: profileData?.phone || '',
      district: profileData?.location || '',
      landSize: profileData?.farmSize || 0,
      landUnit: 'acres' as const,
      soilType: profileData?.soilType || 'mixed',
      cropsGrown: profileData?.crops || [],
      farmingExperience: profileData?.experience ? parseInt(profileData.experience) : 1,
      irrigationType: profileData?.irrigationType || 'traditional',
      language: profileData?.preferredLanguage || 'en',
      preferences: {
        audioNotifications: true,
        dailySummary: true,
        marketAlerts: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...profileData
    };

    await firestoreService.updateUserProfile(uid, userProfile);
    
    res.status(201).json({ 
      message: 'User created successfully',
      uid,
      profile: userProfile
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      error: 'Failed to create user',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const profile = await firestoreService.getUserProfile(uid);
    
    if (!profile) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.json({ uid, profile });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ 
      error: 'Failed to get user',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Export functions
export const api = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 300,
    memory: '2GB',
  })
  .https.onRequest(app);

export const dailySummary = functions
  .region('us-central1')
  .pubsub.schedule('0 6 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(dailySummaryPush);
