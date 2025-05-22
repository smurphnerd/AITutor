/**
 * Dynamic Assignment Schema Types
 * 
 * Flexible types that adapt to different assignment marking formats
 */

export type MarkingSchemaType = 'qualitative' | 'numerical' | 'weighted' | 'hybrid';

export interface QualitativeCriteria {
  fail: { description: string; examples: string[] };
  pass: { description: string; examples: string[] };
  credit: { description: string; examples: string[] };
  distinction: { description: string; examples: string[] };
  high_distinction: { description: string; examples: string[] };
}

export interface NumericalMarkRange {
  range: string; // e.g., "0-49", "50-64"
  grade: string; // corresponding grade band
  description: string;
  examples: string[];
}

export interface NumericalCriteria {
  mark_ranges: NumericalMarkRange[];
}

export interface AssignmentSection {
  section_name: string;
  section_weight?: number; // Percentage if weighted, points if numerical, null if qualitative
  criteria: QualitativeCriteria | NumericalCriteria;
}

export interface AssignmentSchema {
  assignment_title: string;
  marking_schema_type: MarkingSchemaType;
  total_possible_marks?: number; // Only if numerical/weighted
  sections: AssignmentSection[];
  general_instructions: string;
  submission_requirements: string;
}

// Grading result types that adapt to the schema
export interface SectionGrade {
  section_name: string;
  grade: string; // Grade band OR numerical score
  marks_awarded?: number; // Only if numerical schema
  max_marks?: number; // Only if numerical schema
  feedback: string;
  strengths: string[];
  improvements: string[];
  evidence: string[];
}

export interface GradingResult {
  overall_grade: string;
  total_marks?: number; // Only if numerical schema
  max_possible_marks?: number; // Only if numerical schema
  section_grades: SectionGrade[];
  overall_feedback: string;
  recommendations: string[];
  schema_type: MarkingSchemaType; // For frontend rendering
}

// Type guards to help with schema validation
export function isQualitativeCriteria(criteria: any): criteria is QualitativeCriteria {
  return criteria && 
    typeof criteria.fail === 'object' &&
    typeof criteria.pass === 'object' &&
    typeof criteria.credit === 'object' &&
    typeof criteria.distinction === 'object' &&
    typeof criteria.high_distinction === 'object';
}

export function isNumericalCriteria(criteria: any): criteria is NumericalCriteria {
  return criteria && 
    Array.isArray(criteria.mark_ranges) &&
    criteria.mark_ranges.length > 0;
}

export function validateAssignmentSchema(schema: any): schema is AssignmentSchema {
  return schema &&
    typeof schema.assignment_title === 'string' &&
    ['qualitative', 'numerical', 'weighted', 'hybrid'].includes(schema.marking_schema_type) &&
    Array.isArray(schema.sections) &&
    schema.sections.length > 0 &&
    typeof schema.general_instructions === 'string' &&
    typeof schema.submission_requirements === 'string';
}