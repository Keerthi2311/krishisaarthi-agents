import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCLOUD_PROJECT || 'krishisaarathi';
const LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
});

// FIXED: Use available models in 2025
// Text model for general queries
export const textModel = vertexAI.preview.getGenerativeModel({
  model: 'gemini-2.5-flash', // Changed from gemini-2.5-pro (not available for new projects)
  generationConfig: {
    maxOutputTokens: 2048,
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});

// FIXED: Vision model for image analysis (using same model for consistency)
export const visionModel = vertexAI.preview.getGenerativeModel({
  model: 'gemini-2.5-flash', // Changed from gemini-1.5-pro (not available for new projects)
  generationConfig: {
    maxOutputTokens: 2048,
    temperature: 0.4,
    topP: 0.8,
    topK: 32,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});

// Alternative: Create a function to get model with fallback options
export const getAvailableModel = async (preferVision = false) => {
  const modelPriority = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite', 
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
  ];

  for (const modelName of modelPriority) {
    try {
      const model = vertexAI.preview.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: preferVision ? 0.4 : 0.7,
          topP: 0.8,
          topK: preferVision ? 32 : 40,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });
      
      // Test if model is accessible (optional)
      console.log(`Using model: ${modelName}`);
      return model;
    } catch (error) {
      console.log(`Model ${modelName} not available, trying next...`);
      continue;
    }
  }
  
  throw new Error('No Gemini models available in your project');
};

export { PROJECT_ID, LOCATION };
export default vertexAI;