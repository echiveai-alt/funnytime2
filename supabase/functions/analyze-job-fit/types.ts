// Database types based on your schema
export interface Education {
  id: string;
  user_id: string;
  degree: string;
  field: string;
  school: string;
  graduation_date: string | null;
  is_expected_graduation: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  user_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  user_id: string;
  company_id: string;
  title: string;
  specialty: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface Experience {
  id: string;
  user_id: string;
  role_id: string;
  title: string;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

// Enriched types with joins
export interface ExperienceWithRole extends Experience {
  roles: Role & {
    companies: Company;
  };
}

export interface RoleWithDuration extends Role {
  durationMonths: number;
  durationYears: number;
  company: string;
}

// Job analysis types
// Weighted scoring: absolute/critical/high = 1.0, medium = 0.75, low = 0.5
export type ImportanceLevel = "absolute" | "critical" | "high" | "medium" | "low";

export type RequirementCategory = 
  | "education_degree" 
  | "education_field" 
  | "years_experience"
  | "role_title" 
  | "technical_skill" 
  | "soft_skill" 
  | "domain_knowledge";

export type DegreeLevel = "Other" | "Diploma" | "Associate" | "Bachelor's" | "Master's" | "PhD";

export interface JobRequirement {
  requirement: string;
  importance: ImportanceLevel;
  category: RequirementCategory;
  minimumDegreeLevel?: DegreeLevel;
  requiredField?: string;
  fieldCriteria?: string;
  minimumYears?: number;
  specificRole?: string;
  requiredTitleKeywords?: string[];
}

export interface Stage1Results {
  jobRequirements: JobRequirement[];
  allKeywords: string[];
  jobTitle: string;
  companySummary: string;
}

export interface MatchedRequirement {
  jobRequirement: string;
  experienceEvidence: string;
  experienceSource: string;
}

export interface UnmatchedRequirement {
  requirement: string;
  importance: ImportanceLevel;
}

export interface BulletPoint {
  text: string;
  visualWidth: number;
  exceedsMax: boolean;
  belowMin: boolean;
  isWithinRange: boolean;
  experienceId: string;
  keywordsUsed: string[];
  relevanceScore: number;
}

export interface Stage2Results {
  overallScore: number;
  isFit: boolean;
  fitLevel: string;
  matchedRequirements: MatchedRequirement[];
  unmatchedRequirements: UnmatchedRequirement[];
  bulletPoints?: Record<string, BulletPoint[]>;
  keywordsUsed?: string[];
  keywordsNotUsed?: string[];
  absoluteGaps?: string[];
  absoluteGapExplanation?: string;
  criticalGaps?: string[];
  recommendations?: {
    forCandidate: string[];
  };
}

export interface UnifiedAnalysisResult extends Stage2Results {
  jobRequirements: JobRequirement[];
  allKeywords: string[];
  jobTitle: string;
  companySummary: string;
  resumeBullets?: {
    bulletOrganization: Array<{
      name: string;
      roles: Array<{
        title: string;
        bulletPoints: BulletPoint[];
      }>;
    }>;
    keywordsUsed: string[];
    keywordsNotUsed: string[];
    generatedFrom: {
      totalExperiences: number;
      keywordMatchType: string;
      scoreThreshold: number;
      visualWidthRange: {
        min: number;
        max: number;
        target: number;
      };
    };
  };
  actionPlan: {
    readyForApplication: boolean;
    readyForBulletGeneration: boolean;
    criticalGaps: string[];
    absoluteGaps?: string[];
  };
  limitReached?: {
    type: 'bullets' | 'analyses';
    message: string;
  };
}

export interface EducationCheckResult {
  meets: boolean;
  evidence: string;
  source: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface LogContext {
  userId?: string;
  stage?: string;
  attempt?: number;
  [key: string]: any;
}
