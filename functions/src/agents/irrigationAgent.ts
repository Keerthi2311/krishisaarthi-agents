import { textModel } from '../config/gemini';
import { ProfileContextAgent } from './profileAgent';
import { weatherService } from '../services/weather';

export class IrrigationAdvisorAgent {
  private profileAgent = new ProfileContextAgent();

  async getAdvice(uid: string, query?: string): Promise<{
    advice: string;
    englishText: string;
    schedule: string[];
    moistureLevel: string;
    waterRequirement: string;
    weatherData: any;
  }> {
    try {
      const profile = await this.profileAgent.fetchUserProfile(uid);
      if (!profile) throw new Error('User profile not found');

      // Get real weather data using the weather service
      const weatherData = await weatherService.getWeatherData(
        profile.district || 'Davanagere'
      );
      
      // Get irrigation recommendations based on weather and crop data
      const primaryCrop = profile.cropsGrown?.[0] || 'mixed crops';
      const irrigationAnalysis = weatherService.getIrrigationRecommendations(weatherData, primaryCrop);
      
      const contextPrompt = this.profileAgent.generateContextPrompt(profile);
      
      const irrigationPrompt = `
${contextPrompt}

TASK: Provide comprehensive irrigation advice based on current weather conditions and 7-day forecast.

REAL WEATHER DATA for ${profile.district}:
Current Conditions:
- Temperature: ${weatherData.current.temperature.toFixed(1)}°C
- Humidity: ${weatherData.current.humidity.toFixed(1)}%
- Recent Rainfall: ${weatherData.current.rainfall.toFixed(1)}mm
- Wind Speed: ${weatherData.current.windSpeed.toFixed(1)} km/h
- Atmospheric Pressure: ${weatherData.current.pressure.toFixed(0)} hPa
- UV Index: ${weatherData.current.uvIndex.toFixed(1)}
- Weather Condition: ${weatherData.current.condition}

7-DAY WEATHER FORECAST:
${weatherData.forecast.map((day, index) => `
Day ${index + 1} (${day.date}):
- Temperature: ${day.temperature.min.toFixed(1)}°C to ${day.temperature.max.toFixed(1)}°C
- Expected Rainfall: ${day.rainfall.toFixed(1)}mm (${day.precipitationProbability}% chance)
- Humidity: ${day.humidity.toFixed(1)}%
- Condition: ${day.condition}
`).join('')}

AI IRRIGATION ANALYSIS:
- Should irrigate today: ${irrigationAnalysis.shouldIrrigate ? 'YES' : 'NO'}
- Recommended schedule: ${irrigationAnalysis.schedule.join(', ')}
- Water requirement: ${irrigationAnalysis.waterRequirement}
- Weather reasoning: ${irrigationAnalysis.reasoning}

FARMER'S QUERY: "${query || 'General irrigation advice needed'}"

RESPONSE FORMAT:
Provide detailed irrigation guidance covering:
- **Immediate Action**: Should they water today based on current conditions?
- **Daily Schedule**: Specific watering times for the next 7 days with reasoning
- **Water Amount**: How much water to apply (liters per plant/square meter)
- **Weather Impact**: How current and forecasted weather affects irrigation needs
- **Crop-Specific Advice**: Tailored recommendations for each crop they grow
- **Efficiency Tips**: Water conservation strategies based on current weather
- **Warning Signs**: What to watch for (over-watering/under-watering symptoms)
- **Weekly Strategy**: Irrigation adjustments based on 7-day weather forecast

Be specific with exact watering times, water quantities, and practical tips for their irrigation system.
Use real weather data to provide precise, actionable irrigation recommendations.
`;

      const result = await textModel.generateContent(irrigationPrompt);
      const response = result.response.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate irrigation advice';

      return {
        advice: response,
        englishText: response,
        schedule: irrigationAnalysis.schedule,
        moistureLevel: this.determineMoistureLevel(weatherData),
        waterRequirement: this.calculateWaterRequirement(weatherData, profile),
        weatherData: weatherData
      };
    } catch (error) {
      console.error('Irrigation advice error:', error);
      throw error;
    }
  }

  private determineMoistureLevel(weatherData: any): string {
    const { current, forecast } = weatherData;
    
    // Calculate moisture level based on recent rainfall and humidity
    const recentRain = current.rainfall;
    const humidity = current.humidity;
    const upcomingRain = forecast.slice(0, 2).reduce((total: number, day: any) => total + day.rainfall, 0);
    
    if (recentRain > 10 || upcomingRain > 15) {
      return 'High - Adequate moisture from recent/upcoming rainfall';
    } else if (humidity > 70 && recentRain > 2) {
      return 'Moderate - Good moisture levels, monitor daily';
    } else if (humidity < 50 && recentRain < 1) {
      return 'Low - Immediate irrigation needed';
    } else {
      return 'Moderate - Regular irrigation schedule recommended';
    }
  }

  private calculateWaterRequirement(weatherData: any, profile: any): string {
    const { current } = weatherData;
    const baseRequirement = 25; // Base liters per square meter
    
    // Adjust based on weather conditions
    let multiplier = 1.0;
    
    if (current.temperature > 35) multiplier += 0.3;
    if (current.temperature < 20) multiplier -= 0.2;
    if (current.humidity < 40) multiplier += 0.2;
    if (current.windSpeed > 20) multiplier += 0.15;
    if (current.rainfall > 5) multiplier -= 0.4;
    
    // Adjust based on crop type
    const primaryCrop = profile.cropsGrown?.[0]?.toLowerCase() || '';
    if (['rice', 'sugarcane'].includes(primaryCrop)) multiplier += 0.4;
    if (['onion', 'garlic'].includes(primaryCrop)) multiplier -= 0.2;
    
    const adjustedRequirement = Math.max(baseRequirement * multiplier, 10);
    
    return `${adjustedRequirement.toFixed(0)} liters per square meter (adjusted for current weather conditions)`;
  }

  async getPersonalizedRecommendations(uid: string): Promise<any[]> {
    try {
      const advice = await this.getAdvice(uid);
      return [
        {
          type: 'irrigation_schedule',
          priority: 'high',
          message: 'Today\'s irrigation recommendations ready',
          data: advice
        }
      ];
    } catch (error) {
      console.error('Error getting personalized irrigation recommendations:', error);
      return [];
    }
  }
}
