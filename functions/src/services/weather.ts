// Types for weather data
export interface WeatherCondition {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  pressure: number;
  uvIndex: number;
  cloudCover: number;
  condition: string; // sunny, cloudy, rainy, etc.
}

export interface WeatherForecast {
  date: string;
  temperature: {
    min: number;
    max: number;
    average: number;
  };
  rainfall: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  precipitationProbability: number;
}

export interface WeatherData {
  current: WeatherCondition;
  forecast: WeatherForecast[];
  location: {
    district: string;
    latitude: number;
    longitude: number;
  };
  lastUpdated: string;
}

export class WeatherService {
  private apiKey: string;
  private baseUrl = 'https://weather.googleapis.com/v1'; // Correct Google Weather API

  constructor() {
    // Use the Google Weather API key correctly
    this.apiKey = process.env.GOOGLE_WEATHER_API_KEY || '';
    
    console.log('WeatherService initialized - Using Google Weather API for real weather data');
    console.log('API Key status:', this.apiKey ? 'LOADED' : 'MISSING');
    console.log('API Key length:', this.apiKey?.length || 0);
  }

  async getWeatherData(district: string, latitude?: number, longitude?: number): Promise<WeatherData> {
    try {
      console.log(`Getting weather data for ${district} with Google Weather API`);
      
      // Always try to get real weather data first with Google API
      if (this.apiKey && this.apiKey.length > 10) {
        try {
          // Get coordinates if not provided
          const coords = await this.getCoordinates(district, latitude, longitude);
          console.log(`Coordinates for ${district}:`, coords);
          
          // Use Google Weather API
          const currentResponse = await fetch(
            `${this.baseUrl}/currentConditions:lookup?location.latitude=${coords.latitude}&location.longitude=${coords.longitude}&key=${this.apiKey}`
          );
          
          if (currentResponse.ok) {
            const currentData = await currentResponse.json();
            console.log('Google Weather API current data received');
            
            // Get forecast data from Google Weather API
            const forecastResponse = await fetch(
              `${this.baseUrl}/forecast:lookup?location.latitude=${coords.latitude}&location.longitude=${coords.longitude}&key=${this.apiKey}`
            );
            
            let forecastData = null;
            if (forecastResponse.ok) {
              forecastData = await forecastResponse.json();
              console.log('Google Weather API forecast data received');
            }
            
            return this.parseGoogleWeatherData(currentData, forecastData, district, coords);
          } else {
            console.warn('Google Weather API call failed:', await currentResponse.text());
          }
        } catch (apiError) {
          console.error('Real weather API error:', apiError);
        }
      }
      
      // If API fails, use intelligent mock data based on location and season
      console.log('Using intelligent mock weather data for:', district);
      return this.getIntelligentMockWeatherData(district);

    } catch (error) {
      console.error('Weather data error:', error);
      return this.getIntelligentMockWeatherData(district);
    }
  }

  private async getCoordinates(district: string, lat?: number, lng?: number): Promise<{latitude: number, longitude: number}> {
    if (lat && lng) {
      return { latitude: lat, longitude: lng };
    }

    // District to coordinates mapping for Karnataka (can be extended)
    const districtCoords: { [key: string]: { latitude: number, longitude: number } } = {
      'bangalore': { latitude: 12.9716, longitude: 77.5946 },
      'mysore': { latitude: 12.2958, longitude: 76.6394 },
      'mangalore': { latitude: 12.9141, longitude: 74.8560 },
      'hubli': { latitude: 15.3647, longitude: 75.1240 },
      'belgaum': { latitude: 15.8497, longitude: 74.4977 },
      'davanagere': { latitude: 14.4644, longitude: 75.9218 },
      'bellary': { latitude: 15.1394, longitude: 76.9214 },
      'bijapur': { latitude: 16.8302, longitude: 75.7100 },
      'shimoga': { latitude: 13.9299, longitude: 75.5681 },
      'tumkur': { latitude: 13.3392, longitude: 77.1186 }
    };

    const key = district.toLowerCase().replace(/\s+/g, '');
    return districtCoords[key] || districtCoords['bangalore']; // Default to Bangalore
  }

  /* Unused legacy methods - keeping for future reference
  private async getCurrentWeather(latitude: number, longitude: number): Promise<WeatherCondition> {
    try {
      const response = await fetch(
        `${this.baseUrl}/current?location=${latitude},${longitude}&key=${this.apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        temperature: data.temperature || 25,
        humidity: data.humidity || 65,
        rainfall: data.precipitation || 0,
        windSpeed: data.windSpeed || 10,
        pressure: data.pressure || 1013,
        uvIndex: data.uvIndex || 5,
        cloudCover: data.cloudCover || 30,
        condition: data.condition || 'partly_cloudy'
      };

    } catch (error) {
      console.error('Current weather fetch error:', error);
      return this.getMockCurrentWeather();
    }
  }

  private async getWeatherForecast(latitude: number, longitude: number): Promise<WeatherForecast[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/forecast?location=${latitude},${longitude}&days=7&key=${this.apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Weather forecast API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.forecast?.map((day: any, index: number) => ({
        date: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        temperature: {
          min: day.temperature?.min || 18,
          max: day.temperature?.max || 32,
          average: day.temperature?.average || 25
        },
        rainfall: day.precipitation || 0,
        humidity: day.humidity || 65,
        windSpeed: day.windSpeed || 10,
        condition: day.condition || 'partly_cloudy',
        precipitationProbability: day.precipitationProbability || 0
      })) || this.getMockForecast();

    } catch (error) {
      console.error('Weather forecast fetch error:', error);
      return this.getMockForecast();
    }
  }
  End of unused legacy methods */

  private parseGoogleWeatherData(currentData: any, forecastData: any, district: string, coords: {latitude: number, longitude: number}): WeatherData {
    // Parse Google Weather API response format
    const current: WeatherCondition = {
      temperature: Math.round(currentData.temperature?.degrees || 25),
      humidity: currentData.relativeHumidity || 65,
      rainfall: currentData.precipitation?.qpf?.quantity || 0,
      windSpeed: Math.round(currentData.wind?.speed?.value || 10),
      pressure: Math.round(currentData.airPressure?.meanSeaLevelMillibars || 1013),
      uvIndex: currentData.uvIndex || 5,
      cloudCover: currentData.cloudCover || 30,
      condition: this.mapGoogleWeatherCondition(currentData.weatherCondition?.type || 'PARTLY_CLOUDY')
    };

    // Parse forecast data if available
    let forecast: WeatherForecast[] = [];
    if (forecastData && forecastData.forecast && forecastData.forecast.dailyForecasts) {
      forecast = forecastData.forecast.dailyForecasts.slice(0, 7).map((day: any) => ({
        date: day.date || new Date().toISOString().split('T')[0],
        temperature: {
          min: Math.round(day.temperature?.low?.degrees || current.temperature - 5),
          max: Math.round(day.temperature?.high?.degrees || current.temperature + 5),
          average: Math.round((day.temperature?.low?.degrees + day.temperature?.high?.degrees) / 2 || current.temperature)
        },
        rainfall: day.precipitation?.total?.quantity || 0,
        humidity: day.relativeHumidity || current.humidity,
        windSpeed: Math.round(day.wind?.speed?.value || current.windSpeed),
        condition: this.mapGoogleWeatherCondition(day.weatherCondition?.type || 'PARTLY_CLOUDY'),
        precipitationProbability: day.precipitation?.probability?.percent || 10
      }));
    } else {
      // Generate forecast based on current conditions if not available
      forecast = this.generateForecastFromCurrent(current);
    }

    return {
      current,
      forecast,
      location: {
        district,
        latitude: coords.latitude,
        longitude: coords.longitude
      },
      lastUpdated: new Date().toISOString()
    };
  }

  private mapGoogleWeatherCondition(googleCondition: string): string {
    const conditionMap: {[key: string]: string} = {
      'CLEAR': 'sunny',
      'PARTLY_CLOUDY': 'partly_cloudy',
      'CLOUDY': 'cloudy',
      'OVERCAST': 'cloudy',
      'RAIN': 'rainy',
      'SHOWERS': 'rainy',
      'THUNDERSTORM': 'stormy',
      'SNOW': 'snowy',
      'FOG': 'foggy',
      'MIST': 'foggy'
    };
    return conditionMap[googleCondition] || 'partly_cloudy';
  }

  private generateForecastFromCurrent(current: WeatherCondition): WeatherForecast[] {
    const forecast: WeatherForecast[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        temperature: {
          min: Math.round(current.temperature - 3 + (Math.random() * 2)),
          max: Math.round(current.temperature + 3 + (Math.random() * 2)),
          average: Math.round(current.temperature + (Math.random() * 2 - 1))
        },
        rainfall: current.rainfall + (Math.random() * 5),
        humidity: Math.round(current.humidity + (Math.random() * 10 - 5)),
        windSpeed: Math.round(current.windSpeed + (Math.random() * 3 - 1.5)),
        condition: current.condition,
        precipitationProbability: Math.round(20 + (Math.random() * 40))
      });
    }
    return forecast;
  }

  /* Legacy OpenWeatherMap parser - keeping for reference
  private parseOpenWeatherData(currentData: any, forecastData: any, district: string, coords: {latitude: number, longitude: number}): WeatherData {
    const current: WeatherCondition = {
      temperature: Math.round(currentData.main.temp),
      humidity: currentData.main.humidity,
      rainfall: currentData.rain ? currentData.rain['1h'] || 0 : 0,
      windSpeed: currentData.wind.speed,
      pressure: currentData.main.pressure,
      uvIndex: 5, // OpenWeatherMap free tier doesn't include UV index
      cloudCover: currentData.clouds.all,
      condition: this.mapWeatherCondition(currentData.weather[0].main)
    };

    const forecast: WeatherForecast[] = forecastData.list.slice(0, 7).map((item: any) => ({
      date: new Date(item.dt * 1000).toISOString().split('T')[0],
      temperature: {
        min: Math.round(item.main.temp_min),
        max: Math.round(item.main.temp_max),
        average: Math.round(item.main.temp)
      },
      rainfall: item.rain ? item.rain['3h'] || 0 : 0,
      humidity: item.main.humidity,
      windSpeed: item.wind.speed,
      condition: this.mapWeatherCondition(item.weather[0].main),
      precipitationProbability: Math.round(item.pop * 100)
    }));

    return {
      current,
      forecast,
      location: {
        district,
        latitude: coords.latitude,
        longitude: coords.longitude
      },
      lastUpdated: new Date().toISOString()
    };
  }
  End of legacy OpenWeatherMap parser */

  // @ts-ignore - Keeping for reference
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private mapWeatherCondition(condition: string): string {
    const conditionMap: {[key: string]: string} = {
      'Clear': 'sunny',
      'Clouds': 'cloudy',
      'Rain': 'rainy',
      'Drizzle': 'rainy',
      'Thunderstorm': 'stormy',
      'Snow': 'snowy',
      'Mist': 'foggy',
      'Fog': 'foggy'
    };
    return conditionMap[condition] || 'partly_cloudy';
  }

  private getIntelligentMockWeatherData(district: string): WeatherData {
    // Generate location-based and season-aware mock data
    const locationFactors = this.getLocationFactors(district);
    const seasonFactors = this.getSeasonFactors();
    
    const current: WeatherCondition = {
      temperature: Math.round(locationFactors.baseTemp + seasonFactors.tempAdjustment + (Math.random() * 6 - 3)),
      humidity: Math.round(locationFactors.baseHumidity + seasonFactors.humidityAdjustment + (Math.random() * 20 - 10)),
      rainfall: seasonFactors.rainfallProbability > Math.random() ? Math.round(Math.random() * 10) : 0,
      windSpeed: Math.round(locationFactors.baseWindSpeed + (Math.random() * 5)),
      pressure: Math.round(1013 + (Math.random() * 20 - 10)),
      uvIndex: Math.round(locationFactors.baseUV + seasonFactors.uvAdjustment),
      cloudCover: Math.round(seasonFactors.cloudCover + (Math.random() * 30 - 15)),
      condition: seasonFactors.primaryCondition
    };

    const forecast: WeatherForecast[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        temperature: {
          min: Math.round(current.temperature - 5 + (Math.random() * 4)),
          max: Math.round(current.temperature + 5 + (Math.random() * 4)),
          average: Math.round(current.temperature + (Math.random() * 4 - 2))
        },
        rainfall: seasonFactors.rainfallProbability > Math.random() ? Math.round(Math.random() * 15) : 0,
        humidity: Math.round(current.humidity + (Math.random() * 10 - 5)),
        windSpeed: Math.round(current.windSpeed + (Math.random() * 3 - 1.5)),
        condition: this.getRandomCondition(seasonFactors.primaryCondition),
        precipitationProbability: Math.round(seasonFactors.rainfallProbability * 100)
      });
    }

    return {
      current,
      forecast,
      location: {
        district,
        latitude: locationFactors.latitude,
        longitude: locationFactors.longitude
      },
      lastUpdated: new Date().toISOString()
    };
  }

  private getLocationFactors(district: string) {
    // Indian districts climate data
    const locationData: {[key: string]: any} = {
      'bangalore': { baseTemp: 25, baseHumidity: 65, baseWindSpeed: 8, baseUV: 6, latitude: 12.9716, longitude: 77.5946 },
      'mumbai': { baseTemp: 28, baseHumidity: 75, baseWindSpeed: 12, baseUV: 7, latitude: 19.0760, longitude: 72.8777 },
      'delhi': { baseTemp: 26, baseHumidity: 60, baseWindSpeed: 10, baseUV: 6, latitude: 28.7041, longitude: 77.1025 },
      'chennai': { baseTemp: 30, baseHumidity: 80, baseWindSpeed: 15, baseUV: 8, latitude: 13.0827, longitude: 80.2707 },
      'kolkata': { baseTemp: 28, baseHumidity: 85, baseWindSpeed: 8, baseUV: 7, latitude: 22.5726, longitude: 88.3639 },
      'hyderabad': { baseTemp: 28, baseHumidity: 55, baseWindSpeed: 9, baseUV: 7, latitude: 17.3850, longitude: 78.4867 },
      'pune': { baseTemp: 26, baseHumidity: 65, baseWindSpeed: 10, baseUV: 6, latitude: 18.5204, longitude: 73.8567 }
    };
    
    const key = district.toLowerCase();
    return locationData[key] || locationData['bangalore']; // Default to Bangalore
  }

  private getSeasonFactors() {
    const month = new Date().getMonth();
    
    if (month >= 2 && month <= 5) { // March to June - Summer
      return {
        tempAdjustment: 8,
        humidityAdjustment: -15,
        uvAdjustment: 3,
        cloudCover: 20,
        rainfallProbability: 0.1,
        primaryCondition: 'sunny'
      };
    } else if (month >= 6 && month <= 9) { // July to October - Monsoon
      return {
        tempAdjustment: -5,
        humidityAdjustment: 20,
        uvAdjustment: -2,
        cloudCover: 80,
        rainfallProbability: 0.7,
        primaryCondition: 'rainy'
      };
    } else { // November to February - Winter
      return {
        tempAdjustment: -8,
        humidityAdjustment: -10,
        uvAdjustment: -1,
        cloudCover: 40,
        rainfallProbability: 0.2,
        primaryCondition: 'partly_cloudy'
      };
    }
  }

  private getRandomCondition(primary: string): string {
    const variations: {[key: string]: string[]} = {
      'sunny': ['sunny', 'partly_cloudy'],
      'rainy': ['rainy', 'cloudy', 'stormy'],
      'partly_cloudy': ['partly_cloudy', 'cloudy', 'sunny']
    };
    
    const options = variations[primary] || ['partly_cloudy'];
    return options[Math.floor(Math.random() * options.length)];
  }

  /* Unused mock methods - keeping for reference
  private getMockCurrentWeather(): WeatherCondition {
    return {
      temperature: 28 + Math.random() * 6, // 28-34°C
      humidity: 60 + Math.random() * 25, // 60-85%
      rainfall: Math.random() > 0.8 ? Math.random() * 10 : 0, // Occasional rain
      windSpeed: 8 + Math.random() * 12, // 8-20 km/h
      pressure: 1008 + Math.random() * 10, // 1008-1018 hPa
      uvIndex: 3 + Math.random() * 7, // 3-10
      cloudCover: Math.random() * 80, // 0-80%
      condition: ['sunny', 'partly_cloudy', 'cloudy', 'overcast'][Math.floor(Math.random() * 4)]
    };
  }

  private getMockForecast(): WeatherForecast[] {
    return Array.from({ length: 7 }, (_, i) => {
      const baseTemp = 25 + Math.random() * 8;
      const rainChance = Math.random();
      
      return {
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        temperature: {
          min: baseTemp - 5 - Math.random() * 3,
          max: baseTemp + 5 + Math.random() * 5,
          average: baseTemp
        },
        rainfall: rainChance > 0.7 ? Math.random() * 25 : 0,
        humidity: 55 + Math.random() * 30,
        windSpeed: 5 + Math.random() * 15,
        condition: rainChance > 0.7 ? 'rainy' : 
                  rainChance > 0.4 ? 'cloudy' : 
                  rainChance > 0.2 ? 'partly_cloudy' : 'sunny',
        precipitationProbability: Math.round(rainChance * 100)
      };
    });
  }
  End of unused mock methods */
  
  private getCropWaterRequirements(cropType: string): { requirement: string; timing: string[] } {
    const cropData: { [key: string]: { requirement: string; timing: string[] } } = {
      'rice': { requirement: 'high', timing: ['Keep fields flooded', 'Drain before harvest'] },
      'wheat': { requirement: 'moderate', timing: ['Critical at flowering', 'Reduce during ripening'] },
      'corn': { requirement: 'high', timing: ['Critical during tasseling', 'Important during grain filling'] },
      'cotton': { requirement: 'moderate to high', timing: ['Important during flowering', 'Critical during boll development'] },
      'sugarcane': { requirement: 'very high', timing: ['Consistent throughout growing season'] },
      'tomato': { requirement: 'moderate', timing: ['Regular but avoid overwatering', 'Critical during fruit development'] },
      'potato': { requirement: 'moderate', timing: ['Important during tuber formation', 'Reduce before harvest'] },
      'onion': { requirement: 'low to moderate', timing: ['Light frequent watering', 'Stop before harvest'] }
    };

    return cropData[cropType.toLowerCase()] || { requirement: 'moderate', timing: ['Regular watering as needed'] };
  }

  getIrrigationRecommendations(weatherData: WeatherData, cropType: string) {
    const current = weatherData.current;
    const forecast = weatherData.forecast;
    
    // Analyze current conditions
    const shouldIrrigate = this.shouldIrrrigate(current, cropType);
    const waterRequirement = this.calculateWaterRequirement(current, cropType);
    const schedule = this.generateIrrigationSchedule(forecast, cropType);
    
    return {
      shouldIrrigate,
      waterRequirement,
      schedule,
      reasoning: this.generateIrrigationReasoning(current, forecast, cropType)
    };
  }

  private shouldIrrrigate(current: WeatherCondition, cropType: string): boolean {
    // Determine if irrigation is needed based on current conditions
    if (current.rainfall > 5) return false; // Recent rain
    if (current.humidity < 30) return true; // Very dry
    if (current.temperature > 35) return true; // Very hot
    
    // Crop-specific needs
    const cropNeeds = this.getCropWaterRequirements(cropType);
    return cropNeeds.requirement !== 'low';
  }

  private calculateWaterRequirement(current: WeatherCondition, cropType: string): string {
    let baseRequirement = 25; // liters per square meter
    
    // Adjust based on temperature
    if (current.temperature > 35) baseRequirement += 10;
    else if (current.temperature < 20) baseRequirement -= 5;
    
    // Adjust based on humidity
    if (current.humidity < 40) baseRequirement += 8;
    else if (current.humidity > 80) baseRequirement -= 5;
    
    // Adjust based on wind
    if (current.windSpeed > 15) baseRequirement += 5;
    
    // Crop-specific adjustments
    const cropMultiplier = this.getCropWaterMultiplier(cropType);
    baseRequirement *= cropMultiplier;
    
    return `${Math.round(baseRequirement)} liters per square meter`;
  }

  private generateIrrigationSchedule(forecast: WeatherForecast[], cropType: string): string[] {
    const schedule: string[] = [];
    const cropNeeds = this.getCropWaterRequirements(cropType);
    
    // Default schedule
    schedule.push('Early morning (6:00-8:00 AM)');
    
    // Add evening watering if needed
    const avgTemp = forecast.slice(0, 3).reduce((sum, day) => sum + day.temperature.average, 0) / 3;
    if (avgTemp > 30) {
      schedule.push('Evening (6:00-7:30 PM)');
    }
    
    // Add specific crop timing
    schedule.push(...cropNeeds.timing);
    
    return schedule;
  }

  private generateIrrigationReasoning(current: WeatherCondition, forecast: WeatherForecast[], cropType: string): string {
    const reasons: string[] = [];
    
    if (current.rainfall < 2) {
      reasons.push('Low recent rainfall detected');
    }
    
    if (current.temperature > 32) {
      reasons.push('High temperature increases water evaporation');
    }
    
    if (current.humidity < 50) {
      reasons.push('Low humidity requires additional watering');
    }
    
    // Check forecast
    const upcomingRain = forecast.slice(0, 3).some(day => day.rainfall > 5);
    if (upcomingRain) {
      reasons.push('Rain expected in 2-3 days, adjust schedule accordingly');
    }
    
    return reasons.join('. ') + '.';
  }

  private getCropWaterMultiplier(cropType: string): number {
    const multipliers: {[key: string]: number} = {
      'rice': 1.5,
      'sugarcane': 1.8,
      'cotton': 1.2,
      'wheat': 0.8,
      'maize': 1.0,
      'tomato': 1.3,
      'onion': 0.9,
      'potato': 1.1
    };
    
    return multipliers[cropType.toLowerCase()] || 1.0;
  }
}

export const weatherService = new WeatherService();
