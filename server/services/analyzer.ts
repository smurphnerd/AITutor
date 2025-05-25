/**
 * Dynamic Assignment Analyzer Service
 * 
 * This service analyzes assignment materials and creates a flexible schema
 * that adapts to different marking formats (qualitative, numerical, weighted, hybrid)
 */

import { File } from '@shared/schema';
import { AssignmentSchema, validateAssignmentSchema, MarkingSchemaType } from '../types/assignmentSchema';
import { PROMPT_TEMPLATES, populatePrompt } from '../config/promptTemplates';

/**
 * Analyze assignment materials and determine the appropriate grading schema
 */
export async function analyzeAssignmentMaterials(files: File[]): Promise<AssignmentSchema> {
  try {
    console.log('Analyzing assignment materials for dynamic schema...');
    
    // Extract content from all provided files
    const fileContents = files.map(file => {
      if (!file.extractedText) {
        throw new Error(`File ${file.originalname} does not have extracted text content.`);
      }
      return {
        filename: file.originalname,
        content: file.extractedText
      };
    });

    // Combine all content for analysis
    const combinedContent = fileContents.map(({ filename, content }) => 
      `=== ${filename} ===\n${content}`
    ).join('\n\n');

    // Use centralized prompt template
    const analysisPrompt = populatePrompt('ASSIGNMENT_ANALYZER', {
      ASSIGNMENT_CONTENT: combinedContent
    });

    // Try different AI providers in order of preference (Gemini first as default)
    const aiProviders = ['gemini', 'anthropic', 'openai'];
    
    for (const provider of aiProviders) {
      try {
        console.log(`Attempting assignment analysis with ${provider}...`);
        const result = await analyzeWithProvider(provider, analysisPrompt);
        
        if (result && validateAssignmentSchema(result)) {
          console.log(`Successfully analyzed assignment with ${provider}:`, result.marking_schema_type);
          return result;
        }
      } catch (error) {
        console.error(`Assignment analysis failed with ${provider}:`, error);
        continue; // Try next provider
      }
    }

    // Fallback to default schema if all providers fail
    console.log('All AI providers failed, using default qualitative schema');
    return createDefaultSchema(fileContents);

  } catch (error) {
    console.error('Error in assignment analysis:', error);
    throw new Error(`Assignment analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyze assignment with a specific AI provider
 */
async function analyzeWithProvider(provider: string, prompt: string): Promise<AssignmentSchema | null> {
  switch (provider) {
    case 'openai':
      return analyzeWithOpenAI(prompt);
    case 'gemini':
      return analyzeWithGemini(prompt);
    case 'anthropic':
      return analyzeWithAnthropic(prompt);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Analyze assignment materials using OpenAI
 */
async function analyzeWithOpenAI(prompt: string): Promise<AssignmentSchema | null> {
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
          content: 'You are an expert academic assignment analyzer. Always respond with valid JSON.'
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
    console.error('OpenAI assignment analysis error:', error);
    return null;
  }
}

/**
 * Analyze assignment materials using Gemini
 */
async function analyzeWithGemini(prompt: string): Promise<AssignmentSchema | null> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const result = await model.generateContent([
      'You are an expert academic assignment analyzer. Always respond with valid JSON.',
      prompt
    ]);

    const response = await result.response;
    const content = response.text();
    
    // Extract JSON from response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Try parsing the entire response as JSON
    return JSON.parse(content);
  } catch (error) {
    console.error('Gemini assignment analysis error:', error);
    return null;
  }
}

/**
 * Analyze assignment materials using Anthropic Claude
 */
async function analyzeWithAnthropic(prompt: string): Promise<AssignmentSchema | null> {
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
          content: `You are an expert academic assignment analyzer. Always respond with valid JSON.\n\n${prompt}`
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
    console.error('Anthropic assignment analysis error:', error);
    return null;
  }
}

/**
 * Create a default qualitative schema when AI analysis fails
 */
function createDefaultSchema(fileContents: { filename: string; content: string }[]): AssignmentSchema {
  // Extract likely section names from content
  const sections = extractDefaultSections(fileContents);
  
  return {
    assignment_title: fileContents[0]?.filename.replace(/\.[^/.]+$/, "") || "Assignment",
    marking_schema_type: 'qualitative',
    sections: sections.map(sectionName => ({
      section_name: sectionName,
      criteria: {
        fail: {
          description: "Does not meet minimum requirements",
          examples: ["Missing key components", "Significant errors", "Poor understanding demonstrated"]
        },
        pass: {
          description: "Meets minimum requirements with basic competency",
          examples: ["Basic understanding", "Some minor issues", "Adequate completion"]
        },
        credit: {
          description: "Good work that exceeds minimum requirements",
          examples: ["Clear understanding", "Well-structured", "Minor areas for improvement"]
        },
        distinction: {
          description: "High-quality work demonstrating strong understanding",
          examples: ["Excellent analysis", "Clear communication", "Strong evidence"]
        },
        high_distinction: {
          description: "Outstanding work of exceptional quality",
          examples: ["Exceptional insight", "Perfect execution", "Innovative approach"]
        }
      }
    })),
    general_instructions: "Grade according to standard academic criteria",
    submission_requirements: "Submit work that demonstrates understanding of key concepts"
  };
}

/**
 * Extract potential section names from content
 */
function extractDefaultSections(fileContents: { filename: string; content: string }[]): string[] {
  const combinedContent = fileContents.map(f => f.content).join('\n');
  
  // Look for common section patterns
  const sectionPatterns = [
    /(?:^|\n)\s*(?:Question|Task|Part|Section|Chapter)\s*(\d+)[:\.]?\s*([^\n]+)/gi,
    /(?:^|\n)\s*(\d+[\.\)])?\s*([A-Z][^:\n]{10,50})/gm,
    /(?:^|\n)\s*([A-Z][A-Z\s]{5,30}):?\s*(?:\n|$)/gm
  ];
  
  const sections: string[] = [];
  
  for (const pattern of sectionPatterns) {
    const matches = [...combinedContent.matchAll(pattern)];
    matches.forEach(match => {
      const sectionName = (match[2] || match[1] || '').trim();
      if (sectionName && sectionName.length > 3 && sectionName.length < 100) {
        sections.push(sectionName);
      }
    });
    
    if (sections.length >= 3) break; // Found enough sections
  }
  
  // Fallback sections if none found
  if (sections.length === 0) {
    return [
      "Understanding and Analysis",
      "Implementation and Execution", 
      "Communication and Presentation",
      "Critical Thinking and Evaluation"
    ];
  }
  
  return sections.slice(0, 8); // Limit to 8 sections max
}