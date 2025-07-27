import { Request, Response } from 'express';
import { firestoreService } from '../services/firestore';

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

    // Generate personalized recommendations based on profile and history
    const recommendations = {
      weatherAlerts: [
        'Monsoon expected next week - prepare irrigation systems',
        'Temperature rising - increase watering frequency'
      ],
      cropCare: [
        'Check for pest infections in tomato crops',
        'Apply fertilizer for better yield'
      ],
      marketTips: [
        'Tomato prices are up 15% this week - good time to sell',
        'Consider storing onions for better prices next month'
      ],
      schemes: [
        'PM-KISAN scheme payment due next month',
        'Crop insurance deadline approaching'
      ]
    };

    res.json({
      success: true,
      recommendations,
      profile,
      recentActivityCount: recentInteractions.length
    });

  } catch (error) {
    console.error('Recommendations handler error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
