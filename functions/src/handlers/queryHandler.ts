import { Request, Response } from 'express';
import { DiseaseDiagnoserAgent } from '../agents/diseaseAgent';
import { IrrigationAdvisorAgent } from '../agents/irrigationAgent';
import { MarketAdvisorAgent } from '../agents/marketAgent';
import { SchemeRecommenderAgent } from '../agents/schemeAgent';
import { transcribeAudio } from '../services/stt';
import { synthesizeEnglishSpeech } from '../services/tts';
import { classifyIntent } from '../services/classifier';
import { logInteraction, firestoreService } from '../services/firestore';

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

    // Base recommendations structure
    const recommendations = {
      weatherAlerts: [] as string[],
      cropCare: [] as string[],
      marketTips: [] as string[],
      schemes: [] as string[],
      relatedActions: [] as string[]
    };

    // Generate contextual recommendations based on the query intent and response
    switch (intent) {
      case 'disease':
        recommendations.cropCare.push(
          'Monitor your crops daily for early disease detection',
          'Maintain proper plant spacing to prevent disease spread'
        );
        recommendations.relatedActions.push(
          'Consider organic pesticides for long-term crop health',
          'Schedule regular soil testing to prevent nutrient deficiency'
        );
        if (responseData.treatment) {
          recommendations.relatedActions.push(`Follow up on the ${responseData.treatment} treatment in 3-5 days`);
        }
        break;

      case 'irrigation':
        recommendations.cropCare.push(
          'Check soil moisture levels before watering',
          'Install drip irrigation for water efficiency'
        );
        recommendations.weatherAlerts.push('Monitor weather forecast for irrigation planning');
        if (responseData.waterSchedule) {
          recommendations.relatedActions.push('Set reminders for your irrigation schedule');
        }
        break;

      case 'market':
        recommendations.marketTips.push(
          'Track price trends for better selling decisions',
          'Consider value addition to increase profits'
        );
        recommendations.relatedActions.push(
          'Connect with local farmer groups for bulk selling',
          'Explore direct-to-consumer sales channels'
        );
        break;

      case 'scheme':
        recommendations.schemes.push(
          'Keep all farming documents ready for scheme applications',
          'Subscribe to government notifications for new schemes'
        );
        recommendations.relatedActions.push(
          'Consult with local agriculture officer for scheme guidance',
          'Maintain proper farming records for scheme eligibility'
        );
        break;
    }

    // Add general recommendations based on user profile and season
    if (profile?.crops && profile.crops.length > 0) {
      recommendations.cropCare.push(`Focus on ${profile.crops[0]} specific care during this season`);
    }

    // Add weather-based recommendations
    recommendations.weatherAlerts.push(
      'Check 7-day weather forecast for farming activities',
      'Prepare for seasonal changes in advance'
    );

    // Add scheme reminders
    recommendations.schemes.push(
      'PM-KISAN scheme verification deadline approaching',
      'Crop insurance enrollment period is active'
    );

    return {
      recommendations,
      profileBased: {
        crops: profile?.crops || [],
        location: profile?.location || 'Not specified',
        farmSize: profile?.farmSize || 'Not specified'
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
      recentActivityCount: 0
    };
  }
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
