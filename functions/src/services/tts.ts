import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

const ttsClient = new TextToSpeechClient();

function getBucket() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin.storage().bucket();
}

export async function synthesizeEnglishSpeech(
  text: string,
  uid: string,
  voiceGender: 'MALE' | 'FEMALE' = 'FEMALE'
): Promise<string | null> {
  try {
    // Clean and prepare text for TTS
    const cleanText = text
      .replace(/[*_#]/g, '') // Remove markdown
      .replace(/\n+/g, '. ') // Replace newlines with periods
      .substring(0, 5000); // Limit text length

    const request = {
      input: { text: cleanText },
      voice: {
        languageCode: 'en-IN',
        name: `en-IN-Standard-${voiceGender === 'FEMALE' ? 'A' : 'B'}`,
        ssmlGender: voiceGender,
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
        speakingRate: 0.9,
        pitch: 0.0,
        volumeGainDb: 0.0,
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error('No audio content generated');
    }

    // Generate unique filename
    const fileName = `audio/${uid}/${Date.now()}_${uuidv4()}.mp3`;
    const bucket = getBucket();
    const file = bucket.file(fileName);
    
    // Upload to Firebase Storage
    await file.save(response.audioContent as Buffer, {
      metadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=3600',
      },
    });

    // Make file publicly accessible
    await file.makePublic();
    
    // Return public URL
    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  } catch (error) {
    console.error('Text-to-speech error:', error);
    return null; // Return null instead of throwing to handle gracefully
  }
}

// Alternative TTS with SSML support
export async function synthesizeSpeechWithSSML(
  ssmlText: string,
  uid: string,
  voiceType: 'standard' | 'wavenet' = 'standard'
): Promise<string> {
  try {
    const request = {
      input: { ssml: ssmlText },
      voice: {
        languageCode: 'en-IN',
        name: voiceType === 'wavenet' ? 'en-IN-Wavenet-A' : 'en-IN-Standard-A',
        ssmlGender: 'FEMALE' as const,
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
        effectsProfileId: ['telephony-class-application'],
        speakingRate: 0.85,
        pitch: -2.0,
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    
    const fileName = `audio/${uid}/ssml_${Date.now()}.mp3`;
    const bucket = getBucket();
    const file = bucket.file(fileName);
    
    await file.save(response.audioContent as Buffer, {
      metadata: { contentType: 'audio/mpeg' },
    });

    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  } catch (error) {
    console.error('SSML TTS error:', error);
    throw error;
  }
}

// Legacy compatibility
export const textToSpeechService = async (text: string, languageCode: string = 'en-IN', uid?: string): Promise<string | null> => {
  return synthesizeEnglishSpeech(text, uid || 'temp');
};

export const ttsService = {
  async textToSpeech(text: string, languageCode: string = 'en-IN'): Promise<string | null> {
    return synthesizeEnglishSpeech(text, 'temp');
  },
};
