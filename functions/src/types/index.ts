// TypeScript interfaces and types

export interface FarmerProfile {
  userId: string;
  fullName: string;
  district: string;
  landSize: number;
  landUnit: 'acres' | 'hectares';
  soilType: string;
  cropsGrown: string[];
  farmingExperience: number;
  irrigationType: string;
  phoneNumber?: string;
  language: string;
  preferences: {
    audioNotifications?: boolean;
    dailySummary?: boolean;
    marketAlerts?: boolean;
  };
  createdAt?: Date;
  updatedAt: Date;
}

export interface UserProfile {
  userId: string;
  farmLocation?: string;
  cropTypes: string[];
  farmSize?: string;
  language: string;
  preferences: {
    audioNotifications?: boolean;
    dailySummary?: boolean;
    marketAlerts?: boolean;
  };
  createdAt?: Date;
  updatedAt: Date;
}

export interface Interaction {
  type: 'disease' | 'irrigation' | 'market' | 'scheme' | 'general';
  query: string;
  response: string;
  timestamp: Date;
  metadata?: {
    imageUrl?: string;
    audioUrl?: string;
    confidence?: number;
    processingTime?: number;
  };
}

export interface DailySummary {
  summary: string;
  audioUrl?: string | null;
  date: string; // YYYY-MM-DD format
  createdAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface GeminiAnalysisParams {
  query: string;
  imageUrl?: string;
  cropType?: string;
  location?: string;
  language?: string;
  soilType?: string;
  cropStage?: string;
  farmSize?: string;
  schemeType?: string;
}

export interface ClassificationResult {
  intent: string;
  confidence: number;
  extractedEntities: {
    cropType?: string;
    location?: string;
    diseaseType?: string;
  };
}

export interface AudioProcessingResult {
  transcription: string;
  language: string;
  confidence: number;
  duration: number;
}

export interface FileUploadResult {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface WeatherData {
  location: string;
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  conditions: string;
  forecast: {
    date: string;
    temperature: { min: number; max: number };
    conditions: string;
    rainfall: number;
  }[];
}

export interface MarketPrice {
  commodity: string;
  variety?: string;
  market: string;
  price: number;
  unit: string;
  date: string;
  trend: 'up' | 'down' | 'stable';
}

export interface GovernmentScheme {
  name: string;
  description: string;
  eligibility: string[];
  benefits: string[];
  applicationProcess: string;
  documents: string[];
  deadline?: string;
  contactInfo: {
    office: string;
    phone?: string;
    email?: string;
    website?: string;
  };
}

export type SupportedLanguage = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'ml';
export type IntentType = 'disease' | 'irrigation' | 'market' | 'scheme' | 'general';
export type CropType = 'rice' | 'wheat' | 'cotton' | 'sugarcane' | 'tomato' | 'potato' | 'onion' | string;
export type FarmSize = 'small' | 'medium' | 'large';
export type SoilType = 'clay' | 'sandy' | 'loamy' | 'black' | 'red' | 'alluvial';
export type CropStage = 'sowing' | 'germination' | 'vegetative' | 'flowering' | 'fruiting' | 'harvesting';

// Gemini AI Types
export interface GeminiResponse {
  text: string;
  finishReason: string;
  safetyRatings: SafetyRating[];
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface SafetyRating {
  category: string;
  probability: string;
}

export interface SafetySetting {
  category: string;
  threshold: string;
}

export type SafetySettings = SafetySetting[];

export interface GenerativeModel {
  generateContent: (request: any) => Promise<any>;
  generateContentStream: (request: any) => Promise<any>;
}

export interface TextOnlyInput {
  text: string;
}
