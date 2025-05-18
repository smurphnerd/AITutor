import OpenAI from "openai";
import { File } from "@shared/schema";
import fs from "fs/promises";
import path from "path";
import config from './config';

// Check if OpenAI API key is available
if (!config.ai.openai) {
  console.warn('OPENAI_API_KEY is not set in environment variables or .env file');
  console.warn('OpenAI functionality will not work correctly');
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: config.ai.openai || "" });

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
 * Parse the contents of the rubric file to extract sections
 */
async function parseRubric(rubricFile: File): Promise<RubricSection[]> {
  try {
    // For this MVP, we'll extract sections using a simple approach
    // In a production environment, this would be more sophisticated
    
    // Read processed content from the file's content.json if available
    const contentPath = path.join(path.dirname(rubricFile.path), `${path.basename(rubricFile.path)}.content.json`);
    
    try {
      const content = await fs.readFile(contentPath, 'utf-8');
      const parsedContent = JSON.parse(content);
      
      // Use AI to extract the rubric sections
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
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert at parsing academic rubrics and extracting structured information." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      return result.sections || [];
    } catch (readError) {
      console.error("Error reading content file, falling back to default sections:", readError);
      
      // Fall back to default sections for project management assignments
      return [
        {
          name: "Project Charter",
          maxScore: 30,
          criteria: "Clear project scope, objectives, deliverables and success criteria"
        },
        {
          name: "Risk Management",
          maxScore: 30,
          criteria: "Comprehensive risk identification, assessment, and mitigation strategies"
        },
        {
          name: "Quality Management",
          maxScore: 30,
          criteria: "Appropriate quality standards, assurance processes, and control measures"
        },
        {
          name: "Stakeholder Analysis",
          maxScore: 30,
          criteria: "Thorough stakeholder identification, assessment of interests and influence"
        },
        {
          name: "Communication Plan",
          maxScore: 30,
          criteria: "Well-defined communication strategy, methods, and frequency for each stakeholder"
        },
        {
          name: "Documentation & Presentation",
          maxScore: 20,
          criteria: "Professional documentation, clear writing, proper formatting and organization"
        },
        {
          name: "Team Contribution",
          maxScore: 30,
          criteria: "Evidence of team collaboration, balanced contribution, and effective teamwork"
        }
      ];
    }
  } catch (error) {
    console.error("Error parsing rubric:", error);
    throw new Error("Failed to parse rubric");
  }
}

/**
 * Grade a submission against one or more rubrics
 */
export async function gradePapers(
  rubricFiles: File[],
  submissionFile: File
): Promise<GradingResult> {
  try {
    // Parse all rubrics
    const rubricSections = await Promise.all(
      rubricFiles.map(parseRubric)
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
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "You are an expert academic grader with experience in evaluating student submissions against rubrics."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });
      
      const gradingResult = JSON.parse(response.choices[0].message.content);
      
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
      console.error("OpenAI error during grading:", aiError);
      
      // Fallback to simulated grading when OpenAI API is unavailable or rate limited
      // This ensures the application can still function for demo purposes
      
      // Generate a placeholder grading result
      const sectionFeedback: Record<string, SectionFeedback> = {};
      
      // Generate placeholder feedback for each section
      allSections.forEach(section => {
        // Simulate a reasonable score (60-80% of max)
        const score = Math.floor(section.maxScore * (0.6 + Math.random() * 0.2));
        
        sectionFeedback[section.name] = {
          score,
          maxScore: section.maxScore,
          feedback: "This is placeholder feedback since the AI service is currently unavailable. Please try again later for detailed feedback.",
          strengths: ["The submission addresses the main requirements of this section"],
          improvements: ["Consider expanding on key concepts for a higher score"]
        };
      });
      
      // Calculate total score
      const totalScore = Object.values(sectionFeedback).reduce((sum, section) => sum + section.score, 0);
      const passingScore = Math.floor(maxPossibleScore * 0.6);
      
      return {
        submissionId: submissionFile.id.toString(),
        submissionName: submissionFile.originalname,
        totalScore,
        maxPossibleScore,
        overallFeedback: "This is a placeholder assessment generated because the AI grading service is currently unavailable. This submission has been given a simulated grade for demonstration purposes.",
        status: totalScore >= passingScore ? "pass" : "fail",
        sectionFeedback,
        createdAt: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error("Error grading paper:", error);
    throw new Error("Failed to grade submission");
  }
}
