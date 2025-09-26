import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced scoring configuration aligned with comprehensive framework
const SCORING_CONFIG = {
  WEIGHTS: {
    technical: 0.30,           // Core technical competencies
    experience_level: 0.25,    // Seniority, progression, complexity
    domain_industry: 0.20,     // Sector knowledge, transferable experience  
    leadership_impact: 0.15,   // Scale of responsibility, measurable outcomes
    cultural_soft: 0.10        // Communication, problem-solving, teamwork
  },
  IMPORTANCE_MULTIPLIERS: {
    critical: 1.0,     // Must-have (can't be taught quickly)
    high: 0.85,        // Strongly preferred
    medium: 0.65,      // Nice to have
    low: 0.35          // Bonus points
  },
  MATCH_TYPE_SCORES: {
    exact: 1.0,        // Identical terms/concepts
    semantic: 0.9,     // Same meaning, different words
    synonym: 0.8,      // Equivalent terms
    transferable: 0.7, // Related/applicable skills
    contextual: 0.6    // Requires interpretation
  },
  EVIDENCE_MULTIPLIERS: {
    quantified: 1.0,   // Clear metrics/outcomes
    demonstrated: 0.8, // Clear examples
    mentioned: 0.5,    // Basic indication
    implied: 0.3       // Inferred from context
  },
  WEAK_EVIDENCE_THRESHOLD: 0.5, // Added missing constant
  FIT_THRESHOLDS: {
    excellent: 90,
    strong: 75,
    good: 60,
    fair: 45,
    poor: 0
  }
};

// Focused scoring calculation for job fit assessment
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

  // Calculate scores for each category and identify weak experiences
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
        
        // Track weak evidence experiences
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

// Updated prompt for job fit analysis with requirements vs responsibilities distinction
function createJobFitAnalysisPrompt(jobDescription: string, experiences: any[], education: any[]): string {
  return `
You are an expert talent recruiter analyzing if a candidate's demonstrated experiences show they can perform the job requirements.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE EXPERIENCES:
${experiences.map((exp, index) => `
Experience ${index + 1}:
- ID: ${exp.id}
- Company: ${exp.company}
- Role: ${exp.role}
- Specialty: ${exp.specialty || 'Not specified'}
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

JOB FIT ANALYSIS FRAMEWORK:

**CRITICAL DISTINCTION - Requirements vs Responsibilities:**
1. **REQUIREMENTS**: Must-have qualifications, skills, experience levels that are prerequisites
   - Examples: "Bachelor's degree required", "5+ years Python experience", "Security clearance required"
   - These are deal-breakers if missing and should be weighted heavily
   
2. **RESPONSIBILITIES**: Day-to-day tasks and duties the person would perform
   - Examples: "Manage customer relationships", "Develop marketing campaigns", "Lead team meetings"
   - These are valuable if candidate has done them but can be learned on the job

**PRIORITIZE REQUIREMENTS over responsibilities in scoring and matching**

Focus on 5 key areas that predict job performance:

1. **TECHNICAL SKILLS (30%)**: Programming languages, tools, frameworks, methodologies
   - Can they use the required technologies?
   - Do they have the technical depth needed?

2. **EXPERIENCE LEVEL (25%)**: Role complexity, responsibility scope, similar challenges
   - Have they handled similar complexity/scale?
   - Do they have relevant hands-on experience?

3. **DOMAIN/INDUSTRY KNOWLEDGE (20%)**: Sector expertise, regulatory knowledge, business context
   - Do they understand the business domain?
   - Have they worked with similar constraints/requirements?

4. **LEADERSHIP/IMPACT (15%)**: Scale of responsibility, measurable outcomes
   - Look for evidence of: team leadership, project management, measurable business impact
   - Base this ONLY on concrete examples from their experiences
   - Example: "managed team of 8" = leadership evidence

5. **CULTURAL/SOFT SKILLS (10%)**: Communication, problem-solving, teamwork
   - Look for evidence of: collaboration, communication, adaptability, initiative
   - Base this ONLY on concrete examples from their experiences
   - Example: "coordinated with 3 departments" = collaboration evidence

IMPORTANCE LEVELS (focus on what matters most):
- **critical**: Must-have requirements that are deal-breakers
- **high**: Strongly preferred requirements with significant learning curve
- **medium**: Nice to have requirements, can be developed
- **low**: Bonus skills or responsibilities that add value

MATCHING STRATEGY - Look for functional equivalence:
- **exact**: Identical terms ("Python" = "Python")
- **semantic**: Same function, different words ("led team" = "team leadership") 
- **synonym**: Equivalent terms ("MySQL" = "SQL database")
- **transferable**: Related skills that apply ("retail manager" = "team management")
- **contextual**: Skills implied from context ("optimized process" = "process improvement")

EVIDENCE QUALITY - Rate the strength of proof:
- **quantified**: Has specific metrics ("reduced time by 40%", "managed $2M budget")
- **demonstrated**: Clear examples with context ("Led 5-person team for 6-month project")
- **mentioned**: Stated but no details ("responsible for leadership")
- **implied**: Inferred from title/situation ("Senior Engineer at startup")

KEYWORD EXTRACTION RULES:
- Keep phrases SHORT (1-3 words max): "Python", "team leadership", "AWS", not "experience with Python programming"
- Extract SPECIFIC terms: "React", "SQL", "project management", "Agile"
- Focus on SEARCHABLE keywords that would appear on resumes
- Separate REQUIREMENTS (must-haves) from RESPONSIBILITIES (nice-to-haves)

SEARCH ALL EXPERIENCE FIELDS (handle null values gracefully): 
- situation (may be null), task (may be null), action, result, tags, role titles, company names
- When situation/task are null, focus more heavily on action and result fields
- Specialty field may be null - use for context when available but don't require it

Return JSON:
{
  "jobRequirements": [
    {
      "requirement": "specific requirement text (1-3 words)",
      "type": "requirement|responsibility",
      "category": "technical|experience_level|domain_industry|leadership_impact|cultural_soft",
      "importance": "critical|high|medium|low",
      "context": "why this requirement matters for success"
    }
  ],
  "extractedKeywords": {
    "requirements": {
      "technical": ["Python", "React", "AWS"],
      "experience": ["5+ years", "senior level", "startup experience"],
      "education": ["Bachelor's degree", "Computer Science", "certification"],
      "industry": ["fintech", "healthcare", "B2B SaaS"],
      "soft_skills": ["leadership", "communication", "problem-solving"]
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
      "jobRequirement": "requirement text",
      "type": "requirement|responsibility",
      "experienceEvidence": "specific evidence from candidate experience",
      "experienceContext": "Company - Role - Title format",
      "matchType": "exact|semantic|synonym|transferable|contextual",
      "evidenceStrength": "quantified|demonstrated|mentioned|implied"
    }
  ],
  "unmatchedRequirements": [
    {
      "requirement": "requirement text",
      "type": "requirement|responsibility", 
      "category": "category",
      "importance": "importance level",
      "suggestionToImprove": "how candidate could develop or better demonstrate this"
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
      "matchingRequirements": ["requirements this experience addresses"],
      "strengthOfEvidence": "quantified|demonstrated|mentioned|implied"
    }
  ],
  "fitAssessment": {
    "overallScore": 75,
    "fitLevel": "Strong|Good|Fair|Poor",
    "categoryBreakdown": {
      "technical": {"score": 80, "confidence": "high|medium|low"},
      "experience_level": {"score": 70, "confidence": "high|medium|low"},
      "domain_industry": {"score": 65, "confidence": "high|medium|low"}, 
      "leadership_impact": {"score": 85, "confidence": "high|medium|low"},
      "cultural_soft": {"score": 75, "confidence": "high|medium|low"}
    }
  },
  "strengths": ["demonstrated strengths with specific evidence"],
  "gaps": ["missing requirements or weak evidence areas"],
  "recommendations": {
    "forCandidate": ["how to strengthen weak experiences or develop missing skills"],
    "forInterview": ["questions to ask to clarify fit"],
    "forApplication": ["how to better position existing experience"]
  },
  "summary": "clear assessment of job fit based on demonstrated experience evidence"
}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('ANALYZE_JOB_FIT_OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('Environment variables check:', {
      hasOpenaiApiKey: !!openaiApiKey,
      openaiKeyLength: openaiApiKey?.length || 0,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey
    });

    if (!openaiApiKey) {
      throw new Error('Missing ANALYZE_JOB_FIT_OPENAI_API_KEY environment variable');
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required Supabase environment variables');
    }

    if (!openaiApiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format - should start with sk-');
    }

    console.log('analyze-job-fit: Using dedicated OpenAI API key');

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

    // Fetch data with proper structure - handle nested relationships
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
      throw new Error('Failed to fetch experiences: ' + experiencesResult.reason);
    }
    if (experiencesResult.value.error) {
      throw new Error('Failed to fetch experiences: ' + experiencesResult.value.error.message);
    }

    const experiences = experiencesResult.value.data;
    if (!experiences || experiences.length === 0) {
      throw new Error('No experiences found. Please add at least one experience before analyzing job fit.');
    }

    const education = educationResult.status === 'fulfilled' && !educationResult.value.error 
      ? educationResult.value.data || []
      : [];

    // Improved data formatting for analysis
    const formattedExperiences = experiences.map(exp => {
      // Handle the nested structure properly
      const role = exp.roles;
      const company = role?.companies;
      
      return {
        id: exp.id,
        // Use consistent field names that match the AI prompt
        company: company?.name || 'Unknown Company',
        role: role?.title || 'Unknown Role',
        specialty: role?.specialty || null,
        startDate: role?.start_date || null,
        endDate: role?.end_date || null,
        
        // Core experience fields - ensure these match database columns
        title: exp.title || 'Untitled Experience',
        situation: exp.situation || null,
        task: exp.task || null, 
        action: exp.action || 'No action details provided',
        result: exp.result || 'No results specified',
        tags: Array.isArray(exp.tags) ? exp.tags : []
      };
    });

    // Enhanced education formatting
    const formattedEducation = education.map((edu: any) => ({
      school: edu.school,
      degree: edu.degree,
      field: edu.field_of_study,
      graduationDate: edu.graduation_date,
      gpa: edu.gpa,
      isExpectedGraduation: edu.is_expected_graduation
    }));

    // Add debug logging to check data
    console.log('Formatted experiences sample:', {
      count: formattedExperiences.length,
      firstExperience: formattedExperiences[0],
      hasContent: formattedExperiences.some(exp => 
        exp.action && exp.action !== 'No action details provided'
      )
    });

    // Create focused job fit analysis prompt
    const prompt = createJobFitAnalysisPrompt(jobDescription, formattedExperiences, formattedEducation);

    // Log prompt size for debugging
    console.log('Job fit analysis prompt character count:', prompt.length);
    if (prompt.length > 120000) {
      console.warn('Prompt is very large, consider reducing data size');
    }

    // Call OpenAI API with enhanced error handling
    let openaiResponse;
    let retryCount = 0;
    const maxRetries = 3;
    let lastError: any = null;

    while (retryCount < maxRetries) {
      try {
        console.log(`OpenAI API call attempt ${retryCount + 1}/${maxRetries}`);
        
        const requestBody = {
          model: 'gpt-4o-mini-2024-07-18',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_completion_tokens: 4096, // Increased for comprehensive analysis
          temperature: 0.1
        };

        console.log('Request body size:', JSON.stringify(requestBody).length, 'characters');

        openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        console.log('OpenAI response status:', openaiResponse.status, openaiResponse.statusText);
        
        if (openaiResponse.ok) {
          console.log('OpenAI API call successful');
          break;
        }

        const errorText = await openaiResponse.text();
        console.error('OpenAI API error response:', errorText);
        
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { error: { message: errorText } };
        }

        lastError = new Error(`OpenAI API error (${openaiResponse.status}): ${errorDetails.error?.message || 'Unknown error'}`);

        // Don't retry on authentication/permission errors
        if ([401, 403, 400].includes(openaiResponse.status)) {
          throw lastError;
        }

        retryCount++;
        if (retryCount < maxRetries) {
          const delay = 1000 * Math.pow(2, retryCount);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error('OpenAI API call error:', error);
        lastError = error;
        retryCount++;
        if (retryCount >= maxRetries) break;
        
        const delay = 1000 * Math.pow(2, retryCount);
        console.log(`Retrying in ${delay}ms after error...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!openaiResponse?.ok) {
      throw lastError || new Error('Failed to get response from OpenAI API after all retries');
    }

    const openaiData = await openaiResponse.json();
    
    console.log('OpenAI response structure:', {
      hasChoices: !!openaiData.choices,
      choicesLength: openaiData.choices?.length || 0,
      hasMessage: !!openaiData.choices?.[0]?.message,
      hasContent: !!openaiData.choices?.[0]?.message?.content,
      usage: openaiData.usage
    });

    if (!openaiData.choices?.[0]?.message?.content) {
      console.error('Invalid OpenAI response:', JSON.stringify(openaiData));
      throw new Error('Invalid response structure from OpenAI API - no content returned');
    }

    const responseText = openaiData.choices[0].message.content;
    console.log('OpenAI response text length:', responseText.length);
    console.log('Response preview:', responseText.substring(0, 500) + '...');
    
    // Enhanced JSON parsing and validation
    let analysis: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response:', responseText);
        throw new Error('No JSON found in response');
      }

      console.log('Extracted JSON length:', jsonMatch[0].length);
      analysis = JSON.parse(jsonMatch[0]);
      
      // Validate job fit analysis fields
      const requiredFields = [
        'jobRequirements', 'bulletKeywords', 'matchedRequirements', 
        'unmatchedRequirements', 'relevantExperiences', 'fitAssessment', 'strengths',
        'gaps', 'recommendations', 'summary'
      ];
      
      for (const field of requiredFields) {
        if (!(field in analysis)) {
          console.error('Missing required field:', field);
          console.error('Available fields:', Object.keys(analysis));
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Recalculate score with focused framework and identify weak experiences
      if (analysis.jobRequirements && analysis.matchedRequirements) {
        const { score: recalculatedScore, breakdown, weakExperiences } = calculateJobFitScore(
          analysis.matchedRequirements, 
          analysis.jobRequirements
        );
        
        // Update analysis with recalculated scores
        if (Math.abs(recalculatedScore - (analysis.fitAssessment?.overallScore || 0)) > 10) {
          console.log(`Score adjustment: ${analysis.fitAssessment?.overallScore} → ${recalculatedScore}`);
          if (!analysis.fitAssessment) analysis.fitAssessment = {};
          analysis.fitAssessment.overallScore = recalculatedScore;
          analysis.fitAssessment.scoreBreakdown = breakdown;
        }

        // Add weak evidence experiences if score is below 80%
        if (recalculatedScore < 80 && weakExperiences.length > 0) {
          const weakExperienceDetails = weakExperiences
            .slice(0, 5) // Limit to 5 as requested
            .map((weak: any) => {
              // Try to find the experience from relevantExperiences
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
            message: "Your score could improve by adding more detailed evidence to these experiences:",
            experiences: weakExperienceDetails,
            suggestion: "Consider adding specific metrics, outcomes, or more detailed examples to strengthen the evidence in these experiences."
          };
        }
      }

      // Update fit level based on focused thresholds
      const score = analysis.fitAssessment?.overallScore || 0;
      if (score >= SCORING_CONFIG.FIT_THRESHOLDS.excellent) analysis.fitAssessment.fitLevel = "Excellent";
      else if (score >= SCORING_CONFIG.FIT_THRESHOLDS.strong) analysis.fitAssessment.fitLevel = "Strong";
      else if (score >= SCORING_CONFIG.FIT_THRESHOLDS.good) analysis.fitAssessment.fitLevel = "Good";
      else if (score >= SCORING_CONFIG.FIT_THRESHOLDS.fair) analysis.fitAssessment.fitLevel = "Fair";
      else analysis.fitAssessment.fitLevel = "Poor";

      // Experience grouping by role (specialty available for context)
      if (analysis.relevantExperiences) {
        const experienceIdsByRole: any = {};
        
        // Experience grouping by role (handle null specialty gracefully)
        analysis.relevantExperiences.forEach((exp: any) => {
          const roleKey = `${exp.companyName}-${exp.roleTitle}`;
          
          if (!experienceIdsByRole[roleKey]) {
            experienceIdsByRole[roleKey] = {
              company: exp.companyName,
              roleTitle: exp.roleTitle,
              specialty: exp.specialty || null, // Handle null specialty
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
            specialty: roleData.specialty || null, // Handle null specialty
            experiences: roleExperiences
          };
        });
        analysis.experiencesByRole = experiencesByRole;
      }

      // Focused action planning based on job fit assessment
      const finalScore = analysis.fitAssessment?.overallScore || 0;
      const criticalGaps = analysis.unmatchedRequirements?.filter((req: any) => req.importance === 'critical') || [];
      
      if (finalScore < SCORING_CONFIG.FIT_THRESHOLDS.good || criticalGaps.length > 0) {
        analysis.actionPlan = {
          priority: "improve_job_fit",
          focus: criticalGaps.length > 0 ? "critical_gaps" : "general_improvement",
          criticalGaps: criticalGaps.map((gap: any) => gap.requirement),
          suggestedActions: analysis.recommendations?.forCandidate || [],
          readyForApplication: false,
          readyForBulletGeneration: finalScore >= 80 // Add explicit flag for bullet generation
        };
      } else {
        analysis.actionPlan = {
          priority: "application_ready",
          experienceIds: analysis.relevantExperiences.map((exp: any) => exp.id),
          readyForBulletGeneration: true,
          interviewPrep: analysis.recommendations?.forInterview || []
        };
      }

    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Response text:', responseText);
      throw new Error('Failed to parse job fit analysis results: ' + (parseError instanceof Error ? parseError.message : String(parseError)));
    }

    console.log(`Job fit analysis completed: ${analysis.fitAssessment?.overallScore}% match (${analysis.fitAssessment?.fitLevel})`);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in job fit analysis function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
