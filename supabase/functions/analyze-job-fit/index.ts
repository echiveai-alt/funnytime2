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
1. Break down compound requirements:
   - "Experience with Salesforce and HubSpot" = 2 requirements
   - "3+ years in product management" = 2 requirements: "product management experience" AND "3+ years experience"
   
2. Each distinct skill, tool, technology, certification, or responsibility = separate requirement

3. Mark importance levels:
   - critical: Must-have, required, essential (explicitly stated in job description)
   - high: Preferred, strongly desired
   - medium: Nice to have, plus if you have
   - low: Bonus, additional

4. Extract ALL keywords and phrases that appear in the job description:
   - Technical terms (e.g., "Salesforce", "Python", "A/B testing")
   - Skills (e.g., "data analysis", "project management")
   - Domain terms (e.g., "SaaS", "B2B", "customer acquisition")
   - Action verbs (e.g., "optimize", "scale", "implement")
   - Industry jargon (e.g., "funnel optimization", "user journeys")

CRITICAL: Do NOT extract any company names, project names, dates, or specific details that could only come from a candidate's background. Only extract information from the job description.

Return JSON in this EXACT format:
{
  "jobRequirements": [
    {
      "requirement": "Specific requirement text from job description",
      "importance": "critical|high|medium|low",
      "category": "technical_skill|soft_skill|experience|education|domain_knowledge"
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
  keywordMatchType: string
): string {
  const keywordInstruction = keywordMatchType === 'exact' 
    ? 'Use keywords EXACTLY as they appear in the provided keyword list'
    : 'Use keywords and their variations (different tenses, forms, related terms like "managed" for "led")';

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

  return `You are matching a candidate's experiences against job requirements that were already extracted from a job description.

JOB REQUIREMENTS (extracted in previous stage):
${JSON.stringify(stage1Results.jobRequirements, null, 2)}

KEYWORDS TO EMBED (extracted in previous stage):
${JSON.stringify(stage1Results.allKeywords, null, 2)}

CANDIDATE EXPERIENCES (GROUPED BY ROLE):
${experiencesText}

MATCHING RULES - BE EXTREMELY STRICT BUT FAIR:

1. WHAT COUNTS AS A MATCH:
   ✓ The experience explicitly mentions the skill/tool/technology
   ✓ The experience describes performing the exact responsibility
   ✓ The experience shows clear evidence of the capability
   
   Examples of VALID matches:
   - Requirement: "SQL experience" + Experience: "Wrote SQL queries to analyze customer data" = MATCH
   - Requirement: "Team leadership" + Experience: "Led a team of 5 engineers" = MATCH
   - Requirement: "Python" + Experience: "Developed Python scripts for automation" = MATCH

2. WHAT DOES NOT COUNT AS A MATCH:
   ✗ Generic statements without specifics
   ✗ Assumptions or inferences
   ✗ Tangentially related skills
   
   Examples of INVALID matches:
   - Requirement: "SQL" + Experience: "Analyzed data" = NO MATCH (SQL not mentioned)
   - Requirement: "Team leadership" + Experience: "Worked with team" = NO MATCH (no leadership evidence)
   - Requirement: "Salesforce" + Experience: "CRM experience" = NO MATCH (Salesforce not specified)

3. FOR EACH REQUIREMENT:
   - Check ALL candidate experiences
   - If ANY experience provides explicit evidence → MATCHED
   - Record the specific experience and evidence found
   - If NO experience mentions it → UNMATCHED
   - Be thorough - don't skip requirements

4. SCORING CALCULATION:
   - Score = (Number of Matched Requirements / Total Requirements) × 100
   - Round DOWN to nearest whole number
   - If missing ANY critical requirements, cap score at 65%
   - 40-60% is NORMAL and expected for most candidates
   - 70-79% means strong candidate with minor gaps
   - 80%+ should be RARE - only when nearly all requirements clearly met

CRITICAL: YOU MUST POPULATE BOTH matchedRequirements AND unmatchedRequirements ARRAYS FOR ALL SCORES.
Even if score is low, show which requirements were matched and which were not.

Return JSON in this EXACT format:

FOR SCORES >= 80% (Fit candidates):
{
  "overallScore": 85,
  "isFit": true,
  "fitLevel": "Excellent",
  "matchedRequirements": [
    {
      "jobRequirement": "SQL experience",
      "experienceEvidence": "Wrote complex SQL queries to analyze customer behavior patterns",
      "experienceSource": "TechCorp - Data Analyst: Customer Analysis Project"
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
  "keywordsUsed": ["SQL", "customer retention", "analysis"],
  "keywordsNotUsed": ["Tableau", "certification"]
}

FOR SCORES < 80% (Not fit candidates):
{
  "overallScore": 55,
  "isFit": false,
  "fitLevel": "Fair",
  "matchedRequirements": [
    {
      "jobRequirement": "Data analysis",
      "experienceEvidence": "Analyzed customer data to identify trends and patterns",
      "experienceSource": "StartupCo - Analyst: Market Research"
    },
    {
      "jobRequirement": "Excel proficiency",
      "experienceEvidence": "Created Excel dashboards with pivot tables and vlookups",
      "experienceSource": "StartupCo - Analyst: Financial Reporting"
    }
  ],
  "unmatchedRequirements": [
    {
      "requirement": "SQL experience",
      "importance": "critical"
    },
    {
      "requirement": "Python programming",
      "importance": "high"
    },
    {
      "requirement": "Tableau expertise",
      "importance": "high"
    },
    {
      "requirement": "Machine learning knowledge",
      "importance": "medium"
    }
  ],
  "matchableKeywords": ["data analysis", "Excel", "trends", "patterns"],
  "unmatchableKeywords": ["SQL", "Python", "Tableau", "machine learning"],
  "criticalGaps": ["SQL experience", "Python programming"],
  "recommendations": {
    "forCandidate": [
      "Gain SQL experience through online courses or personal projects",
      "Learn Python basics for data analysis (pandas, numpy)",
      "Consider entry-level positions that don't require Python/SQL",
      "Highlight your strong Excel and analytical skills in applications"
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
8. Track which keywords were embedded and which couldn't fit

REMEMBER: 
- Always provide matchedRequirements array (even if empty for very low scores)
- Always provide unmatchedRequirements array (even if empty for perfect scores)
- Be specific about which experience provides evidence for each match
- For unmatched requirements, include the importance level from the job requirements`;
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
      console.warn('Non-fit candidate missing matchableKeywords array, setting default');
      stage2Results.matchableKeywords = [];
    }
    if (!Array.isArray(stage2Results.unmatchableKeywords)) {
      console.warn('Non-fit candidate missing unmatchableKeywords array, setting default');
      stage2Results.unmatchableKeywords = [];
    }
    if (!Array.isArray(stage2Results.criticalGaps)) {
      console.warn('Non-fit candidate missing criticalGaps array, setting default');
      stage2Results.criticalGaps = [];
    }
    if (!stage2Results.recommendations?.forCandidate) {
      console.warn('Non-fit candidate missing recommendations, setting default');
      stage2Results.recommendations = { forCandidate: [] };
    }
  }

  console.log('Stage 2 response validation passed:', {
    score: stage2Results.overallScore,
    isFit: stage2Results.isFit,
    matchedCount: stage2Results.matchedRequirements.length,
    unmatchedCount: stage2Results.unmatchedRequirements.length
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
        content: 'CRITICAL: Your previous response was incomplete or invalid. You MUST include both matchedRequirements and unmatchedRequirements arrays with proper structure. Even if the score is low, show what was matched (with evidence) and what was not matched (with importance level). Return valid JSON only.'
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
          content: 'You extract requirements and keywords from job descriptions. You never see candidate information. Only extract what is in the job description.'
        },
        {
          role: 'user',
          content: createStage1Prompt(jobDescription.trim())
        }
      ],
      2000
    );

    const stage1Match = stage1Response.match(/\{[\s\S]*\}/);
    if (!stage1Match) {
      throw new AnalysisError('Invalid Stage 1 response format', 'INVALID_RESPONSE', 500);
    }

    const stage1Results = JSON.parse(stage1Match[0]);
    
    console.log('Stage 1 complete:', {
      requirementsExtracted: stage1Results.jobRequirements?.length || 0,
      keywordsExtracted: stage1Results.allKeywords?.length || 0
    });

    // Validate stage 1 - ensure no candidate contamination
    const candidateTerms = formattedExperiences.flatMap(exp => [
      exp.company.toLowerCase(),
      exp.role.toLowerCase(),
      exp.title.toLowerCase()
    ]);
    
    const contaminated = stage1Results.jobRequirements.filter((req: any) =>
      candidateTerms.some(term => req.requirement.toLowerCase().includes(term))
    );
    
    if (contaminated.length > 0) {
      console.warn('WARNING: Detected candidate data contamination in requirements:', contaminated);
    }

    // ===== STAGE 2: Match to experiences and generate bullets =====
    console.log('STAGE 2: Matching requirements to experiences...');
    
    const stage2Results = await callOpenAIWithRetry(
      openaiApiKey,
      [
        {
          role: 'system',
          content: 'You are a strict resume analyzer. Match candidate experiences against pre-extracted job requirements. Be critical and honest. ALWAYS provide both matchedRequirements and unmatchedRequirements arrays, regardless of score. Only high-quality matches should score 80%+.'
        },
        {
          role: 'user',
          content: createStage2Prompt(stage1Results, experiencesByRole, keywordMatchType)
        }
      ],
      8000
    );

    console.log('Stage 2 complete - detailed results:', {
      score: stage2Results.overallScore,
      isFit: stage2Results.isFit,
      fitLevel: stage2Results.fitLevel,
      totalRequirements: stage1Results.jobRequirements.length,
      matchedCount: stage2Results.matchedRequirements?.length || 0,
      unmatchedCount: stage2Results.unmatchedRequirements?.length || 0,
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
