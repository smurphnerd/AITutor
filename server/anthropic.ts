/**
 * Anthropic Claude Integration
 * 
 * This file provides integration with Anthropic's Claude models for enhanced grading capabilities.
 * It complements our existing OpenAI and Gemini integrations to provide more AI options.
 */

import Anthropic from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import fs from 'fs/promises';
import path from 'path';
import { File } from '@shared/schema';
import { RubricSection } from './rubrics.config';
import { GRADING_PARAMETERS } from './aiModels.config';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const CLAUDE_MODEL = 'claude-3-7-sonnet-20250219';

// Initialize Anthropic client
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set. Claude features will not be available.');
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

interface SectionFeedback {
  score: number;
  maxScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

interface GradingResult {
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
 * Extract rubric sections from a file using Claude
 */
export async function parseRubricWithClaude(rubricFile: File): Promise<RubricSection[]> {
  try {
    const anthropic = getAnthropicClient();
    
    // Read the rubric file
    const filePath = path.join('uploads', rubricFile.filename);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // Create a prompt that instructs Claude to extract rubric sections
    const prompt = `
I need to extract grading rubric sections from the following document.
Please identify each section name, maximum score, and criteria.
Return the result as a JSON array of objects with properties "name", "maxScore", and "criteria".

DOCUMENT CONTENT:
${fileContent}

EXPECTED OUTPUT FORMAT EXAMPLE:
[
  {
    "name": "Introduction",
    "maxScore": 10,
    "criteria": "Clear problem statement with background and justification"
  },
  {
    "name": "Methodology",
    "maxScore": 20,
    "criteria": "Comprehensive description of methods used with justification"
  }
]

Please analyze the document and extract all rubric sections following this format.
`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract JSON from response
    const contentBlock = response.content[0];
    if (contentBlock.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }
    
    const content = contentBlock.text;
    const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    
    if (jsonMatch) {
      const sections = JSON.parse(jsonMatch[0]) as RubricSection[];
      console.log(`Successfully extracted ${sections.length} rubric sections with Claude`);
      return sections;
    } else {
      throw new Error('Failed to parse JSON from Claude response');
    }
  } catch (error) {
    console.error('Error parsing rubric with Claude:', error);
    return []; // Return empty array, default sections will be used
  }
}

/**
 * Grade a submission based on rubrics using Claude
 */
export async function gradePapersWithClaude(
  rubricFiles: File[],
  submissionFile: File
): Promise<GradingResult> {
  try {
    const anthropic = getAnthropicClient();
    
    // Read all files
    const rubricContents = await Promise.all(
      rubricFiles.map(async (file) => {
        const filePath = path.join('uploads', file.filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return { name: file.originalname, content };
      })
    );
    
    const submissionPath = path.join('uploads', submissionFile.filename);
    const submissionContent = await fs.readFile(submissionPath, 'utf-8');
    
    // Prepare the prompt for Claude
    const rubricText = rubricContents
      .map(r => `## RUBRIC: ${r.name}\n${r.content}`)
      .join('\n\n');
    
    const prompt = `
As an expert academic grader, evaluate the following submission based on the provided rubrics.
Your evaluation should be fair, consistent, and provide detailed feedback with specific examples from the submission.

# RUBRICS
${rubricText}

# SUBMISSION
${submissionContent}

Provide a comprehensive evaluation in JSON format with the following structure:
{
  "totalScore": (number - sum of all section scores),
  "maxPossibleScore": (number - sum of all section maximum scores),
  "overallFeedback": (string - overall assessment of the submission),
  "status": (string - "pass" or "fail" based on whether totalScore >= 60% of maxPossibleScore),
  "sectionFeedback": {
    "Section1Name": {
      "score": (number - points earned),
      "maxScore": (number - maximum possible points),
      "feedback": (string - detailed evaluation explaining the score),
      "strengths": [(array of strings - specific strengths with examples)],
      "improvements": [(array of strings - specific suggestions for improvement)]
    },
    "Section2Name": {
      // Same structure as above
    }
    // Additional sections as needed
  }
}

IMPORTANT GUIDELINES:
1. For each section, provide specific examples from the submission to justify your scoring
2. Include direct quotes or references to the submission in your feedback
3. Provide actionable improvement suggestions
4. Be objective and fair in your assessment
`;

    // Make API call to Claude
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract and parse JSON from response
    const contentBlock = response.content[0];
    if (contentBlock.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }
    
    const content = contentBlock.text;
    const jsonMatch = content.match(/\{\s*"totalScore[\s\S]*\}/);
    
    if (jsonMatch) {
      const gradingResult = JSON.parse(jsonMatch[0]) as GradingResult;
      return {
        ...gradingResult,
        submissionId: submissionFile.id.toString(),
        submissionName: submissionFile.originalname,
        createdAt: new Date().toISOString()
      };
    } else {
      throw new Error('Failed to parse JSON from Claude response');
    }
  } catch (error) {
    console.error('Error grading with Claude:', error instanceof Error ? error.message : String(error));
    return generateErrorResult(
      submissionFile,
      error instanceof Error ? error.message : 'Unknown error during Claude grading'
    );
  }
}

/**
 * Generate an error result when Claude service fails
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
    overallFeedback: `Error: Unable to grade submission. ${errorMessage}`,
    status: 'pending',
    sectionFeedback: {
      'Error': {
        score: 0,
        maxScore: 100,
        feedback: `The grading service encountered an error: ${errorMessage}. Please try again later or contact support if the problem persists.`,
        strengths: [],
        improvements: ['Try again later when the service is available.']
      }
    },
    createdAt: new Date().toISOString()
  };
}