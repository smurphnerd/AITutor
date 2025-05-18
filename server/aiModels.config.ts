/**
 * AI Models Configuration
 * 
 * This file provides a central place to configure AI models used throughout the application.
 * Change these settings to experiment with different AI models and parameters.
 */

// Available OpenAI models
export const OPENAI_MODELS = {
  // Text generation models
  GPT_4: "gpt-4",
  GPT_4_TURBO: "gpt-4-turbo",
  GPT_4O: "gpt-4o", // the newest OpenAI model released May 13, 2024
  GPT_35_TURBO: "gpt-3.5-turbo",
  
  // Image generation models
  DALL_E_3: "dall-e-3",
  DALL_E_2: "dall-e-2",
  
  // Embedding models
  TEXT_EMBEDDING_3: "text-embedding-3-small"
};

// Available Gemini models
export const GEMINI_MODELS = {
  // Text generation models
  GEMINI_PRO: "gemini-pro", // More capable but may not be available in all regions
  GEMINI_1_5_FLASH: "gemini-1.5-flash", // Faster, more cost-effective option
  
  // Vision models (for processing images)
  GEMINI_PRO_VISION: "gemini-pro-vision", // Handles images + text in some regions
  GEMINI_1_5_FLASH_VISION: "gemini-1.5-flash-vision" // Newer multimodal option
};

// Anthropic Claude models (for future implementation)
export const ANTHROPIC_MODELS = {
  CLAUDE_3_OPUS: "claude-3-opus-20240229",
  CLAUDE_3_SONNET: "claude-3-sonnet-20240229",
  CLAUDE_3_HAIKU: "claude-3-haiku-20240307"
};

// ACTIVE MODEL CONFIGURATION
// -------------------------
// Change these settings to use different models

// Active model selections
export const ACTIVE_MODELS = {
  // Primary text processing model (used for most tasks)
  PRIMARY_TEXT_MODEL: OPENAI_MODELS.GPT_4O,
  
  // Backup text processing model (used if primary fails)
  BACKUP_TEXT_MODEL: GEMINI_MODELS.GEMINI_1_5_FLASH,
  
  // Vision/multimodal model (used for processing images/PDFs)
  VISION_MODEL: GEMINI_MODELS.GEMINI_1_5_FLASH_VISION,
  
  // Model used for grading assignments
  GRADING_MODEL: OPENAI_MODELS.GPT_4O,
  
  // Model used for generating images (if needed)
  IMAGE_GENERATION_MODEL: OPENAI_MODELS.DALL_E_3
};

// Model parameters for text generation
export const TEXT_PARAMETERS = {
  // Controls randomness (0-1): lower = more deterministic
  temperature: 0.2,
  
  // Nucleus sampling parameter (0-1): limits token selection to most likely options
  topP: 0.9,
  
  // Number of most likely tokens to consider (higher = more diverse)
  topK: 40,
  
  // Maximum output length
  maxOutputTokens: 4096
};

// Model parameters for vision/multimodal tasks
export const VISION_PARAMETERS = {
  temperature: 0.2,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 4096
};

// Model parameters specifically for grading
export const GRADING_PARAMETERS = {
  // Lower temperature for more consistent, objective grading
  temperature: 0.1,
  
  // Higher token limit to accommodate detailed feedback
  maxOutputTokens: 8192,
  
  topP: 0.95,
  topK: 40
};