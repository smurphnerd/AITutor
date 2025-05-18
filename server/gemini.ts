import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from "fs/promises";
import path from "path";
import { File } from "@shared/schema";
import config from './config';

// Check if Gemini API key is available
if (!config.ai.gemini) {
  console.warn('GEMINI_API_KEY is not set in environment variables or .env file');
  console.warn('Gemini AI functionality will not work correctly');
}

// Initialize the Google Generative AI with API key from config
const genAI = new GoogleGenerativeAI(config.ai.gemini || "");

// Use more cost-effective Gemini Flash model for text generation
const geminiPro = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.2,
    topP: 0.8,
    topK: 40
  }
});

// Use standard Gemini model for vision capabilities
// The model name has been updated to use a supported version
const geminiProVision = genAI.getGenerativeModel({ 
  model: "gemini-pro-vision", // Using standard vision model instead of flash-vision
  generationConfig: {
    temperature: 0.2,
    topP: 0.8,
    topK: 40
  }
});

// Set safety settings
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

interface RubricSection {
  name: string;
  maxScore: number;
  criteria: string;
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
 * Process a PDF file using Gemini Pro Vision API
 */
export async function processPdfWithGemini(filePath: string): Promise<{ text: string; images: string[]; imageDescriptions: string[] }> {
  const images: string[] = [];
  const imageDescriptions: string[] = [];
  
  try {
    // Read the PDF file
    const dataBuffer = await fs.readFile(filePath);
    
    // Convert to base64 for Gemini
    const base64Data = dataBuffer.toString('base64');
    
    // Create prompt parts with the PDF file
    const promptParts = [
      { text: "Extract all text content from this PDF document and identify any images, figures, charts, or visual elements in it. Provide a brief description of each visual element you find." },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data
        }
      }
    ];
    
    // Add debugging for Gemini API connection
    console.log("Attempting to connect to Gemini API with vision model...");
    console.log("API Key present:", !!config.ai.gemini);
    if (config.ai.gemini) {
      // Log first few characters only for security
      const keyStart = config.ai.gemini.substring(0, 4);
      console.log("API Key starts with:", keyStart + "...");
    } else {
      console.log("Warning: GEMINI_API_KEY environment variable is not set");
    }
    
    // We'll try to check which models are available
    try {
      const models = await genAI.listModels();
      console.log("Available Gemini models:", models.models.map(m => m.name));
    } catch (modelError) {
      console.log("Could not list available models:", modelError.message);
    }
    
    // Generate content using Gemini Vision
    const result = await geminiProVision.generateContent({
      contents: [{ role: "user", parts: promptParts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
      safetySettings
    });
    
    console.log("Successfully received response from Gemini API");
    
    const response = result.response;
    const fullText = response.text();
    
    // Try to identify image descriptions using a regex approach
    const imageRegex = /(?:figure|image|chart|diagram|graph|table)\s*\d+[:\s]+(.*?)(?=(?:figure|image|chart|diagram|graph|table)\s*\d+|\n\n|$)/gi;
    let match;
    
    while ((match = imageRegex.exec(fullText)) !== null) {
      const description = match[1];
      if (description && description.trim().length > 0) {
        imageDescriptions.push(description.trim());
      }
    }
    
    return { text: fullText, images, imageDescriptions };
  } catch (error) {
    console.error("Error processing PDF with Gemini:", error);
    
    // Extract and log error details
    const err = error as any;
    if (err.status) console.error("HTTP Status:", err.status);
    if (err.statusText) console.error("Status Text:", err.statusText);
    if (err.errorDetails) console.error("Error Details:", JSON.stringify(err.errorDetails, null, 2));
    
    // Provide a fallback response
    return { 
      text: "Could not extract text from PDF. The document may be scanned or have security restrictions.", 
      images: [], 
      imageDescriptions: ["This document may contain images that couldn't be processed automatically."] 
    };
  }
}

/**
 * Parse the contents of the rubric file to extract sections
 */
export async function parseRubricWithGemini(rubricFile: File): Promise<RubricSection[]> {
  try {
    // Read processed content from the file's content.json if available
    const contentPath = path.join(path.dirname(rubricFile.path), `${path.basename(rubricFile.path)}.content.json`);
    
    try {
      const content = await fs.readFile(contentPath, 'utf-8');
      const parsedContent = JSON.parse(content);
      
      // Check if we have text content to analyze
      if (!parsedContent.text || parsedContent.text.trim().length === 0) {
        console.log("No text content found in the rubric file, using default sections");
        return getDefaultRubricSections();
      }
      
      console.log("Extracted text from rubric file:", parsedContent.text.substring(0, 200) + "...");
      
      // Use Gemini to extract the rubric sections - with improved prompt
      const prompt = `
        Please analyze this rubric document content and extract the rubric sections:
        
        ${parsedContent.text}
        
        For each section, identify:
        1. The section name/title
        2. The maximum score for that section
        3. The criteria or description for that section
        
        IMPORTANT: Respond ONLY with a JSON array. Do not include any explanatory text, markdown formatting, or code blocks.
        The response should be a valid JSON array with this exact structure:
        [
          {
            "name": "Section Name",
            "maxScore": 10,
            "criteria": "Description of criteria for this section"
          }
        ]
      `;
      
      console.log("Sending rubric text to Gemini for analysis");
      const result = await geminiPro.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096
        },
        safetySettings
      });
      
      const response = result.response;
      let jsonText = response.text();
      console.log("Raw Gemini response:", jsonText.substring(0, 100) + "...");
      
      // Clean up the response to extract only the JSON part
      // Remove any markdown code blocks
      jsonText = jsonText.replace(/```json\s*|\s*```/g, "");
      
      // Try to find JSON array pattern using regex
      const jsonMatch = jsonText.match(/\[\s*\{[\s\S]+\}\s*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
      
      // Another approach: extract everything between the first '[' and the last ']'
      if (jsonText.includes('[') && jsonText.includes(']')) {
        const startIndex = jsonText.indexOf('[');
        const endIndex = jsonText.lastIndexOf(']') + 1;
        if (startIndex < endIndex) {
          jsonText = jsonText.substring(startIndex, endIndex);
        }
      }
      
      console.log("Cleaned JSON to parse:", jsonText.substring(0, 100) + "...");
      
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
        console.log("Successfully parsed JSON response");
      } catch (error) {
        console.error("Error parsing JSON from Gemini response:", error);
        console.log("Response text was:", jsonText);
        
        // If we can't parse the JSON, create a simple structure from the rubric text
        console.log("Creating basic sections from rubric text");
        return createBasicSectionsFromText(parsedContent.text);
      }
      
      // Check if we got a valid array of sections
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Validate each section has the required fields
        const validSections = parsed.filter(section => 
          section && 
          typeof section.name === 'string' && 
          (typeof section.maxScore === 'number' || !isNaN(parseInt(section.maxScore)))
        );
        
        if (validSections.length > 0) {
          // Normalize sections to ensure correct types
          return validSections.map(section => ({
            name: section.name,
            maxScore: typeof section.maxScore === 'number' ? section.maxScore : parseInt(section.maxScore),
            criteria: section.criteria || `Criteria for ${section.name}`
          }));
        }
      } else if (parsed && parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        return parsed.sections;
      }
      
      // If we reach here, create sections from the text
      return createBasicSectionsFromText(parsedContent.text);
      
    } catch (readError) {
      console.error("Error reading content file or parsing Gemini response:", readError);
      return getDefaultRubricSections();
    }
  } catch (error) {
    console.error("Error parsing rubric with Gemini:", error);
    return getDefaultRubricSections();
  }
}

/**
 * Create basic rubric sections by analyzing text patterns
 */
function createBasicSectionsFromText(text: string): RubricSection[] {
  console.log("Creating basic sections from text analysis");
  
  // Look for common section patterns in academic rubrics
  const sections: RubricSection[] = [];
  
  // Try to identify section headings with potential point values
  const sectionRegex = /(?:^|\n)([A-Z][^.!?:]*(?:section|criteria|category|part|area)?[^.!?:]*)(?:\s*[-:]\s*|\s*\(|\s*\[\s*|\s+)(?:up to\s+)?(\d+)(?:\s*(?:points?|marks?|pts?|\/\d+|%))/gi;
  
  let match;
  let remainingText = text;
  let lastIndex = 0;
  
  while ((match = sectionRegex.exec(text)) !== null) {
    const name = match[1].trim();
    const maxScore = parseInt(match[2]);
    
    // Extract criteria (text between this match and next match or end)
    const startPos = match.index + match[0].length;
    const endPos = text.indexOf(match[0], startPos); // Find next section heading
    
    let criteria = "";
    if (endPos !== -1) {
      criteria = text.substring(startPos, endPos).trim();
    } else {
      criteria = text.substring(startPos).trim();
    }
    
    sections.push({
      name,
      maxScore,
      criteria: criteria.substring(0, 200) // Limit length 
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // If we couldn't identify any sections, create default ones
  if (sections.length === 0) {
    return getDefaultRubricSections();
  }
  
  return sections;
}

/**
 * Grade a submission against one or more rubrics using Gemini
 */
export async function gradePapersWithGemini(
  rubricFiles: File[],
  submissionFile: File
): Promise<GradingResult> {
  try {
    console.log("Starting grading process using extracted text with Gemini...");
    
    // Parse all rubrics
    const rubricSections = await Promise.all(
      rubricFiles.map(file => parseRubricWithGemini(file))
    );
    
    // Flatten all sections from all rubrics
    const allSections = rubricSections.flat();
    
    if (allSections.length === 0) {
      console.log("No valid rubric sections found, using default sections");
      return generateErrorResult(
        submissionFile, 
        "Unable to extract valid rubric sections from the provided files."
      );
    }
    
    console.log(`Successfully extracted ${allSections.length} rubric sections`);
    
    // Read submission content
    const submissionContentPath = path.join(
      path.dirname(submissionFile.path),
      `${path.basename(submissionFile.path)}.content.json`
    );
    
    let submissionContent;
    try {
      const content = await fs.readFile(submissionContentPath, 'utf-8');
      submissionContent = JSON.parse(content);
      
      if (!submissionContent.text || submissionContent.text.trim().length === 0) {
        console.error("No text content found in submission");
        return generateErrorResult(
          submissionFile, 
          "No readable text content found in the submission. Please check the file format."
        );
      }
      
      console.log("Extracted submission text:", submissionContent.text.substring(0, 200) + "...");
      
      // Check for image descriptions to include in grading
      const imageDescriptions = submissionContent.imageDescriptions || [];
      if (imageDescriptions.length > 0) {
        console.log(`Found ${imageDescriptions.length} image descriptions to include in grading`);
      }
      
    } catch (error) {
      console.error("Error reading submission content:", error);
      return generateErrorResult(
        submissionFile,
        "Failed to read submission content"
      );
    }
    
    // Calculate total possible score
    const maxPossibleScore = allSections.reduce((sum, section) => sum + section.maxScore, 0);
    console.log(`Maximum possible score based on rubric: ${maxPossibleScore}`);
    
    try {
      // Create a more structured prompt for grading that works with extracted text
      const prompt = `
        As an expert academic grader, please evaluate the student submission based on the rubric sections below.
        
        ## RUBRIC:
        ${JSON.stringify(allSections, null, 2)}
        
        ## STUDENT SUBMISSION TEXT:
        ${submissionContent.text}
        
        ${submissionContent.imageDescriptions && submissionContent.imageDescriptions.length > 0 
          ? `## IMAGE DESCRIPTIONS IN SUBMISSION:
             ${submissionContent.imageDescriptions.join('\n')}`
          : ''}
        
        ## INSTRUCTIONS:
        1. Evaluate the text against each rubric section
        2. For each section, assign a score not exceeding the maximum
        3. Provide specific feedback with strengths and improvement areas
        4. Calculate total score and determine if submission passes (60% threshold)
        
        ## RESPONSE FORMAT - IMPORTANT!
        Return ONLY a valid JSON object without any explanation text or markdown. Format exactly as:
        
        {
          "totalScore": <number>,
          "maxPossibleScore": ${maxPossibleScore},
          "overallFeedback": "<overall assessment>",
          "status": "<pass or fail>",
          "sectionFeedback": {
            "<exact section name>": {
              "score": <number>,
              "maxScore": <section max score>,
              "feedback": "<specific feedback>",
              "strengths": ["<strength 1>", "<strength 2>"],
              "improvements": ["<area to improve 1>", "<area to improve 2>"]
            }
          }
        }
      `;
      
      console.log("Sending grading request to Gemini with extracted text...");
      const result = await geminiPro.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096
        },
        safetySettings
      });
      
      const response = result.response;
      let jsonText = response.text();
      
      // If the response is wrapped in markdown code blocks, extract just the JSON part
      if (jsonText.includes("```json")) {
        jsonText = jsonText.replace(/```json\s*|\s*```/g, "");
      }
      
      let gradingResult;
      try {
        gradingResult = JSON.parse(jsonText);
      } catch (error) {
        console.error("Error parsing grading JSON from Gemini response:", error);
        console.log("Response text was:", jsonText);
        // Fallback to simulated grading
        throw new Error("Failed to parse grading result from Gemini");
      }
      
      // Ensure the response matches our expected format
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
    } catch (aiError) {
      console.error("Gemini error during grading:", aiError);
      
      // Return error result instead of simulated grading
      const errorMessage = aiError instanceof Error ? aiError.message : "Unknown error with AI service";
      return generateErrorResult(submissionFile, errorMessage);
    }
  } catch (error) {
    console.error("Error grading paper with Gemini:", error);
    throw new Error("Failed to grade submission");
  }
}

/**
 * Generate default rubric sections when parsing fails
 */
function getDefaultRubricSections(): RubricSection[] {
  return [
    {
      name: "Introduction & Literature Review",
      maxScore: 20,
      criteria: "Quality of introduction and literature review"
    },
    {
      name: "Methodology",
      maxScore: 20,
      criteria: "Appropriateness and execution of research methodology"
    },
    {
      name: "Results & Discussion",
      maxScore: 50,
      criteria: "Quality of results presentation and discussion"
    },
    {
      name: "Conclusion & References",
      maxScore: 10,
      criteria: "Quality of conclusion and proper referencing"
    }
  ];
}

/**
 * Generate an error result instead of simulated grading when AI service fails
 */
function generateErrorResult(
  submissionFile: File,
  errorMessage: string
): GradingResult {
  return {
    submissionId: submissionFile.id.toString(),
    submissionName: submissionFile.originalname,
    totalScore: 0,
    maxPossibleScore: 0,
    overallFeedback: `⚠️ Error processing with Gemini AI: ${errorMessage}. Please try again later or contact support if the issue persists.`,
    status: 'pending',
    sectionFeedback: {},
    createdAt: new Date().toISOString()
  };
}