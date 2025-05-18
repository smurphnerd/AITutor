/**
 * Rubrics Configuration
 * 
 * This file provides default rubric sections that can be used when parsing rubric files fails.
 * Customize these templates for different assignment types.
 */

export interface RubricSection {
  name: string;
  maxScore: number;
  criteria: string;
}

// Project Management Assignment Rubric
export const PROJECT_MANAGEMENT_RUBRIC: RubricSection[] = [
  {
    name: "Project Planning & Requirements",
    maxScore: 25,
    criteria: "Evaluates the project plan, including clear objectives, scope definition, timeline, resource allocation, and requirements gathering. Looks for comprehensive planning that addresses stakeholder needs and project constraints."
  },
  {
    name: "Methodology & Process",
    maxScore: 20,
    criteria: "Assesses the choice and implementation of project methodology (Agile, Waterfall, etc.), process documentation, adherence to methodology principles, adaptability, and the reasoning behind methodology selection."
  },
  {
    name: "Risk Management",
    maxScore: 15,
    criteria: "Evaluates risk identification, analysis, prioritization, mitigation strategies, contingency planning, and overall risk management approach throughout the project lifecycle."
  },
  {
    name: "Communication & Stakeholder Management",
    maxScore: 15,
    criteria: "Assesses communication planning, stakeholder analysis, engagement strategies, reporting mechanisms, and evidence of effective communication throughout the project."
  },
  {
    name: "Project Execution & Control",
    maxScore: 15,
    criteria: "Evaluates implementation of the project plan, monitoring processes, corrective actions, change management procedures, and overall control mechanisms."
  },
  {
    name: "Documentation & Presentation",
    maxScore: 10,
    criteria: "Assesses the quality, clarity, organization, and completeness of project documentation, including proper formatting, citation, and professional presentation."
  }
];

// Academic Research Paper Rubric
export const RESEARCH_PAPER_RUBRIC: RubricSection[] = [
  {
    name: "Thesis & Argumentation",
    maxScore: 25,
    criteria: "Evaluates the clarity, originality, and significance of the thesis or research question. Assesses the logical development and support of key arguments throughout the paper."
  },
  {
    name: "Research Quality",
    maxScore: 25,
    criteria: "Assesses the breadth, depth, relevance, and credibility of sources. Evaluates how effectively the research supports the thesis and contributes to the field."
  },
  {
    name: "Analysis & Critical Thinking",
    maxScore: 20,
    criteria: "Evaluates the depth of analysis, synthesis of information from multiple sources, consideration of alternative viewpoints, and original insights provided."
  },
  {
    name: "Organization & Structure",
    maxScore: 15,
    criteria: "Assesses the logical flow of ideas, effective transitions between sections, clear introduction and conclusion, and appropriate use of headings and organization strategies."
  },
  {
    name: "Writing Quality & Style",
    maxScore: 10,
    criteria: "Evaluates grammar, spelling, syntax, vocabulary, sentence variety, and overall adherence to academic writing conventions."
  },
  {
    name: "Citation & Formatting",
    maxScore: 5,
    criteria: "Assesses proper citation of sources using the required style (APA, MLA, Chicago, etc.), consistency in formatting, and accurate reference list/bibliography."
  }
];

// Technical Report Rubric
export const TECHNICAL_REPORT_RUBRIC: RubricSection[] = [
  {
    name: "Technical Content & Accuracy",
    maxScore: 30,
    criteria: "Evaluates technical depth, accuracy of information, appropriate use of technical concepts, and evidence of technical proficiency."
  },
  {
    name: "Methodology & Implementation",
    maxScore: 25,
    criteria: "Assesses the approach to problem-solving, technical design choices, implementation details, and justification of methods used."
  },
  {
    name: "Results & Analysis",
    maxScore: 20,
    criteria: "Evaluates presentation of results, data visualization, interpretation of findings, limitations addressed, and conclusions drawn from technical work."
  },
  {
    name: "Documentation & Structure",
    maxScore: 15,
    criteria: "Assesses organization, completeness, clarity of technical documentation, adherence to technical writing conventions, and appropriate use of sections."
  },
  {
    name: "Technical Language & Presentation",
    maxScore: 10,
    criteria: "Evaluates use of technical terminology, clarity of explanations for technical concepts, quality of diagrams/illustrations, and overall presentation."
  }
];

// Generic Assignment Rubric (fallback if no specific type detected)
export const GENERIC_ASSIGNMENT_RUBRIC: RubricSection[] = [
  {
    name: "Content & Understanding",
    maxScore: 30,
    criteria: "Evaluates the depth, accuracy, and relevance of the content. Assesses understanding of key concepts and application of knowledge."
  },
  {
    name: "Analysis & Critical Thinking",
    maxScore: 25,
    criteria: "Assesses analytical skills, logical reasoning, evaluation of evidence, and original insights provided."
  },
  {
    name: "Organization & Structure",
    maxScore: 20,
    criteria: "Evaluates the logical flow of ideas, clear introduction and conclusion, effective transitions, and overall structure."
  },
  {
    name: "Evidence & Citations",
    maxScore: 15,
    criteria: "Assesses use of supporting evidence, quality of sources, proper citation format, and integration of research."
  },
  {
    name: "Writing Quality & Presentation",
    maxScore: 10,
    criteria: "Evaluates grammar, spelling, sentence structure, academic tone, formatting, and professional presentation."
  }
];

// Default rubric to use when no specific template is specified in aiModels.config.ts
export const DEFAULT_RUBRIC = PROJECT_MANAGEMENT_RUBRIC;