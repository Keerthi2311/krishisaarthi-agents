import { textModel } from '../config/gemini';

export type UserIntent = 'disease' | 'irrigation' | 'market' | 'scheme' | 'weather' | 'general';

export async function classifyIntent(
  queryText: string, 
  hasImage: boolean = false
): Promise<UserIntent> {
  try {
    // Rule-based classification first (faster and more reliable)
    const ruleBasedIntent = classifyByRules(queryText, hasImage);
    if (ruleBasedIntent !== 'general') {
      return ruleBasedIntent;
    }

    // Use AI for complex queries that don't match rules
    const classificationPrompt = `
TASK: Classify the farmer's query into one of these categories:
- disease: Questions about crop diseases, pests, plant health issues, dying plants
- irrigation: Questions about watering, water management, soil moisture, drought
- market: Questions about crop prices, selling, market trends, mandis, profit
- scheme: Questions about government schemes, subsidies, loans, benefits
- weather: Questions about rain, temperature, weather forecast, climate
- general: General farming questions not fitting above categories

Farmer's Query: "${queryText}"
Has Image: ${hasImage ? 'Yes' : 'No'}

RULES:
- If image is present and query mentions disease/problem symptoms → disease
- Price, selling, market related questions → market  
- Water, irrigation, watering questions → irrigation
- Government schemes, subsidies, loan questions → scheme
- Weather, rain, temperature questions → weather
- Everything else → general

Respond with ONLY the category name (disease/irrigation/market/scheme/weather/general).
No explanation needed.
`;

    const result = await textModel.generateContent(classificationPrompt);
    const aiResponse = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanResponse = aiResponse.trim().toLowerCase();
    
    const validIntents: UserIntent[] = ['disease', 'irrigation', 'market', 'scheme', 'weather', 'general'];
    const matchedIntent = validIntents.find(intent => cleanResponse.includes(intent));
    
    return matchedIntent || 'general';
  } catch (error) {
    console.error('Intent classification error:', error);
    // Fallback to rule-based classification
    return classifyByRules(queryText, hasImage);
  }
}

function classifyByRules(queryText: string, hasImage: boolean): UserIntent {
  const query = queryText.toLowerCase();
  
  // Disease keywords (English)
  const diseaseKeywords = [
    'disease', 'pest', 'infection', 'spot', 'dying', 'yellow', 'brown', 'sick',
    'bug', 'insect', 'fungus', 'rot', 'wilt', 'blight', 'leaf', 'stem', 'root',
    'damage', 'problem', 'issue', 'unhealthy', 'cure', 'treatment', 'medicine'
  ];
  
  // Market keywords
  const marketKeywords = [
    'price', 'sell', 'market', 'mandi', 'profit', 'cost', 'rate', 'money',
    'buy', 'selling', 'purchase', 'trade', 'dealer', 'buyer', 'export',
    'demand', 'supply', 'wholesale', 'retail', 'commission', 'transport'
  ];
  
  // Irrigation keywords  
  const irrigationKeywords = [
    'water', 'irrigation', 'watering', 'dry', 'moisture', 'drought', 'rain',
    'sprinkle', 'flood', 'drip', 'pump', 'well', 'bore', 'canal', 'reservoir',
    'wet', 'soil moisture', 'water management', 'water schedule'
  ];
  
  // Scheme keywords
  const schemeKeywords = [
    'scheme', 'subsidy', 'government', 'benefit', 'loan', 'support', 'grant',
    'policy', 'registration', 'application', 'eligibility', 'documentation',
    'pm kisan', 'credit', 'insurance', 'compensation', 'assistance'
  ];
  
  // Weather keywords
  const weatherKeywords = [
    'weather', 'rain', 'temperature', 'climate', 'forecast', 'humidity',
    'wind', 'storm', 'drought', 'flood', 'season', 'monsoon', 'winter',
    'summer', 'heat', 'cold', 'sunny', 'cloudy', 'precipitation'
  ];

  // Check for keywords in order of priority
  
  // If image is present and disease-related terms, prioritize disease
  if (hasImage && diseaseKeywords.some(keyword => query.includes(keyword))) {
    return 'disease';
  }
  
  // Check market keywords
  if (marketKeywords.some(keyword => query.includes(keyword))) {
    return 'market';
  }
  
  // Check irrigation keywords
  if (irrigationKeywords.some(keyword => query.includes(keyword))) {
    return 'irrigation';
  }
  
  // Check scheme keywords
  if (schemeKeywords.some(keyword => query.includes(keyword))) {
    return 'scheme';
  }
  
  // Check weather keywords
  if (weatherKeywords.some(keyword => query.includes(keyword))) {
    return 'weather';
  }
  
  // Check disease keywords (even without image)
  if (diseaseKeywords.some(keyword => query.includes(keyword))) {
    return 'disease';
  }
  
  return 'general';
}
