import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced scoring configuration with stricter definitions
const SCORING_CONFIG = {
  WEIGHTS: {
    technical: 0.30,
    experience_level: 0.25,
    domain_industry: 0.20,
    leadership_impact: 0.15,
    cultural_soft: 0.10
  },
  IMPORTANCE_MULTIPLIERS: {
    critical: 1.0,
    high: 0.85,
    medium: 0.65,
    low: 0.35
  },
  MATCH_TYPE_SCORES: {
    exact: 1.0,
    semantic: 0.9,
    synonym: 0.8,
    transferable: 0.7,
    contextual: 0.6
  },
  EVIDENCE_MULTIPLIERS: {
    quantified: 1.0,
    demonstrated: 0.8,
    mentioned: 0.5,
    implied: 0.3
  },
  WEAK_EVIDENCE_THRESHOLD: 0.5,
  FIT_THRESHOLDS: {
    excellent: 90,
    strong: 75,
    good: 60,
    fair: 45,
    poor: 0
  }
} as const;

// Enhanced error handling
class AnalysisError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

// Deterministic scoring function
function calculateJobFitScore(
  matches: any[], 
  jobRequirements: any[]
): { score: number, breakdown: any, weakExperiences: any[] } {
  let totalPossibleScore = 0;
  let achievedScore = 0;
  const breakdown: any = {};
  const weakExperiences: any[] = [];

  // Initialize breakdown by category
  Object.keys(SCORING_CONFIG.WEIGHTS).forEach(category => {
    breakdown[category] = { possible: 0, achieved: 0, percentage: 0 };
  });

  // Group requirements by category
  const requirementsByCategory: any = {};
  jobRequirements.forEach((req: any) => {
    if (!requirementsByCategory[req.category]) {
      requirementsByCategory[req.category] = [];
    }
    requirementsByCategory[req.category].push(req);
  });

  // Calculate scores for each category
  Object.entries(requirementsByCategory).forEach(([category, requirements]: [string, any]) => {
    const categoryWeight = (SCORING_CONFIG.WEIGHTS as any)[category] || 0.1;
    let categoryPossible = 0;
    let categoryAchieved = 0;

    (requirements as any[]).forEach((req: any) => {
      const importanceMultiplier = (SCORING_CONFIG.IMPORTANCE_MULTIPLIERS as any)[req.importance] || 0.5;
      const maxReqScore = categoryWeight * importanceMultiplier * 100;
      categoryPossible += maxReqScore;
      totalPossibleScore += maxReqScore;

      // Find matching experience for this requirement
      const match = matches.find(m => m.jobRequirement === req.requirement);
      if (match) {
        const matchTypeScore = (SCORING_CONFIG.MATCH_TYPE_SCORES as any)[match.matchType] || 0.5;
        const evidenceScore = (SCORING_CONFIG.EVIDENCE_MULTIPLIERS as any)[match.evidenceStrength] || 0.3;
        
        if (evidenceScore <= SCORING_CONFIG.WEAK_EVIDENCE_THRESHOLD) {
          weakExperiences.push({
            requirement: req.requirement,
            evidence: match.experienceEvidence,
            evidenceStrength: match.evidenceStrength,
            experienceContext: match.experienceContext
          });
        }
        
        const achievedReqScore = maxReqScore * matchTypeScore * evidenceScore;
        categoryAchieved += achievedReqScore;
        achievedScore += achievedReqScore;
      }
    });

    breakdown[category] = {
      possible: Math.round(categoryPossible),
      achieved: Math.round(categoryAchieved),
      percentage: categoryPossible > 0 ? Math.round((categoryAchieved / categoryPossible) * 100) : 0
    };
  });

  const finalScore = Math.min(100, Math.round((achievedScore / totalPossibleScore) * 100));
  
  return { score: finalScore, breakdown, weakExperiences };
}

// Calculate years of experience from role dates
function calculateExperienceYears(startDate: string | null, endDate: string | null): number {
  if (!startDate) return 0;
  
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  
  const diffInMs = end.getTime() - start.getTime();
  const diffInYears = diffInMs / (1000 * 60 * 60 * 24 * 365.25);
  
  return Math.max(0, diffInYears);
}

// Create a deterministic hash for consistent results
function createConsistentHash(jobDescription: string, experiences: any[]): string {
  const experienceString = experiences
    .map(exp => `${exp.company}-${exp.role}-${exp.title}-${exp.action}-${exp.result}`)
    .sort()
    .join('|');
  
  const combinedString = jobDescription + experienceString;
  const encoder = new TextEncoder();
  const data = encoder.encode(combinedString);
  
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) & 0xffffffff;
  }
  
  return Math.abs(hash).toString(36).slice(0, 16);
}

// Enhanced prompt with better structure and validation
function createJobFitAnalysisPrompt(jobDescription: string, experiences: any[], education: any[], consistencyHash: string): string {
  // Validate inputs
  if (!jobDescription || jobDescription.trim().length < 50) {
    throw new AnalysisError('Job description too short for meaningful analysis', 'INVALID_JOB_DESCRIPTION', 400);
  }

  if (!experiences || experiences.length === 0) {
    throw new AnalysisError('No experiences provided for analysis', 'NO_EXPERIENCES', 400);
  }

  return `You are an expert talent recruiter and career analyst. Your analysis must be COMPLETELY DETERMINISTIC and CONSISTENT.

CONSISTENCY REQUIREMENTS:
- Hash: ${consistencyHash}
- Extract requirements alphabetically
- Use exact scoring criteria
- Temperature = 0 for deterministic results

JOB DESCRIPTION:
${jobDescription}

CANDIDATE EXPERIENCES:
${experiences.map((exp, index) => `
Experience ${index + 1}:
- ID: ${exp.id}
- Company: ${exp.company}
- Role: ${exp.role}
- Duration: ${exp.experienceYears} years (${exp.startDate || 'Unknown'} to ${exp.endDate || 'Current'})
- Title: ${exp.title}
- Situation: ${exp.situation || 'Not provided'}
- Task: ${exp.task || 'Not provided'}  
- Action: ${exp.action}
- Result: ${exp.result}
- Tags: ${exp.tags.join(', ') || 'None'}
`).join('')}

EDUCATION:
${education?.length ? education.map((edu: any, index: number) => `
${index + 1}. ${edu.degree || 'Degree'} in ${edu.field || 'Field'} from ${edu.school || 'School'}
   Graduation: ${edu.graduationDate || 'Not specified'}
   Expected: ${edu.isExpectedGraduation ? 'Yes' : 'No'}
`).join('') : 'No education provided'}

ANALYSIS FRAMEWORK:

**REQUIREMENT EXTRACTION:**
1. Extract ONLY explicit, measurable requirements
2. Ignore generic responsibilities 
3. Sort alphabetically for consistency
4. Focus on skills, tools, experience levels, certifications

**CATEGORIES (Fixed definitions):**
- technical: Specific tools, languages, frameworks, certifications
- experience_level: Years of experience, seniority levels (calculate from dates)
- domain_industry: Sector knowledge, industry experience
- leadership_impact: Team management, project leadership, stakeholder management
- cultural_soft: Communication, problem-solving, analytical thinking

**IMPORTANCE LEVELS:**
- critical: Explicit deal-breakers ("required", "must have", security clearance)
- high: Strong preferences ("preferred", "X+ years", numbered requirements)
- medium: General skills ("experience with", "familiar with")
- low: Nice-to-have ("bonus", additional responsibilities)

**MATCH TYPES (Apply systematically):**
- exact: Identical terms (case-insensitive)
- semantic: Same concept, different phrasing
- synonym: Industry equivalents
- transferable: Related skills from different domains
- contextual: Skills implied from role context

**EVIDENCE STRENGTH:**
- quantified: Contains specific numbers/metrics
- demonstrated: Clear examples with context
- mentioned: Explicitly stated, no details
- implied: Inferred from role/context

Return JSON with this EXACT structure:

{
  "consistencyHash": "${consistencyHash}",
  "jobRequirements": [
    {
      "requirement": "exact text from job description",
      "type": "requirement",
      "category": "technical|experience_level|domain_industry|leadership_impact|cultural_soft",
      "importance": "critical|high|medium|low",
      "context": "why this requirement matters"
    }
  ],
  "extractedKeywords": {
    "requirements": {
      "technical": ["specific tools/languages"],
      "education": ["degree requirements"],
      "industry": ["sector knowledge"],
      "soft_skills": ["communication skills"],
      "seniority": ["experience levels"]
    },
    "responsibilities": {
      "daily_tasks": ["routine activities"],
      "outcomes": ["expected results"],
      "management": ["leadership duties"]
    }
  },
  "bulletKeywords": {
    "technical": ["resume-ready technical terms"],
    "actionVerbs": ["strong action verbs"],
    "industry": ["industry-specific terms"],
    "metrics": ["measurable outcomes"],
    "behavioral": ["soft skills terms"],
    "qualifications": ["credential keywords"]
  },
  "matchedRequirements": [
    {
      "jobRequirement": "exact requirement text",
      "type": "requirement",
      "experienceEvidence": "specific candidate evidence",
      "experienceContext": "Company - Role - Title",
      "matchType": "exact|semantic|synonym|transferable|contextual",
      "evidenceStrength": "quantified|demonstrated|mentioned|implied",
      "scoringCalculation": {
        "matchTypeScore": 0.9,
        "evidenceScore": 0.8,
        "importanceMultiplier": 0.85,
        "categoryWeight": 0.30,
        "finalScore": 18.36
      }
    }
  ],
  "unmatchedRequirements": [
    {
      "requirement": "requirement text",
      "type": "requirement",
      "category": "category",
      "importance": "importance level",
      "suggestionToImprove": "specific actionable advice"
    }
  ],
  "relevantExperiences": [
    {
      "id": "experience_id",
      "roleTitle": "role title",
      "companyName": "company name",
      "title": "experience title",
      "situation": "situation or null",
      "task": "task or null", 
      "action": "action taken",
      "result": "outcome achieved",
      "tags": ["relevant tags"],
      "relevanceScore": 85,
      "matchingRequirements": ["requirements this addresses"],
      "strengthOfEvidence": "evidence strength level"
    }
  ],
  "fitAssessment": {
    "overallScore": 0,
    "fitLevel": "Excellent|Strong|Good|Fair|Poor",
    "categoryBreakdown": {
      "technical": {"score": 0, "possible": 0, "achieved": 0},
      "experience_level": {"score": 0, "possible": 0, "achieved": 0},
      "domain_industry": {"score": 0, "possible": 0, "achieved": 0},
      "leadership_impact": {"score": 0, "possible": 0, "achieved": 0},
      "cultural_soft": {"score": 0, "possible": 0, "achieved": 0}
    }
  },
  "strengths": ["specific demonstrated strengths"],
  "gaps": ["missing or weak areas"],
  "recommendations": {
    "forCandidate": ["specific improvement actions"],
    "forApplication": ["application positioning advice"]
  },
  "summary": "objective assessment summary"
}`;
}

serve(async (req) => {
  console.log('analyze-job-fit: Function called with method:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('analyze-job-fit: Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('analyze-job-fit: Starting analysis...');
    
    // Environment validation with better error messages
    const openaiApiKey = Deno.env.get('ANALYZE_JOB_FIT_OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiApiKey) {
      throw new AnalysisError('OpenAI API key not configured', 'MISSING_API_KEY', 500);
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new AnalysisError('Supabase configuration missing', 'MISSING_SUPABASE_CONFIG', 500);
    }

    console.log('analyze-job-fit: Environment validated');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Enhanced authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new AnalysisError('Authorization header required', 'MISSING_AUTH', 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('analyze-job-fit: Authentication failed:', authError);
      throw new AnalysisError('Authentication failed', 'AUTH_FAILED', 401);
    }

    // Enhanced request validation
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      throw new AnalysisError('Invalid JSON in request body', 'INVALID_JSON', 400);
    }

    const { jobDescription } = requestBody;
    
    if (!jobDescription) {
      throw new AnalysisError('Job description is required', 'MISSING_JOB_DESCRIPTION', 400);
    }

    if (typeof jobDescription !== 'string') {
      throw new AnalysisError('Job description must be a string', 'INVALID_JOB_DESCRIPTION_TYPE', 400);
    }

    const trimmedDescription = jobDescription.trim();
    if (trimmedDescription.length < 50) {
      throw new AnalysisError('Job description too short for meaningful analysis (minimum 50 characters)', 'JOB_DESCRIPTION_TOO_SHORT', 400);
    }

    if (trimmedDescription.length > 20000) {
      throw new AnalysisError('Job description too long (maximum 20,000 characters)', 'JOB_DESCRIPTION_TOO_LONG', 400);
    }

    console.log(`analyze-job-fit: Processing job description (${trimmedDescription.length} chars) for user ${user.id}`);

    // Enhanced data fetching with better error handling
    const [experiencesResult, educationResult] = await Promise.allSettled([
      supabase
        .from('experiences')
        .select(`
          *,
          roles!inner(
            id,
            title,
            specialty,
            start_date,
            end_date,
            companies!inner(
              id,
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('education')
        .select('*')
        .eq('user_id', user.id)
        .order('graduation_date', { ascending: false })
    ]);

    if (experiencesResult.status === 'rejected') {
      console.error('analyze-job-fit: Failed to fetch experiences:', experiencesResult.reason);
      throw new AnalysisError('Failed to fetch user experiences', 'DATABASE_ERROR', 500, true);
    }

    if (experiencesResult.value.error) {
      console.error('analyze-job-fit: Database error:', experiencesResult.value.error);
      throw new AnalysisError('Database query failed', 'DATABASE_ERROR', 500, true);
    }

    const experiences = experiencesResult.value.data;
    if (!experiences || experiences.length === 0) {
      throw new AnalysisError('No professional experiences found. Please add some experiences before analyzing.', 'NO_EXPERIENCES', 400);
    }

    const education = educationResult.status === 'fulfilled' && !educationResult.value.error 
      ? educationResult.value.data || []
      : [];

    console.log(`analyze-job-fit: Found ${experiences.length} experiences and ${education.length} education records`);

    // Enhanced experience formatting with validation
    const formattedExperiences = experiences
      .map(exp => {
        const role = exp.roles;
        const company = role?.companies;
        
        if (!role || !company) {
          console.warn('analyze-job-fit: Experience missing role/company data:', exp.id);
          return null;
        }
        
        const experienceYears = calculateExperienceYears(role.start_date, role.end_date);
        
        return {
          id: exp.id,
          company: company.name || 'Unknown Company',
          role: role.title || 'Unknown Role', 
          specialty: role.specialty || null,
          startDate: role.start_date || null,
          endDate: role.end_date || null,
          experienceYears: Math.round(experienceYears * 100) / 100,
          title: exp.title || 'Untitled Experience',
          situation: exp.situation || null,
          task: exp.task || null,
          action: exp.action || 'No action details provided',
          result: exp.result || 'No results specified',
          tags: Array.isArray(exp.tags) ? exp.tags.sort() : []
        };
      })
      .filter(exp => exp !== null)
      .sort((a, b) => a.id.localeCompare(b.id));

    if (formattedExperiences.length === 0) {
      throw new AnalysisError('No valid experiences found after formatting', 'NO_VALID_EXPERIENCES', 400);
    }

    const formattedEducation = education.map((edu: any) => ({
      school: edu.school,
      degree: edu.degree,
      field: edu.field_of_study,
      graduationDate: edu.graduation_date,
      gpa: edu.gpa,
      isExpectedGraduation: edu.is_expected_graduation
    }));

    // Create consistency hash
    const consistencyHash = createConsistentHash(trimmedDescription, formattedExperiences);
    console.log('analyze-job-fit: Generated consistency hash:', consistencyHash);

    // Create enhanced prompt
    const prompt = createJobFitAnalysisPrompt(trimmedDescription, formattedExperiences, formattedEducation, consistencyHash);

    console.log('analyze-job-fit: Calling OpenAI API...');

    // Enhanced OpenAI API call with proper timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    let openaiResponse;
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          temperature: 0,
          seed: parseInt(consistencyHash.slice(0, 8), 16) % 2147483647
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        throw new AnalysisError('OpenAI API request timed out', 'API_TIMEOUT', 504, true);
      }
      
      throw new AnalysisError(`Network error: ${fetchError.message}`, 'NETWORK_ERROR', 500, true);
    }

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('analyze-job-fit: OpenAI API Error:', openaiResponse.status, errorText);
      
      const isRetryable = openaiResponse.status >= 500 || openaiResponse.status === 429;
      throw new AnalysisError(
        `OpenAI API error: ${openaiResponse.status} - ${errorText}`,
        'OPENAI_API_ERROR',
        500,
        isRetryable
      );
    }

    const openaiData = await openaiResponse.json();
    const responseText = openaiData.choices[0].message.content;

    console.log('analyze-job-fit: OpenAI response received, parsing...');

    // Enhanced JSON parsing with better error handling
    let analysis: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('analyze-job-fit: No JSON found in response');
        throw new AnalysisError('No valid JSON found in AI response', 'INVALID_API_RESPONSE', 500, true);
      }

      analysis = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!analysis.jobRequirements || !Array.isArray(analysis.jobRequirements)) {
        throw new AnalysisError('Invalid analysis structure - missing job requirements', 'INVALID_ANALYSIS_STRUCTURE', 500, true);
      }

      // Verify consistency hash
      if (analysis.consistencyHash !== consistencyHash) {
        console.warn('analyze-job-fit: Consistency hash mismatch');
      }

    } catch (parseError) {
      console.error('analyze-job-fit: JSON parsing failed:', parseError);
      
      if (parseError instanceof SyntaxError) {
        throw new AnalysisError('Invalid JSON in AI response', 'JSON_PARSE_ERROR', 500, true);
      }
      throw parseError;
    }

    // Enhanced scoring calculation
    if (analysis.jobRequirements && analysis.matchedRequirements) {
      const { score: recalculatedScore, breakdown, weakExperiences } = calculateJobFitScore(
        analysis.matchedRequirements,
        analysis.jobRequirements
      );

      // Update with calculated score
      analysis.fitAssessment = analysis.fitAssessment || {};
      analysis.fitAssessment.overallScore = recalculatedScore;
      analysis.fitAssessment.categoryBreakdown = breakdown;
      analysis.fitAssessment.calculatedScore = true;

      // Determine fit level
      const score = recalculatedScore;
      if (score >= SCORING_CONFIG.FIT_THRESHOLDS.excellent) analysis.fitAssessment.fitLevel = "Excellent";
      else if (score >= SCORING_CONFIG.FIT_THRESHOLDS.strong) analysis.fitAssessment.fitLevel = "Strong";
      else if (score >= SCORING_CONFIG.FIT_THRESHOLDS.good) analysis.fitAssessment.fitLevel = "Good";
      else if (score >= SCORING_CONFIG.FIT_THRESHOLDS.fair) analysis.fitAssessment.fitLevel = "Fair";
      else analysis.fitAssessment.fitLevel = "Poor";

      // Add weak experiences for scores below 80%
      if (recalculatedScore < 80 && weakExperiences.length > 0) {
        analysis.weakEvidenceExperiences = {
          message: "Score could improve with stronger evidence for these experiences:",
          experiences: weakExperiences.slice(0, 5).map((weak: any) => ({
            experienceIdentifier: weak.experienceContext || 'Unknown Experience',
            requirement: weak.requirement,
            currentEvidence: weak.evidence,
            evidenceStrength: weak.evidenceStrength
          })),
          suggestion: "Add specific metrics, outcomes, or detailed examples to strengthen evidence."
        };
      }

      // Enhanced experience grouping
      if (analysis.relevantExperiences) {
        const experienceIdsByRole: any = {};
        
        analysis.relevantExperiences.forEach((exp: any) => {
          const roleKey = `${exp.companyName}-${exp.roleTitle}`;
          
          if (!experienceIdsByRole[roleKey]) {
            experienceIdsByRole[roleKey] = {
              company: exp.companyName,
              roleTitle: exp.roleTitle,
              specialty: exp.specialty || null,
              experienceIds: []
            };
          }
          
          experienceIdsByRole[roleKey].experienceIds.push(exp.id);
        });
        
        // Sort and limit experiences per role
        Object.keys(experienceIdsByRole).forEach(roleKey => {
          const roleExperiences = analysis.relevantExperiences
            .filter((exp: any) => {
              const expRoleKey = `${exp.companyName}-${exp.roleTitle}`;
              return expRoleKey === roleKey;
            })
            .sort((a: any, b: any) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
            .slice(0, 6);
          
          experienceIdsByRole[roleKey].experienceIds = roleExperiences.map((exp: any) => exp.id);
        });
        
        analysis.experienceIdsByRole = experienceIdsByRole;
      }

      // Enhanced action planning
      const criticalGaps = analysis.unmatchedRequirements?.filter((req: any) => req.importance === 'critical') || [];
      
      analysis.actionPlan = {
        priority: recalculatedScore >= 60 ? "application_ready" : "improve_job_fit",
        focus: criticalGaps.length > 0 ? "critical_gaps" : "general_improvement",
        criticalGaps: criticalGaps.map((gap: any) => gap.requirement),
        suggestedActions: analysis.recommendations?.forCandidate || [],
        readyForApplication: recalculatedScore >= 60,
        readyForBulletGeneration: recalculatedScore >= 80,
        experienceIds: analysis.relevantExperiences?.map((exp: any) => exp.id) || []
      };
    }

    console.log(`analyze-job-fit: Analysis completed successfully - ${analysis.fitAssessment?.overallScore || 0}% (${analysis.fitAssessment?.fitLevel || 'Unknown'})`);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('analyze-job-fit: Error occurred:', error);
    
    // Enhanced error response
    let statusCode = 500;
    let errorMessage = 'Analysis failed';
    let errorCode = 'UNKNOWN_ERROR';
    let retryable = false;
    
    if (error instanceof AnalysisError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code;
      retryable = error.retryable;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      code: errorCode,
      retryable,
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? error.stack : String(error)
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
