/**
 * AI Service
 * 
 * This service provides a unified interface for interacting with different AI providers.
 * It automatically routes requests to the appropriate provider based on the model configuration.
 */

import { AIModel, ModelProvider, GRADING_PARAMETERS } from '../aiModels.config';
import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import config from '../config';
import { File } from '@shared/schema';
import { RubricSection } from '../rubrics.config';

// Initialize AI clients
const openai = new OpenAI({ apiKey: config.ai.openai || "" });
const genAI = new GoogleGenerativeAI(config.ai.gemini || "");

// Safety settings for Gemini
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

// Interfaces for consistent handling
export interface SectionFeedback {
  score: number;
  maxScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface GradingResult {
  submissionId: string;
  submissionName: string;
  totalScore: number;
  maxPossibleScore: number;
  overallFeedback: string;
  status: 'pass' | 'fail' | 'pending';
  sectionFeedback: {
    [sectionName: string]: SectionFeedback;
  };
  createdAt: string;
}

/**
 * Process a rubric file and extract sections using AI
 */
export async function parseRubricWithAI(rubricFile: File, model: AIModel): Promise<RubricSection[]> {
  try {
    console.log(`Parsing rubric using ${model.provider} with model ${model.name}`);
    
    // Choose provider based on model configuration
    switch (model.provider) {
      case ModelProvider.OPENAI:
        return await parseRubricWithOpenAI(rubricFile, model);
      case ModelProvider.GEMINI:
        return await parseRubricWithGemini(rubricFile, model);
      case ModelProvider.ANTHROPIC:
        throw new Error("Anthropic support is not yet implemented");
      default:
        throw new Error(`Unknown provider: ${model.provider}`);
    }
  } catch (error) {
    console.error(`Error parsing rubric with AI: ${error.message}`);
    // Return empty array, caller will handle with default sections
    return [];
  }
}

/**
 * Parse rubric with OpenAI
 */
async function parseRubricWithOpenAI(rubricFile: File, model: AIModel): Promise<RubricSection[]> {
  const filePath = `uploads/${rubricFile.filename}`;
  // Implementation using OpenAI
  // Replace with your existing OpenAI parsing code
  // This is just a skeleton implementation
  
  const prompt = `I need you to extract the rubric sections from the following academic rubric. 
    Format your response as a JSON array with objects containing 'name', 'maxScore', and 'criteria' properties.
    Here's an example of the expected format:
    [
      {
        "name": "Content",
        "maxScore": 30,
        "criteria": "Depth and accuracy of content"
      }
    ]
    
    Parse the following rubric:
    ${filePath}`;

  try {
    const response = await openai.chat.completions.create({
      model: model.name,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: GRADING_PARAMETERS.temperature,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.sections || [];
  } catch (error) {
    console.error("OpenAI rubric parsing error:", error);
    return [];
  }
}

/**
 * Parse rubric with Gemini
 */
async function parseRubricWithGemini(rubricFile: File, model: AIModel): Promise<RubricSection[]> {
  const filePath = `uploads/${rubricFile.filename}`;
  // Implementation using Gemini
  // Replace with your existing Gemini parsing code
  // This is just a skeleton implementation
  
  const prompt = `I need you to extract the rubric sections from the following academic rubric. 
    Format your response as a JSON array with objects containing 'name', 'maxScore', and 'criteria' properties.
    Here's an example of the expected format:
    [
      {
        "name": "Content",
        "maxScore": 30,
        "criteria": "Depth and accuracy of content"
      }
    ]
    
    Parse the following rubric:
    ${filePath}`;

  try {
    const geminiModel = genAI.getGenerativeModel({
      model: model.name,
      generationConfig: {
        temperature: GRADING_PARAMETERS.temperature,
        topP: GRADING_PARAMETERS.topP,
        topK: GRADING_PARAMETERS.topK,
        maxOutputTokens: GRADING_PARAMETERS.maxOutputTokens,
      },
      safetySettings,
    });

    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();
    // Extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error("Gemini rubric parsing error:", error);
    return [];
  }
}

/**
 * Grade a submission against rubrics using the specified AI model
 */
export async function gradeSubmissionWithAI(
  rubricFiles: File[],
  submissionFile: File,
  model: AIModel
): Promise<GradingResult> {
  try {
    console.log(`Grading submission using ${model.provider} with model ${model.name}`);
    
    // Choose provider based on model configuration
    switch (model.provider) {
      case ModelProvider.OPENAI:
        return await gradeSubmissionWithOpenAI(rubricFiles, submissionFile, model);
      case ModelProvider.GEMINI:
        return await gradeSubmissionWithGemini(rubricFiles, submissionFile, model);
      case ModelProvider.ANTHROPIC:
        throw new Error("Anthropic support is not yet implemented");
      default:
        throw new Error(`Unknown provider: ${model.provider}`);
    }
  } catch (error) {
    console.error(`Error grading submission with AI: ${error.message}`);
    // Return an error result
    return generateErrorResult(submissionFile, "AI service encountered an error processing your document.");
  }
}

/**
 * Grade submission with OpenAI
 */
async function gradeSubmissionWithOpenAI(
  rubricFiles: File[],
  submissionFile: File,
  model: AIModel
): Promise<GradingResult> {
  // Implementation using OpenAI
  // Replace with your existing OpenAI grading code
  // This is just a skeleton implementation
  
  // Extract rubric sections
  const rubricSectionsPromises = rubricFiles.map(file => parseRubricWithAI(file, model));
  const rubricSectionsArrays = await Promise.all(rubricSectionsPromises);
  const rubricSections = rubricSectionsArrays.flat();
  
  // Prepare the submission
  const submissionFilePath = `uploads/${submissionFile.filename}`;
  
  // Create prompt for grading
  const prompt = `Grade the following submission against this rubric...`;

  try {
    const response = await openai.chat.completions.create({
      model: model.name,
      messages: [
        { 
          role: "system", 
          content: "You are an expert academic grader with experience in evaluating student submissions against rubrics."
        },
        { role: "user", content: prompt }
      ],
      temperature: GRADING_PARAMETERS.temperature,
      max_tokens: GRADING_PARAMETERS.maxOutputTokens,
      response_format: { type: "json_object" }
    });

    const gradingResult = JSON.parse(response.choices[0].message.content);
    
    // Format the result
    return {
      submissionId: submissionFile.id.toString(),
      submissionName: submissionFile.originalname,
      totalScore: gradingResult.totalScore,
      maxPossibleScore: gradingResult.maxPossibleScore,
      overallFeedback: gradingResult.overallFeedback,
      status: gradingResult.status,
      sectionFeedback: gradingResult.sectionFeedback,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("OpenAI grading error:", error);
    throw error;
  }
}

/**
 * Grade submission with Gemini
 */
async function gradeSubmissionWithGemini(
  rubricFiles: File[],
  submissionFile: File,
  model: AIModel
): Promise<GradingResult> {
  // Implementation using Gemini
  // Replace with your existing Gemini grading code
  // This is just a skeleton implementation
  
  // Extract rubric sections
  const rubricSectionsPromises = rubricFiles.map(file => parseRubricWithAI(file, model));
  const rubricSectionsArrays = await Promise.all(rubricSectionsPromises);
  const rubricSections = rubricSectionsArrays.flat();
  
  // Prepare the submission
  const submissionFilePath = `uploads/${submissionFile.filename}`;
  
  // Create prompt for grading
  const prompt = `Grade the following submission against this rubric...`;

  try {
    const geminiModel = genAI.getGenerativeModel({
      model: model.name,
      generationConfig: {
        temperature: GRADING_PARAMETERS.temperature,
        topP: GRADING_PARAMETERS.topP,
        topK: GRADING_PARAMETERS.topK,
        maxOutputTokens: GRADING_PARAMETERS.maxOutputTokens,
      },
      safetySettings,
    });

    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from Gemini response");
    }
    
    const gradingResult = JSON.parse(jsonMatch[0]);
    
    // Format the result
    return {
      submissionId: submissionFile.id.toString(),
      submissionName: submissionFile.originalname,
      totalScore: gradingResult.totalScore,
      maxPossibleScore: gradingResult.maxPossibleScore,
      overallFeedback: gradingResult.overallFeedback,
      status: gradingResult.status,
      sectionFeedback: gradingResult.sectionFeedback,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("Gemini grading error:", error);
    throw error;
  }
}

/**
 * Generate an error result when AI service fails
 */
function generateErrorResult(
  submissionFile: File,
  errorMessage: string
): GradingResult {
  return {
    submissionId: submissionFile.id.toString(),
    submissionName: submissionFile.originalname,
    totalScore: 0,
    maxPossibleScore: 100,
    overallFeedback: `Error: ${errorMessage}`,
    status: 'pending',
    sectionFeedback: {},
    createdAt: new Date().toISOString()
  };
}