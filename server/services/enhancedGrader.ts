/**
 * Enhanced Grading Service
 * 
 * This service implements a multi-stage grading approach:
 * 1. First, a comprehensive rubric analyzer processes all assignment materials into a standardized format
 * 2. Then, the more sophisticated AI uses this structured format to grade the submission
 * 
 * This separation of concerns improves accuracy and provides detailed, actionable feedback.
 */

import { AIProvider, ACTIVE_MODELS, GRADING_PARAMETERS } from '../aiModels.config';
import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import config from '../config';
import { File } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';
import { analyzeAssignmentMaterials, AnalyzedAssignment } from './rubricAnalyzer';

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

// Gemini model with configured parameters for grading
const geminiGrader = genAI.getGenerativeModel({
  model: ACTIVE_MODELS.GRADING_MODEL,
  generationConfig: {
    temperature: GRADING_PARAMETERS.temperature,
    topP: GRADING_PARAMETERS.topP,
    topK: GRADING_PARAMETERS.topK,
    maxOutputTokens: GRADING_PARAMETERS.maxOutputTokens,
  },
  safetySettings,
});

// Output interfaces
export interface SectionFeedback {
  score: number;
  max_score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  grade_level: string;
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
 * Main enhanced grading function that uses a two-stage approach
 */
export async function enhancedGradePapers(
  assignmentFiles: File[],
  submissionFile: File,
): Promise<GradingResult> {
  try {
    console.log(`Using comprehensive two-stage grading approach with provider: ${ACTIVE_MODELS.GRADING_PROVIDER}`);
    
    // STAGE 1: Analyze all assignment materials into a comprehensive standardized format
    console.log('Stage 1: Analyzing all assignment materials into comprehensive format...');
    const analyzedAssignment = await analyzeAssignmentMaterials(assignmentFiles);
    
    // STAGE 2: Grade the submission using the comprehensive analyzed assignment
    console.log('Stage 2: Grading submission using comprehensive analysis...');
    
    // Select the correct service based on configuration
    switch (ACTIVE_MODELS.GRADING_PROVIDER) {
      case AIProvider.OPENAI:
        console.log('Using OpenAI for grading');
        return await gradeWithOpenAI(analyzedAssignment, submissionFile);
      case AIProvider.GEMINI:
        console.log('Using Gemini for grading');
        return await gradeWithGemini(analyzedAssignment, submissionFile);
      case AIProvider.ANTHROPIC:
        throw new Error('Anthropic provider not yet implemented');
      default:
        throw new Error(`Unknown provider: ${ACTIVE_MODELS.GRADING_PROVIDER}`);
    }
  } catch (error) {
    console.error('Error during enhanced grading:', error instanceof Error ? error.message : String(error));
    // Return a fallback error result
    return generateErrorResult(
      submissionFile, 
      `Error during grading process: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Grade using OpenAI with the analyzed assignment
 */
async function gradeWithOpenAI(
  analyzedAssignment: AnalyzedAssignment,
  submissionFile: File
): Promise<GradingResult> {
  try {
    // Extract submission content
    const submissionContent = await extractSubmissionContent(submissionFile);
    
    // Create a concise version of the analyzed assignment for the prompt
    const conciseAssignment = {
      title: analyzedAssignment.title,
      description: analyzedAssignment.description,
      sections: analyzedAssignment.sections.map(section => ({
        section_name: section.section_name,
        max_score: section.max_score,
        description: section.description,
        grading_criteria: section.grading_criteria
      }))
    };
    
    // Format the analyzed assignment for the prompt (keep it concise to avoid token limitations)
    const assignmentJson = JSON.stringify(conciseAssignment, null, 2);
    
    // Create the grading prompt with the analyzed assignment
    const prompt = `
      ## ASSIGNMENT ANALYSIS:
      ${assignmentJson}
      
      ## STUDENT SUBMISSION:
      ${submissionContent}
      
      ## GRADING REQUIREMENTS:
      1. Grade this submission according to the analyzed assignment details provided
      2. For each section, determine which grade level the submission meets (fail, pass, credit, distinction, or high_distinction)
      3. Assign a score based on the grade level and max_score for that section
      4. Provide detailed feedback for each section with specific examples from the submission
      5. Include specific strengths (what was done well) and areas for improvement with direct quotes
      6. Calculate total score and determine if submission passes (${analyzedAssignment.pass_threshold}% threshold)
      
      ## RESPONSE FORMAT - IMPORTANT!
      Return ONLY a valid JSON object with this structure:
      {
        "totalScore": number,
        "maxPossibleScore": ${analyzedAssignment.total_marks},
        "overallFeedback": "Overall assessment of the submission including main strengths and areas for improvement",
        "status": "pass" or "fail",
        "sectionFeedback": {
          "Section Name 1": {
            "score": number,
            "max_score": number from rubric,
            "grade_level": "fail", "pass", "credit", "distinction", or "high_distinction",
            "feedback": "Detailed feedback for this section with quotes from submission",
            "strengths": ["strength 1 with example", "strength 2 with example"],
            "improvements": ["improvement 1 with suggestion", "improvement 2 with suggestion"]
          },
          "Section Name 2": {
            // same structure
          }
        }
      }
    `;
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: ACTIVE_MODELS.GRADING_MODEL,
      messages: [
        { 
          role: "system", 
          content: "You are an expert academic grader with experience in evaluating student submissions. Use the analyzed assignment details to provide consistent, fair, and detailed feedback."
        },
        { role: "user", content: prompt }
      ],
      temperature: GRADING_PARAMETERS.temperature,
      max_tokens: GRADING_PARAMETERS.maxOutputTokens,
      response_format: { type: "json_object" }
    });
    
    // Parse the result
    const gradingResult = JSON.parse(response.choices[0].message.content);
    
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
    console.error('OpenAI enhanced grading error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Grade using Gemini with the analyzed assignment
 */
async function gradeWithGemini(
  analyzedAssignment: AnalyzedAssignment,
  submissionFile: File
): Promise<GradingResult> {
  try {
    // Extract submission content
    const submissionContent = await extractSubmissionContent(submissionFile);
    
    // Create a concise version of the analyzed assignment for the prompt
    const conciseAssignment = {
      title: analyzedAssignment.title,
      description: analyzedAssignment.description,
      sections: analyzedAssignment.sections.map(section => ({
        section_name: section.section_name,
        max_score: section.max_score,
        description: section.description,
        grading_criteria: section.grading_criteria
      }))
    };
    
    // Format the analyzed assignment for the prompt (keep it concise to avoid token limitations)
    const assignmentJson = JSON.stringify(conciseAssignment, null, 2);
    
    // Create the grading prompt with the analyzed assignment
    const prompt = `
      ## ASSIGNMENT ANALYSIS:
      ${assignmentJson}
      
      ## STUDENT SUBMISSION:
      ${submissionContent}
      
      ## GRADING REQUIREMENTS:
      1. Grade this submission according to the analyzed assignment details provided
      2. For each section, determine which grade level the submission meets (fail, pass, credit, distinction, or high_distinction)
      3. Assign a score based on the grade level and max_score for that section
      4. Provide detailed feedback for each section with specific examples from the submission
      5. Include specific strengths (what was done well) and areas for improvement with direct quotes
      6. Calculate total score and determine if submission passes (${analyzedAssignment.pass_threshold}% threshold)
      
      ## RESPONSE FORMAT - IMPORTANT!
      Return ONLY a valid JSON object with this structure:
      {
        "totalScore": number,
        "maxPossibleScore": ${analyzedAssignment.total_marks},
        "overallFeedback": "Overall assessment of the submission including main strengths and areas for improvement",
        "status": "pass" or "fail",
        "sectionFeedback": {
          "Section Name 1": {
            "score": number,
            "max_score": number from rubric,
            "grade_level": "fail", "pass", "credit", "distinction", or "high_distinction",
            "feedback": "Detailed feedback for this section with quotes from submission",
            "strengths": ["strength 1 with example", "strength 2 with example"],
            "improvements": ["improvement 1 with suggestion", "improvement 2 with suggestion"]
          },
          "Section Name 2": {
            // same structure
          }
        }
      }
    `;
    
    // Call Gemini API
    const result = await geminiGrader.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Gemini response');
    }
    
    // Parse the result
    const gradingResult = JSON.parse(jsonMatch[0]);
    
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
    console.error('Gemini enhanced grading error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Extract the content from a submission file
 */
async function extractSubmissionContent(submissionFile: File): Promise<string> {
  try {
    const filePath = path.join('uploads', submissionFile.filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error extracting submission content:', error instanceof Error ? error.message : String(error));
    return 'Error: Could not extract submission content.';
  }
}

/**
 * Generate error result when AI service fails
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
    overallFeedback: errorMessage,
    status: 'pending',
    sectionFeedback: {},
    createdAt: new Date().toISOString()
  };
}