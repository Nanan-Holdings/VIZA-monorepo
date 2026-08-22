export type InterviewRole = "assistant" | "user";

export type InterviewPurpose =
  | "tourism"
  | "business"
  | "family_visit"
  | "medical"
  | "other";

export interface ApplicantProfile {
  purpose: InterviewPurpose;
  purposeDetails: string;
  destinations: string;
  travelDates: string;
  duration: string;
  funding: string;
  budget: string;
  occupation: string;
  employer: string;
  homeTies: string;
  previousTravel: string;
}

export interface InterviewOfficer {
  id: "standard" | "rapid" | "verification" | "supportive";
  name: string;
  style: string;
}

export type AnswerRequirement =
  | "detail"
  | "destination"
  | "time"
  | "money"
  | "work"
  | "ties"
  | "history";

export interface InterviewQuestion {
  id: string;
  topic: string;
  prompt: string;
  isFollowUp: boolean;
  parentId?: string;
}

export interface AnswerAssessment {
  score: number;
  status: "strong" | "developing" | "weak";
  note: string;
  missingRequirements: AnswerRequirement[];
}

export interface InterviewExchange {
  question: InterviewQuestion;
  answer: string;
  assessment: AnswerAssessment;
  submittedAt: string;
}

export interface InterviewTurnResponse {
  assessment: AnswerAssessment;
  completed: boolean;
  nextQuestion: InterviewQuestion | null;
  nextQuestionIndex: number;
  closingMessage?: string;
}

export interface ReportStrength {
  title: string;
  evidence: string;
}

export interface ReportAction {
  priority: 1 | 2 | 3;
  title: string;
  action: string;
}

export interface InterviewQuestionAnalysis {
  question: string;
  answer: string;
  topic: string;
  score: number;
  status: "strong" | "developing" | "weak";
  note: string;
  responseFramework: string;
}

export interface InterviewReport {
  overallScore: number;
  readiness: "准备充分" | "接近准备" | "需要加强";
  summary: string;
  dimensions: {
    clarity: number;
    specificity: number;
    consistency: number;
    returnIntent: number;
  };
  strengths: ReportStrength[];
  actions: ReportAction[];
  riskFlags: string[];
  questionAnalysis: InterviewQuestionAnalysis[];
  generatedAt: string;
  idempotencyKey: string;
}
