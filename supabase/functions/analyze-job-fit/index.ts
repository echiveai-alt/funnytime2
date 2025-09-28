import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-keyword-match-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Simplified constants
const CONSTANTS = {
  FIT_THRESHOLD: 80,
  MAX_BULLETS_PER_ROLE: 6,
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

// Simple fit calculation - just count matched vs total requirements
function calculateFitScore(matchedRequirements: any[], totalRequirements: any[]): number {
  if (!totalRequirements || totalRequirements.length === 0) return 0;
  
  const criticalRequirements = totalRequirements.filter(req => req.importance === 'critical');
  const matchedCritical = matchedRequirements.filter(match => 
    criticalRequirements.some(req => req.requirement === match.jobRequirement)
  );
  
  // If missing critical requirements, cap at 70%
  if (criticalRequirements.length > 0 && matchedCritical.length < criticalRequirements.length) {
    const maxScore = 70;
    const baseScore = Math.round((matchedRequirements.length / totalRequirements.length) * 100);
    return Math.min(maxScore, baseScore);
  }
  
  return Math.round((matchedRequirements.length / totalRequirements.length) * 100);
}

function createSimplifiedPrompt(jobDescription: string, experiences: any[], keywordMatchType: string): string {
  const keywordInstruction = keywordMatchType === 'exact' 
    ? 'Use keywords EXACTLY as they appear in the job description'
    : 'Use keywords and their variations (different tenses, forms, related terms)';

  return `You are a professional resume analyzer. Analyze if the candidate's experiences match the job requirements.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE EXPERIENCES:
${experiences.map((exp, i) => `
${i + 1}. ${exp.company} - ${exp.role}
   Title: ${exp.title}
   Action: ${exp.action}
   Result: ${exp.result}
   ${exp.situation ? `Context: ${exp.situation}` : ''}
   ${exp.task ? `Task: ${exp.task}` : ''}
`).join('')}

ANALYSIS REQUIREMENTS:
1. Extract specific job requirements (skills, tools, experience levels, certifications)
2. Mark importance: critical (must-have), high (preferred), medium (nice-to-have), low (bonus)
3. Find which requirements match the candidate's experiences
4. Extract keywords for resume optimization

KEYWORD MATCHING: ${keywordInstruction}

Return JSON in this exact format:
{
  "jobRequirements": [
    {
      "requirement": "specific requirement text",
      "importance": "critical|high|medium|low"
    }
  ],
  "matchedRequirements": [
    {
      "jobRequirement": "requirement text",
      "experienceEvidence": "evidence from candidate experience",
      "experienceSource": "Company - Role: Experience Title"
    }
  ],
  "unmatchedRequirements": [
    {
      "requirement": "requirement text", 
      "importance": "importance level"
    }
  ],
  "resumeKeywords": {
    "technical": ["technical terms from job"],
    "skills": ["skill keywords"], 
    "industry": ["industry-specific terms"],
    "action": ["action verbs"],
    "metrics": ["quantifiable terms"]
  },
  "experiencesByRole": {
    "Company Name - Role Title": [
      {
        "id": "experience_id",
        "title": "experience title",
        "action": "action taken",
        "result": "result achieved",
        "relevanceScore": 85
      }
    ]
  }
}`;
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
    
    if (!jobDescription?.trim()) {
      throw new AnalysisError('Job description is required', 'MISSING_JOB_DESCRIPTION', 400);
    }

    if (jobDescription.trim().length < 50) {
      throw new AnalysisError('Job description too short for analysis', 'JOB_DESCRIPTION_TOO_SHORT', 400);
    }

    // Get keyword matching preference
    const keywordMatchType = req.headers.get('x-keyword-match-type') || 'exact';

    console.log(`Starting simplified analysis for user ${user.id}`);

    // Fetch user experiences
    const { data: experiences, error: expError } = await supabase
      .from('experiences')
      .select(`
        *,
        roles!inner(
          title,
          start_date,
          end_date,
          companies!inner(name)
        )
      `)
      .eq('user_id', user.id);

    if (expError || !experiences?.length) {
      throw new AnalysisError('No experiences found', 'NO_EXPERIENCES', 400);
    }

    // Format experiences simply
    const formattedExperiences = experiences.map(exp => ({
      id: exp.id,
      company: exp.roles.companies.name,
      role: exp.roles.title,
      title: exp.title,
      action: exp.action,
      result: exp.result,
      situation: exp.situation,
      task: exp.task
    }));

    // Call OpenAI
    console.log('Calling OpenAI with simplified prompt...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ 
          role: 'user', 
          content: createSimplifiedPrompt(jobDescription.trim(), formattedExperiences, keywordMatchType)
        }],
        max_tokens: 3000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new AnalysisError(`OpenAI API error: ${response.status}`, 'OPENAI_ERROR', 500);
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices[0].message.content;

    // Parse AI response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AnalysisError('Invalid AI response format', 'INVALID_RESPONSE', 500);
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Calculate simple fit score
    const fitScore = calculateFitScore(
      analysis.matchedRequirements || [], 
      analysis.jobRequirements || []
    );

    const isFit = fitScore >= CONSTANTS.FIT_THRESHOLD;

    // Prepare response based on fit status
    let result: any = {
      overallScore: fitScore,
      fitLevel: isFit ? 'Good' : 'Poor',
      isFit: isFit,
      jobRequirements: analysis.jobRequirements || [],
      matchedRequirements: analysis.matchedRequirements || [],
      unmatchedRequirements: analysis.unmatchedRequirements || [],
    };

    if (isFit) {
      // If fit: prepare for bullet generation
      result = {
        ...result,
        // Data needed for bullet generation
        experienceIdsByRole: analysis.experiencesByRole || {},
        bulletKeywords: analysis.resumeKeywords || {},
        // Ready for bullet generation
        fitAssessment: {
          overallScore: fitScore,
          fitLevel: 'Good'
        },
        actionPlan: {
          readyForApplication: true,
          readyForBulletGeneration: true
        }
      };
    } else {
      // If not fit: provide gap analysis
      const criticalGaps = analysis.unmatchedRequirements?.filter(
        (req: any) => req.importance === 'critical'
      ) || [];

      result = {
        ...result,
        gaps: analysis.unmatchedRequirements?.map((req: any) => req.requirement) || [],
        criticalGaps: criticalGaps.map((req: any) => req.requirement),
        recommendations: {
          forCandidate: [
            'Add more relevant experience in missing skill areas',
            'Consider training or certification in critical requirements',
            'Highlight transferable skills more clearly in existing experiences'
          ]
        },
        fitAssessment: {
          overallScore: fitScore,
          fitLevel: 'Poor'
        },
        actionPlan: {
          readyForApplication: false,
          readyForBulletGeneration: false,
          criticalGaps: criticalGaps.map((req: any) => req.requirement)
        }
      };
    }

    console.log(`Analysis completed: ${fitScore}% fit (${isFit ? 'PASS' : 'FAIL'})`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    let statusCode = 500;
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error instanceof AnalysisError) {
      statusCode = error.statusCode;
      errorCode = error.code;
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      code: errorCode
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
