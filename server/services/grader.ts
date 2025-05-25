/**
 * Dynamic Grading Service
 * 
 * This service grades submissions using the analyzed assignment schema,
 * adapting to different marking formats and using centralized prompts
 */

import { File } from '@shared/schema';
import { AssignmentSchema, GradingResult, MarkingSchemaType } from '../types/assignmentSchema';
import { PROMPT_TEMPLATES, populatePrompt } from '../config/promptTemplates';
import { analyzeAssignmentMaterials } from './analyzer';
import { MOCK_GRADING_RESULT, MOCK_AI_DELAY } from '../mockData';

// Testing mode flag - temporarily forced to true to save API credits
const TESTING_MODE = true; // Force testing mode to save your AI credits
console.log('🧪 TESTING MODE FORCED ON - No AI credits will be used');

/**
 * Main grading function using dynamic two-stage approach
 * Now handles multiple submission files as one student submission
 */
export async function gradePapersWithDynamicSchema(
  rubricFiles: File[],
  submissionFiles: File[]
): Promise<GradingResult> {
  try {
    const submissionNames = submissionFiles.map(f => f.originalname).join(', ');
    console.log(`Using dynamic grading approach for student submission: ${submissionNames}`);

    // Testing mode: return mock data after delay to simulate processing
    if (TESTING_MODE) {
      console.log('🧪 TESTING MODE: Using mock grading response');
      await new Promise(resolve => setTimeout(resolve, MOCK_AI_DELAY));
      
      return {
        ...MOCK_GRADING_RESULT,
        submissionId: submissionFiles[0]?.id.toString() || 'mock-submission',
        submissionName: submissionNames,
        totalScore: 75,
        maxPossibleScore: 100,
        status: 'pass' as const,
        createdAt: new Date().toISOString()
      };
    }

    // Stage 1: Analyze assignment materials to determine schema
    console.log('Stage 1: Analyzing assignment materials for schema...');
    const assignmentSchema = await analyzeAssignmentMaterials(rubricFiles);
    
    console.log(`Detected marking schema: ${assignmentSchema.marking_schema_type}`);

    // Stage 2: Grade combined submission using the analyzed schema
    console.log('Stage 2: Grading combined submission against analyzed schema...');
    const gradingResult = await gradeSubmissionWithSchema(assignmentSchema, submissionFiles);

    return gradingResult;

  } catch (error) {
    console.error('Error in dynamic grading:', error);
    
    // Generate error result using fallback grading
    return generateFallbackGradingResult(
      submissionFiles,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Grade a submission against an analyzed assignment schema
 */
async function gradeSubmissionWithSchema(
  schema: AssignmentSchema, 
  submissionFiles: File[]
): Promise<GradingResult> {
  
  // Extract and combine content from all submission files
  const submissionContents = await Promise.all(
    submissionFiles.map(file => extractSubmissionContent(file))
  );
  const submissionContent = submissionContents.join('\n\n--- Next File ---\n\n');
  
  // Prepare grading prompt using centralized template
  const gradingPrompt = populatePrompt('SUBMISSION_GRADER', {
    ASSIGNMENT_SCHEMA: JSON.stringify(schema, null, 2),
    SUBMISSION_CONTENT: submissionContent
  });

  // Try different AI providers (Gemini first as default)
  const aiProviders = ['gemini', 'anthropic', 'openai'];
  
  for (const provider of aiProviders) {
    try {
      console.log(`Attempting grading with ${provider}...`);
      const result = await gradeWithProvider(provider, gradingPrompt, schema.marking_schema_type);
      
      if (result) {
        console.log(`Successfully graded with ${provider}`);
        return {
          ...result,
          schema_type: schema.marking_schema_type
        };
      }
    } catch (error) {
      console.error(`Grading failed with ${provider}:`, error);
      continue;
    }
  }

  // If all providers fail, use fallback
  throw new Error('All AI providers failed during grading');
}

/**
 * Grade submission with a specific AI provider
 */
async function gradeWithProvider(
  provider: string, 
  prompt: string, 
  schemaType: MarkingSchemaType
): Promise<Omit<GradingResult, 'schema_type'> | null> {
  
  switch (provider) {
    case 'openai':
      return gradeWithOpenAI(prompt);
    case 'gemini':
      return gradeWithGemini(prompt);
    case 'anthropic':
      return gradeWithAnthropic(prompt);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Grade submission using OpenAI
 */
async function gradeWithOpenAI(prompt: string): Promise<Omit<GradingResult, 'schema_type'> | null> {
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: 'system',
          content: 'You are an expert academic grader. Always respond with valid JSON following the specified format exactly.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (error) {
    console.error('OpenAI grading error:', error);
    return null;
  }
}

/**
 * Grade submission using Gemini
 */
async function gradeWithGemini(prompt: string): Promise<Omit<GradingResult, 'schema_type'> | null> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const result = await model.generateContent([
      'You are an expert academic grader. Always respond with valid JSON following the specified format exactly.',
      prompt
    ]);

    const response = await result.response;
    const content = response.text();
    
    // Extract JSON from response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    return JSON.parse(content);
  } catch (error) {
    console.error('Gemini grading error:', error);
    return null;
  }
}

/**
 * Grade submission using Anthropic Claude
 */
async function gradeWithAnthropic(prompt: string): Promise<Omit<GradingResult, 'schema_type'> | null> {
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219', // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `You are an expert academic grader. Always respond with valid JSON following the specified format exactly.\n\n${prompt}`
        }
      ],
      temperature: 0.1
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    // Extract JSON from response
    const jsonMatch = content.text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    return JSON.parse(content.text);
  } catch (error) {
    console.error('Anthropic grading error:', error);
    return null;
  }
}

/**
 * Extract content from submission file, prioritizing database content
 */
async function extractSubmissionContent(submissionFile: File): Promise<string> {
  console.log(`Extracting content for submission: ${submissionFile.originalname}`);
  
  // First check if we have the extracted text stored in the database
  if (submissionFile.extractedText) {
    console.log(`Using pre-extracted content from database for: ${submissionFile.originalname}`);
    return submissionFile.extractedText;
  }
  
  // If no extracted text available, return error message
  throw new Error(`No extracted text content available for ${submissionFile.originalname}`);
}

/**
 * Generate fallback grading result when all else fails
 */
function generateFallbackGradingResult(
  submissionFile: File,
  errorMessage: string
): GradingResult {
  return {
    overall_grade: "Unable to Grade",
    section_grades: [
      {
        section_name: "Grading Error",
        grade: "error",
        feedback: `Unable to grade this submission due to: ${errorMessage}`,
        strengths: [],
        improvements: [
          "Please ensure the submission is properly formatted",
          "Check that all required content is included",
          "Contact instructor if this error persists"
        ],
        evidence: []
      }
    ],
    overall_feedback: `Grading could not be completed for ${submissionFile.originalname}. Error: ${errorMessage}`,
    recommendations: [
      "Verify submission format and content",
      "Ensure all files are properly uploaded",
      "Contact instructor for assistance"
    ],
    schema_type: 'qualitative'
  };
}