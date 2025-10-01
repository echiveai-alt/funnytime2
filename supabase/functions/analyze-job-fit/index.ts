import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-keyword-match-type',
};

const CONSTANTS = {
  FIT_THRESHOLD: 80,
  VISUAL_WIDTH_MIN: 150,
  VISUAL_WIDTH_MAX: 179,
  VISUAL_WIDTH_TARGET: 165,
} as const;

class AnalysisError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

// Enhanced requirement structure
interface JobRequirement {
  requirement: string;
  importance: "critical" | "high" | "medium" | "low";
  category: "education_degree" | "education_field" | "years_experience" | 
            "role_title" | "technical_skill" | "soft_skill" | "domain_knowledge";
  
  // For education_degree
  minimumDegreeLevel?: "Associate" | "Bachelor's" | "Master's" | "PhD";
  
  // For education_field
  requiredField?: string;
  fieldCriteria?: string; // e.g., "STEM", "Business-related", "Technical field"
  
  // For years_experience
  minimumYears?: number;
  specificRole?: string; // e.g., "product management", "software engineering"
  
  // For role_title
  requiredTitleKeywords?: string[];
}

// Degree hierarchy - numeric for easy comparison
const DEGREE_HIERARCHY = {
  "Other": 0,
  "Diploma": 0,
  "Associate": 1,
  "Bachelor's": 2,
  "Master's": 3,
  "PhD": 4
} as const;

type DegreeLevel = keyof typeof DEGREE_HIERARCHY;

// Helper function to get numeric degree level
function getDegreeLevel(degree: string): number {
  return DEGREE_HIERARCHY[degree as DegreeLevel] ?? 0;
}

// Helper function to check if education meets degree requirement
function meetsEducationRequirement(
  userEducation: any[], 
  requiredDegreeLevel: string
): { meets: boolean; evidence: string; source: string } {
  if (userEducation.length === 0) {
    return { meets: false, evidence: "", source: "" };
  }

  // Get user's highest degree
  const highestDegree = userEducation.reduce((highest, edu) => {
    const currentLevel = getDegreeLevel(edu.degree);
    const highestLevel = getDegreeLevel(highest.degree);
    return currentLevel > highestLevel ? edu : highest;
  }, userEducation[0]);

  const userLevel = getDegreeLevel(highestDegree.degree);
  const requiredLevel = getDegreeLevel(requiredDegreeLevel);

  const meets = userLevel >= requiredLevel;

  return {
    meets,
    evidence: `${highestDegree.degree}${highestDegree.field ? ` in ${highestDegree.field}` : ''}`,
    source: `Education: ${highestDegree.degree}${highestDegree.field ? ` in ${highestDegree.field}` : ''} from ${highestDegree.school}`
  };
}

// Helper function to extract lowest degree requirement from JD requirements
function getLowestDegreeRequirement(jobRequirements: any[]): string | null {
  const degreeReqs = jobRequirements
    .filter(req => req.category === 'education_degree')
    .map(req => req.minimumDegreeLevel)
    .filter(Boolean);

  if (degreeReqs.length === 0) return null;

  // Return the degree with lowest numeric value (most lenient requirement)
  return degreeReqs.reduce((lowest, current) => {
    return getDegreeLevel(current) < getDegreeLevel(lowest) ? current : lowest;
  });
}

// Helper function to calculate role duration in months
function calculateRoleDuration(startDate: string, endDate: string | null): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  
  const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                 (end.getMonth() - start.getMonth());
  
  return Math.max(0, months);
}

// Helper function to calculate total experience months
function calculateTotalExperienceMonths(roles: any[]): number {
  return roles.reduce((total, role) => {
    return total + calculateRoleDuration(role.start_date, role.end_date);
  }, 0);
}

// Helper function to format education summary
function formatEducationSummary(educationInfo: any[]): string {
  if (educationInfo.length === 0) {
    return "No formal education provided";
  }

  const degreeHierarchy = {
    "PhD": 4,
    "Master's": 3,
    "Bachelor's": 2,
    "Associate": 1,
    "Diploma": 0,
    "Other": 0
  };

  // Find highest degree
  const highestDegree = educationInfo.reduce((highest, edu) => {
    const currentLevel = degreeHierarchy[edu.degree as keyof typeof degreeHierarchy] || 0;
    const highestLevel = degreeHierarchy[highest.degree as keyof typeof degreeHierarchy] || 0;
    return currentLevel > highestLevel ? edu : highest;
  }, educationInfo[0]);

  const summary = educationInfo.map(edu => 
    `- ${edu.degree}${edu.field ? ` in ${edu.field}` : ''} from ${edu.school}`
  ).join('\n');

  return `Highest Degree: ${highestDegree.degree}${highestDegree.field ? ` in ${highestDegree.field}` : ''}

All Education:
${summary}`;
}

// Visual width calculation
function calculateVisualWidth(text: string): number {
  let score = 0;
  for (const char of text) {
    if (char === ' ') score += 0.55;
    else if (['W', 'M', '@', '%', '&'].includes(char)) score += 1.25;
    else if (['m', 'w', 'Q', 'G', 'O', 'D', 'B', 'H', 'N', 'U', 'A', 'K', 'R'].includes(char)) score += 1.15;
    else if (['i', 'l', 'j', 't', 'f', 'r', 'I', 'J', '1', '!', ';', ':', '.', ',', "'", '"', '`', '|', '/'].includes(char)) score += 0.55;
    else if (char === '-') score += 0.70;
    else if (['0', '2', '3', '4', '5', '6', '7', '8', '9'].includes(char)) score += 1.00;
    else if (char >= 'A' && char <= 'Z') score += 1.10;
    else if (char >= 'a' && char <= 'z') score += 1.00;
    else score += 0.80;
  }
  return score;
}

// STAGE 1: Extract requirements and keywords from job description ONLY
function createStage1Prompt(jobDescription: string): string {
  return `You are analyzing a job description to extract requirements and keywords. You will NOT see any candidate information in this stage.

JOB DESCRIPTION:
${jobDescription}

TASK: Extract requirements and keywords from the job description above. Do NOT invent requirements. Only extract what is explicitly stated or clearly implied.

EXTRACTION RULES:

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
   
   - CRITICAL: IGNORE "or equivalent experience" alternatives
     * "Bachelor's degree or equivalent practical experience" → Extract ONLY "Bachelor's degree"
     * Do NOT create separate requirement for "equivalent experience"

2. YEARS OF EXPERIENCE:
   - Extract as "years_experience" category
   - "5+ years of experience" → minimumYears: 5, specificRole: null (general experience)
   - "3+ years in product management" → minimumYears: 3, specificRole: "product management"
   - "2-4 years as software engineer" → minimumYears: 2, specificRole: "software engineering"

3. ROLE/TITLE REQUIREMENTS:
   - Extract as "role_title" category
   - "Experience as a Product Manager" → requiredTitleKeywords: ["Product Manager"]
   - "Background in data science or analytics" → requiredTitleKeywords: ["data science", "analytics"]

4. SKILLS AND COMPETENCIES:
   - technical_skill: Tools, technologies, programming languages, certifications
   - soft_skill: Leadership, communication, problem-solving
   - domain_knowledge: Industry-specific knowledge, methodologies

5. IMPORTANCE LEVELS:
   - critical: Must-have, required, essential (explicitly stated)
   - high: Preferred, strongly desired
   - medium: Nice to have, plus if you have
   - low: Bonus, additional

6. KEYWORDS: Extract ALL relevant terms from job description (technical terms, skills, domain terms, action verbs, industry jargon)

CRITICAL RULES:
- Do NOT extract "equivalent experience" as an alternative to education
- Split compound requirements (e.g., "SQL and Python" = 2 requirements)
- Do NOT extract company names, project names, or candidate-specific details
- Only extract what is in the job description

Return JSON in this EXACT format:
{
  "jobRequirements": [
    {
      "requirement": "Bachelor's degree",
      "importance": "critical",
      "category": "education_degree",
      "minimumDegreeLevel": "Bachelor's"
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
    }
  ],
  "allKeywords": ["keyword1", "keyword2", "keyword3"],
  "jobTitle": "Job title from description",
  "companySummary": "Brief summary of company/role from job description"
}`;
}

// STAGE 2: Match requirements to experiences and generate bullets
function createStage2Prompt(
  stage1Results: any,
  experiencesByRole: Record<string, any[]>,
  educationInfo: any[],
  userRoles: any[],
  keywordMatchType: string
): string {
  const keywordInstruction = keywordMatchType === 'exact' 
    ? 'Use keywords EXACTLY as they appear in the provided keyword list'
    : 'Use keywords and their variations (different tenses, forms, related terms like "managed" for "led")';

  // Calculate total experience duration
  const totalMonths = calculateTotalExperienceMonths(userRoles);
  const totalYears = Math.floor(totalMonths / 12);

  // Format education data
  const educationSummary = formatEducationSummary(educationInfo);
  
  // Format role durations with specialty
  const roleDurations = userRoles.map(role => ({
    title: role.title,
    specialty: role.specialty,
    company: role.company,
    months: calculateRoleDuration(role.start_date, role.end_date),
    years: Math.floor(calculateRoleDuration(role.start_date, role.end_date) / 12)
  }));

  const experiencesText = Object.entries(experiencesByRole)
    .map(([roleKey, exps]) => {
      return `
=== ${roleKey} ===
Number of experiences for this role: ${exps.length}
${exps.map((exp, i) => `
  Experience ${i + 1}:
  - ID: ${exp.id}
  - Title: ${exp.title}
  - Action: ${exp.action}
  - Result: ${exp.result}
  ${exp.situation ? `- Context: ${exp.situation}` : ''}
  ${exp.task ? `- Task: ${exp.task}` : ''}
`).join('')}`;
    }).join('\n');

  return `CANDIDATE PROFILE SUMMARY:

EDUCATION:
${educationSummary}

TOTAL PROFESSIONAL EXPERIENCE:
- Total Duration: ${totalYears} years (${totalMonths} months)

ROLE-SPECIFIC EXPERIENCE:
${roleDurations.map(rd => `- ${rd.title}${rd.specialty ? ` (${rd.specialty})` : ''} at ${rd.company}: ${rd.years} years (${rd.months} months)`).join('\n')}

You are matching a candidate's experiences and education against job requirements that were already extracted from a job description.

JOB REQUIREMENTS (extracted in previous stage):
${JSON.stringify(stage1Results.jobRequirements, null, 2)}

KEYWORDS TO EMBED (extracted in previous stage):
${JSON.stringify(stage1Results.allKeywords, null, 2)}

CANDIDATE EXPERIENCES (GROUPED BY ROLE):
${experiencesText}

MATCHING RULES - STRUCTURED AND PRECISE:

1. EDUCATION FIELD MATCHING (if applicable):
   If job requires a specific field or field criteria (e.g., "Computer Science", "STEM", "Technical field"):
   
   - Use your knowledge to determine if candidate's field meets the criteria
   - Consider ALL of the candidate's education fields (they may have multiple degrees)
   - "Actuarial Science" for "STEM" requirement → likely MATCH
   - "Computer Science" for "Computer Science or related" → MATCH
   - "English Literature" for "STEM" → NO MATCH
   
   Be reasonable in your interpretation of related fields.
   
   NOTE: Degree LEVEL requirements (Bachelor's, Master's, etc.) have already been pre-processed and are NOT in your requirements list.

2. YEARS OF EXPERIENCE MATCHING:
   Two types of experience requirements:
   
   A) GENERAL EXPERIENCE (no specificRole):
      - Use Total Professional Experience duration
      - Example: Requires 5 years, candidate has ${totalYears} years → ${totalYears >= 5 ? 'MATCH' : 'NO MATCH'}
   
   B) ROLE-SPECIFIC EXPERIENCE (has specificRole):
      - Sum durations of RELATED roles
      - Be flexible with role matching (e.g., "Product Analyst" can count toward "Product Management")
      - Consider BOTH role titles AND specialty field when determining if a role is related
      - SPECIALTY IS CRITICAL: If JD asks for "product management in subscription products", a role with specialty "Subscription Products" is strong evidence
      - Examples:
        * JD: "3 years in product management for B2B SaaS"
        * Candidate: "Product Manager (B2B SaaS)" → STRONG MATCH (specialty matches)
        * Candidate: "Product Manager (Consumer Apps)" → PARTIAL MATCH (title matches, specialty different)
        * Candidate: "Product Analyst (B2B SaaS)" → MATCH (similar title, specialty matches)
      - Sum their durations and compare to requirement
   
   For matches, cite the specific role(s), their specialty if relevant, and their combined duration.

4. ROLE TITLE REQUIREMENTS:
   - Check if candidate has held a role with matching or similar title
   - Be flexible: "Software Engineer" matches "Software Developer"
   - Cite the role title and company as evidence

5. TECHNICAL SKILLS:
   - Experience must explicitly mention the skill/tool/technology
   - "Wrote SQL queries" → matches "SQL" requirement
   - "Analyzed data" → does NOT match "SQL" requirement (too generic)

6. SOFT SKILLS:
   - Must have explicit evidence of the skill
   - "Led team of 5" → matches "team leadership"
   - "Worked with team" → does NOT match "leadership"

7. SCORING CALCULATION:
   - Score = (Number of Matched Requirements / Total Requirements) × 100
   - Round DOWN to nearest whole number
   - If missing ANY critical requirements, cap score at 65%
   - 40-60% is NORMAL and expected for most candidates
   - 70-79% means strong candidate with minor gaps
   - 80%+ should be RARE - only when nearly all requirements clearly met

CRITICAL: YOU MUST POPULATE BOTH matchedRequirements AND unmatchedRequirements ARRAYS FOR ALL SCORES.

CRITICAL: YOU MUST ALWAYS PROVIDE recommendations.forCandidate array for scores < 80%.

Return JSON in this EXACT format:

FOR SCORES >= 80% (Fit candidates):
{
  "overallScore": 85,
  "isFit": true,
  "fitLevel": "Excellent",
  "matchedRequirements": [
    {
      "jobRequirement": "Computer Science or related field",
      "experienceEvidence": "Bachelor of Science in Computer Science",
      "experienceSource": "Education: B.Sc in Computer Science from University X"
    },
    {
      "jobRequirement": "5+ years of experience",
      "experienceEvidence": "Total ${totalYears} years of professional experience",
      "experienceSource": "All professional roles combined"
    },
    {
      "jobRequirement": "3+ years in product management",
      "experienceEvidence": "4 years combined in product management roles",
      "experienceSource": "Product Manager (B2B SaaS) at TechCorp (2 years) + Product Analyst (Enterprise Software) at StartupCo (2 years)"
    }
  ],
  "unmatchedRequirements": [
    {
      "requirement": "Tableau certification",
      "importance": "medium"
    }
  ],
  "bulletPoints": {
    "Company - Role": [
      {
        "text": "Increased customer retention by 23% through SQL-driven analysis of 50K+ user behaviors",
        "experienceId": "exp_123",
        "keywordsUsed": ["SQL", "customer retention", "analysis"],
        "relevanceScore": 10
      }
    ]
  },
  "keywordsUsed": ["SQL", "customer retention"],
  "keywordsNotUsed": ["Tableau"]
}

FOR SCORES < 80% (Not fit candidates):
{
  "overallScore": 55,
  "isFit": false,
  "fitLevel": "Fair",
  "matchedRequirements": [
    {
      "jobRequirement": "STEM degree",
      "experienceEvidence": "Bachelor of Science in Actuarial Science",
      "experienceSource": "Education: B.Sc in Actuarial Science from University X"
    }
  ],
  "unmatchedRequirements": [
    {
      "requirement": "5+ years of experience",
      "importance": "critical"
    }
  ],
  "matchableKeywords": [],
  "unmatchableKeywords": [],
  "criticalGaps": ["5+ years of experience"],
  "recommendations": {
    "forCandidate": [
      "Gain ${5 - totalYears} more years of professional experience",
      "Focus on roles that will build toward the required experience level",
      "Highlight your strong educational foundation in your applications"
    ]
  }
}

BULLET GENERATION RULES (ONLY IF SCORE >= 80%):
1. Create EXACTLY ONE bullet for EVERY experience
2. Create SEPARATE entries for EACH "Company - Role" combination
3. Order bullets by relevance (most relevant first)
4. Structure: "Result (with numbers) + Action verb + context" OR "Action verb + context + quantified result"
5. Target width: ${CONSTANTS.VISUAL_WIDTH_TARGET} chars (range: ${CONSTANTS.VISUAL_WIDTH_MIN}-${CONSTANTS.VISUAL_WIDTH_MAX})
6. ${keywordInstruction}
7. ONLY embed keywords if they naturally fit based on the experience content
8. Track which keywords were embedded and which couldn't fit`;
}

async function callOpenAI(apiKey: string, messages: any[], maxTokens: number) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    throw new AnalysisError(`OpenAI API error: ${response.status}`, 'OPENAI_ERROR', 500);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Validation function for Stage 2 response
function validateStage2Response(stage2Results: any): void {
  // Basic structure validation
  if (typeof stage2Results.overallScore !== 'number') {
    throw new AnalysisError('Missing or invalid overallScore in response', 'INVALID_RESPONSE', 500);
  }
  
  if (typeof stage2Results.isFit !== 'boolean') {
    throw new AnalysisError('Missing or invalid isFit in response', 'INVALID_RESPONSE', 500);
  }

  // CRITICAL: These arrays must always be present
  if (!Array.isArray(stage2Results.matchedRequirements)) {
    console.error('Missing matchedRequirements array in response:', stage2Results);
    throw new AnalysisError(
      'AI response missing matchedRequirements array. This is required for all scores.',
      'INVALID_RESPONSE',
      500
    );
  }

  if (!Array.isArray(stage2Results.unmatchedRequirements)) {
    console.error('Missing unmatchedRequirements array in response:', stage2Results);
    throw new AnalysisError(
      'AI response missing unmatchedRequirements array. This is required for all scores.',
      'INVALID_RESPONSE',
      500
    );
  }

  // Validate matched requirements structure
  for (const match of stage2Results.matchedRequirements) {
    if (!match.jobRequirement || !match.experienceEvidence || !match.experienceSource) {
      console.error('Invalid matched requirement structure:', match);
      throw new AnalysisError(
        'Invalid matchedRequirements structure. Each must have jobRequirement, experienceEvidence, and experienceSource',
        'INVALID_RESPONSE',
        500
      );
    }
  }

  // Validate unmatched requirements structure
  for (const unmatched of stage2Results.unmatchedRequirements) {
    if (!unmatched.requirement || !unmatched.importance) {
      console.error('Invalid unmatched requirement structure:', unmatched);
      throw new AnalysisError(
        'Invalid unmatchedRequirements structure. Each must have requirement and importance',
        'INVALID_RESPONSE',
        500
      );
    }
  }

  // Validate fit-specific fields
  if (stage2Results.isFit) {
    if (!stage2Results.bulletPoints || typeof stage2Results.bulletPoints !== 'object') {
      throw new AnalysisError('Fit candidate missing bulletPoints', 'INVALID_RESPONSE', 500);
    }
    if (!Array.isArray(stage2Results.keywordsUsed)) {
      throw new AnalysisError('Fit candidate missing keywordsUsed array', 'INVALID_RESPONSE', 500);
    }
  }

  // Validate non-fit specific fields (set defaults if missing)
  if (!stage2Results.isFit) {
    if (!Array.isArray(stage2Results.matchableKeywords)) {
      stage2Results.matchableKeywords = [];
    }
    if (!Array.isArray(stage2Results.unmatchableKeywords)) {
      stage2Results.unmatchableKeywords = [];
    }
    if (!Array.isArray(stage2Results.criticalGaps)) {
      stage2Results.criticalGaps = [];
    }
    if (!stage2Results.recommendations?.forCandidate || !Array.isArray(stage2Results.recommendations.forCandidate)) {
      stage2Results.recommendations = { 
        forCandidate: [
          'Review the unmatched requirements and consider how to gain experience in those areas',
          'Add more detailed STAR-format experiences that demonstrate relevant skills',
          'Consider taking online courses or certifications in key missing areas'
        ]
      };
    }
  }

  console.log('Stage 2 response validation passed:', {
    score: stage2Results.overallScore,
    isFit: stage2Results.isFit,
    matchedCount: stage2Results.matchedRequirements.length,
    unmatchedCount: stage2Results.unmatchedRequirements.length,
    hasRecommendations: !stage2Results.isFit ? stage2Results.recommendations?.forCandidate?.length > 0 : 'N/A'
  });
}

// Call OpenAI with retry logic for invalid responses
async function callOpenAIWithRetry(
  apiKey: string, 
  messages: any[], 
  maxTokens: number,
  maxAttempts: number = 2
): Promise<any> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`OpenAI call attempt ${attempt}/${maxAttempts}`);
      
      const responseText = await callOpenAI(apiKey, messages, maxTokens);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      validateStage2Response(parsed); // This will throw if validation fails
      
      return parsed;
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxAttempts) {
        throw error;
      }
      
      // Add additional instruction for retry
      messages.push({
        role: 'assistant',
        content: 'I need to provide a more complete response.'
      });
      messages.push({
        role: 'user',
        content: `CRITICAL: Your previous response was incomplete or invalid. You MUST include:

1. Both matchedRequirements and unmatchedRequirements arrays with proper structure
2. For scores < 80%, you MUST include recommendations.forCandidate array with 3-5 specific recommendations

3. STRUCTURED MATCHING RULES:
   - education_degree: Use degree hierarchy (Associate < Bachelor's < Master's < PhD)
   - education_field: Use AI reasoning to determine if field meets criteria
   - years_experience: Calculate from role dates, consider role similarity for specific roles
   - All other categories: Require explicit evidence

4. For matched requirements, show:
   - What requirement was matched
   - Evidence from experience OR education OR role duration
   - Source (experience, education, or role summary)

5. For unmatched requirements, include the importance level

6. Return valid JSON only with all required fields.`
      });
      
      console.log('Retrying with enhanced prompt...');
    }
  }
  
  throw new AnalysisError('Max retry attempts reached', 'MAX_RETRIES', 500);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment validation
    const openaiApiKey = Deno.env.get('ANALYZE_JOB_FIT_OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new AnalysisError('Missing required environment variables', 'CONFIG_ERROR', 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new AnalysisError('Authorization required', 'AUTH_REQUIRED', 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new AnalysisError('Authentication failed', 'AUTH_FAILED', 401);
    }

    // Get request data
    const { jobDescription } = await req.json();
    
    if (!jobDescription?.trim() || jobDescription.trim().length < 50) {
      throw new AnalysisError('Job description too short for analysis', 'INVALID_INPUT', 400);
    }

    const keywordMatchType = req.headers.get('x-keyword-match-type') || 'exact';

    console.log(`Starting two-stage analysis for user ${user.id}`);

    // Fetch user experiences with role information
    const { data: experiences, error: expError } = await supabase
      .from('experiences')
      .select(`
        *,
        roles!inner(
          id,
          title,
          specialty,
          start_date,
          end_date,
          companies!inner(name)
        )
      `)
      .eq('user_id', user.id);

    if (expError || !experiences?.length) {
      throw new AnalysisError('No experiences found', 'NO_EXPERIENCES', 400);
    }

    // Fetch user education with structured degree field
    const { data: education, error: eduError } = await supabase
      .from('education')
      .select('*')
      .eq('user_id', user.id);

    if (eduError) {
      console.warn('Error fetching education:', eduError);
    }

    const educationInfo = education?.map(edu => ({
      degree: edu.degree, // Now structured: Bachelor's, Master's, PhD, Associate, Diploma, Other
      field: edu.field,
      school: edu.school,
      graduationDate: edu.graduation_date,
      isExpected: edu.is_expected_graduation
    })) || [];

    console.log('User education:', {
      count: educationInfo.length,
      degrees: educationInfo.map(e => ({ degree: e.degree, field: e.field }))
    });

    // Extract unique roles with their durations
    const rolesMap = new Map<string, any>();
    experiences.forEach(exp => {
      const roleKey = `${exp.roles.id}`;
      if (!rolesMap.has(roleKey)) {
        rolesMap.set(roleKey, {
          id: exp.roles.id,
          title: exp.roles.title,
          specialty: exp.roles.specialty,
          company: exp.roles.companies.name,
          start_date: exp.roles.start_date,
          end_date: exp.roles.end_date
        });
      }
    });
    const userRoles = Array.from(rolesMap.values());

    console.log('User roles:', {
      count: userRoles.length,
      roles: userRoles.map(r => ({
        title: r.title,
        specialty: r.specialty,
        company: r.company,
        months: calculateRoleDuration(r.start_date, r.end_date)
      }))
    });

    // Format and group experiences
    const formattedExperiences = experiences.map(exp => ({
      id: exp.id,
      company: exp.roles.companies.name,
      role: exp.roles.title,
      roleKey: `${exp.roles.companies.name} - ${exp.roles.title}`,
      title: exp.title,
      action: exp.action,
      result: exp.result,
      situation: exp.situation,
      task: exp.task
    }));

    const experiencesByRole = formattedExperiences.reduce((acc, exp) => {
      if (!acc[exp.roleKey]) {
        acc[exp.roleKey] = [];
      }
      acc[exp.roleKey].push(exp);
      return acc;
    }, {} as Record<string, typeof formattedExperiences>);

    console.log('Experiences grouped by role:', Object.keys(experiencesByRole).map(key => ({
      role: key,
      count: experiencesByRole[key].length
    })));

    // ===== STAGE 1: Extract requirements from job description =====
    console.log('STAGE 1: Extracting requirements and keywords from job description...');
    
    const stage1Response = await callOpenAI(
      openaiApiKey,
      [
        {
          role: 'system',
          content: 'You extract requirements and keywords from job descriptions. You never see candidate information. CRITICAL: Do NOT extract "equivalent experience" alternatives to degrees. Extract degree requirements, field requirements, years of experience (general and role-specific), skills, and keywords. Use structured categories.'
        },
        {
          role: 'user',
          content: createStage1Prompt(jobDescription.trim())
        }
      ],
      3000
    );

    const stage1Match = stage1Response.match(/\{[\s\S]*\}/);
    if (!stage1Match) {
      throw new AnalysisError('Invalid Stage 1 response format', 'INVALID_RESPONSE', 500);
    }

    const stage1Results = JSON.parse(stage1Match[0]);
    
    console.log('Stage 1 complete:', {
      requirementsExtracted: stage1Results.jobRequirements?.length || 0,
      keywordsExtracted: stage1Results.allKeywords?.length || 0,
      requirementsByCategory: stage1Results.jobRequirements?.reduce((acc: any, req: any) => {
        acc[req.category] = (acc[req.category] || 0) + 1;
        return acc;
      }, {})
    });

    // ===== PRE-PROCESSING: Deterministic Education Degree Matching =====
    console.log('PRE-PROCESSING: Checking education degree requirements...');
    
    const preMatchedRequirements: any[] = [];
    const educationDegreeReqs = stage1Results.jobRequirements.filter(
      (req: any) => req.category === 'education_degree'
    );

    if (educationDegreeReqs.length > 0 && educationInfo.length > 0) {
      // Get the lowest (most lenient) degree requirement from JD
      const lowestRequiredDegree = getLowestDegreeRequirement(stage1Results.jobRequirements);
      
      if (lowestRequiredDegree) {
        const educationCheck = meetsEducationRequirement(educationInfo, lowestRequiredDegree);
        
        if (educationCheck.meets) {
          // User meets degree requirement - mark ALL education_degree requirements as matched
          educationDegreeReqs.forEach((req: any) => {
            preMatchedRequirements.push({
              jobRequirement: req.requirement,
              experienceEvidence: educationCheck.evidence,
              experienceSource: educationCheck.source
            });
          });
          
          console.log('Education degree requirements PRE-MATCHED:', {
            required: lowestRequiredDegree,
            userHas: educationCheck.evidence,
            matchedCount: educationDegreeReqs.length
          });
        } else {
          console.log('Education degree requirements NOT MET:', {
            required: lowestRequiredDegree,
            userHas: educationCheck.evidence
          });
        }
      }
    }

    // Filter out education_degree requirements from those sent to AI
    // AI will still handle education_field requirements
    const requirementsForAI = stage1Results.jobRequirements.filter(
      (req: any) => req.category !== 'education_degree'
    );

    console.log('Requirements distribution:', {
      total: stage1Results.jobRequirements.length,
      preMatched: preMatchedRequirements.length,
      sentToAI: requirementsForAI.length
    });

    // ===== STAGE 2: Match to experiences and generate bullets =====
    console.log('STAGE 2: Matching requirements to experiences and education...');
    
    // Create modified stage1Results for AI with education_degree removed
    const stage1ResultsForAI = {
      ...stage1Results,
      jobRequirements: requirementsForAI
    };
    
    const stage2Results = await callOpenAIWithRetry(
      openaiApiKey,
      [
        {
          role: 'system',
          content: 'You are a strict resume analyzer. Match candidate experiences AND education against pre-extracted job requirements. Use structured matching: AI reasoning for education_field, date calculations for years_experience, role similarity for role_title, explicit evidence for skills. NOTE: education_degree requirements have been pre-processed and removed from your requirements list. ALWAYS provide both matchedRequirements and unmatchedRequirements arrays. For scores < 80%, ALWAYS provide recommendations.'
        },
        {
          role: 'user',
          content: createStage2Prompt(stage1ResultsForAI, experiencesByRole, educationInfo, userRoles, keywordMatchType)
        }
      ],
      8000
    );

    // Merge pre-matched education requirements back into results
    stage2Results.matchedRequirements = [
      ...preMatchedRequirements,
      ...(stage2Results.matchedRequirements || [])
    ];

    // Recalculate score based on ALL requirements (including pre-matched)
    const totalRequirements = stage1Results.jobRequirements.length;
    const totalMatched = stage2Results.matchedRequirements.length;
    const recalculatedScore = Math.floor((totalMatched / totalRequirements) * 100);
    
    // Check for critical gaps in unmatched requirements
    const criticalUnmatched = (stage2Results.unmatchedRequirements || [])
      .filter((req: any) => req.importance === 'critical');
    
    // Apply 65% cap if missing critical requirements
    if (criticalUnmatched.length > 0) {
      stage2Results.overallScore = Math.min(recalculatedScore, 65);
      stage2Results.criticalGaps = criticalUnmatched.map((req: any) => req.requirement);
      console.log('Score capped at 65% due to missing critical requirements:', criticalUnmatched.length);
    } else {
      stage2Results.overallScore = recalculatedScore;
    }
    
    // Update fit status based on final score
    stage2Results.isFit = stage2Results.overallScore >= CONSTANTS.FIT_THRESHOLD;

    console.log('Stage 2 complete - detailed results:', {
      score: stage2Results.overallScore,
      isFit: stage2Results.isFit,
      fitLevel: stage2Results.fitLevel,
      totalRequirements: stage1Results.jobRequirements.length,
      matchedCount: stage2Results.matchedRequirements?.length || 0,
      unmatchedCount: stage2Results.unmatchedRequirements?.length || 0,
      hasRecommendations: !stage2Results.isFit ? stage2Results.recommendations?.forCandidate?.length > 0 : 'N/A',
      matchedSample: stage2Results.matchedRequirements?.[0],
      unmatchedSample: stage2Results.unmatchedRequirements?.[0]
    });

    // Merge stage 1 and stage 2 results
    const analysis = {
      ...stage2Results,
      jobRequirements: stage1Results.jobRequirements,
      allKeywords: stage1Results.allKeywords,
      jobTitle: stage1Results.jobTitle,
      companySummary: stage1Results.companySummary
    };

    // Process and validate bullets if fit
    if (analysis.isFit && analysis.bulletPoints) {
      const processedBullets: any = {};
      const allKeywordsInBullets = new Set<string>();
      
      // Helper function to check if keyword is actually in text
      const isKeywordInText = (text: string, keyword: string, matchType: string): boolean => {
        const lowerText = text.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        
        if (matchType === 'exact') {
          const regex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return regex.test(text);
        } else {
          const keywordWords = lowerKeyword.split(/\s+/).filter(w => w.length > 0);
          
          if (keywordWords.length === 1 && keywordWords[0].length <= 2) {
            return false;
          }
          
          return keywordWords.every(word => {
            if (word.length <= 3) {
              const regex = new RegExp(`\\b${word}\\b`, 'i');
              return regex.test(lowerText);
            }
            
            const stem = word.replace(/(ing|ed|s|es|tion|ment|ly|ize|ise|ization|isation)$/i, '');
            
            if (stem.length < 3) {
              return lowerText.includes(word);
            }
            
            const stemRegex = new RegExp(`\\b\\w*${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'i');
            return stemRegex.test(text);
          });
        }
      };
      
      Object.entries(analysis.bulletPoints).forEach(([roleKey, bullets]: [string, any]) => {
        const sortedBullets = bullets.sort((a: any, b: any) => 
          (b.relevanceScore || 0) - (a.relevanceScore || 0)
        );

        processedBullets[roleKey] = sortedBullets.map((bullet: any) => {
          const visualWidth = calculateVisualWidth(bullet.text);
          const isWithinRange = visualWidth >= CONSTANTS.VISUAL_WIDTH_MIN && 
                                visualWidth <= CONSTANTS.VISUAL_WIDTH_MAX;
          
          const claimedKeywords = bullet.keywordsUsed || [];
          const verifiedKeywords = claimedKeywords.filter((kw: string) => 
            isKeywordInText(bullet.text, kw, keywordMatchType)
          );
          
          verifiedKeywords.forEach((kw: string) => allKeywordsInBullets.add(kw));
          
          if (claimedKeywords.length !== verifiedKeywords.length) {
            const unverified = claimedKeywords.filter((kw: string) => !verifiedKeywords.includes(kw));
            console.log(`Keyword mismatch in bullet: claimed ${claimedKeywords.length}, verified ${verifiedKeywords.length}`, {
              unverified
            });
          }
          
          return {
            text: bullet.text,
            visualWidth: Math.round(visualWidth),
            exceedsMax: visualWidth > CONSTANTS.VISUAL_WIDTH_MAX,
            belowMin: visualWidth < CONSTANTS.VISUAL_WIDTH_MIN,
            isWithinRange: isWithinRange,
            experienceId: bullet.experienceId,
            keywordsUsed: verifiedKeywords,
            relevanceScore: bullet.relevanceScore || 0
          };
        });
      });

      const actualKeywordsUsed = Array.from(allKeywordsInBullets);
      const actualKeywordsNotUsed = stage1Results.allKeywords.filter((kw: string) => !allKeywordsInBullets.has(kw));

      console.log('Keyword validation:', {
        total: stage1Results.allKeywords.length,
        verified: actualKeywordsUsed.length,
        notUsed: actualKeywordsNotUsed.length
      });

      analysis.bulletPoints = processedBullets;
      analysis.keywordsUsed = actualKeywordsUsed;
      analysis.keywordsNotUsed = actualKeywordsNotUsed;

      // Format for frontend
      const companyRoleMap: Record<string, any[]> = {};
      
      Object.entries(processedBullets).forEach(([roleKey, bullets]: [string, any]) => {
        const dashIndex = roleKey.indexOf(' - ');
        if (dashIndex === -1) return;
        
        const company = roleKey.substring(0, dashIndex).trim();
        const role = roleKey.substring(dashIndex + 3).trim();
        
        if (!companyRoleMap[company]) {
          companyRoleMap[company] = [];
        }
        
        companyRoleMap[company].push({
          title: role,
          bulletPoints: bullets
        });
      });

      const bulletOrganization = Object.entries(companyRoleMap).map(([company, roles]) => ({
        name: company,
        roles: roles
      }));

      analysis.resumeBullets = {
        bulletOrganization,
        keywordsUsed: actualKeywordsUsed,
        keywordsNotUsed: actualKeywordsNotUsed,
        generatedFrom: {
          totalExperiences: experiences.length,
          keywordMatchType: keywordMatchType,
          scoreThreshold: CONSTANTS.FIT_THRESHOLD,
          visualWidthRange: {
            min: CONSTANTS.VISUAL_WIDTH_MIN,
            max: CONSTANTS.VISUAL_WIDTH_MAX,
            target: CONSTANTS.VISUAL_WIDTH_TARGET
          }
        }
      };
    }

    // Add action plan
    analysis.actionPlan = {
      readyForApplication: analysis.isFit,
      readyForBulletGeneration: analysis.isFit,
      criticalGaps: analysis.criticalGaps || []
    };

    console.log(`Analysis completed: ${analysis.overallScore}% (${analysis.isFit ? 'FIT' : 'NOT FIT'})`);
    console.log(`Matched: ${analysis.matchedRequirements.length}, Unmatched: ${analysis.unmatchedRequirements.length}`);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Two-stage analysis error:', error);
    
    let statusCode = 500;
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error instanceof AnalysisError) {
      statusCode = error.statusCode;
      errorCode = error.code;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      code: errorCode
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
