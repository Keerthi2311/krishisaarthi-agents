import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const getDb = () => {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin.firestore();
};

export interface InteractionLog {
  uid: string;
  queryText: string;
  imageUrl?: string;
  intent: string;
  response: string;
  audioUrl: string | null;
  priority: 'low' | 'medium' | 'high';
  additionalData?: any;
  timestamp: Date;
}

export async function logInteraction(log: InteractionLog): Promise<void> {
  try {
    const logData = {
      ...log,
      timestamp: FieldValue.serverTimestamp(),
      processedAt: new Date().toISOString(),
    };

    // Save to user's log collection
    await getDb()
      .collection('logs')
      .doc(log.uid)
      .collection('interactions')
      .add(logData);

    // Update user statistics
    await updateUserStats(log.uid, log.intent);
    
    console.log('Interaction logged successfully:', log.uid);
  } catch (error) {
    console.error('Error logging interaction:', error);
    throw error;
  }
}

export async function updateUserStats(uid: string, intent: string): Promise<void> {
  try {
    const userStatsRef = getDb().collection('userStats').doc(uid);
    
    await userStatsRef.set({
      totalQueries: FieldValue.increment(1),
      [`${intent}Queries`]: FieldValue.increment(1),
      lastQueryAt: FieldValue.serverTimestamp(),
      lastIntent: intent,
    }, { merge: true });
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
}

export async function getUserInteractionHistory(
  uid: string,
  limit: number = 10
): Promise<InteractionLog[]> {
  try {
    const snapshot = await getDb()
      .collection('logs')
      .doc(uid)
      .collection('interactions')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
  } catch (error) {
    console.error('Error fetching interaction history:', error);
    throw error;
  }
}

export async function saveDailyRecommendations(
  uid: string,
  recommendations: any
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    await getDb()
      .collection('dailyRecommendations')
      .doc(uid)
      .collection('recommendations')
      .doc(today)
      .set({
        ...recommendations,
        date: today,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error('Error saving daily recommendations:', error);
    throw error;
  }
}

export async function getDailyRecommendations(uid: string): Promise<any> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const doc = await getDb()
      .collection('dailyRecommendations')
      .doc(uid)
      .collection('recommendations')
      .doc(today)
      .get();
    
    if (doc.exists) {
      return doc.data();
    }
    
    return null;
  } catch (error) {
    console.error('Error getting daily recommendations:', error);
    throw error;
  }
}

// Legacy compatibility functions
export const firestoreService = {
  async getUserProfile(uid: string) {
    try {
      const doc = await getDb().collection('users').doc(uid).get();
      return doc.exists ? doc.data() : null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  },

  async updateUserProfile(uid: string, profileData: any) {
    try {
      await getDb().collection('users').doc(uid).set(profileData, { merge: true });
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  },

  async getUserInteractions(uid: string, days: number = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const snapshot = await getDb()
        .collection('logs')
        .doc(uid)
        .collection('interactions')
        .where('timestamp', '>=', cutoffDate)
        .orderBy('timestamp', 'desc')
        .get();
      
      return snapshot.docs.map((doc: any) => doc.data());
    } catch (error) {
      console.error('Error getting user interactions:', error);
      return [];
    }
  },

  async getActiveUsers() {
    try {
      const snapshot = await getDb().collection('users').get();
      return snapshot.docs.map((doc: any) => ({ userId: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting active users:', error);
      return [];
    }
  },

  async saveDailySummary(uid: string, summaryData: any) {
    try {
      await getDb()
        .collection('dailySummaries')
        .doc(uid)
        .collection('summaries')
        .doc(summaryData.date)
        .set(summaryData);
    } catch (error) {
      console.error('Error saving daily summary:', error);
      throw error;
    }
  }
};
