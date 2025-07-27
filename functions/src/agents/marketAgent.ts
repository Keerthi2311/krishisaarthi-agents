import { Request, Response } from 'express';
import { textModel } from '../config/gemini';
import { ProfileContextAgent } from './profileAgent';

export class MarketAdvisorAgent {
  private profileAgent = new ProfileContextAgent();

  async getMarketAdvice(uid: string, query?: string): Promise<{
    advice: string;
    englishText: string;
    recommendation: 'sell' | 'hold' | 'wait';
    priceData: any[];
  }> {
    try {
      const profile = await this.profileAgent.fetchUserProfile(uid);
      if (!profile) throw new Error('User profile not found');

      // Fetch current market data (mock implementation)
      const marketData = await this.fetchMarketData(profile.cropsGrown, profile.district || '');
      
      const contextPrompt = this.profileAgent.generateContextPrompt(profile);
      
      const marketPrompt = `
${contextPrompt}

TASK: Provide comprehensive market advice based on current prices and trends.

Farmer's Query: "${query || 'Need market advice for my crops'}"

Current Market Data for ${profile.district || 'India'}:
${JSON.stringify(marketData, null, 2)}

INSTRUCTIONS:
1. Analyze current price trends for the farmer's crops: ${profile.cropsGrown.join(', ')}
2. Compare with historical averages and seasonal patterns
3. Consider local market conditions in ${profile.district}
4. Provide specific buy/sell/hold recommendations
5. Suggest alternative crops if current prices are poor
6. Recommend nearby mandis with better prices

RESPONSE FORMAT:
Provide detailed market advice in English covering:
- Current price situation for each of their crops
- Best selling strategy (sell now/wait for better prices)
- Which local mandis offer the best prices
- Alternative crop suggestions if applicable
- Expected price trends for the next 2-4 weeks
- Transportation and logistics advice

Be specific with:
- Exact price ranges and profit margins
- Names of nearby mandis and markets
- Timing recommendations (best days/times to sell)
- Quality requirements for better prices
`;

      const result = await textModel.generateContent(marketPrompt);
      const response = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const recommendation = this.extractRecommendation(response);
      
      return {
        advice: response,
        englishText: response,
        recommendation,
        priceData: marketData,
      };
    } catch (error) {
      console.error('Market advice error:', error);
      throw error;
    }
  }

  private async fetchMarketData(crops: string[], district: string) {
    // Mock implementation - replace with real market API (Agmarknet, etc.)
    return crops.map(crop => ({
      crop,
      currentPrice: Math.floor(Math.random() * 100) + 50,
      avgPrice: Math.floor(Math.random() * 80) + 40,
      trend: Math.random() > 0.5 ? 'up' : 'down',
      district,
      lastUpdated: new Date().toISOString(),
    }));
  }

  private extractRecommendation(response: string): 'sell' | 'hold' | 'wait' {
    const lowerResponse = response.toLowerCase();
    const sellKeywords = ['sell now', 'good time to sell', 'sell immediately', 'prices are high'];
    const holdKeywords = ['hold', 'wait', 'prices may increase', 'store'];
    
    if (sellKeywords.some(keyword => lowerResponse.includes(keyword))) {
      return 'sell';
    }
    if (holdKeywords.some(keyword => lowerResponse.includes(keyword))) {
      return 'hold';
    }
    return 'wait';
  }
}

export const marketAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, query } = req.body;

    if (!userId || !query) {
      res.status(400).json({ error: 'User ID and query are required' });
      return;
    }

    const agent = new MarketAdvisorAgent();
    const advice = await agent.getMarketAdvice(userId, query);

    res.json({
      success: true,
      recommendations: advice,
    });
  } catch (error) {
    console.error('Market Agent Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
