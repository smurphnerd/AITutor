/**
 * AI Provider Management
 * 
 * This module provides utilities for determining which AI provider to use for a given model.
 * It allows for switching between providers while keeping a consistent interface.
 */

// Define available AI providers
export enum AIProvider {
  OPENAI = 'openai',
  GEMINI = 'gemini',
  ANTHROPIC = 'anthropic',
}

// Function to determine provider based on model name
export function getProviderForModel(modelName: string): AIProvider {
  // OpenAI models
  if (modelName.startsWith('gpt-') || 
      modelName.startsWith('text-') || 
      modelName.startsWith('dall-e')) {
    return AIProvider.OPENAI;
  }
  
  // Gemini models
  if (modelName.startsWith('gemini-')) {
    return AIProvider.GEMINI;
  }
  
  // Anthropic models
  if (modelName.startsWith('claude-')) {
    return AIProvider.ANTHROPIC;
  }
  
  // Default to OpenAI if unknown
  console.warn(`Unknown model provider for: ${modelName}, defaulting to OpenAI`);
  return AIProvider.OPENAI;
}

// Model availability check function
export function isModelAvailable(provider: AIProvider): boolean {
  switch (provider) {
    case AIProvider.OPENAI:
      return process.env.OPENAI_API_KEY !== undefined;
    case AIProvider.GEMINI:
      return process.env.GEMINI_API_KEY !== undefined;
    case AIProvider.ANTHROPIC:
      return process.env.ANTHROPIC_API_KEY !== undefined;
    default:
      return false;
  }
}

// Utility to get model name with fallback options
export function getModelWithFallbacks(primaryModel: string, fallbacks: string[] = []): string {
  // First check if primary model's provider is available
  const primaryProvider = getProviderForModel(primaryModel);
  if (isModelAvailable(primaryProvider)) {
    return primaryModel;
  }
  
  // Try fallbacks in order
  for (const fallbackModel of fallbacks) {
    const fallbackProvider = getProviderForModel(fallbackModel);
    if (isModelAvailable(fallbackProvider)) {
      console.log(`Primary model provider not available, using fallback: ${fallbackModel}`);
      return fallbackModel;
    }
  }
  
  // If we got here, no provider is available, return primary anyway
  // The calling code should handle API errors
  console.warn(`No AI provider available for any specified model. Using primary model.`);
  return primaryModel;
}