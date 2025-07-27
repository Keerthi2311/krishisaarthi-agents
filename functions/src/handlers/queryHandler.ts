import { Request, Response } from 'express';
import { DiseaseDiagnoserAgent } from '../agents/diseaseAgent';
import { IrrigationAdvisorAgent } from '../agents/irrigationAgent';
import { MarketAdvisorAgent } from '../agents/marketAgent';
import { SchemeRecommenderAgent } from '../agents/schemeAgent';
import { transcribeAudio } from '../services/stt';
import { synthesizeEnglishSpeech } from '../services/tts';
import { classifyIntent } from '../services/classifier';
import { logInteraction, firestoreService } from '../services/firestore';
import { weatherService } from '../services/weather';

// Helper function to generate contextual recommendations based on query and user profile
async function generateContextualRecommendations(
  uid: string, 
  intent: string, 
  queryText: string,
  responseData: any
): Promise<any> {
  try {
    // Get user profile and recent interactions
    const profile = await firestoreService.getUserProfile(uid);
    const recentInteractions = await firestoreService.getUserInteractions(uid, 7);

    if (!profile) {
      throw new Error('User profile not found');
    }

    // Get real weather data for user's location
    const weatherData = await weatherService.getWeatherData(profile.district || 'Davanagere');

    // Initialize agents to get fresh recommendations
    const irrigationAgent = new IrrigationAdvisorAgent();
    const marketAgent = new MarketAdvisorAgent();
    const schemeAgent = new SchemeRecommenderAgent();

    // Get recommendations from agents (only if not the current intent to avoid redundancy)
    const agentRecommendations: any = {};
    
    try {
      if (intent !== 'irrigation') {
        const irrigationAdvice = await irrigationAgent.getAdvice(uid);
        agentRecommendations.irrigation = irrigationAdvice;
      }
      
      if (intent !== 'market') {
        const marketAdvice = await marketAgent.getMarketAdvice(uid);
        agentRecommendations.market = marketAdvice;
      }
      
      if (intent !== 'scheme') {
        const schemeAdvice = await schemeAgent.getRecommendations(uid);
        agentRecommendations.scheme = schemeAdvice;
      }
    } catch (agentError) {
      console.warn('Some agent recommendations failed:', agentError);
    }

    // Generate agent-driven recommendations instead of hardcoded logic
    const [weatherAlerts, cropCareAdvice] = await Promise.all([
      generateAgentWeatherAlerts(irrigationAgent, uid, weatherData, profile),
      generateAgentCropCare(new DiseaseDiagnoserAgent(), uid, profile, weatherData, recentInteractions)
    ]);

    // Base recommendations structure
    const recommendations = {
      weatherAlerts: weatherAlerts,
      cropCare: cropCareAdvice,
      marketTips: [] as string[],
      schemes: [] as string[],
      relatedActions: [] as string[]
    };

    // Generate contextual recommendations based on the query intent and response
    switch (intent) {
      case 'disease':
        recommendations.relatedActions.push(
          'Consider organic pesticides for long-term crop health',
          'Schedule regular soil testing to prevent nutrient deficiency'
        );
        if (responseData.treatment) {
          recommendations.relatedActions.push(`Follow up on the ${responseData.treatment} treatment in 3-5 days`);
        }
        // Add irrigation recommendations if available
        if (agentRecommendations.irrigation) {
          recommendations.relatedActions.push(`Today's irrigation advice: ${agentRecommendations.irrigation.moistureLevel}`);
        }
        break;

      case 'irrigation':
        if (weatherData.current.rainfall > 5) {
          recommendations.relatedActions.push('Recent rainfall detected - monitor soil moisture before next watering');
        }
        if (weatherData.current.temperature > 35) {
          recommendations.relatedActions.push('High temperature alert - consider early morning or late evening watering');
        }
        // Add market insights if available
        if (agentRecommendations.market) {
          recommendations.marketTips.push('Market update: Check current crop prices for harvest timing');
        }
        break;

      case 'market':
        recommendations.relatedActions.push(
          'Connect with local farmer groups for bulk selling',
          'Explore direct-to-consumer sales channels'
        );
        // Add irrigation advice if available
        if (agentRecommendations.irrigation && agentRecommendations.irrigation.moistureLevel.includes('Low')) {
          recommendations.relatedActions.push('Irrigation needed: Ensure crops are well-watered before harvest');
        }
        break;

      case 'scheme':
        recommendations.relatedActions.push(
          'Consult with local agriculture officer for scheme guidance',
          'Maintain proper farming records for scheme eligibility'
        );
        break;
    }

    // Extract market insights from agent recommendations
    if (agentRecommendations.market) {
      recommendations.marketTips = extractMarketInsights(agentRecommendations.market);
    } else {
      recommendations.marketTips.push('Track local mandi prices for optimal selling decisions');
    }

    // Extract scheme recommendations from agent
    if (agentRecommendations.scheme) {
      recommendations.schemes = extractSchemeInsights(agentRecommendations.scheme);
    } else {
      recommendations.schemes.push(
        'Check eligibility for government schemes and subsidies',
        'Visit local agriculture office for scheme information'
      );
    }

    return {
      recommendations,
      profileBased: {
        crops: profile?.crops || profile?.cropsGrown || [],
        location: profile?.location || profile?.district || 'Not specified',
        farmSize: profile?.farmSize || profile?.landSize || 'Not specified'
      },
      irrigation: {
        shouldIrrigate: agentRecommendations.irrigation ? 
          agentRecommendations.irrigation.moistureLevel.includes('Low') : 
          weatherData.current.rainfall < 2,
        schedule: agentRecommendations.irrigation?.schedule || [
          weatherData.current.temperature > 35 ? 'Early morning (5:30-7:00 AM)' : 'Morning (6:00-8:00 AM)',
          'Evening (6:00-7:30 PM)'
        ],
        waterRequirement: agentRecommendations.irrigation?.waterRequirement || 
          `${Math.max(25 * (weatherData.current.temperature > 35 ? 1.3 : 1.0), 10).toFixed(0)} liters per square meter`,
        moistureLevel: agentRecommendations.irrigation?.moistureLevel || 
          (weatherData.current.rainfall > 10 ? 'High - Recent rainfall provides moisture' :
           weatherData.current.humidity < 50 ? 'Low - Irrigation needed' : 'Moderate'),
        weatherReasoning: `Based on current weather: ${weatherData.current.condition}, Temperature: ${weatherData.current.temperature.toFixed(1)}°C, Humidity: ${weatherData.current.humidity.toFixed(1)}%, Recent rainfall: ${weatherData.current.rainfall.toFixed(1)}mm`
      },
      weather: {
        current: {
          temperature: weatherData.current.temperature.toFixed(1) + '°C',
          condition: weatherData.current.condition,
          humidity: weatherData.current.humidity.toFixed(1) + '%',
          rainfall: weatherData.current.rainfall.toFixed(1) + 'mm'
        },
        forecast: weatherData.forecast.slice(0, 2).map(day => ({
          date: day.date,
          condition: day.condition,
          rainChance: day.precipitationProbability + '%'
        }))
      },
      recentActivityCount: recentInteractions.length
    };

  } catch (error) {
    console.error('Error generating contextual recommendations:', error);
    // Return basic recommendations if there's an error
    return {
      recommendations: {
        weatherAlerts: ['Monitor weather conditions for farming decisions'],
        cropCare: ['Maintain regular crop monitoring schedule'],
        marketTips: ['Stay updated with local market prices'],
        schemes: ['Check government schemes regularly'],
        relatedActions: ['Consider consulting with agriculture experts']
      },
      profileBased: {
        crops: [],
        location: 'Not specified',
        farmSize: 'Not specified'
      },
      irrigation: {
        shouldIrrigate: true,
        schedule: ['Morning (6:00-8:00 AM)', 'Evening (6:00-7:30 PM)'],
        waterRequirement: '25 liters per square meter (standard amount)',
        moistureLevel: 'Moderate - Regular irrigation schedule recommended',
        weatherReasoning: 'Weather data unavailable - follow standard irrigation practices'
      },
      weather: {
        current: { temperature: 'N/A', condition: 'N/A', humidity: 'N/A', rainfall: 'N/A' },
        forecast: []
      },
      recentActivityCount: 0
    };
  }
}

// Agent-driven helper functions (replacing hardcoded logic in queryHandler)

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

export async function queryHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uid, audioData, imageUrl, queryText } = req.body;

    if (!uid) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    let transcribedText = queryText || '';
    
    // Transcribe audio if provided
    if (audioData) {
      const audioBuffer = Buffer.from(audioData, 'base64');
      transcribedText = await transcribeAudio(audioBuffer, 'en-IN');
    }

    if (!transcribedText && !imageUrl) {
      res.status(400).json({ 
        error: 'Either voice query or image is required' 
      });
      return;
    }

    // Classify user intent using AI
    const intent = await classifyIntent(transcribedText, !!imageUrl);
    
    let response = '';
    let priority: 'low' | 'medium' | 'high' = 'medium';
    let additionalData: any = {};

    // Route to appropriate agent based on intent
    switch (intent) {
      case 'disease':
        const diseaseAgent = new DiseaseDiagnoserAgent();
        const diagnosis = await diseaseAgent.diagnose(uid, imageUrl, transcribedText);
        response = diagnosis.englishText;
        priority = diagnosis.urgency;
        additionalData = {
          treatment: diagnosis.treatment,
          cost: diagnosis.cost,
        };
        break;

      case 'irrigation':
        const irrigationAgent = new IrrigationAdvisorAgent();
        const irrigation = await irrigationAgent.getAdvice(uid, transcribedText);
        response = irrigation.englishText;
        additionalData = {
          waterSchedule: irrigation.schedule,
          soilMoisture: irrigation.moistureLevel,
        };
        break;

      case 'market':
        const marketAgent = new MarketAdvisorAgent();
        const market = await marketAgent.getMarketAdvice(uid, transcribedText);
        response = market.englishText;
        additionalData = {
          recommendation: market.recommendation,
          priceData: market.priceData,
        };
        break;

      case 'scheme':
        const schemeAgent = new SchemeRecommenderAgent();
        const scheme = await schemeAgent.getRecommendations(uid, transcribedText);
        response = scheme.englishText;
        additionalData = {
          eligibleSchemes: scheme.schemes,
        };
        break;

      default:
        response = 'I understand your farming question. Could you please be more specific about what you need help with? I can assist with crop diseases, irrigation, market prices, or government schemes.';
    }

    // Convert response to English audio
    const audioUrl = await synthesizeEnglishSpeech(response, uid);

    // Generate contextual recommendations based on the query and response
    const recommendationData = await generateContextualRecommendations(
      uid, 
      intent, 
      transcribedText, 
      additionalData
    );

    // Log the interaction in Firestore
    await logInteraction({
      uid,
      queryText: transcribedText,
      imageUrl: imageUrl || null,
      intent,
      response,
      audioUrl,
      priority,
      additionalData,
      timestamp: new Date()
    });

    res.json({
      // Primary response - the detailed answer to the user's query
      answer: {
        text: response,
        audioUrl,
        intent,
        priority,
        additionalData,
        timestamp: new Date().toISOString()
      },
      // Secondary response - personalized recommendations based on query and profile
      recommendations: {
        contextual: recommendationData.recommendations,
        profileBased: recommendationData.profileBased,
        recentActivityCount: recommendationData.recentActivityCount,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Query handler error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
