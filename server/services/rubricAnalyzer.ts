/**
 * Rubric Analyzer Service
 * 
 * This service is responsible for analyzing assignment instructions, rubrics, and reference materials
 * to create a comprehensive standardized format that clearly communicates assignment requirements
 * and grading criteria.
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

// Gemini model for analysis with configured parameters
const geminiAnalyzer = genAI.getGenerativeModel({
  model: ACTIVE_MODELS.BACKUP_TEXT_MODEL, 
  generationConfig: {
    temperature: TEXT_PARAMETERS.temperature,
    topP: TEXT_PARAMETERS.topP,
    topK: TEXT_PARAMETERS.topK,
    maxOutputTokens: TEXT_PARAMETERS.maxOutputTokens,
  },
  safetySettings,
});

// Enhanced standardized rubric section interface with detailed grading criteria
export interface EnhancedRubricSection {
  section_name: string;
  max_score: number;
  description: string;  // Detailed description including any relevant reference material
  grading_criteria: {
    fail: {
      score_range: string,  // e.g., "0-49%"
      criteria: string,     // What constitutes a failing grade
      examples: string[]    // Examples of failing work if available
    },
    pass: {
      score_range: string,  // e.g., "50-64%"
      criteria: string,
      examples: string[]
    },
    credit: {
      score_range: string,  // e.g., "65-74%"
      criteria: string,
      examples: string[]
    },
    distinction: {
      score_range: string,  // e.g., "75-84%"
      criteria: string,
      examples: string[]
    },
    high_distinction: {
      score_range: string,  // e.g., "85-100%"
      criteria: string,
      examples: string[]
    }
  },
  reference_materials: string[]  // References specific to this section
}

// Comprehensive standardized assignment format
export interface AnalyzedAssignment {
  title: string;
  description: string;
  learning_outcomes: string[];
  overall_requirements: string[];
  submission_guidelines: string;
  sections: EnhancedRubricSection[];
  general_references: string[];
  total_marks: number;
  pass_threshold: number;  // Typically 50%
}

/**
 * Analyze all assignment materials (instructions, rubrics, references) together
 * to create a comprehensive standardized format
 */
export async function analyzeAssignmentMaterials(files: File[]): Promise<AnalyzedAssignment> {
  try {
    console.log('Analyzing all assignment materials together...');
    
    // Extract text content from all provided files
    const fileContents: {filename: string, content: string}[] = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join('uploads', file.filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return {
          filename: file.originalname,
          content
        };
      })
    );

    // Combine all content into a structured format for the AI to analyze
    const structuredContent = fileContents.map(file => 
      `## FILE: ${file.filename}\n\n${file.content}\n\n`
    ).join('---\n\n');
    
    // Process the combined content based on configured provider
    if (ACTIVE_MODELS.PRIMARY_TEXT_PROVIDER === AIProvider.OPENAI) {
      return await analyzeWithOpenAI(structuredContent);
    } else {
      return await analyzeWithGemini(structuredContent);
    }
  } catch (error) {
    console.error('Error analyzing assignment materials:', error);
    // Return a default analysis
    return createDefaultAnalysis();
  }
}

/**
 * Analyze assignment materials using OpenAI
 */
async function analyzeWithOpenAI(content: string): Promise<AnalyzedAssignment> {
  const prompt = `
    You are an expert academic assignment analyzer. Your task is to carefully analyze the provided materials
    (which may include assignment instructions, rubrics, and reference materials) and synthesize them into a 
    comprehensive standardized format that clearly communicates the assignment requirements and grading criteria.
    
    Your analysis should help students understand exactly what they need to do to score 100% on the assignment.
    
    ## MATERIALS FOR ANALYSIS:
    ${content}
    
    ## OUTPUT REQUIREMENTS:
    Analyze all the provided materials together and return a JSON object with the following structure:
    
    {
      "title": "Assignment title",
      "description": "Comprehensive description of the assignment",
      "learning_outcomes": ["Learning outcome 1", "Learning outcome 2", ...],
      "overall_requirements": ["Requirement 1", "Requirement 2", ...],
      "submission_guidelines": "Instructions for submission, formatting, etc.",
      "sections": [
        {
          "section_name": "Name of section (e.g., Introduction, Methods, etc.)",
          "max_score": number (maximum points for this section),
          "description": "Detailed description of this section including what should be included",
          "grading_criteria": {
            "fail": {
              "score_range": "0-49%",
              "criteria": "Detailed description of what constitutes a failing grade",
              "examples": ["Example failure point 1", "Example failure point 2"]
            },
            "pass": {
              "score_range": "50-64%",
              "criteria": "Detailed description of what constitutes a passing grade",
              "examples": ["Example pass point 1", "Example pass point 2"]
            },
            "credit": {
              "score_range": "65-74%",
              "criteria": "Detailed description of what constitutes a credit grade",
              "examples": ["Example credit point 1", "Example credit point 2"]
            },
            "distinction": {
              "score_range": "75-84%",
              "criteria": "Detailed description of what constitutes a distinction grade",
              "examples": ["Example distinction point 1", "Example distinction point 2"]
            },
            "high_distinction": {
              "score_range": "85-100%",
              "criteria": "Detailed description of what constitutes a high distinction grade",
              "examples": ["Example HD point 1", "Example HD point 2"]
            }
          },
          "reference_materials": ["Specific reference 1 for this section", "Specific reference 2", ...]
        },
        ...more sections...
      ],
      "general_references": ["General reference 1", "General reference 2", ...],
      "total_marks": total number of marks for the assignment,
      "pass_threshold": typically 50%
    }
    
    IMPORTANT: 
    1. Be as detailed and specific as possible
    2. If any information is not explicitly provided in the materials, use your academic expertise to make reasonable inferences
    3. Ensure each section's grading criteria clearly describe what differentiates each grade level
    4. Include specific examples for each grade level where possible
    5. Make sure your analysis is comprehensive enough that students can understand exactly what they need to do to score 100%
  `;

  try {
    const response = await openai.chat.completions.create({
      model: ACTIVE_MODELS.BACKUP_TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2, // Lower temperature for more precise analysis
      max_tokens: 4000,
    });

    const parsedResult = JSON.parse(response.choices[0].message.content);
    console.log('Successfully analyzed assignment materials with OpenAI');
    
    return validateAnalyzedAssignment(parsedResult);
  } catch (error) {
    console.error('Error analyzing with OpenAI:', error);
    return createDefaultAnalysis();
  }
}

/**
 * Analyze assignment materials using Gemini
 */
async function analyzeWithGemini(content: string): Promise<AnalyzedAssignment> {
  const prompt = `
    You are an expert academic assignment analyzer. Your task is to carefully analyze the provided materials
    (which may include assignment instructions, rubrics, and reference materials) and synthesize them into a 
    comprehensive standardized format that clearly communicates the assignment requirements and grading criteria.
    
    Your analysis should help students understand exactly what they need to do to score 100% on the assignment.
    
    ## MATERIALS FOR ANALYSIS:
    ${content}
    
    ## OUTPUT REQUIREMENTS:
    Analyze all the provided materials together and return a JSON object with the following structure:
    
    {
      "title": "Assignment title",
      "description": "Comprehensive description of the assignment",
      "learning_outcomes": ["Learning outcome 1", "Learning outcome 2", ...],
      "overall_requirements": ["Requirement 1", "Requirement 2", ...],
      "submission_guidelines": "Instructions for submission, formatting, etc.",
      "sections": [
        {
          "section_name": "Name of section (e.g., Introduction, Methods, etc.)",
          "max_score": number (maximum points for this section),
          "description": "Detailed description of this section including what should be included",
          "grading_criteria": {
            "fail": {
              "score_range": "0-49%",
              "criteria": "Detailed description of what constitutes a failing grade",
              "examples": ["Example failure point 1", "Example failure point 2"]
            },
            "pass": {
              "score_range": "50-64%",
              "criteria": "Detailed description of what constitutes a passing grade",
              "examples": ["Example pass point 1", "Example pass point 2"]
            },
            "credit": {
              "score_range": "65-74%",
              "criteria": "Detailed description of what constitutes a credit grade",
              "examples": ["Example credit point 1", "Example credit point 2"]
            },
            "distinction": {
              "score_range": "75-84%",
              "criteria": "Detailed description of what constitutes a distinction grade",
              "examples": ["Example distinction point 1", "Example distinction point 2"]
            },
            "high_distinction": {
              "score_range": "85-100%",
              "criteria": "Detailed description of what constitutes a high distinction grade",
              "examples": ["Example HD point 1", "Example HD point 2"]
            }
          },
          "reference_materials": ["Specific reference 1 for this section", "Specific reference 2", ...]
        },
        ...more sections...
      ],
      "general_references": ["General reference 1", "General reference 2", ...],
      "total_marks": total number of marks for the assignment,
      "pass_threshold": typically 50%
    }
    
    IMPORTANT: 
    1. Be as detailed and specific as possible
    2. If any information is not explicitly provided in the materials, use your academic expertise to make reasonable inferences
    3. Ensure each section's grading criteria clearly describe what differentiates each grade level
    4. Include specific examples for each grade level where possible
    5. Make sure your analysis is comprehensive enough that students can understand exactly what they need to do to score 100%
  `;

  try {
    const result = await geminiAnalyzer.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Gemini response');
    }
    
    const parsedResult = JSON.parse(jsonMatch[0]);
    console.log('Successfully analyzed assignment materials with Gemini');
    
    return validateAnalyzedAssignment(parsedResult);
  } catch (error) {
    console.error('Error analyzing with Gemini:', error);
    return createDefaultAnalysis();
  }
}

/**
 * Validate the analyzed assignment to ensure it has the expected structure
 */
function validateAnalyzedAssignment(analysis: any): AnalyzedAssignment {
  // Ensure required root properties exist
  if (!analysis.title) analysis.title = "Untitled Assignment";
  if (!analysis.description) analysis.description = "No description provided";
  if (!analysis.learning_outcomes || !Array.isArray(analysis.learning_outcomes)) {
    analysis.learning_outcomes = ["Demonstrate understanding of the subject matter"];
  }
  if (!analysis.overall_requirements || !Array.isArray(analysis.overall_requirements)) {
    analysis.overall_requirements = ["Complete all sections of the assignment"];
  }
  if (!analysis.submission_guidelines) {
    analysis.submission_guidelines = "Submit according to university guidelines";
  }
  
  // Ensure sections array exists
  if (!analysis.sections || !Array.isArray(analysis.sections) || analysis.sections.length === 0) {
    analysis.sections = createDefaultSections();
  }
  
  // Validate each section
  analysis.sections = analysis.sections.map(validateSection);
  
  // Ensure general references array exists
  if (!analysis.general_references || !Array.isArray(analysis.general_references)) {
    analysis.general_references = [];
  }
  
  // Ensure total marks is a number
  if (!analysis.total_marks || typeof analysis.total_marks !== 'number') {
    // Calculate from section max scores
    analysis.total_marks = analysis.sections.reduce((total, section) => total + section.max_score, 0);
  }
  
  // Ensure pass threshold is set (default to 50%)
  if (!analysis.pass_threshold || typeof analysis.pass_threshold !== 'number') {
    analysis.pass_threshold = 50;
  }
  
  return analysis;
}

/**
 * Validate a section to ensure it has the expected structure
 */
function validateSection(section: any): EnhancedRubricSection {
  // Ensure required properties exist
  if (!section.section_name) section.section_name = "Unnamed Section";
  if (!section.max_score || typeof section.max_score !== 'number') {
    section.max_score = 20;
  }
  if (!section.description) {
    section.description = `This section assesses your understanding of ${section.section_name.toLowerCase()}`;
  }
  
  // Ensure grading criteria exists and has all grade levels
  if (!section.grading_criteria) section.grading_criteria = {};
  
  // Define default criteria structure
  const defaultCriteria = {
    score_range: "",
    criteria: "",
    examples: []
  };
  
  // Ensure all grade levels exist with proper structure
  if (!section.grading_criteria.fail) {
    section.grading_criteria.fail = {
      ...defaultCriteria,
      score_range: "0-49%",
      criteria: "Does not meet minimum requirements for this section"
    };
  }
  if (!section.grading_criteria.pass) {
    section.grading_criteria.pass = {
      ...defaultCriteria,
      score_range: "50-64%",
      criteria: "Meets basic requirements for this section"
    };
  }
  if (!section.grading_criteria.credit) {
    section.grading_criteria.credit = {
      ...defaultCriteria,
      score_range: "65-74%",
      criteria: "Exceeds basic requirements with some proficiency"
    };
  }
  if (!section.grading_criteria.distinction) {
    section.grading_criteria.distinction = {
      ...defaultCriteria,
      score_range: "75-84%",
      criteria: "Demonstrates high proficiency and understanding"
    };
  }
  if (!section.grading_criteria.high_distinction) {
    section.grading_criteria.high_distinction = {
      ...defaultCriteria,
      score_range: "85-100%",
      criteria: "Excellent work that exceeds expectations"
    };
  }
  
  // Ensure each grade level has examples array
  ['fail', 'pass', 'credit', 'distinction', 'high_distinction'].forEach(level => {
    if (!section.grading_criteria[level].examples || !Array.isArray(section.grading_criteria[level].examples)) {
      section.grading_criteria[level].examples = [];
    }
  });
  
  // Ensure reference materials array exists
  if (!section.reference_materials || !Array.isArray(section.reference_materials)) {
    section.reference_materials = [];
  }
  
  return section;
}

/**
 * Create default sections when analysis fails
 */
function createDefaultSections(): EnhancedRubricSection[] {
  return [
    {
      section_name: "Introduction & Background",
      max_score: 20,
      description: "This section should provide context for the assignment, clearly state the problem or question being addressed, and outline the approach taken.",
      grading_criteria: {
        fail: {
          score_range: "0-49%",
          criteria: "Missing or inadequate introduction. No clear problem statement or context provided.",
          examples: ["No introduction section", "Problem statement entirely unclear or missing"]
        },
        pass: {
          score_range: "50-64%",
          criteria: "Basic introduction provided with a simple problem statement and minimal context.",
          examples: ["Problem is stated but lacks specificity", "Context is minimal and superficial"]
        },
        credit: {
          score_range: "65-74%",
          criteria: "Good introduction with clear problem statement and adequate context. Approach is outlined.",
          examples: ["Clear problem statement with some specific details", "Adequate background information provided"]
        },
        distinction: {
          score_range: "75-84%",
          criteria: "Well-developed introduction with clear problem statement and thorough context. Approach is well justified.",
          examples: ["Comprehensive problem definition with specific details", "Thorough background with relevant literature"]
        },
        high_distinction: {
          score_range: "85-100%",
          criteria: "Excellent introduction with comprehensive context, clear problem statement, and strong justification for the approach. Shows exceptional understanding of the topic's importance.",
          examples: ["Exceptional problem definition that identifies gaps in current knowledge", "Comprehensive background that synthesizes multiple perspectives"]
        }
      },
      reference_materials: ["Course textbook chapters 1-3", "Lecture notes on problem definition"]
    },
    {
      section_name: "Methodology & Approach",
      max_score: 20,
      description: "This section should detail the methods, tools, and techniques used to address the problem. It should justify the chosen approaches and explain how they are appropriate for the task.",
      grading_criteria: {
        fail: {
          score_range: "0-49%",
          criteria: "Methodology missing, severely flawed, or inappropriate for the problem.",
          examples: ["No methodology section", "Methods described are unsuitable for the stated problem"]
        },
        pass: {
          score_range: "50-64%",
          criteria: "Basic methodology described with some relevance to the problem, but lacks detail or justification.",
          examples: ["Methods described but with minimal detail", "Little to no justification for chosen approach"]
        },
        credit: {
          score_range: "65-74%",
          criteria: "Good methodology with appropriate techniques and tools. Some justification provided.",
          examples: ["Clear description of methods with adequate detail", "Some justification for methodological choices"]
        },
        distinction: {
          score_range: "75-84%",
          criteria: "Well-designed methodology with clear justification for choices made. Limitations addressed.",
          examples: ["Detailed description of methods with strong justification", "Discussion of method limitations and how they were addressed"]
        },
        high_distinction: {
          score_range: "85-100%",
          criteria: "Excellent methodology with innovative approaches, thorough justification, and comprehensive consideration of limitations. Methods are explained in a way that would allow replication.",
          examples: ["Exceptionally detailed methodology with strong theoretical grounding", "Innovative methods or novel application of existing methods"]
        }
      },
      reference_materials: ["Research methods handbook", "Published papers using similar methodologies"]
    },
    {
      section_name: "Results & Analysis",
      max_score: 20,
      description: "This section should present the findings clearly and analyze them thoroughly. Results should be presented in an appropriate format (tables, graphs, etc.) and interpreted accurately.",
      grading_criteria: {
        fail: {
          score_range: "0-49%",
          criteria: "Results missing, inadequate, or inaccurate. Little to no analysis provided.",
          examples: ["Results missing or severely incomplete", "Major errors in data presentation or interpretation"]
        },
        pass: {
          score_range: "50-64%",
          criteria: "Basic results presented with minimal analysis. Some inaccuracies or gaps may be present.",
          examples: ["Results presented but with minimal organization", "Basic analysis with limited depth"]
        },
        credit: {
          score_range: "65-74%",
          criteria: "Good results with adequate analysis and interpretation. Results logically organized.",
          examples: ["Well-organized presentation of results", "Clear analysis that connects to the research question"]
        },
        distinction: {
          score_range: "75-84%",
          criteria: "Thorough results with detailed analysis and clear interpretation. Results well-presented and comprehensive.",
          examples: ["Comprehensive presentation of all relevant results", "Thoughtful analysis that considers multiple perspectives"]
        },
        high_distinction: {
          score_range: "85-100%",
          criteria: "Exceptional results with sophisticated analysis, critical interpretation, and connection to broader context. Results presentation is exemplary.",
          examples: ["Exceptional presentation of results with optimal format choices", "Deep analysis that reveals insights beyond the obvious"]
        }
      },
      reference_materials: ["Data visualization guidelines", "Statistical analysis examples"]
    },
    {
      section_name: "Discussion & Conclusion",
      max_score: 20,
      description: "This section should interpret the results in the context of the problem, compare findings with existing literature, discuss implications, address limitations, and suggest future directions.",
      grading_criteria: {
        fail: {
          score_range: "0-49%",
          criteria: "Discussion missing or fails to address the findings. No meaningful conclusions drawn.",
          examples: ["No discussion of results", "Conclusions missing or unrelated to findings"]
        },
        pass: {
          score_range: "50-64%",
          criteria: "Basic discussion that addresses some key findings. Simple conclusions drawn with limited context.",
          examples: ["Limited discussion that restates results", "Basic conclusions without depth"]
        },
        credit: {
          score_range: "65-74%",
          criteria: "Good discussion with clear conclusions and some implications. Some connection to literature.",
          examples: ["Discussion links results to research question", "Conclusions supported by the findings"]
        },
        distinction: {
          score_range: "75-84%",
          criteria: "Thorough discussion with well-supported conclusions and clear implications. Strong connection to literature and consideration of limitations.",
          examples: ["Discussion that contextualizes findings within field", "Thoughtful exploration of implications"]
        },
        high_distinction: {
          score_range: "85-100%",
          criteria: "Exceptional discussion with insightful conclusions, significant implications, and thoughtful suggestions for future work. Masterful integration with existing literature.",
          examples: ["Discussion that reveals new insights or perspectives", "Conclusions that make a meaningful contribution to the field"]
        }
      },
      reference_materials: ["Key theoretical papers in the field", "Recent research on similar topics"]
    },
    {
      section_name: "Presentation & Documentation",
      max_score: 20,
      description: "This section evaluates the overall quality of writing, formatting, citations, and adherence to academic conventions. The work should be well-organized, clear, and professional.",
      grading_criteria: {
        fail: {
          score_range: "0-49%",
          criteria: "Poor presentation with significant errors in formatting, grammar, or citations. Documentation inadequate or missing.",
          examples: ["Numerous grammatical errors that impede comprehension", "Citations missing or incorrectly formatted"]
        },
        pass: {
          score_range: "50-64%",
          criteria: "Basic presentation with acceptable formatting and minimal grammar errors. Citations present but may have inconsistencies.",
          examples: ["Some grammatical errors but meaning remains clear", "Citations present but with formatting inconsistencies"]
        },
        credit: {
          score_range: "65-74%",
          criteria: "Good presentation with proper formatting, clarity, and few errors. Citations correctly formatted and consistent.",
          examples: ["Writing is clear with minor grammatical errors", "Citations correctly formatted with minor inconsistencies"]
        },
        distinction: {
          score_range: "75-84%",
          criteria: "Well-presented with professional formatting, excellent clarity, and proper citations. Documentation is thorough and follows all conventions.",
          examples: ["Writing is clear, concise, and virtually error-free", "Citations perfectly formatted and comprehensive"]
        },
        high_distinction: {
          score_range: "85-100%",
          criteria: "Exceptional presentation with flawless formatting, exceptional clarity, and comprehensive documentation. Writing is engaging and sophisticated.",
          examples: ["Writing is not only clear but engaging and sophisticated", "Documentation is exemplary and enhances the work's credibility"]
        }
      },
      reference_materials: ["Academic writing guide", "Citation style guide"]
    }
  ];
}

/**
 * Create a default analyzed assignment when analysis fails
 */
function createDefaultAnalysis(): AnalyzedAssignment {
  return {
    title: "Academic Assignment",
    description: "This is a default analysis generated when the system couldn't process the provided materials. The assignment appears to be an academic task requiring research, analysis, and presentation of findings.",
    learning_outcomes: [
      "Demonstrate understanding of the subject matter",
      "Apply appropriate methodologies to address academic problems",
      "Analyze and interpret findings effectively",
      "Communicate academic work clearly and professionally"
    ],
    overall_requirements: [
      "Complete all sections of the assignment",
      "Follow academic conventions for writing and citations",
      "Use evidence to support arguments and conclusions",
      "Submit work that is original and properly referenced"
    ],
    submission_guidelines: "Submit according to university guidelines. Ensure proper formatting, citation style, and adherence to word limits if specified.",
    sections: createDefaultSections(),
    general_references: [
      "Course textbook and reading materials",
      "Lecture notes and supplementary materials",
      "Academic journals relevant to the topic"
    ],
    total_marks: 100,
    pass_threshold: 50
  };
}