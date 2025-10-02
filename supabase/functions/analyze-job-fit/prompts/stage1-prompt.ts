const STAGE1_SYSTEM_CONTEXT = `You extract requirements and keywords from job descriptions. You never see candidate information. 

CRITICAL: Do NOT extract "equivalent experience" alternatives to degrees. Extract degree requirements, field requirements, years of experience (general and role-specific), skills, and keywords. Use structured categories.`;

const STAGE1_EXTRACTION_RULES = `EXTRACTION RULES:

1. EDUCATION REQUIREMENTS:
   - DEGREE LEVEL: Extract as "education_degree" category
     * "Bachelor's degree" → minimumDegreeLevel: "Bachelor's"
     * "Master's degree" → minimumDegreeLevel: "Master's"
     * "PhD" or "Doctorate" → minimumDegreeLevel: "PhD"
     * "Associate degree" → minimumDegreeLevel: "Associate"
   
   - FIELD REQUIREMENTS: Extract as "education_field" category if specified
     * "Bachelor's in Computer Science" → requiredField: "Computer Science"
     * "STEM degree" → fieldCriteria: "STEM"
     * "Technical degree" → fieldCriteria: "Technical field"
   
   - CRITICAL: IGNORE "or equivalent experience" alternatives FOR EDUCATION ONLY
     * "Bachelor's degree or equivalent practical experience" → Extract ONLY "Bachelor's degree"
     * Do NOT create separate requirement for "equivalent experience"
     * This rule applies ONLY to education requirements, NOT to work experience requirements
   
   - FOR WORK EXPERIENCE: Keep "or related/similar" phrases intact
     * "3 years in product management or related technical role" → Extract the FULL phrase
     * "5 years in engineering or similar field" → Extract the FULL phrase

2. 2. YEARS OF EXPERIENCE:
   - Extract as "years_experience" category
   - "5+ years of experience" → minimumYears: 5, specificRole: null (general experience)
   - "3+ years in product management" → minimumYears: 3, specificRole: "product management"
   - "2-4 years as software engineer" → minimumYears: 2, specificRole: "software engineering"
   
   - HANDLING "OR" REQUIREMENTS:
     * "3+ years in X or related role" → minimumYears: 3, specificRole: "X or related role"
     * Keep the full phrase including "or related" to signal flexible matching
     * "5+ years in marketing or similar field" → minimumYears: 5, specificRole: "marketing or similar field"

3. ROLE/TITLE REQUIREMENTS:
   - Extract as "role_title" category
   - "Experience as a Product Manager" → requiredTitleKeywords: ["Product Manager"]
   - "Background in data science or analytics" → requiredTitleKeywords: ["data science", "analytics"]

4. SKILLS AND COMPETENCIES:
   - technical_skill: Tools, technologies, programming languages, certifications
   - soft_skill: Leadership, communication, problem-solving
   - domain_knowledge: Industry-specific knowledge, methodologies

5. IMPORTANCE LEVELS (with scoring weights):
   - absolute: Explicitly non-negotiable (e.g., "Must be US citizen", "Security clearance required") (weight: 1.0, caps score at 79% if missing)
   - critical: Must-have, required, essential (explicitly stated as required) (weight: 1.0)
   - high: Required qualification (weight: 1.0)
   - medium: Preferred, strongly desired, somewhat important (weight: 0.75)
   - low: Nice to have, plus if you have, bonus qualification (weight: 0.5)

6. KEYWORDS: Extract ALL relevant terms from job description (technical terms, skills, domain terms, action verbs, industry jargon)

CRITICAL RULES:
- Do NOT extract "equivalent experience" as an alternative to education
- Split compound requirements (e.g., "SQL and Python" = 2 requirements)
- Do NOT extract company names, project names, or candidate-specific details
- Only extract what is in the job description
- Be precise with importance levels - only use "absolute" for explicitly non-negotiable items`;

const STAGE1_OUTPUT_FORMAT = `Return JSON in this EXACT format:
{
  "jobRequirements": [
    {
      "requirement": "Bachelor's degree",
      "importance": "critical",
      "category": "education_degree",
      "minimumDegreeLevel": "Bachelor's"
    },
    {
      "requirement": "Must be US citizen or have work authorization",
      "importance": "absolute",
      "category": "domain_knowledge"
    },
    {
      "requirement": "Degree in Computer Science or related field",
      "importance": "high",
      "category": "education_field",
      "requiredField": "Computer Science",
      "fieldCriteria": "Computer Science or related technical field"
    },
    {
      "requirement": "5+ years of professional experience",
      "importance": "critical",
      "category": "years_experience",
      "minimumYears": 5
    },
    {
      "requirement": "3+ years in product management",
      "importance": "critical",
      "category": "years_experience",
      "minimumYears": 3,
      "specificRole": "product management"
    },
    {
      "requirement": "SQL proficiency",
      "importance": "high",
      "category": "technical_skill"
    },
    {
      "requirement": "Experience with Tableau",
      "importance": "medium",
      "category": "technical_skill"
    },
    {
      "requirement": "Familiarity with R programming",
      "importance": "low",
      "category": "technical_skill"
    }
  ],
  "allKeywords": ["keyword1", "keyword2", "keyword3"],
  "jobTitle": "Job title from description",
  "companySummary": "Brief summary of company/role from job description"
}`;

export function buildStage1Prompt(jobDescription: string): string {
  return `You are analyzing a job description to extract requirements and keywords. You will NOT see any candidate information in this stage.

JOB DESCRIPTION:
${jobDescription}

TASK: Extract requirements and keywords from the job description above. Do NOT invent requirements. Only extract what is explicitly stated or clearly implied.

${STAGE1_EXTRACTION_RULES}

${STAGE1_OUTPUT_FORMAT}`;
}

export function getStage1SystemMessage(): string {
  return STAGE1_SYSTEM_CONTEXT;
}
