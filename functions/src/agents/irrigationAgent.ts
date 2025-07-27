import { textModel } from '../config/gemini';
import { ProfileContextAgent } from './profileAgent';

export class IrrigationAdvisorAgent {
  private profileAgent = new ProfileContextAgent();

  async getAdvice(uid: string, query?: string): Promise<{
    advice: string;
    englishText: string;
    schedule: string[];
    moistureLevel: string;
    waterRequirement: string;
  }> {
    try {
      const profile = await this.profileAgent.fetchUserProfile(uid);
      if (!profile) throw new Error('User profile not found');

      // Get weather data (mock implementation)
      const weatherData = await this.fetchWeatherData(profile.district);
      
      const contextPrompt = this.profileAgent.generateContextPrompt(profile);
      
      const irrigationPrompt = `
${contextPrompt}

TASK: Provide comprehensive irrigation advice based on current conditions.

Current Weather Data for ${profile.district}:
${JSON.stringify(weatherData, null, 2)}

${query ? `Farmer's Query: "${query}"` : 'Farmers Query: "General irrigation advice needed"'}

IRRIGATION ANALYSIS REQUIREMENTS:
1. Consider the farmer's soil type (${profile.soilType}) and its water retention
2. Analyze current weather patterns and upcoming forecast
3. Factor in the water needs of their crops: ${profile.cropsGrown.join(', ')}
4. Consider their irrigation method: ${profile.irrigationType}
5. Account for farm size: ${profile.landSize} ${profile.landUnit}

RESPONSE FORMAT:
Provide detailed irrigation guidance covering:
- Current soil moisture assessment
- Daily water requirements for next 7 days
- Best times to irrigate (morning/evening recommendations)
- Specific advice for each crop they grow
- Water conservation tips suitable for their irrigation method
- Signs to watch for (over-watering/under-watering)
- Adjustments based on weather forecast

Be specific with:
- Exact watering schedules (times and duration)
- Water quantities needed per crop
- Practical tips for their specific irrigation system
- Cost-saving irrigation strategies
`;

      const result = await textModel.generateContent(irrigationPrompt);
      const response = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Extract structured data from response
      const schedule = this.extractWateringSchedule(response);
      const moistureLevel = this.extractMoistureLevel(response);
      const waterRequirement = this.extractWaterRequirement(response);

      return {
        advice: response,
        englishText: response,
        schedule,
        moistureLevel,
        waterRequirement,
      };
    } catch (error) {
      console.error('Irrigation advice error:', error);
      throw error;
    }
  }

  private async fetchWeatherData(district: string) {
    // Mock weather data - replace with real weather API
    return {
      current: {
        temperature: 28,
        humidity: 65,
        rainfall: 0,
        windSpeed: 12
      },
      forecast: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        temperature: { min: 18 + Math.random() * 5, max: 28 + Math.random() * 8 },
        rainfall: Math.random() > 0.7 ? Math.random() * 20 : 0,
        humidity: 60 + Math.random() * 20
      })),
      district
    };
  }

  private extractWateringSchedule(response: string): string[] {
    const scheduleLines = response.split('\n').filter(line => 
      line.includes('AM') || line.includes('PM') || line.includes('morning') || line.includes('evening')
    );
    return scheduleLines.length > 0 ? scheduleLines : ['Water early morning (6-8 AM) and evening (6-8 PM)'];
  }

  private extractMoistureLevel(response: string): string {
    if (response.toLowerCase().includes('dry') || response.toLowerCase().includes('low moisture')) {
      return 'Low - Needs immediate watering';
    } else if (response.toLowerCase().includes('wet') || response.toLowerCase().includes('high moisture')) {
      return 'High - Reduce watering';
    }
    return 'Moderate - Continue regular schedule';
  }

  private extractWaterRequirement(response: string): string {
    const waterMatch = response.match(/(\d+)\s*(liters?|gallons?|inches?)/i);
    return waterMatch ? waterMatch[0] : 'Based on crop type and weather conditions';
  }

  async getPersonalizedRecommendations(uid: string): Promise<any[]> {
    try {
      await this.getAdvice(uid);
      return [
        'Optimize watering schedule based on weather',
        'Monitor soil moisture levels regularly',
        'Consider water conservation techniques'
      ];
    } catch (error) {
      console.error('Error getting irrigation recommendations:', error);
      return [];
    }
  }
}

