import { SpeechClient, protos } from '@google-cloud/speech';

const client = new SpeechClient();

export async function transcribeAudio(
  audioBuffer: Buffer,
  languageCode: string = 'en-IN'
): Promise<string> {
  try {
    const request = {
      audio: {
        content: audioBuffer.toString('base64'),
      },
      config: {
        encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        sampleRateHertz: 16000,
        languageCode,
        enableAutomaticPunctuation: true,
        alternativeLanguageCodes: ['hi-IN', 'te-IN', 'ta-IN', 'kn-IN'],
      },
    };

    const [response] = await client.recognize(request);
    const transcription = response.results
      ?.map((result: any) => result.alternatives?.[0]?.transcript)
      .join('\n') || '';

    return transcription;
  } catch (error) {
    console.error('Speech-to-Text Error:', error);
    throw new Error('Failed to convert speech to text');
  }
};

export const sttService = {
  async speechToText(audioBuffer: Buffer, languageCode: string = 'en-IN'): Promise<string> {
    return transcribeAudio(audioBuffer, languageCode);
  },
};
