/**
 * Rubric Parser Service
 * 
 * This service is responsible for parsing rubrics into a standardized format
 * that can be used by the main grading service. It uses a simpler AI model
 * to extract structured information from rubric documents.
 */

import { AIProvider, ACTIVE_MODELS, TEXT_PARAMETERS } from '../aiModels.config';
import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import config from '../config';
import { File } from '@shared/schema';
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

// Gemini model for parsing
const geminiParser = genAI.getGenerativeModel({
  model: ACTIVE_MODELS.BACKUP_TEXT_MODEL, // Use backup/simpler model for parsing
  generationConfig: {
    temperature: TEXT_PARAMETERS.temperature,
    topP: TEXT_PARAMETERS.topP,
    topK: TEXT_PARAMETERS.topK,
    maxOutputTokens: TEXT_PARAMETERS.maxOutputTokens,
  },
  safetySettings,
});

// Standardized rubric section interface
export interface RubricSectionGrading {
  section_name: string;
  max_score: number;
  fail: string;
  pass: string;
  credit: string;
  distinction: string;
  high_distinction: string;
}

// Standardized rubric format interface
export interface ParsedRubric {
  sections: RubricSectionGrading[];
  context_text: string;
  reference_text?: string;
}

/**
 * Parse rubric files into standardized format
 */
export async function parseRubricFiles(rubricFiles: File[]): Promise<ParsedRubric> {
  try {
    // Extract text content from all rubric files
    const rubricContents = await Promise.all(
      rubricFiles.map(async (file) => {
        const filePath = path.join('uploads', file.filename);
        return await fs.readFile(filePath, 'utf-8');
      })
    );

    // Combine all rubric content
    const combinedContent = rubricContents.join('\n\n--- NEW RUBRIC ---\n\n');
    
    // Parse the combined content based on configured provider
    if (ACTIVE_MODELS.PRIMARY_TEXT_PROVIDER === AIProvider.OPENAI) {
      return await parseRubricWithOpenAI(combinedContent);
    } else {
      return await parseRubricWithGemini(combinedContent);
    }
  } catch (error) {
    console.error('Error parsing rubric files:', error);
    // Return a default parsed rubric
    return createDefaultParsedRubric();
  }
}

/**
 * Parse rubric content using OpenAI
 */
async function parseRubricWithOpenAI(content: string): Promise<ParsedRubric> {
  const prompt = `
    Parse this rubric document into a standardized format that will be used for grading student assignments.
    
    Extract:
    1. Each section of the rubric with grading criteria for different levels
    2. Any contextual or reference text that explains the assignment
    
    Return a JSON object with this exact structure:
    {
      "sections": [
        {
          "section_name": "Name of the section (e.g., Introduction, Methods, etc.)",
          "max_score": number (maximum points for this section),
          "fail": "Criteria description for failing grade in this section",
          "pass": "Criteria description for passing grade in this section",
          "credit": "Criteria description for credit grade in this section",
          "distinction": "Criteria description for distinction grade in this section",
          "high_distinction": "Criteria description for high distinction grade in this section"
        },
        ...more sections...
      ],
      "context_text": "Any explanatory text about the assignment that provides context",
      "reference_text": "Any reference materials or examples provided in the rubric"
    }
    
    Note: If certain grade levels are not specified in the rubric, include reasonable criteria based on the overall rubric.
    
    RUBRIC DOCUMENT:
    ${content}
  `;

  try {
    const response = await openai.chat.completions.create({
      model: ACTIVE_MODELS.BACKUP_TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for more precise parsing
    });

    const parsedResult = JSON.parse(response.choices[0].message.content);
    console.log('Successfully parsed rubric with OpenAI');
    
    return validateParsedRubric(parsedResult);
  } catch (error) {
    console.error('Error parsing rubric with OpenAI:', error);
    return createDefaultParsedRubric();
  }
}

/**
 * Parse rubric content using Gemini
 */
async function parseRubricWithGemini(content: string): Promise<ParsedRubric> {
  const prompt = `
    Parse this rubric document into a standardized format that will be used for grading student assignments.
    
    Extract:
    1. Each section of the rubric with grading criteria for different levels
    2. Any contextual or reference text that explains the assignment
    
    Return a JSON object with this exact structure:
    {
      "sections": [
        {
          "section_name": "Name of the section (e.g., Introduction, Methods, etc.)",
          "max_score": number (maximum points for this section),
          "fail": "Criteria description for failing grade in this section",
          "pass": "Criteria description for passing grade in this section",
          "credit": "Criteria description for credit grade in this section",
          "distinction": "Criteria description for distinction grade in this section",
          "high_distinction": "Criteria description for high distinction grade in this section"
        },
        ...more sections...
      ],
      "context_text": "Any explanatory text about the assignment that provides context",
      "reference_text": "Any reference materials or examples provided in the rubric"
    }
    
    Note: If certain grade levels are not specified in the rubric, include reasonable criteria based on the overall rubric.
    
    RUBRIC DOCUMENT:
    ${content}
  `;

  try {
    const result = await geminiParser.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Gemini response');
    }
    
    const parsedResult = JSON.parse(jsonMatch[0]);
    console.log('Successfully parsed rubric with Gemini');
    
    return validateParsedRubric(parsedResult);
  } catch (error) {
    console.error('Error parsing rubric with Gemini:', error);
    return createDefaultParsedRubric();
  }
}

/**
 * Validate parsed rubric to ensure it has the expected structure
 */
function validateParsedRubric(parsedRubric: any): ParsedRubric {
  // Ensure sections exists and is an array
  if (!parsedRubric.sections || !Array.isArray(parsedRubric.sections)) {
    parsedRubric.sections = [];
  }
  
  // Ensure each section has all required fields
  parsedRubric.sections = parsedRubric.sections.map((section: any) => ({
    section_name: section.section_name || 'Unnamed Section',
    max_score: Number(section.max_score) || 20,
    fail: section.fail || 'Does not meet minimum requirements.',
    pass: section.pass || 'Meets basic requirements.',
    credit: section.credit || 'Exceeds basic requirements with some proficiency.',
    distinction: section.distinction || 'Demonstrates high proficiency and understanding.',
    high_distinction: section.high_distinction || 'Excellent work that exceeds expectations.'
  }));
  
  // Ensure context text exists
  if (!parsedRubric.context_text) {
    parsedRubric.context_text = '';
  }
  
  return parsedRubric;
}

/**
 * Create a default parsed rubric when parsing fails
 */
function createDefaultParsedRubric(): ParsedRubric {
  return {
    sections: [
      {
        section_name: "Introduction & Background",
        max_score: 20,
        fail: "Missing or inadequate introduction. No clear problem statement.",
        pass: "Basic introduction provided with a simple problem statement.",
        credit: "Good introduction with clear problem statement and basic context.",
        distinction: "Well-developed introduction with clear problem statement and thorough context.",
        high_distinction: "Excellent introduction with comprehensive context, clear problem statement, and relevance to the field."
      },
      {
        section_name: "Methodology & Approach",
        max_score: 20,
        fail: "Methodology missing or inappropriate for the problem.",
        pass: "Basic methodology described with some relevance to the problem.",
        credit: "Good methodology with appropriate techniques and tools.",
        distinction: "Well-designed methodology with clear justification for choices made.",
        high_distinction: "Excellent methodology with innovative approaches, thorough justification, and consideration of limitations."
      },
      {
        section_name: "Results & Analysis",
        max_score: 20,
        fail: "Results missing, inadequate, or inaccurate.",
        pass: "Basic results presented with minimal analysis.",
        credit: "Good results with adequate analysis and interpretation.",
        distinction: "Thorough results with detailed analysis and clear interpretation.",
        high_distinction: "Comprehensive results with sophisticated analysis, critical interpretation, and connection to broader context."
      },
      {
        section_name: "Discussion & Conclusion",
        max_score: 20,
        fail: "Discussion missing or fails to address the findings.",
        pass: "Basic discussion that addresses some key findings.",
        credit: "Good discussion with clear conclusions and some implications.",
        distinction: "Thorough discussion with well-supported conclusions and clear implications.",
        high_distinction: "Excellent discussion with insightful conclusions, significant implications, and suggestions for future work."
      },
      {
        section_name: "Presentation & Documentation",
        max_score: 20,
        fail: "Poor presentation with significant errors in formatting, grammar, or citations.",
        pass: "Basic presentation with acceptable formatting and minimal errors.",
        credit: "Good presentation with proper formatting, clarity, and few errors.",
        distinction: "Well-presented with professional formatting, clarity, and proper citations.",
        high_distinction: "Excellent presentation with flawless formatting, exceptional clarity, and comprehensive documentation."
      }
    ],
    context_text: "This is a default rubric generated when parsing fails. It contains general academic evaluation criteria."
  };
}