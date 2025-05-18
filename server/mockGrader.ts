/**
 * This module provides a basic grading implementation when AI services are unavailable
 * or encounter errors. It ensures the application can still function with proper error
 * feedback rather than failing completely.
 */

import { File } from "@shared/schema";
import { 
  RubricSection, 
  DEFAULT_RUBRIC,
  PROJECT_MANAGEMENT_RUBRIC
} from './rubrics.config';

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
 * Generate error feedback when AI service encounters problems
 */
export function generateErrorGradingResult(
  submissionFile: File,
  errorMessage: string,
  rubricSections: RubricSection[] = []
): GradingResult {
  const sections = rubricSections.length > 0 
    ? rubricSections 
    : getDefaultRubricSections();
  
  // Create section feedback with error messages
  const sectionFeedback: Record<string, SectionFeedback> = {};
  
  // Add error message to each section
  sections.forEach(section => {
    sectionFeedback[section.name] = {
      score: 0,
      maxScore: section.maxScore,
      feedback: `Unable to grade this section: ${errorMessage}`,
      strengths: [],
      improvements: ["Try again later when the AI service is available"]
    };
  });
  
  // Calculate total possible score
  const maxPossibleScore = sections.reduce((sum, section) => sum + section.maxScore, 0);
  
  return {
    submissionId: submissionFile.id.toString(),
    submissionName: submissionFile.originalname,
    totalScore: 0,
    maxPossibleScore: maxPossibleScore,
    overallFeedback: `⚠️ Error: ${errorMessage}. The AI grading service encountered an issue and could not grade this submission. Please try again later.`,
    status: 'pending',
    sectionFeedback,
    createdAt: new Date().toISOString()
  };
}

/**
 * Default rubric sections to use when none can be extracted
 * Uses configuration from rubrics.config.ts
 */
export function getDefaultRubricSections(): RubricSection[] {
  // Return the configured default rubric from our configuration file
  return DEFAULT_RUBRIC;
}