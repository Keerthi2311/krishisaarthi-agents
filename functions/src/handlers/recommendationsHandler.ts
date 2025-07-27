import { Request, Response } from 'express';
import { firestoreService } from '../services/firestore';
import { weatherService } from '../services/weather';
import { IrrigationAdvisorAgent } from '../agents/irrigationAgent';
import { MarketAdvisorAgent } from '../agents/marketAgent';
import { SchemeRecommenderAgent } from '../agents/schemeAgent';
import { DiseaseDiagnoserAgent } from '../agents/diseaseAgent';

export async function getRecommendations(req: Request, res: Response): Promise<void> {
  try {
    const { uid } = req.params;

    if (!uid) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    // Get user profile and recent interactions
    const profile = await firestoreService.getUserProfile(uid);
    const recentInteractions = await firestoreService.getUserInteractions(uid, 7);

    if (!profile) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    // Initialize agents
    const irrigationAgent = new IrrigationAdvisorAgent();
    const marketAgent = new MarketAdvisorAgent();
    const schemeAgent = new SchemeRecommenderAgent();
    const diseaseAgent = new DiseaseDiagnoserAgent();

    // Get weather data for the user's location
    const weatherData = await weatherService.getWeatherData(profile.district || 'Davanagere');

    // Generate agent-driven recommendations (parallel processing for efficiency)
    const [irrigationAdvice, marketAdvice, schemeRecommendations, weatherAlerts, cropCareAdvice] = await Promise.all([
      irrigationAgent.getAdvice(uid, 'Provide irrigation schedule and water requirements'),
      marketAgent.getMarketAdvice(uid, 'Current market conditions and selling advice'),  
      schemeAgent.getRecommendations(uid, 'Eligible government schemes and subsidies'),
      generateAgentWeatherAlerts(irrigationAgent, uid, weatherData, profile),
      generateAgentCropCare(diseaseAgent, uid, profile, weatherData, recentInteractions)
    ]);

    // Extract intelligent recommendations from agents
    const recommendations = {
      weatherAlerts: weatherAlerts,
      cropCare: cropCareAdvice,
      marketTips: extractMarketInsights(marketAdvice),
      schemes: extractSchemeInsights(schemeRecommendations),
      irrigation: {
        shouldIrrigate: irrigationAdvice.moistureLevel.includes('Low'),
        schedule: irrigationAdvice.schedule,
        waterRequirement: irrigationAdvice.waterRequirement,
        reasoning: irrigationAdvice.advice
      }
    };

    res.json({
      success: true,
      recommendations,
      profile: {
        name: profile.name,
        location: profile.district,
        crops: profile.cropsGrown || [],
        farmSize: profile.landSize,
        lastActive: profile.lastActive
      },
      weather: {
        current: weatherData.current,
        forecast: weatherData.forecast.slice(0, 3), // Next 3 days
        location: weatherData.location
      },
      recentActivityCount: recentInteractions.length,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Recommendations handler error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Agent-driven helper functions (replacing hardcoded logic)

// Let irrigation agent provide weather-based alerts and recommendations
async function generateAgentWeatherAlerts(
  irrigationAgent: IrrigationAdvisorAgent, 
  uid: string, 
  weatherData: any, 
  profile: any
): Promise<string[]> {
  try {
    // Use irrigation agent's intelligence for weather-based farming alerts
    const irrigationAdvice = await irrigationAgent.getAdvice(uid, 
      `Analyze current weather conditions and provide critical alerts for farming activities. Current weather: Temperature ${weatherData.current.temperature}°C, Humidity ${weatherData.current.humidity}%, Wind ${weatherData.current.windSpeed} km/h, Rainfall ${weatherData.current.rainfall}mm. Focus on immediate action items and warnings.`
    );
    
    // Extract actionable alerts from agent's response
    const alertText = irrigationAdvice.advice;
    const alerts = extractAlertsFromText(alertText, weatherData);
    
    return alerts.length > 0 ? alerts : ['Weather conditions are suitable for normal farming activities'];
  } catch (error) {
    console.error('Weather alerts generation error:', error);
    return ['Weather monitoring temporarily unavailable. Please check local conditions.'];
  }
}

// Let disease agent provide intelligent crop care recommendations
async function generateAgentCropCare(
  diseaseAgent: DiseaseDiagnoserAgent,
  uid: string,
  profile: any,
  weatherData: any,
  recentInteractions: any[]
): Promise<string[]> {
  try {
    // Build context from recent disease queries
    const recentDiseaseQueries = recentInteractions
      .filter(i => i.intent === 'disease')
      .map(i => i.query)
      .slice(0, 3);
    
    const context = recentDiseaseQueries.length > 0 
      ? `Recent concerns: ${recentDiseaseQueries.join('; ')}`
      : 'General crop health monitoring';
    
    // Use disease agent for intelligent crop care advice
    const diseaseAdvice = await diseaseAgent.diagnose(uid, undefined, 
      `Given current weather conditions (${weatherData.current.temperature}°C, ${weatherData.current.humidity}% humidity, ${weatherData.current.condition}), what crop care recommendations do you have for ${profile.cropsGrown?.join(', ') || 'my crops'}? ${context}. Focus on preventive care and seasonal best practices.`
    );
    
    // Extract crop care recommendations from agent's response
    const recommendations = extractCropCareFromText(diseaseAdvice.diagnosis);
    
    return recommendations.length > 0 ? recommendations : [
      'Continue regular crop monitoring and care',
      'Maintain proper field hygiene practices'
    ];
  } catch (error) {
    console.error('Crop care generation error:', error);
    return ['Crop care recommendations temporarily unavailable. Follow standard practices.'];
  }
}

// Extract market insights from market agent's intelligent analysis
function extractMarketInsights(marketAdvice: any): string[] {
  try {
    const insights: string[] = [];
    
    // Extract key recommendations from market agent's advice
    const adviceText = marketAdvice.advice || marketAdvice.englishText || '';
    
    // Parse agent's intelligent recommendations
    if (marketAdvice.recommendation === 'sell') {
      insights.push('Market analysis suggests selling is favorable now');
    } else if (marketAdvice.recommendation === 'hold') {
      insights.push('Market trends indicate holding for better prices');
    } else if (marketAdvice.recommendation === 'wait') {
      insights.push('Market conditions suggest waiting for optimal timing');
    }
    
    // Extract specific insights from agent's text analysis
    const sentences = adviceText.split('.').filter((s: string) => s.trim().length > 10);
    const marketTips = sentences
      .filter((s: string) => 
        s.includes('price') || s.includes('sell') || s.includes('market') || 
        s.includes('mandi') || s.includes('demand') || s.includes('supply')
      )
      .slice(0, 3)
      .map((s: string) => s.trim());
    
    insights.push(...marketTips);
    
    return insights.length > 0 ? insights : ['Monitor local market prices for optimal selling opportunities'];
  } catch (error) {
    console.error('Market insights extraction error:', error);
    return ['Market analysis temporarily unavailable. Consult local mandi prices.'];
  }
}

// Extract scheme insights from scheme agent's intelligent recommendations
function extractSchemeInsights(schemeRecommendations: any): string[] {
  try {
    const schemes: string[] = [];
    
    // Extract from agent's structured schemes data
    if (schemeRecommendations.schemes && Array.isArray(schemeRecommendations.schemes)) {
      schemeRecommendations.schemes.forEach((scheme: any) => {
        if (scheme.name) {
          const schemeText = scheme.deadline 
            ? `${scheme.name} - Application deadline: ${scheme.deadline}`
            : `Eligible for ${scheme.name} - Apply for benefits`;
          schemes.push(schemeText);
        }
      });
    }
    
    // Extract from agent's text recommendations
    const recommendationText = schemeRecommendations.recommendations || schemeRecommendations.englishText || '';
    const sentences = recommendationText.split('.').filter((s: string) => s.trim().length > 15);
    
    const schemeMatches = sentences
      .filter((s: string) => 
        s.includes('scheme') || s.includes('subsidy') || s.includes('benefit') || 
        s.includes('eligible') || s.includes('apply') || s.includes('PM-') || 
        s.includes('Kisan') || s.includes('government')
      )
      .slice(0, 4)
      .map((s: string) => s.trim());
    
    schemes.push(...schemeMatches);
    
    return schemes.length > 0 ? schemes : [
      'Check eligibility for PM-KISAN and other government schemes',
      'Visit local agriculture office for scheme information'
    ];
  } catch (error) {
    console.error('Scheme insights extraction error:', error);
    return ['Government scheme information temporarily unavailable. Visit local agriculture office.'];
  }
}

// Utility functions for text processing
function extractAlertsFromText(text: string, weatherData: any): string[] {
  const alerts: string[] = [];
  
  // Look for alert keywords in agent's intelligent response
  const sentences = text.split('.').filter(s => s.trim().length > 10);
  
  const alertSentences = sentences.filter(s => 
    s.includes('alert') || s.includes('warning') || s.includes('caution') || 
    s.includes('immediate') || s.includes('urgent') || s.includes('critical') ||
    s.includes('protect') || s.includes('secure') || s.includes('danger')
  ).slice(0, 3);
  
  alerts.push(...alertSentences.map(s => s.trim()));
  
  // Add specific weather-based alerts from agent's analysis
  if (text.includes('wind') && weatherData.current.windSpeed > 25) {
    alerts.push(`Strong winds detected: ${weatherData.current.windSpeed.toFixed(1)} km/h - Secure farming equipment`);
  }
  
  if (text.includes('temperature') && weatherData.current.temperature > 35) {
    alerts.push(`High temperature: ${weatherData.current.temperature.toFixed(1)}°C - Monitor crop stress`);
  }
  
  return alerts;
}

function extractCropCareFromText(text: string): string[] {
  const recommendations: string[] = [];
  
  // Extract actionable recommendations from disease agent's response
  const sentences = text.split('.').filter(s => s.trim().length > 15);
  
  const careSentences = sentences.filter(s => 
    s.includes('monitor') || s.includes('check') || s.includes('apply') || 
    s.includes('spray') || s.includes('treat') || s.includes('prevent') ||
    s.includes('care') || s.includes('maintain') || s.includes('ensure')
  ).slice(0, 4);
  
  recommendations.push(...careSentences.map(s => s.trim()));
  
  return recommendations;
}
