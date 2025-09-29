import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONSTANTS = {
  FIT_THRESHOLD: 80,
  MAX_BULLETS_PER_ROLE: 6,
  VISUAL_WIDTH_LIMIT: 179,
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

// Simple fit calculation
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

function createUnifiedPrompt(jobDescription: string, experiences: any[], keywordMatchType: string): string {
  const keywordInstruction = keywordMatchType === 'exact' 
    ? 'Use keywords EXACTLY as they appear in the job description'
    : 'Use keywords and their variations (different tenses, forms, related terms)';

  return `You are a professional resume analyzer and writer. Analyze if the candidate matches the job, and if they score 80% or higher, generate optimized resume bullets.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE EXPERIENCES:
${experiences.map((exp, i) => `
${i + 1}. ID: ${exp.id}
   Company: ${exp.company}
   Role: ${exp.role}
   Title: ${exp.title}
   Action: ${exp.action}
   Result: ${exp.result}
   ${exp.situation ? `Context: ${exp.situation}` : ''}
   ${exp.task ? `Task: ${exp.task}` : ''}
`).join('')}

ANALYSIS INSTRUCTIONS:
1. Extract specific job requirements (skills, tools, experience levels, certifications)
2. Mark importance: critical (must-have), high (preferred), medium (nice-to-have), low (bonus)
3. Match requirements to candidate's experiences
4. Calculate fit score as: (matched requirements / total requirements) * 100
5. If missing critical requirements, cap score at 70%

BULLET GENERATION (ONLY IF SCORE >= 80%):
- Create up to ${CONSTANTS.MAX_BULLETS_PER_ROLE} bullets per role
- Structure: "Action verb + context + quantified result"
- Keep each bullet under ${CONSTANTS.VISUAL_WIDTH_LIMIT} visual characters
- KEYWORD MATCHING: ${keywordInstruction}
- Use ONLY real information from experiences - never invent details
- Embed keywords naturally where supported by experience

Return JSON in this EXACT format:

IF SCORE >= 80%:
{
  "overallScore": 85,
  "isFit": true,
  "fitLevel": "Good",
  "jobRequirements": [
    {"requirement": "text", "importance": "critical|high|medium|low"}
  ],
  "matchedRequirements": [
    {
      "jobRequirement": "requirement text",
      "experienceEvidence": "evidence from experience",
      "experienceSource": "Company - Role: Experience Title"
    }
  ],
  "unmatchedRequirements": [
    {"requirement": "text", "importance": "level"}
  ],
  "bulletKeywords": {
    "technical": ["terms"],
    "skills": ["skills"],
    "industry": ["terms"],
    "action": ["verbs"],
    "metrics": ["quantifiable terms"]
  },
  "bulletPoints": {
    "Company Name - Role Title": [
      {
        "text": "bullet point text under ${CONSTANTS.VISUAL_WIDTH_LIMIT} visual chars",
        "experienceId": "exp_id",
        "keywordsUsed": ["keywords in this bullet"]
      }
    ]
  },
  "keywordsUsed": ["all keywords successfully embedded"],
  "keywordsNotUsed": ["keywords that couldn't fit naturally"]
}

IF SCORE < 80%:
{
  "overallScore": 65,
  "isFit": false,
  "fitLevel": "Poor",
  "jobRequirements": [...],
  "matchedRequirements": [...],
  "unmatchedRequirements": [...],
  "criticalGaps": ["critical requirements missing"],
  "recommendations": {
    "forCandidate": [
      "Add relevant experience in missing areas",
      "Consider training in critical requirements"
    ]
  }
}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== ANALYZE JOB FIT FUNCTION START ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    // Environment validation
    const openaiApiKey = Deno.env.get('ANALYZE_JOB_FIT_OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiApiKey || !supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        hasOpenAI: !!openaiApiKey,
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      });
      throw new AnalysisError('Missing required environment variables', 'CONFIG_ERROR', 500);
    }

    console.log('Environment variables OK');

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

    console.log(`Starting unified analysis for user ${user.id}`);

    // Fetch user experiences with proper joins
    console.log('Fetching experiences for user:', user.id);
    
    // First get experiences
    const { data: experiencesData, error: expError } = await supabase
      .from('experiences')
      .select('*')
      .eq('user_id', user.id);

    if (expError) {
      console.error('Experiences query error:', expError);
      throw new AnalysisError(`Database error: ${expError.message}`, 'DATABASE_ERROR', 500);
    }

    if (!experiencesData?.length) {
      console.log('No experiences found for user');
      throw new AnalysisError('No experiences found', 'NO_EXPERIENCES', 400);
    }

    // Get roles for these experiences
    const roleIds = [...new Set(experiencesData.map(exp => exp.role_id))];
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id, title, company_id')
      .in('id', roleIds);

    if (rolesError) {
      console.error('Roles query error:', rolesError);
      throw new AnalysisError(`Database error: ${rolesError.message}`, 'DATABASE_ERROR', 500);
    }

    // Get companies for these roles
    const companyIds = [...new Set(rolesData?.map(role => role.company_id) || [])];
    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', companyIds);

    if (companiesError) {
      console.error('Companies query error:', companiesError);
      throw new AnalysisError(`Database error: ${companiesError.message}`, 'DATABASE_ERROR', 500);
    }

    // Create lookup maps
    const rolesMap = new Map(rolesData?.map(role => [role.id, role]) || []);
    const companiesMap = new Map(companiesData?.map(company => [company.id, company]) || []);

    // Format experiences with company and role info
    const experiences = experiencesData.map(exp => {
      const role = rolesMap.get(exp.role_id);
      const company = role ? companiesMap.get(role.company_id) : null;
      
      return {
        id: exp.id,
        company: company?.name || 'Unknown Company',
        role: role?.title || 'Unknown Role',
        title: exp.title,
        action: exp.action,
        result: exp.result,
        situation: exp.situation,
        task: exp.task
      };
    });

    console.log('Successfully formatted experiences:', experiences.length);

    // Format experiences - already formatted above
    console.log('Formatted experiences count:', experiences.length);

    // Call OpenAI with unified prompt
    console.log('Calling OpenAI with unified analysis and generation...');
    
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
          content: createUnifiedPrompt(jobDescription.trim(), experiences, keywordMatchType)
        }],
        max_tokens: 4000,
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

    // Validate and process bullet points if fit
    if (analysis.isFit && analysis.bulletPoints) {
      const processedBullets: any = {};
      
      Object.entries(analysis.bulletPoints).forEach(([roleKey, bullets]: [string, any]) => {
        processedBullets[roleKey] = bullets.map((bullet: any) => {
          const visualWidth = calculateVisualWidth(bullet.text);
          return {
            text: bullet.text,
            visualWidth: Math.round(visualWidth),
            exceedsWidth: visualWidth > CONSTANTS.VISUAL_WIDTH_LIMIT,
            experienceId: bullet.experienceId,
            keywordsUsed: bullet.keywordsUsed || []
          };
        });
      });

      analysis.bulletPoints = processedBullets;

      // Format for frontend compatibility
      const bulletOrganization = Object.entries(processedBullets).map(([roleKey, bullets]: [string, any]) => {
        const [company, role] = roleKey.split(' - ');
        return {
          name: company,
          roles: [{
            title: role,
            bulletPoints: bullets
          }]
        };
      });

      analysis.resumeBullets = {
        bulletOrganization,
        keywordsUsed: analysis.keywordsUsed || [],
        keywordsNotUsed: analysis.keywordsNotUsed || [],
        generatedFrom: {
          totalExperiences: experiences.length,
          keywordMatchType: keywordMatchType,
          scoreThreshold: CONSTANTS.FIT_THRESHOLD
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
    if (analysis.isFit) {
      console.log('Bullets generated in same call');
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unified analysis error:', error);
    
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
