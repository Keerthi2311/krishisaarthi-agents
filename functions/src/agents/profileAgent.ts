import { Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { FarmerProfile } from '../types';

export class ProfileContextAgent {
  private db = getFirestore();

  async fetchUserProfile(uid: string): Promise<FarmerProfile | null> {
    try {
      const doc = await this.db.collection('users').doc(uid).get();
      if (doc.exists) {
        return doc.data() as FarmerProfile;
      }
      return null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  }

  generateContextPrompt(profile: FarmerProfile): string {
    const crops = profile.cropsGrown || [];
    const cropsText = crops.length > 0 ? crops.join(', ') : 'mixed crops';
    
    return `
FARMER PROFILE CONTEXT:
- Name: ${profile.fullName || 'Farmer'}
- Location: ${profile.district || 'Karnataka'}, Karnataka, India
- Farm Size: ${profile.landSize || 1} ${profile.landUnit || 'acres'}
- Soil Type: ${profile.soilType || 'mixed'}
- Primary Crops: ${cropsText}
- Farming Experience: ${profile.farmingExperience || 1} years
- Irrigation Method: ${profile.irrigationType || 'traditional'}

INSTRUCTIONS:
- Provide advice specifically tailored to this farmer's profile
- Consider their specific crops, soil type, and location
- Address them respectfully and personally
- Make recommendations practical for their farm size and experience level
- Consider local conditions in ${profile.district || 'Karnataka'} district of Karnataka
- Give advice in clear, practical English suitable for farmers
`;
  }

  async updateProfile(uid: string, profileData: Partial<FarmerProfile>): Promise<FarmerProfile> {
    try {
      const existingProfile = await this.fetchUserProfile(uid);
      const updatedProfile: FarmerProfile = {
        ...existingProfile,
        ...profileData,
        userId: uid,
        updatedAt: new Date(),
      } as FarmerProfile;

      await this.db.collection('users').doc(uid).set(updatedProfile, { merge: true });
      return updatedProfile;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }
}

export const profileAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, profileData } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const profileService = new ProfileContextAgent();
    const profile = await profileService.updateProfile(userId, profileData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile,
    });
  } catch (error) {
    console.error('Profile Agent Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
