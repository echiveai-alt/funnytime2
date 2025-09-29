import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-keyword-match-type',
};

const CONSTANTS = {
  FIT_THRESHOLD: 80,
  MAX_BULLETS_PER_ROLE: 8,
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

function createUnifiedPrompt(jobDescription: string, experiences: any[], keywordMatchType: string): string {
  const keywordInstruction = keywordMatchType === 'exact' 
    ? 'Use keywords EXACTLY as they appear in the job description'
    : 'Use keywords and their variations (different tenses, forms, related terms like "managed" for "led", "collaborated" for "worked with")';

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

SCORING METHODOLOGY:
1. Extract ALL keywords and requirements from job description (skills, tools, technologies, qualifications, responsibilities)
2. For each requirement/keyword, check if candidate's experiences contain it or a translatable equivalent:
   - Exact matches count fully
   - Translatable matches count fully (e.g., "managed team" = "led team", "collaborated" = "worked with others")
3. Score = (matched requirements / total requirements) * 100
4. If missing critical requirements (e.g., required certifications, years of experience), cap score at 70%

KEYWORD EXTRACTION:
- Extract a comprehensive list of ALL keywords from the job description (no categorization needed)
- Keywords include: skills, tools, technologies, methodologies, qualifications, action verbs, domain terms
- For scores < 80%: divide keywords into "matchable" (found in experiences) and "unmatchable" (not found)

BULLET GENERATION (ONLY IF SCORE >= 80%):
- Create up to ${CONSTANTS.MAX_BULLETS_PER_ROLE} bullets per role (or one per experience if fewer than 8 experiences for that role)
- Order bullets from most relevant to least relevant based on job description alignment
- Use one of these structures:
  * "Result (with numbers if available) + Action verb + context"
  * "Action verb + context + quantified result"
  * "Result (with numbers if available) + Action verb"
- Keep each bullet under ${CONSTANTS.VISUAL_WIDTH_LIMIT} visual characters
- KEYWORD MATCHING: ${keywordInstruction}
- Use ONLY real information from experiences - never invent details
- Embed keywords naturally where supported by experience
- Track which keywords were used in bullets and which couldn't be embedded

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
  "allKeywords": ["comprehensive", "list", "of", "all", "keywords", "from", "job", "description"],
  "bulletPoints": {
    "Company Name - Role Title": [
      {
        "text": "bullet point text under ${CONSTANTS.VISUAL_WIDTH_LIMIT} visual chars",
        "experienceId": "exp_id",
        "keywordsUsed": ["keywords in this bullet"],
        "relevanceScore": 10
      }
    ]
  },
  "keywordsUsed": ["keywords successfully embedded in bullets"],
  "keywordsNotUsed": ["keywords that couldn't fit naturally in bullets"]
}

IF SCORE < 80%:
{
  "overallScore": 65,
  "isFit": false,
  "fitLevel": "Poor",
  "jobRequirements": [...],
  "matchedRequirements": [...],
  "unmatchedRequirements": [...],
  "allKeywords": ["comprehensive", "list", "of", "all", "keywords"],
  "matchableKeywords": ["keywords found in candidate experiences"],
  "unmatchableKeywords": ["keywords NOT found in candidate experiences"],
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

    console.log(`Starting unified analysis for user ${user.id}`);

    // Fetch user experiences
    const { data: experiences, error: expError } = await supabase
      .from('experiences')
      .select(`
        *,
        roles!inner(
          title,
          companies!inner(name)
        )
      `)
      .eq('user_id', user.id);

    if (expError || !experiences?.length) {
      throw new AnalysisError('No experiences found', 'NO_EXPERIENCES', 400);
    }

    // Format experiences
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
          content: createUnifiedPrompt(jobDescription.trim(), formattedExperiences, keywordMatchType)
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
        // Sort by relevanceScore (highest first) if provided
        const sortedBullets = bullets.sort((a: any, b: any) => 
          (b.relevanceScore || 0) - (a.relevanceScore || 0)
        );

        processedBullets[roleKey] = sortedBullets.map((bullet: any) => {
          const visualWidth = calculateVisualWidth(bullet.text);
          return {
            text: bullet.text,
            visualWidth: Math.round(visualWidth),
            exceedsWidth: visualWidth > CONSTANTS.VISUAL_WIDTH_LIMIT,
            experienceId: bullet.experienceId,
            keywordsUsed: bullet.keywordsUsed || [],
            relevanceScore: bullet.relevanceScore || 0
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
      error: error.message,
      code: errorCode
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
