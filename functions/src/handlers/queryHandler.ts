import { Request, Response } from 'express';
import { DiseaseDiagnoserAgent } from '../agents/diseaseAgent';
import { IrrigationAdvisorAgent } from '../agents/irrigationAgent';
import { MarketAdvisorAgent } from '../agents/marketAgent';
import { SchemeRecommenderAgent } from '../agents/schemeAgent';
import { transcribeAudio } from '../services/stt';
import { synthesizeEnglishSpeech } from '../services/tts';
import { classifyIntent } from '../services/classifier';
import { logInteraction } from '../services/firestore';

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
      text: response,
      audioUrl,
      intent,
      priority,
      additionalData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Query handler error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
