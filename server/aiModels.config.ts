/**
 * AI Models Configuration
 *
 * This file provides a central place to configure AI models used throughout the application.
 * Change these settings to experiment with different AI models and parameters.
 */

// Available AI providers
export enum AIProvider {
  OPENAI = "openai",
  GEMINI = "gemini",
  ANTHROPIC = "anthropic",
}

// Model definitions with provider information
export const OPENAI_MODELS = {
  GPT_4: "gpt-4",
  GPT_4_TURBO: "gpt-4-turbo",
  GPT_4O: "gpt-4o", // the newest OpenAI model released May 13, 2024
  GPT_35_TURBO: "gpt-3.5-turbo",
  DALL_E_3: "dall-e-3",
};

export const GEMINI_MODELS = {
  GEMINI_PRO: "gemini-2.5-pro-preview-05-06",
  GEMINI_1_5_FLASH: "gemini-1.5-flash",
  GEMINI_PRO_VISION: "gemini-pro-vision",
  GEMINI_1_5_FLASH_VISION: "gemini-1.5-flash-vision",
};

export const ANTHROPIC_MODELS = {
  CLAUDE_3_OPUS: "claude-3-opus-20240229",
  CLAUDE_3_SONNET: "claude-3-sonnet-20240229",
  CLAUDE_3_HAIKU: "claude-3-haiku-20240307",
};

// ACTIVE MODEL CONFIGURATION
// Change these settings to use different models

// Define which models to use for different purposes
export const ACTIVE_MODELS = {
  // Primary text processing model
  PRIMARY_TEXT_MODEL: GEMINI_MODELS.GEMINI_PRO,
  PRIMARY_TEXT_PROVIDER: AIProvider.GEMINI,

  // Backup text processing model
  BACKUP_TEXT_MODEL: GEMINI_MODELS.GEMINI_1_5_FLASH,
  BACKUP_TEXT_PROVIDER: AIProvider.GEMINI,

  // Vision/multimodal model
  VISION_MODEL: GEMINI_MODELS.GEMINI_1_5_FLASH_VISION,
  VISION_PROVIDER: AIProvider.GEMINI,

  // Model used for grading assignments
  GRADING_MODEL: GEMINI_MODELS.GEMINI_PRO,
  GRADING_PROVIDER: AIProvider.GEMINI,

  // Image generation model
  IMAGE_GENERATION_MODEL: OPENAI_MODELS.DALL_E_3,
  IMAGE_GENERATION_PROVIDER: AIProvider.OPENAI,
};

// Model parameters for text generation
export const TEXT_PARAMETERS = {
  temperature: 0.2,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 4096,
};

// Model parameters for vision/multimodal tasks
export const VISION_PARAMETERS = {
  temperature: 0.2,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 4096,
};

// Model parameters specifically for grading
export const GRADING_PARAMETERS = {
  temperature: 0.1,
  maxOutputTokens: 8192,
  topP: 0.95,
  topK: 40,
};
