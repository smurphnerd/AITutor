import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from "fs/promises";
import path from "path";
import { File } from "@shared/schema";

// Initialize the Google Generative AI with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Use more cost-effective Gemini Flash model for text generation
const geminiPro = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.2,
    topP: 0.8,
    topK: 40
  }
});

// Use Gemini Flash Vision model for processing PDFs and images
const geminiProVision = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash-vision",
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
    console.log("Attempting to connect to Gemini API with flash-vision model...");
    console.log("API Key present:", !!process.env.GEMINI_API_KEY);
    if (process.env.GEMINI_API_KEY) {
      // Log first few characters only for security
      const keyStart = process.env.GEMINI_API_KEY.substring(0, 4);
      console.log("API Key starts with:", keyStart + "...");
    } else {
      console.log("Warning: GEMINI_API_KEY environment variable is not set");
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
      
      // Use Gemini to extract the rubric sections
      const prompt = `
        I have a rubric document with the following content:
        
        ${parsedContent.text}
        
        Please analyze this content and extract the rubric sections. For each section, provide:
        1. The section name/title
        2. The maximum score for that section
        3. The criteria or description for that section
        
        Format your response as a JSON array of objects with the following structure:
        [
          {
            "name": "Section Name",
            "maxScore": 10,
            "criteria": "Description of criteria for this section"
          }
        ]
      `;
      
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
      
      // If the response is wrapped in markdown code blocks, extract just the JSON part
      if (jsonText.includes("```json")) {
        jsonText = jsonText.replace(/```json\s*|\s*```/g, "");
      }
      
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (error) {
        console.error("Error parsing JSON from Gemini response:", error);
        console.log("Response text was:", jsonText);
        // Fall back to default sections
        parsed = getDefaultRubricSections();
      }
      
      // Check if we got a valid array of sections
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.sections && Array.isArray(parsed.sections)) {
        return parsed.sections;
      } else {
        // Fall back to default sections
        return getDefaultRubricSections();
      }
    } catch (readError) {
      console.error("Error reading content file or parsing Gemini response, falling back to default sections:", readError);
      return getDefaultRubricSections();
    }
  } catch (error) {
    console.error("Error parsing rubric with Gemini:", error);
    return getDefaultRubricSections();
  }
}

/**
 * Grade a submission against one or more rubrics using Gemini
 */
export async function gradePapersWithGemini(
  rubricFiles: File[],
  submissionFile: File
): Promise<GradingResult> {
  try {
    // Parse all rubrics
    const rubricSections = await Promise.all(
      rubricFiles.map(file => parseRubricWithGemini(file))
    );
    
    // Flatten all sections from all rubrics
    const allSections = rubricSections.flat();
    
    // Read submission content
    const submissionContentPath = path.join(
      path.dirname(submissionFile.path),
      `${path.basename(submissionFile.path)}.content.json`
    );
    
    let submissionContent;
    try {
      const content = await fs.readFile(submissionContentPath, 'utf-8');
      submissionContent = JSON.parse(content);
    } catch (error) {
      console.error("Error reading submission content:", error);
      throw new Error("Failed to read submission content");
    }
    
    // Calculate total possible score
    const maxPossibleScore = allSections.reduce((sum, section) => sum + section.maxScore, 0);
    
    try {
      // Create a prompt for grading
      const prompt = `
        You are an expert academic grader. I will provide you with a student submission and a rubric.
        Your task is to grade the submission according to the rubric, providing scores and detailed feedback for each section.
        
        # RUBRIC SECTIONS:
        ${allSections.map(section => 
          `## ${section.name} (${section.maxScore} points)
           ${section.criteria}`
        ).join('\n\n')}
        
        # STUDENT SUBMISSION:
        ${submissionContent.text}
        
        ${submissionContent.images && submissionContent.images.length > 0 
          ? `# IMAGES IN SUBMISSION:
             The document contains ${submissionContent.images.length} images. 
             These images should be considered as part of the assessment.
             Image descriptions: ${submissionContent.imageDescriptions?.join('; ') || 'No descriptions available'}`
          : ''}
        
        # GRADING INSTRUCTIONS:
        1. Evaluate the submission against each rubric section
        2. Assign a score for each section (should not exceed the maximum score)
        3. Provide detailed feedback for each section, including strengths and areas for improvement
        4. Calculate the total score
        5. Provide an overall assessment
        6. Determine if the submission should pass or fail (pass requires >= 60% of total possible score)
        
        Format your response as a JSON object with the following structure:
        {
          "totalScore": number,
          "maxPossibleScore": ${maxPossibleScore},
          "overallFeedback": "Detailed overall feedback",
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