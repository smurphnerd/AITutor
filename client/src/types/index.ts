export interface FileUploadResponse {
  id: string;
  originalname: string;
  mimetype: string;
  size: number;
  fileType: 'rubric' | 'submission';
}

export interface RubricSection {
  name: string;
  maxScore: number;
  criteria?: string;
}

export interface FeedbackItem {
  text: string;
  type: 'strength' | 'improvement';
}

export interface SectionFeedback {
  score: number;
  maxScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface GradingResult {
  id: string;
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

export interface GradingRequest {
  rubricIds: string[];
  submissionIds: string[];
}

export interface ProcessingStatus {
  status: 'processing' | 'complete' | 'error';
  progress: number;
  currentFile?: string;
  totalFiles?: number;
  error?: string;
}
