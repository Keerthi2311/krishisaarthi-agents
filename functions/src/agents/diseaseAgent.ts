import { Request, Response } from 'express';
import { textModel } from '../config/gemini';
import { ProfileContextAgent } from './profileAgent';

export class DiseaseDiagnoserAgent {
  private profileAgent = new ProfileContextAgent();

  async diagnose(
    uid: string,
    imageUrl: string | undefined,
    voiceQuery: string
  ): Promise<{
    diagnosis: string;
    englishText: string;
    urgency: 'low' | 'medium' | 'high';
    treatment: string[];
    cost: string;
  }> {
    try {
      const profile = await this.profileAgent.fetchUserProfile(uid);
      if (!profile) throw new Error('User profile not found');

      const contextPrompt = this.profileAgent.generateContextPrompt(profile);
      
      const crops = profile.cropsGrown || [];
      const cropsText = crops.length > 0 ? crops.join(', ') : 'mixed crops';
      
      const diseasePrompt = `
${contextPrompt}

TASK: ${imageUrl ? 'Analyze the crop image for disease diagnosis and provide treatment advice.' : 'Provide disease diagnosis and treatment advice based on the farmer\'s description.'}

${imageUrl ? `Image URL: ${imageUrl}` : 'No image provided - diagnosis based on text description only.'}
Farmer's Query: "${voiceQuery}"

INSTRUCTIONS:
1. ${imageUrl ? 'Examine the image carefully for any disease symptoms, pests, or plant health issues' : 'Analyze the farmer\'s description for potential disease symptoms, pests, or plant health issues'}
2. Consider the farmer's specific crops (${cropsText}) and location (${profile.district || 'Karnataka'})
3. Provide detailed analysis including:
   - Disease identification (if any)
   - Severity assessment (low/medium/high)
   - Specific treatment recommendations
   - Cost estimates for treatments
   - Prevention strategies for future

RESPONSE FORMAT:
Provide a comprehensive response in clear English covering:
- What disease/problem you identified${imageUrl ? ' from the image and description' : ' from the description'}
- Immediate actions the farmer should take
- Specific treatments and chemicals needed
- Where to purchase treatments locally
- Expected treatment costs
- Timeline for recovery
- Prevention tips

If no disease is visible, provide general crop health assessment and maintenance advice.
Be practical and specific - mention exact product names, application methods, and dosages where applicable.
`;

      let response: string;
      
      if (imageUrl) {
        // For vision model with image, use text model for now
        const result = await textModel.generateContent(diseasePrompt);
        response = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        const result = await textModel.generateContent(diseasePrompt);
        response = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      // Parse response for structured data
      const urgency = this.extractUrgency(response);
      const treatment = this.extractTreatments(response);
      const cost = this.extractCost(response);

      return {
        diagnosis: response,
        englishText: response,
        urgency,
        treatment,
        cost,
      };
    } catch (error) {
      console.error('Disease diagnosis error:', error);
      throw error;
    }
  }

  private extractUrgency(response: string): 'low' | 'medium' | 'high' {
    const lowerResponse = response.toLowerCase();
    const highKeywords = ['urgent', 'immediate', 'severe', 'critical', 'emergency'];
    const lowKeywords = ['minor', 'slight', 'preventive', 'maintenance', 'routine'];
    
    if (highKeywords.some(keyword => lowerResponse.includes(keyword))) {
      return 'high';
    }
    if (lowKeywords.some(keyword => lowerResponse.includes(keyword))) {
      return 'low';
    }
    return 'medium';
  }

  private extractTreatments(response: string): string[] {
    const treatments: string[] = [];
    const lines = response.split('\n');
    
    lines.forEach(line => {
      if (line.includes('spray') || line.includes('apply') || line.includes('use')) {
        treatments.push(line.trim());
      }
    });
    
    return treatments.length > 0 ? treatments : ['Follow the detailed recommendations above'];
  }

  private extractCost(response: string): string {
    const costMatch = response.match(/₹[\d,]+|cost.*₹[\d,]+|price.*₹[\d,]+/i);
    return costMatch ? costMatch[0] : 'Cost varies based on farm size and severity';
  }
}

export const diseaseAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, query, imageUrl } = req.body;

    if (!userId || !query) {
      res.status(400).json({ error: 'User ID and query are required' });
      return;
    }

    const agent = new DiseaseDiagnoserAgent();
    const diagnosis = await agent.diagnose(userId, imageUrl, query);

    res.json({
      success: true,
      analysis: diagnosis,
    });
  } catch (error) {
    console.error('Disease Agent Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
