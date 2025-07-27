import { Request, Response } from 'express';
import { textModel } from '../config/gemini';
import { ProfileContextAgent } from './profileAgent';
import { FarmerProfile } from '../types';

export class SchemeRecommenderAgent {
  private profileAgent = new ProfileContextAgent();

  async getRecommendations(uid: string, query?: string): Promise<{
    recommendations: string;
    englishText: string;
    schemes: any[];
  }> {
    try {
      const profile = await this.profileAgent.fetchUserProfile(uid);
      if (!profile) throw new Error('User profile not found');

      // Get available schemes (mock implementation)
      const availableSchemes = await this.fetchAvailableSchemes();
      
      const contextPrompt = this.profileAgent.generateContextPrompt(profile);
      
      const schemePrompt = `
${contextPrompt}

TASK: Recommend relevant government schemes and subsidies for this farmer.

${query ? `Farmer's Query: "${query}"` : ''}

AVAILABLE SCHEMES AND PROGRAMS:
${JSON.stringify(availableSchemes, null, 2)}

ELIGIBILITY ANALYSIS:
Based on the farmer's profile, analyze their eligibility for various schemes considering:
- Farm size: ${profile.landSize} ${profile.landUnit}
- Crops grown: ${profile.cropsGrown.join(', ')}
- Location: ${profile.district}, Karnataka
- Experience level: ${profile.farmingExperience} years

RESPONSE FORMAT:
Provide comprehensive scheme recommendations covering:
- Top 3-5 schemes they are eligible for
- Specific benefits of each scheme
- Application process and required documents
- Deadlines and important dates
- Contact information for applications
- Estimated benefit amounts
- Tips for successful application

For each recommended scheme, include:
- Scheme name and brief description
- Exact benefit amount or percentage
- Eligibility criteria they meet
- Step-by-step application process
- Required documents checklist
- Where to apply (online links, office addresses)
- Timeline for approval and disbursement

Be practical and actionable - focus on schemes they can actually apply for and benefit from.
`;

      const result = await textModel.generateContent(schemePrompt);
      const response = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Filter schemes based on eligibility
      const eligibleSchemes = this.filterEligibleSchemes(availableSchemes, profile);

      return {
        recommendations: response,
        englishText: response,
        schemes: eligibleSchemes,
      };
    } catch (error) {
      console.error('Scheme recommendations error:', error);
      throw error;
    }
  }

  private async fetchAvailableSchemes() {
    // Mock schemes data - replace with real government schemes API
    return [
      {
        id: 'pm-kisan',
        name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
        description: 'Income support scheme for small and marginal farmers',
        benefit: '₹6,000 per year in three installments',
        eligibility: {
          landSize: { max: 2, unit: 'hectares' },
          farmerType: ['small', 'marginal']
        },
        applicationLink: 'https://pmkisan.gov.in',
        documents: ['Aadhaar Card', 'Land Records', 'Bank Account Details']
      },
      {
        id: 'raitha-bandhu',
        name: 'Raitha Bandhu (Karnataka)',
        description: 'Investment support scheme for farmers in Karnataka',
        benefit: '₹10,000 per hectare per season',
        eligibility: {
          landSize: { max: 10, unit: 'hectares' },
          state: 'Karnataka'
        },
        applicationLink: 'https://raitamitra.karnataka.gov.in',
        documents: ['Land Records', 'Aadhaar Card', 'Bank Passbook']
      },
      {
        id: 'soil-health-card',
        name: 'Soil Health Card Scheme',
        description: 'Free soil testing and nutrient recommendations',
        benefit: 'Free soil testing worth ₹500-1000',
        eligibility: {
          farmerType: 'all'
        },
        applicationLink: 'https://soilhealth.dac.gov.in',
        documents: ['Land Records', 'Aadhaar Card']
      },
      {
        id: 'kisan-credit-card',
        name: 'Kisan Credit Card (KCC)',
        description: 'Credit support for farming expenses',
        benefit: 'Credit up to ₹3 lakhs at subsidized interest rates',
        eligibility: {
          landSize: { min: 0.1, unit: 'hectares' }
        },
        applicationLink: 'Contact nearest bank branch',
        documents: ['Land Records', 'Aadhaar Card', 'PAN Card', 'Bank Statements']
      }
    ];
  }

  private filterEligibleSchemes(schemes: any[], profile: FarmerProfile): any[] {
    return schemes.filter(scheme => {
      // Check land size eligibility
      if (scheme.eligibility.landSize) {
        const profileLandInHectares = profile.landUnit === 'acres' 
          ? profile.landSize * 0.4047 
          : profile.landSize;
          
        if (scheme.eligibility.landSize.max && profileLandInHectares > scheme.eligibility.landSize.max) {
          return false;
        }
        if (scheme.eligibility.landSize.min && profileLandInHectares < scheme.eligibility.landSize.min) {
          return false;
        }
      }
      
      // Check state eligibility
      if (scheme.eligibility.state && scheme.eligibility.state !== 'Karnataka') {
        return false;
      }
      
      return true;
    });
  }

  async getPersonalizedRecommendations(uid: string): Promise<any[]> {
    try {
      await this.getRecommendations(uid);
      return [
        'Apply for eligible government schemes',
        'Keep required documents ready',
        'Monitor scheme application deadlines'
      ];
    } catch (error) {
      console.error('Error getting scheme recommendations:', error);
      return [];
    }
  }
}

export const schemeAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, query } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const agent = new SchemeRecommenderAgent();
    const recommendations = await agent.getRecommendations(userId, query);

    res.json({
      success: true,
      recommendations,
    });
  } catch (error) {
    console.error('Scheme Agent Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
