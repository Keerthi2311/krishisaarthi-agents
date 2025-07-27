import { firestoreService } from '../services/firestore';
import { DailySummaryAgent } from '../agents/dailySummaryAgent';
import { synthesizeEnglishSpeech } from '../services/tts';
import { UserProfile } from '../types';

export async function dailySummaryPush(): Promise<void> {
  try {
    console.log('Running daily summary push...');

    // Get all active users
    const activeUsers = await firestoreService.getActiveUsers() as UserProfile[];
    const dailySummaryAgent = new DailySummaryAgent();

    for (const user of activeUsers) {
      try {
        // Generate personalized daily summary using the agent
        const summaryResult = await dailySummaryAgent.generateSummary(user.userId);

        // Use the audio URL from the agent or generate one if needed
        let audioUrl = summaryResult.audioUrl;
        
        // If no audio was generated but user prefers audio, generate it
        if (!audioUrl && user.preferences?.audioNotifications) {
          audioUrl = await synthesizeEnglishSpeech(summaryResult.summary, user.userId, 'FEMALE');
        }

        // Save summary notification
        await firestoreService.saveDailySummary(user.userId, {
          summary: summaryResult.summary,
          audioUrl,
          date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          createdAt: new Date(),
        });

        console.log(`Daily summary generated for user: ${user.userId}`);
      } catch (userError) {
        console.error(`Error generating summary for user ${user.userId}:`, userError);
      }
    }

    console.log('Daily summary push completed');
  } catch (error) {
    console.error('Daily summary push error:', error);
  }
}
