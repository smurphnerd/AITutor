/**
 * Grading Service
 * 
 * This service handles grading submissions using AI providers.
 * It automatically routes requests to the appropriate AI provider based on configuration.
 */

import { ACTIVE_MODELS, AIProvider, GRADING_PARAMETERS } from '../aiModels.config';
import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import config from '../config';
import { File } from '@shared/schema';
import { DEFAULT_RUBRIC, RubricSection } from '../rubrics.config';
import fs from 'fs/promises';
import path from 'path';

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

// Gemini model with configured parameters
const geminiModel = genAI.getGenerativeModel({
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
 * Main grading function that routes to the appropriate AI provider
 */
export async function gradePapers(
  rubricFiles: File[],
  submissionFile: File,
): Promise<GradingResult> {
  try {
    console.log(`Using provider: ${ACTIVE_MODELS.GRADING_PROVIDER} with model: ${ACTIVE_MODELS.GRADING_MODEL} for grading`);
    
    // Select the correct service based on configuration
    switch (ACTIVE_MODELS.GRADING_PROVIDER) {
      case AIProvider.OPENAI:
        console.log('Using OpenAI for grading');
        return await gradeWithOpenAI(rubricFiles, submissionFile);
      case AIProvider.GEMINI:
        console.log('Using Gemini for grading');
        return await gradeWithGemini(rubricFiles, submissionFile);
      case AIProvider.ANTHROPIC:
        throw new Error('Anthropic provider not yet implemented');
      default:
        throw new Error(`Unknown provider: ${ACTIVE_MODELS.GRADING_PROVIDER}`);
    }
  } catch (error) {
    console.error('Error during grading:', error);
    // Return a fallback error result
    return generateErrorResult(
      submissionFile, 
      `Error: ${error.message || 'AI service error'}`
    );
  }
}

/**
 * Grade using OpenAI
 */
async function gradeWithOpenAI(
  rubricFiles: File[],
  submissionFile: File
): Promise<GradingResult> {
  try {
    // Parse rubrics
    const rubricSections = await parseRubricsForGrading(rubricFiles);
    
    // Extract submission content
    const submissionContent = await processSubmission(submissionFile);
    
    // Format rubric for prompt
    const rubricText = rubricSections.map(section => 
      `${section.name} (${section.maxScore} points): ${section.criteria}`
    ).join('\n');
    
    // Create the grading prompt
    const prompt = `
      ## RUBRIC:
      ${rubricText}
      
      ## SUBMISSION:
      ${submissionContent.text}
      
      ${submissionContent.imageDescriptions ? `## IMAGE DESCRIPTIONS IN SUBMISSION:\n${submissionContent.imageDescriptions.join('\n')}` : ''}
      
      ## GRADING REQUIREMENTS:
      1. ONLY evaluate against the rubric sections provided - DO NOT add any sections not in the rubric
      2. For each section, assign a score not exceeding the maximum score shown in the rubric
      3. Provide DETAILED, SPECIFIC feedback with DIRECT QUOTES and EXAMPLES from the submission
      4. For each strength and improvement area, include at least one specific example from the actual text
      5. Calculate total score and determine if submission passes (60% threshold)
      
      ## RESPONSE FORMAT - IMPORTANT!
      Return ONLY a valid JSON object with this structure:
      {
        "totalScore": number,
        "maxPossibleScore": number,
        "overallFeedback": "Overall assessment of the submission",
        "status": "pass" or "fail",
        "sectionFeedback": {
          "Section Name 1": {
            "score": number,
            "maxScore": number from rubric,
            "feedback": "Detailed feedback for this section",
            "strengths": ["strength 1", "strength 2"],
            "improvements": ["improvement 1", "improvement 2"]
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
          content: "You are an expert academic grader with experience in evaluating student submissions against rubrics."
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
    console.error('OpenAI grading error:', error);
    throw error;
  }
}

/**
 * Grade using Gemini
 */
async function gradeWithGemini(
  rubricFiles: File[],
  submissionFile: File
): Promise<GradingResult> {
  try {
    // Parse rubrics
    const rubricSections = await parseRubricsForGrading(rubricFiles);
    
    // Extract submission content
    const submissionContent = await processSubmission(submissionFile);
    
    // Format rubric for prompt
    const rubricText = rubricSections.map(section => 
      `${section.name} (${section.maxScore} points): ${section.criteria}`
    ).join('\n');
    
    // Create the grading prompt
    const prompt = `
      ## RUBRIC:
      ${rubricText}
      
      ## SUBMISSION:
      ${submissionContent.text}
      
      ${submissionContent.imageDescriptions ? `## IMAGE DESCRIPTIONS IN SUBMISSION:\n${submissionContent.imageDescriptions.join('\n')}` : ''}
      
      ## GRADING REQUIREMENTS:
      1. ONLY evaluate against the rubric sections provided - DO NOT add any sections not in the rubric
      2. For each section, assign a score not exceeding the maximum score shown in the rubric
      3. Provide DETAILED, SPECIFIC feedback with DIRECT QUOTES and EXAMPLES from the submission
      4. For each strength and improvement area, include at least one specific example from the actual text
      5. Calculate total score and determine if submission passes (60% threshold)
      
      ## RESPONSE FORMAT - IMPORTANT!
      Return ONLY a valid JSON object with this structure:
      {
        "totalScore": number,
        "maxPossibleScore": number,
        "overallFeedback": "Overall assessment of the submission",
        "status": "pass" or "fail",
        "sectionFeedback": {
          "Section Name 1": {
            "score": number,
            "maxScore": number from rubric,
            "feedback": "Detailed feedback for this section",
            "strengths": ["strength 1", "strength 2"],
            "improvements": ["improvement 1", "improvement 2"]
          },
          "Section Name 2": {
            // same structure
          }
        }
      }
    `;
    
    // Call Gemini API
    const result = await geminiModel.generateContent(prompt);
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
    console.error('Gemini grading error:', error);
    throw error;
  }
}

/**
 * Extract rubric sections from files or use defaults
 */
async function parseRubricsForGrading(rubricFiles: File[]): Promise<RubricSection[]> {
  try {
    if (rubricFiles.length === 0) {
      return DEFAULT_RUBRIC;
    }
    
    const sections: RubricSection[] = [];
    for (const file of rubricFiles) {
      const fileSections = await parseRubricFile(file);
      sections.push(...fileSections);
    }
    
    return sections.length > 0 ? sections : DEFAULT_RUBRIC;
  } catch (error) {
    console.error('Error parsing rubrics:', error);
    return DEFAULT_RUBRIC;
  }
}

/**
 * Parse a single rubric file
 */
async function parseRubricFile(rubricFile: File): Promise<RubricSection[]> {
  try {
    const filePath = path.join('uploads', rubricFile.filename);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // Use AI based on provider configuration
    if (ACTIVE_MODELS.GRADING_PROVIDER === AIProvider.OPENAI) {
      return await parseRubricWithOpenAI(fileContent);
    } else if (ACTIVE_MODELS.GRADING_PROVIDER === AIProvider.GEMINI) {
      return await parseRubricWithGemini(fileContent);
    } else {
      // Fallback to simple text-based parsing
      return createBasicSectionsFromText(fileContent);
    }
  } catch (error) {
    console.error('Error reading/parsing rubric file:', error);
    return [];
  }
}

/**
 * Parse rubric with OpenAI
 */
async function parseRubricWithOpenAI(fileContent: string): Promise<RubricSection[]> {
  const prompt = `
    Extract the grading rubric sections from this document.
    Return a JSON array of objects, each with 'name', 'maxScore' (number), and 'criteria' (string) properties.
    Example: 
    [
      {
        "name": "Content",
        "maxScore": 30,
        "criteria": "Depth and relevance of content"
      }
    ]
    
    Document content:
    ${fileContent}
  `;

  try {
    const response = await openai.chat.completions.create({
      model: ACTIVE_MODELS.GRADING_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: GRADING_PARAMETERS.temperature
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.sections || [];
  } catch (error) {
    console.error('OpenAI rubric parsing error:', error);
    return [];
  }
}

/**
 * Parse rubric with Gemini
 */
async function parseRubricWithGemini(fileContent: string): Promise<RubricSection[]> {
  const prompt = `
    Extract the grading rubric sections from this document.
    Return a JSON array of objects, each with 'name', 'maxScore' (number), and 'criteria' (string) properties.
    Example: 
    [
      {
        "name": "Content",
        "maxScore": 30,
        "criteria": "Depth and relevance of content"
      }
    ]
    
    Document content:
    ${fileContent}
  `;

  try {
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error('Gemini rubric parsing error:', error);
    return [];
  }
}

/**
 * Process a submission file to extract text content
 */
async function processSubmission(submissionFile: File): Promise<{ text: string, imageDescriptions?: string[] }> {
  try {
    const filePath = path.join('uploads', submissionFile.filename);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // For now, we're just reading the text content
    // A more sophisticated implementation would handle different file types
    // and extract images/text appropriately
    
    return {
      text: fileContent
    };
  } catch (error) {
    console.error('Error processing submission:', error);
    return { text: 'Error extracting content from submission' };
  }
}

/**
 * Create basic rubric sections from text when AI parsing fails
 */
function createBasicSectionsFromText(text: string): RubricSection[] {
  // Simple pattern matching to find potential sections
  const sectionMatches = text.match(/(\w[\w\s]+)[\s]?\((\d+)[^\d]+points?\)/gi);
  
  if (!sectionMatches || sectionMatches.length === 0) {
    return DEFAULT_RUBRIC;
  }
  
  const sections: RubricSection[] = [];
  
  sectionMatches.forEach(match => {
    const nameMatch = match.match(/(\w[\w\s]+)[\s]?\(/i);
    const scoreMatch = match.match(/\((\d+)[^\d]+points?\)/i);
    
    if (nameMatch && scoreMatch) {
      const name = nameMatch[1].trim();
      const maxScore = parseInt(scoreMatch[1]);
      
      // Find potential criteria text (text after the section heading)
      const sectionIndex = text.indexOf(match);
      const nextSectionIndex = text.indexOf('(', sectionIndex + match.length);
      let criteria = '';
      
      if (nextSectionIndex > 0) {
        criteria = text.substring(sectionIndex + match.length, nextSectionIndex).trim();
      } else {
        // If this is the last section, take the rest of the text
        criteria = text.substring(sectionIndex + match.length).trim();
      }
      
      // Limit to reasonable length
      criteria = criteria.substring(0, 200);
      
      sections.push({
        name,
        maxScore,
        criteria
      });
    }
  });
  
  return sections.length > 0 ? sections : DEFAULT_RUBRIC;
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