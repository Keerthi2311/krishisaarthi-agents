import { VertexAI, HarmCategory, HarmBlockThreshold, GenerativeModel, SafetySetting } from '@google-cloud/vertexai';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { GeminiResponse } from '../types';

export class GeminiService {
  private vertexAI: VertexAI;
  private textModel: GenerativeModel | null = null;
  private visionModel: GenerativeModel | null = null;
  private readonly projectId: string;
  private readonly location: string;
  private readonly defaultSafetySettings: SafetySetting[];

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id';
    this.location = process.env.VERTEX_AI_LOCATION || 'us-central1';
    
    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: this.location,
    });

    this.defaultSafetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];

    this.initializeModels();
  }

  private async initializeModels(): Promise<void> {
    try {
      // Initialize text model (Gemini Pro)
      this.textModel = this.vertexAI.getGenerativeModel({
        model: 'gemini-1.5-pro-001',
        safetySettings: this.defaultSafetySettings,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
        },
      });

      // Initialize vision model (Gemini Pro Vision)
      this.visionModel = this.vertexAI.getGenerativeModel({
        model: 'gemini-1.5-pro-vision-001',
        safetySettings: this.defaultSafetySettings,
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.4,
          topP: 0.8,
          topK: 32,
        },
      });

      logger.info('Gemini models initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gemini models:', error);
      throw new Error('Gemini service initialization failed');
    }
  }

  async generateTextResponse(
    prompt: string,
    systemInstruction?: string,
    customSafetySettings?: SafetySetting[]
  ): Promise<GeminiResponse> {
    try {
      if (!this.textModel) {
        throw new Error('Text model not initialized');
      }

      const enhancedPrompt = systemInstruction 
        ? `${systemInstruction}\n\nUser Query: ${prompt}`
        : prompt;

      const request = {
        contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
        safetySettings: customSafetySettings || this.defaultSafetySettings,
      };

      const result = await this.textModel.generateContent(request);
      const response = await result.response;

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response candidates received from Gemini');
      }

      const candidate = response.candidates[0];
      
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('Invalid response structure from Gemini');
      }

      const text = candidate.content.parts[0].text || '';

      return {
        text,
        finishReason: candidate.finishReason || 'STOP',
        safetyRatings: candidate.safetyRatings?.map(rating => ({
          category: rating.category?.toString() || 'UNKNOWN',
          probability: rating.probability?.toString() || 'UNKNOWN',
        })) || [],
        usageMetadata: {
          promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
          candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokenCount: response.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      logger.error('Error generating text response:', error);
      throw new Error(`Failed to generate text response: ${error}`);
    }
  }

  async generateVisionResponse(
    prompt: string,
    imageUrl: string,
    systemInstruction?: string,
    customSafetySettings?: SafetySetting[]
  ): Promise<GeminiResponse> {
    try {
      if (!this.visionModel) {
        throw new Error('Vision model not initialized');
      }

      // Download image from URL
      const imageData = await this.downloadImageAsBase64(imageUrl);
      
      const enhancedPrompt = systemInstruction 
        ? `${systemInstruction}\n\nUser Query: ${prompt}`
        : prompt;

      const request = {
        contents: [{
          role: 'user',
          parts: [
            { text: enhancedPrompt },
            {
              inlineData: {
                mimeType: this.getMimeTypeFromUrl(imageUrl),
                data: imageData,
              },
            },
          ],
        }],
        safetySettings: customSafetySettings || this.defaultSafetySettings,
      };

      const result = await this.visionModel.generateContent(request);
      const response = await result.response;

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response candidates received from Gemini Vision');
      }

      const candidate = response.candidates[0];
      
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('Invalid response structure from Gemini Vision');
      }

      const text = candidate.content.parts[0].text || '';

      return {
        text,
        finishReason: candidate.finishReason || 'STOP',
        safetyRatings: candidate.safetyRatings?.map(rating => ({
          category: rating.category?.toString() || 'UNKNOWN',
          probability: rating.probability?.toString() || 'UNKNOWN',
        })) || [],
        usageMetadata: {
          promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
          candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokenCount: response.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      logger.error('Error generating vision response:', error);
      throw new Error(`Failed to generate vision response: ${error}`);
    }
  }

  async generateStreamingResponse(
    prompt: string,
    systemInstruction?: string,
    customSafetySettings?: SafetySetting[]
  ): Promise<AsyncIterable<GeminiResponse>> {
    try {
      if (!this.textModel) {
        throw new Error('Text model not initialized');
      }

      const enhancedPrompt = systemInstruction 
        ? `${systemInstruction}\n\nUser Query: ${prompt}`
        : prompt;

      const request = {
        contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
        safetySettings: customSafetySettings || this.defaultSafetySettings,
      };

      const streamResult = await this.textModel.generateContentStream(request);

      async function* streamGenerator(): AsyncIterable<GeminiResponse> {
        for await (const chunk of streamResult.stream) {
          if (chunk.candidates && chunk.candidates.length > 0) {
            const candidate = chunk.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
              const text = candidate.content.parts[0].text || '';
              yield {
                text,
                finishReason: candidate.finishReason || 'STOP',
                safetyRatings: candidate.safetyRatings?.map(rating => ({
                  category: rating.category?.toString() || 'UNKNOWN',
                  probability: rating.probability?.toString() || 'UNKNOWN',
                })) || [],
                usageMetadata: {
                  promptTokenCount: 0,
                  candidatesTokenCount: 0,
                  totalTokenCount: 0,
                },
              };
            }
          }
        }
      }

      return streamGenerator();
    } catch (error) {
      logger.error('Error generating streaming response:', error);
      throw new Error(`Failed to generate streaming response: ${error}`);
    }
  }

  async generateMultiTurnResponse(
    messages: Array<{ role: 'user' | 'model'; content: string }>,
    systemInstruction?: string,
    customSafetySettings?: SafetySetting[]
  ): Promise<GeminiResponse> {
    try {
      if (!this.textModel) {
        throw new Error('Text model not initialized');
      }

      const contents = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      }));

      if (systemInstruction) {
        contents.unshift({
          role: 'user',
          parts: [{ text: systemInstruction }],
        });
      }

      const request = {
        contents,
        safetySettings: customSafetySettings || this.defaultSafetySettings,
      };

      const result = await this.textModel.generateContent(request);
      const response = await result.response;

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response candidates received from Gemini');
      }

      const candidate = response.candidates[0];
      
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('Invalid response structure from Gemini');
      }

      const text = candidate.content.parts[0].text || '';

      return {
        text,
        finishReason: candidate.finishReason || 'STOP',
        safetyRatings: candidate.safetyRatings?.map(rating => ({
          category: rating.category?.toString() || 'UNKNOWN',
          probability: rating.probability?.toString() || 'UNKNOWN',
        })) || [],
        usageMetadata: {
          promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
          candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokenCount: response.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      logger.error('Error generating multi-turn response:', error);
      throw new Error(`Failed to generate multi-turn response: ${error}`);
    }
  }

  async analyzeImageWithPrompt(
    imageUrl: string,
    analysisPrompt: string,
    detailedAnalysis: boolean = false
  ): Promise<GeminiResponse> {
    const systemInstruction = detailedAnalysis
      ? `You are an expert agricultural AI assistant. Provide detailed analysis of the provided image focusing on:
         1. Plant health assessment
         2. Disease or pest identification
         3. Growth stage analysis
         4. Environmental conditions
         5. Actionable recommendations
         Be specific, accurate, and provide practical advice.`
      : `You are an agricultural AI assistant. Analyze the provided image and give concise, practical advice.`;

    return this.generateVisionResponse(analysisPrompt, imageUrl, systemInstruction);
  }

  async generateJsonResponse<T>(
    prompt: string,
    schema: Record<string, any>,
    systemInstruction?: string
  ): Promise<T> {
    try {
      const jsonPrompt = `${prompt}\n\nPlease respond with valid JSON that matches this schema:\n${JSON.stringify(schema, null, 2)}\n\nResponse:`;
      
      const response = await this.generateTextResponse(jsonPrompt, systemInstruction);
      
      // Extract JSON from response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch (parseError) {
        logger.error('Failed to parse JSON response:', parseError);
        throw new Error('Invalid JSON in response');
      }
    } catch (error) {
      logger.error('Error generating JSON response:', error);
      throw new Error(`Failed to generate JSON response: ${error}`);
    }
  }

  private async downloadImageAsBase64(imageUrl: string): Promise<string> {
    try {
      // Check if it's a Firebase Storage URL
      if (imageUrl.includes('firebasestorage.googleapis.com')) {
        const bucket = admin.storage().bucket();
        const fileName = this.extractFileNameFromUrl(imageUrl);
        const file = bucket.file(fileName);
        
        const [buffer] = await file.download();
        return buffer.toString('base64');
      } else {
        // External URL - use fetch
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return buffer.toString('base64');
      }
    } catch (error) {
      logger.error('Error downloading image:', error);
      throw new Error(`Failed to download image: ${error}`);
    }
  }

  private extractFileNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      return pathParts[pathParts.length - 1];
    } catch (error) {
      throw new Error('Invalid image URL format');
    }
  }

  private getMimeTypeFromUrl(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'bmp':
        return 'image/bmp';
      default:
        return 'image/jpeg'; // Default fallback
    }
  }

  async getModelInfo(): Promise<{ textModel: string; visionModel: string; location: string; projectId: string }> {
    return {
      textModel: 'gemini-1.5-pro-001',
      visionModel: 'gemini-1.5-pro-vision-001',
      location: this.location,
      projectId: this.projectId,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.generateTextResponse('Hello, are you working?');
      return response.text.length > 0;
    } catch (error) {
      logger.error('Gemini health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const geminiService = new GeminiService();
