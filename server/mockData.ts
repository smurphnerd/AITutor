/**
 * Mock data for testing without using AI APIs
 * This allows us to test the progress tracking and UI without consuming API usage
 */

export const MOCK_ASSIGNMENT_SCHEMA = {
  assignment_title: "Project Management Assignment 2",
  marking_schema_type: "qualitative" as const,
  sections: [
    {
      section_name: "Project Planning",
      criteria: {
        fail: { description: "Poor planning approach", examples: ["No clear timeline", "Missing deliverables"] },
        pass: { description: "Basic planning evident", examples: ["Simple timeline", "Basic milestones"] },
        credit: { description: "Good planning structure", examples: ["Detailed timeline", "Clear milestones"] },
        distinction: { description: "Excellent planning", examples: ["Comprehensive plan", "Risk assessment"] },
        high_distinction: { description: "Outstanding planning", examples: ["Advanced techniques", "Innovation"] }
      }
    },
    {
      section_name: "Team Management",
      criteria: {
        fail: { description: "No team coordination", examples: ["No role definition", "Poor communication"] },
        pass: { description: "Basic team structure", examples: ["Simple roles", "Regular meetings"] },
        credit: { description: "Good team dynamics", examples: ["Clear roles", "Effective communication"] },
        distinction: { description: "Excellent leadership", examples: ["Strong coordination", "Conflict resolution"] },
        high_distinction: { description: "Outstanding leadership", examples: ["Team motivation", "Strategic thinking"] }
      }
    },
    {
      section_name: "Documentation Quality",
      criteria: {
        fail: { description: "Poor documentation", examples: ["Incomplete records", "No structure"] },
        pass: { description: "Basic documentation", examples: ["Simple records", "Basic structure"] },
        credit: { description: "Good documentation", examples: ["Clear structure", "Comprehensive records"] },
        distinction: { description: "Excellent documentation", examples: ["Professional format", "Detailed analysis"] },
        high_distinction: { description: "Outstanding documentation", examples: ["Industry standard", "Exceptional detail"] }
      }
    }
  ],
  general_instructions: "Assess the student's project management capabilities",
  submission_requirements: "Submit project plan, team coordination evidence, and documentation"
};

export const MOCK_GRADING_RESULT = {
  overall_grade: "Credit",
  section_grades: [
    {
      section_name: "Project Planning",
      grade: "Credit",
      feedback: "Good project planning approach with clear timeline and milestones. Could benefit from more detailed risk assessment.",
      strengths: ["Clear project timeline", "Well-defined milestones", "Logical task sequencing"],
      improvements: ["Add risk assessment", "Include contingency planning", "More detailed resource allocation"],
      evidence: ["Gantt chart provided", "Milestone definitions clear", "Task dependencies identified"]
    },
    {
      section_name: "Team Management",
      grade: "Distinction",
      feedback: "Excellent team management with clear role definitions and strong communication strategies.",
      strengths: ["Clear role assignments", "Regular team meetings", "Effective conflict resolution"],
      improvements: ["Document team performance metrics", "Include team development strategies"],
      evidence: ["Team charter provided", "Meeting minutes included", "Role matrix clear"]
    },
    {
      section_name: "Documentation Quality",
      grade: "Credit",
      feedback: "Good documentation quality with clear structure. Some sections could be more comprehensive.",
      strengths: ["Professional formatting", "Clear section headings", "Good use of diagrams"],
      improvements: ["More detailed analysis", "Include more supporting evidence", "Better referencing"],
      evidence: ["Well-structured document", "Appropriate use of visuals", "Consistent formatting"]
    }
  ],
  overall_feedback: "This is a solid project management submission demonstrating good understanding of key concepts. The student shows competency in planning and team management with particularly strong leadership skills. Documentation quality is good but could be enhanced with more detailed analysis and supporting evidence.",
  recommendations: [
    "Develop more comprehensive risk management strategies",
    "Include quantitative performance metrics for team management",
    "Enhance documentation with more detailed analysis and supporting evidence",
    "Consider using advanced project management tools and techniques"
  ],
  schema_type: "qualitative" as const
};

export const MOCK_AI_DELAY = 2000; // 2 seconds to simulate AI processing time