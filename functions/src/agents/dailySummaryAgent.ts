import { textModel } from '../config/gemini';
import { ProfileContextAgent } from './profileAgent';
import { MarketAdvisorAgent } from './marketAgent';
import { IrrigationAdvisorAgent } from './irrigationAgent';
import { synthesizeEnglishSpeech } from '../services/tts';
import { getFirestore } from 'firebase-admin/firestore';

export class DailySummaryAgent {
  private profileAgent = new ProfileContextAgent();
  private marketAgent = new MarketAdvisorAgent();
  private irrigationAgent = new IrrigationAdvisorAgent();
  private db = getFirestore();

  async generateSummary(uid: string): Promise<{
    summary: string;
    audioUrl: string | null;
    categories: {
      weather: string;
      market: string;
      irrigation: string;
      general: string;
    };
  }> {
    try {
      const profile = await this.profileAgent.fetchUserProfile(uid);
      if (!profile) throw new Error('User profile not found');

      // Get data from other agents
      const marketAdvice = await this.marketAgent.getMarketAdvice(uid);
      const irrigationAdvice = await this.irrigationAgent.getAdvice(uid);
      
      const contextPrompt = this.profileAgent.generateContextPrompt(profile);
      
      const summaryPrompt = `
${contextPrompt}

TASK: Create a comprehensive daily farming summary for this farmer.

MARKET INSIGHTS:
${marketAdvice.advice}

IRRIGATION ADVICE:
${irrigationAdvice.advice}

CREATE A DAILY SUMMARY INCLUDING:
1. Good morning greeting with farmer's name
2. Today's priority tasks based on weather and crops
3. Market highlights for their crops
4. Irrigation recommendations for today
5. Any urgent actions needed
6. General farming tip for the day
7. Encouraging closing message

RESPONSE FORMAT:
Create a friendly, informative daily summary in English that covers:
- Personal greeting using farmer's name
- Weather-based advice for today's farming activities
- Market updates relevant to their crops
- Specific irrigation guidance for today
- Any urgent or time-sensitive recommendations
- A practical tip they can implement today
- Motivational closing focused on successful farming

Keep the tone encouraging, practical, and personal. Limit to 2-3 minutes of speaking time.
Make it sound like a trusted farming advisor speaking directly to them.
`;

      const result = await textModel.generateContent(summaryPrompt);
      const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Generate audio version
      const audioUrl = await synthesizeEnglishSpeech(summary, uid);
      
      // Extract categories
      const categories = this.extractCategories(summary, marketAdvice.advice, irrigationAdvice.advice);
      
      // Save to Firestore
      await this.saveDailySummary(uid, {
        summary,
        audioUrl,
        categories,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date()
      });

      return {
        summary,
        audioUrl,
        categories
      };
    } catch (error) {
      console.error('Daily summary generation error:', error);
      throw error;
    }
  }

  private extractCategories(summary: string, market: string, irrigation: string) {
    return {
      weather: this.extractWeatherInfo(summary),
      market: this.extractMarketHighlights(market),
      irrigation: this.extractIrrigationTasks(irrigation),
      general: this.extractGeneralTips(summary)
    };
  }

  private extractWeatherInfo(summary: string): string {
    const weatherMatch = summary.match(/weather[\s\S]*?(?=market|irrigation|today|tomorrow|\n\n)/i);
    return weatherMatch ? weatherMatch[0].trim() : 'Check local weather conditions';
  }

  private extractMarketHighlights(market: string): string {
    const lines = market.split('\n').slice(0, 3);
    return lines.join(' ').substring(0, 150) + '...';
  }

  private extractIrrigationTasks(irrigation: string): string {
    const taskMatch = irrigation.match(/today[\s\S]*?(?=tomorrow|next|\n\n)/i);
    return taskMatch ? taskMatch[0].trim().substring(0, 150) + '...' : 'Follow regular watering schedule';
  }

  private extractGeneralTips(summary: string): string {
    const tipMatch = summary.match(/tip[\s\S]*?(?=\n|$)/i);
    return tipMatch ? tipMatch[0].trim() : 'Keep monitoring your crops regularly';
  }

  private async saveDailySummary(uid: string, summaryData: any) {
    try {
      await this.db
        .collection('dailySummaries')
        .doc(uid)
        .collection('summaries')
        .doc(summaryData.date)
        .set(summaryData);
    } catch (error) {
      console.error('Error saving daily summary:', error);
    }
  }
}
