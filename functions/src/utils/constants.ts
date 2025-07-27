// App-wide constants
export const APP_CONFIG = {
  PROJECT_ID: 'krishisaarathi',
  REGION: 'us-central1',
  SUPPORTED_LANGUAGES: ['en', 'hi', 'te', 'ta', 'kn', 'ml'],
  DEFAULT_LANGUAGE: 'en',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/wav'],
} as const;

export const FIRESTORE_COLLECTIONS = {
  USERS: 'users',
  INTERACTIONS: 'interactions',
  DAILY_SUMMARIES: 'dailySummaries',
  FEEDBACK: 'feedback',
} as const;

export const INTENT_TYPES = {
  DISEASE: 'disease',
  IRRIGATION: 'irrigation',
  MARKET: 'market',
  SCHEME: 'scheme',
  GENERAL: 'general',
} as const;

export const CROP_TYPES = [
  'rice', 'wheat', 'cotton', 'sugarcane', 'tomato', 'potato', 
  'onion', 'maize', 'barley', 'soybean', 'groundnut', 'sunflower',
  'mustard', 'jowar', 'bajra', 'ragi', 'pulses', 'chili', 'turmeric',
  'ginger', 'garlic', 'cabbage', 'cauliflower', 'brinjal', 'okra'
] as const;

export const LANGUAGE_CODES = {
  ENGLISH: 'en-IN',
  HINDI: 'hi-IN',
  TELUGU: 'te-IN',
  TAMIL: 'ta-IN',
  KANNADA: 'kn-IN',
  MALAYALAM: 'ml-IN',
} as const;

export const ERROR_MESSAGES = {
  INVALID_REQUEST: 'Invalid request parameters',
  USER_NOT_FOUND: 'User not found',
  UNAUTHORIZED: 'Unauthorized access',
  INTERNAL_ERROR: 'Internal server error',
  FILE_TOO_LARGE: 'File size exceeds limit',
  INVALID_FILE_TYPE: 'Invalid file type',
  GEMINI_ERROR: 'AI service temporarily unavailable',
  DATABASE_ERROR: 'Database operation failed',
} as const;
