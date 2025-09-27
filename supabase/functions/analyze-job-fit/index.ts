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
};

// Deterministic scoring function - same inputs always produce same output
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
  const end = endDate ? new Date(endDate) : new Date(); // Current date if still active
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  
  const diffInMs = end.getTime() - start.getTime();
  const diffInYears = diffInMs / (1000 * 60 * 60 * 24 * 365.25); // Account for leap years
  
  return Math.max(0, diffInYears);
}

// Create a deterministic hash for consistent results using Deno APIs
function createConsistentHash(jobDescription: string, experiences: any[]): string {
  const experienceString = experiences.map(exp => 
    `${exp.company}-${exp.role}-${exp.title}-${exp.action}-${exp.result}`
  ).sort().join('|');
  
  const combinedString = jobDescription + experienceString;
  const encoder = new TextEncoder();
  const data = encoder.encode(combinedString);
  
  // Simple hash function for consistency
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) & 0xffffffff;
  }
  
  return Math.abs(hash).toString(36).slice(0, 16);
}

// Enhanced prompt with explicit consistency requirements and NO interview recommendations
function createJobFitAnalysisPrompt(jobDescription: string, experiences: any[], education: any[], consistencyHash: string): string {
  return `
You are an expert talent recruiter. Your analysis must be COMPLETELY DETERMINISTIC - identical inputs must produce identical outputs.

CONSISTENCY REQUIREMENTS:
- Use this hash for deterministic processing: ${consistencyHash}
- Extract requirements in alphabetical order
- Score matches using EXACT criteria below
- Use consistent terminology throughout
- Temperature = 0 for deterministic results

JOB DESCRIPTION:
${jobDescription}

CANDIDATE EXPERIENCES:
${experiences.map((exp, index) => `
Experience ${index + 1}:
- ID: ${exp.id}
- Company: ${exp.company}
- Role: ${exp.role}
- Specialty: ${exp.specialty || 'Not specified'}
- Start Date: ${exp.startDate || 'Not specified'}
- End Date: ${exp.endDate || 'Current/Not specified'}
- Experience Duration: ${exp.experienceYears} years
- Title: ${exp.title}
- Situation: ${exp.situation || 'Not provided'}
- Task: ${exp.task || 'Not provided'}
- Action: ${exp.action}
- Result: ${exp.result}
- Tags: ${exp.tags.join(', ') || 'None'}
`).join('')}

EDUCATION: 
${education && education.length > 0 ? education.map((edu: any, index: number) => `
Education ${index + 1}:
- School: ${edu.school || 'Not specified'}
- Degree: ${edu.degree || 'Not specified'}  
- Field: ${edu.field || 'Not specified'}
- Graduation: ${edu.graduationDate || 'Not specified'}
- GPA: ${edu.gpa || 'Not specified'}
- Expected: ${edu.isExpectedGraduation ? 'Yes' : 'No'}
`).join('') : 'No education information provided'}

STRICT ANALYSIS FRAMEWORK:

**REQUIREMENT EXTRACTION (Must be consistent):**
1. Extract ONLY explicit requirements from job description
2. Ignore vague responsibilities like "work collaboratively" 
3. Focus on measurable, specific qualifications
4. Sort requirements alphabetically for consistency
5. Apply match criteria systematically - prioritize stronger match types

**CATEGORIES (Fixed definitions):**
- **technical**: Specific tools, languages, frameworks (e.g., "Python", "AWS", "React")
- **experience_level**: Years of experience, seniority level - CALCULATE from role dates, don't extract as keywords
- **domain_industry**: Sector knowledge (e.g., "fintech", "healthcare", "B2B SaaS")
- **leadership_impact**: Team management, project leadership (e.g., "team leadership", "project management")
- **cultural_soft**: Communication, problem-solving (e.g., "communication", "analytical thinking")

**IMPORTANCE LEVELS (Strict criteria):**
- **critical**: Deal-breakers explicitly stated (e.g., "Bachelor's degree REQUIRED", "Must have security clearance")
- **high**: "Preferred", "Strong experience", numbered years (e.g., "5+ years experience")
- **medium**: "Experience with", "Familiar with", general skills
- **low**: "Nice to have", bonus skills, additional responsibilities

**MATCH TYPES (Apply systematically with clear standards):**
- **exact**: Identical terms (case-insensitive) - "Python" matches "python", "SQL" matches "sql"
- **semantic**: Same core concept, different phrasing - "team lead" matches "team leadership", "manage" matches "management"  
- **synonym**: Industry-standard equivalents - "JavaScript" matches "JS", "artificial intelligence" matches "AI"
- **transferable**: Clearly related skills from different domains - "retail team management" matches "team management", "sales analytics" matches "data analysis"
- **contextual**: Skills reasonably implied from clear context - "Senior Software Engineer at startup" implies "software development" and potentially "leadership"

**MATCHING STANDARDS:**
- Require clear, logical connections between job requirements and candidate experience
- Semantic matches must share the same core function or skill
- Transferable matches must demonstrate applicable overlap, not just superficial similarity
- Contextual matches must be based on reasonable professional implications
- When in doubt, use a lower match type rather than forcing a connection
- Mark as unmatched if no clear, defensible connection exists

**EVIDENCE STRENGTH (Strict criteria):**
- **quantified**: Contains specific numbers/metrics (e.g., "reduced costs by 30%", "managed team of 8")
- **demonstrated**: Clear examples with context (e.g., "Led 6-month project to implement...")
- **mentioned**: Explicitly stated but no details (e.g., "responsible for Python development")
- **implied**: Can be inferred from role/context (e.g., "Software Engineer" implies programming)

**SCORING RULES:**
- Score = (Match Type Score × Evidence Strength × Importance × Category Weight) × 100
- Use ONLY the predefined multipliers - no subjective adjustments
- Missing requirements score 0 - no partial credit
- Calculate category percentages: achieved/possible × 100

**CONSISTENCY CHECKS:**
- Each requirement must map to exactly one match or be unmatched
- Use identical scoring formula for all requirements
- Maintain consistent terminology across all sections
- Sort all arrays alphabetically for deterministic output

Return JSON with this EXACT structure (no deviations):

{
  "consistencyHash": "${consistencyHash}",
  "jobRequirements": [
    {
      "requirement": "exact requirement text from job description",
      "type": "requirement|responsibility", 
      "category": "technical|experience_level|domain_industry|leadership_impact|cultural_soft",
      "importance": "critical|high|medium|low",
      "context": "brief explanation of why this matters"
    }
  ],
  "extractedKeywords": {
    "requirements": {
      "technical": ["Python", "React", "AWS"],
      "education": ["Bachelor's degree", "Computer Science", "certification"],
      "industry": ["fintech", "healthcare", "B2B SaaS"],
      "soft_skills": ["leadership", "communication", "problem-solving"],
      "seniority": ["Senior", "Lead", "Principal", "Director"]
    },
    "responsibilities": {
      "daily_tasks": ["code review", "sprint planning", "client meetings"],
      "outcomes": ["increase conversion", "reduce latency", "improve UX"],
      "management": ["team leadership", "project management", "stakeholder communication"]
    }
  },
  "bulletKeywords": {
    "technical": ["Python", "React", "AWS", "microservices"],
    "actionVerbs": ["developed", "optimized", "led", "implemented"],
    "industry": ["fintech", "healthcare", "e-commerce", "SaaS"],
    "metrics": ["ROI", "performance", "efficiency", "scale"],
    "behavioral": ["collaboration", "problem-solving", "leadership"],
    "qualifications": ["Bachelor's degree", "5+ years", "certification"]
  },
  "matchedRequirements": [
    {
      "jobRequirement": "exact requirement text",
      "type": "requirement|responsibility",
      "experienceEvidence": "specific evidence from candidate",
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
      "type": "requirement|responsibility",
      "category": "category",
      "importance": "importance level",
      "suggestionToImprove": "how candidate could develop or better demonstrate this",
      "scoringImpact": {
        "possibleScore": 25.5,
        "achievedScore": 0
      }
    }
  ],
  "relevantExperiences": [
    {
      "id": "experience id",
      "roleTitle": "role title",
      "companyName": "company name",
      "title": "experience title", 
      "situation": "situation (may be null)",
      "task": "task (may be null)",
      "action": "action",
      "result": "result",
      "tags": ["tags"],
      "relevanceScore": 85,
      "matchingRequirements": ["list of requirements this addresses"],
      "strengthOfEvidence": "quantified|demonstrated|mentioned|implied"
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
    },
    "scoringBreakdown": {
      "totalPossible": 0,
      "totalAchieved": 0,
      "calculationMethod": "sum(matchTypeScore × evidenceScore × importanceMultiplier × categoryWeight × 100)"
    }
  },
  "strengths": ["demonstrated strengths with specific evidence"],
  "gaps": ["missing requirements or weak evidence areas"],
  "recommendations": {
    "forCandidate": ["specific actionable suggestions"],
    "forApplication": ["positioning recommendations"]
  },
  "summary": "objective assessment based on scoring framework"
}

CRITICAL: Use temperature=0 thinking. Be completely deterministic. Same inputs = same outputs.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('ANALYZE_JOB_FIT_OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    const { jobDescription } = await req.json();
    if (!jobDescription) {
      throw new Error('Job description is required');
    }

    // Fetch data
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

    if (experiencesResult.status === 'rejected' || experiencesResult.value.error) {
      throw new Error('Failed to fetch experiences');
    }

    const experiences = experiencesResult.value.data;
    if (!experiences || experiences.length === 0) {
      throw new Error('No experiences found');
    }

    const education = educationResult.status === 'fulfilled' && !educationResult.value.error 
      ? educationResult.value.data || []
      : [];

    // Format experiences consistently (sort for deterministic ordering)
    const formattedExperiences = experiences
      .map(exp => {
        const role = exp.roles;
        const company = role?.companies;
        const experienceYears = calculateExperienceYears(role?.start_date, role?.end_date);
        
        return {
          id: exp.id,
          company: company?.name || 'Unknown Company',
          role: role?.title || 'Unknown Role',
          specialty: role?.specialty || null,
          startDate: role?.start_date || null,
          endDate: role?.end_date || null,
          experienceYears: Math.round(experienceYears * 100) / 100, // Round to 2 decimal places
          title: exp.title || 'Untitled Experience',
          situation: exp.situation || null,
          task: exp.task || null,
          action: exp.action || 'No action details provided',
          result: exp.result || 'No results specified',
          tags: Array.isArray(exp.tags) ? exp.tags.sort() : [] // Sort tags for consistency
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id)); // Sort by ID for consistency

    const formattedEducation = education.map((edu: any) => ({
      school: edu.school,
      degree: edu.degree,
      field: edu.field_of_study,
      graduationDate: edu.graduation_date,
      gpa: edu.gpa,
      isExpectedGraduation: edu.is_expected_graduation
    }));

    // Create consistency hash
    const consistencyHash = createConsistentHash(jobDescription, formattedExperiences);
    console.log('Consistency hash:', consistencyHash);

    // Create deterministic prompt
    const prompt = createJobFitAnalysisPrompt(jobDescription, formattedExperiences, formattedEducation, consistencyHash);

    // Call OpenAI with temperature=0 for deterministic results
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 4096,
        temperature: 0, // Critical for consistency
        seed: parseInt(consistencyHash.slice(0, 8), 16) % 2147483647 // Use hash-based seed
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const responseText = openaiData.choices[0].message.content;

    // Parse and validate response
    let analysis: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      analysis = JSON.parse(jsonMatch[0]);

      // Verify consistency hash matches
      if (analysis.consistencyHash !== consistencyHash) {
        console.warn('Consistency hash mismatch - this may indicate non-deterministic processing');
      }

      // Recalculate score using deterministic function
      if (analysis.jobRequirements && analysis.matchedRequirements) {
        const { score: recalculatedScore, breakdown, weakExperiences } = calculateJobFitScore(
          analysis.matchedRequirements,
          analysis.jobRequirements
        );

        // Update with calculated score
        analysis.fitAssessment.overallScore = recalculatedScore;
        analysis.fitAssessment.categoryBreakdown = breakdown;
        analysis.fitAssessment.calculatedScore = true; // Flag to indicate recalculation

        // Add weak experiences if score < 80
        if (recalculatedScore < 80 && weakExperiences.length > 0) {
          const weakExperienceDetails = weakExperiences
            .slice(0, 5)
            .map((weak: any) => {
              const contextExp = analysis.relevantExperiences?.find((exp: any) => 
                weak.experienceContext && (
                  weak.experienceContext.includes(exp.id) ||
                  weak.experienceContext.includes(exp.title) ||
                  weak.experienceContext.includes(exp.companyName)
                )
              );
              
              return {
                experienceIdentifier: contextExp ? 
                  `${contextExp.companyName} - ${contextExp.roleTitle} - ${contextExp.title}` : 
                  weak.experienceContext || 'Unknown Experience',
                requirement: weak.requirement,
                currentEvidence: weak.evidence,
                evidenceStrength: weak.evidenceStrength
              };
            });

          analysis.weakEvidenceExperiences = {
            message: "Score could improve with stronger evidence for these experiences:",
            experiences: weakExperienceDetails,
            suggestion: "Add specific metrics, outcomes, or detailed examples to strengthen evidence."
          };
        }

        // Update fit level
        const score = recalculatedScore;
        if (score >= SCORING_CONFIG.FIT_THRESHOLDS.excellent) analysis.fitAssessment.fitLevel = "Excellent";
        else if (score >= SCORING_CONFIG.FIT_THRESHOLDS.strong) analysis.fitAssessment.fitLevel = "Strong";
        else if (score >= SCORING_CONFIG.FIT_THRESHOLDS.good) analysis.fitAssessment.fitLevel = "Good";
        else if (score >= SCORING_CONFIG.FIT_THRESHOLDS.fair) analysis.fitAssessment.fitLevel = "Fair";
        else analysis.fitAssessment.fitLevel = "Poor";

        // Experience grouping by role
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
          
          // Sort and limit to top 6 experience IDs per role
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
          
          // Keep experiencesByRole for analytics
          const experiencesByRole: any = {};
          Object.entries(experienceIdsByRole).forEach(([roleKey, roleData]: [string, any]) => {
            const roleExperiences = analysis.relevantExperiences
              .filter((exp: any) => roleData.experienceIds.includes(exp.id));
            
            experiencesByRole[roleKey] = {
              company: roleData.company,
              roleTitle: roleData.roleTitle,
              specialty: roleData.specialty || null,
              experiences: roleExperiences
            };
          });
          analysis.experiencesByRole = experiencesByRole;
        }

        // Enhanced Action planning based on job fit assessment
        const finalScore = analysis.fitAssessment?.overallScore || 0;
        const criticalGaps = analysis.unmatchedRequirements?.filter((req: any) => req.importance === 'critical') || [];
        
        if (finalScore < SCORING_CONFIG.FIT_THRESHOLDS.good || criticalGaps.length > 0) {
          analysis.actionPlan = {
            priority: "improve_job_fit",
            focus: criticalGaps.length > 0 ? "critical_gaps" : "general_improvement",
            criticalGaps: criticalGaps.map((gap: any) => gap.requirement),
            suggestedActions: analysis.recommendations?.forCandidate || [],
            readyForApplication: false,
            readyForBulletGeneration: finalScore >= 80
          };
        } else {
          analysis.actionPlan = {
            priority: "application_ready",
            experienceIds: analysis.relevantExperiences?.map((exp: any) => exp.id) || [],
            readyForBulletGeneration: true,
            readyForApplication: true
          };
        }
      }

      console.log(`Job fit analysis completed: ${analysis.fitAssessment.overallScore}% (${analysis.fitAssessment.fitLevel})`);
      console.log(`Consistency hash: ${consistencyHash}`);
      
      // Debug logging for keyword extraction analysis
      console.log('=== KEYWORD EXTRACTION DEBUG ===');
      console.log('Job Requirements Count:', analysis.jobRequirements ? analysis.jobRequirements.length : 0);
      if (analysis.jobRequirements && analysis.jobRequirements.length > 0) {
        console.log('Job Requirements Sample:', JSON.stringify(analysis.jobRequirements.slice(0, 5), null, 2));
      }
      
      if (analysis.extractedKeywords) {
        console.log('Extracted Keywords - Requirements:', analysis.extractedKeywords.requirements ? analysis.extractedKeywords.requirements.length : 0);
        console.log('Extracted Keywords - Responsibilities:', analysis.extractedKeywords.responsibilities ? analysis.extractedKeywords.responsibilities.length : 0);
        if (analysis.extractedKeywords.requirements) {
          console.log('Requirements Keywords Sample:', JSON.stringify(analysis.extractedKeywords.requirements.slice(0, 10), null, 2));
        }
        if (analysis.extractedKeywords.responsibilities) {
          console.log('Responsibilities Keywords Sample:', JSON.stringify(analysis.extractedKeywords.responsibilities.slice(0, 10), null, 2));
        }
      }
      
      if (analysis.bulletKeywords) {
        console.log('Bullet Keywords Count:', Object.keys(analysis.bulletKeywords).length);
        Object.entries(analysis.bulletKeywords).forEach(([category, keywords]: [string, any]) => {
          console.log(`${category} Keywords:`, Array.isArray(keywords) ? keywords.length : 0);
        });
      }
      console.log('=== END KEYWORD DEBUG ===');

    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      throw new Error('Failed to parse analysis results');
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in job fit analysis:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
