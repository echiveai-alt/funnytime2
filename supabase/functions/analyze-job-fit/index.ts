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

function createUnifiedPrompt(
  jobDescription: string, 
  experiencesByRole: Record<string, any[]>, 
  keywordMatchType: string
): string {
  const keywordInstruction = keywordMatchType === 'exact' 
    ? 'Use keywords EXACTLY as they appear in the job description'
    : 'Use keywords and their variations (different tenses, forms, related terms like "managed" for "led", "collaborated" for "worked with")';

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

  return `You are a professional resume analyzer and writer. Analyze if the candidate matches the job, and if they score 80% or higher, generate optimized resume bullets.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE EXPERIENCES (GROUPED BY ROLE):
${experiencesText}

SCORING METHODOLOGY - BE EXTREMELY STRICT:
1. Extract ALL meaningful requirements from the job description:
   - Break down compound requirements into separate items
   - Example: "experience with Salesforce and HubSpot" = 2 separate requirements
   - Example: "3+ years in product management" = 2 requirements: "product management experience" AND "3+ years duration"
   - Each technical tool/platform = separate requirement
   - Each certification or degree = separate requirement
   - Each specific responsibility or achievement mentioned = separate requirement
   
2. For EACH requirement, apply STRICT matching rules:
   - EXACT MATCH ONLY: If job says "Salesforce", candidate needs "Salesforce" (not just "CRM experience")
   - EXACT MATCH ONLY: If job says "5+ years", candidate needs evidence of 5+ years (not "several years")
   - NO ASSUMPTIONS: If experience doesn't explicitly mention a requirement, it's NOT matched
   - NO GENEROUS INTERPRETATION: "Analyzed data" ≠ "SQL experience" unless SQL is mentioned
   - NO PARTIAL CREDIT: Either the requirement is met with clear evidence, or it's not matched
   
3. Calculate: (exactly matched requirements / total requirements) × 100
   - Round DOWN, not up
   - A score of 40-60% is NORMAL and EXPECTED for most candidates
   - Scores of 70-79% indicate a strong candidate with minor gaps
   - Scores of 80%+ should be RARE - only for candidates who clearly meet or exceed nearly all requirements
   - Scores of 90%+ should be EXCEPTIONAL - candidate is overqualified
   
4. CRITICAL REQUIREMENTS: If missing ANY must-have/required items explicitly marked in job description, cap score at 65% maximum

5. VERIFICATION CHECKLIST before finalizing score:
   - Did I extract every distinct requirement from the job description?
   - Did I verify each matched requirement has EXPLICIT evidence in experiences (not inferred)?
   - Would a hiring manager reviewing these experiences agree the candidate meets this requirement?
   - Am I being strict enough, or am I being generous to avoid disappointing the candidate?
   - If the candidate scored 80%+, do they truly meet almost all requirements with clear evidence?

REMEMBER: Your job is ACCURACY, not kindness. A 50% score means the candidate meets half the requirements - that's valuable, honest feedback. Don't inflate scores.

KEYWORD EXTRACTION:
- Extract a comprehensive list of ALL keywords from the job description (no categorization needed)
- Keywords include: skills, tools, technologies, methodologies, qualifications, action verbs, domain terms
- For scores < 80%: divide keywords into "matchable" (found in experiences) and "unmatchable" (not found)

BULLET GENERATION (ONLY IF SCORE >= 80%):
CRITICAL RULES - READ CAREFULLY:
1. YOU MUST create SEPARATE entries for EACH unique "Company Name - Role Title" combination shown above
2. For each role, generate bullets ONLY from experiences that belong to that specific role
3. YOU MUST generate EXACTLY ONE bullet for EVERY SINGLE experience listed for that role
4. ABSOLUTELY NO SKIPPING: If Role A has 7 experiences, you MUST create 7 bullets. If Role B has 3 experiences, you MUST create 3 bullets.
5. Each bullet MUST use the experienceId from the specific experience it's based on
6. COUNT YOUR BULLETS: Verify you've created the exact number shown above for each role

EXAMPLE - If you see:
=== Company X - Role Y ===
Number of experiences for this role: 5
  Experience 1: ID: abc-123 ...
  Experience 2: ID: def-456 ...
  Experience 3: ID: ghi-789 ...
  Experience 4: ID: jkl-012 ...
  Experience 5: ID: mno-345 ...

YOU MUST OUTPUT:
"Company X - Role Y": [
  {"text": "...", "experienceId": "abc-123", ...},
  {"text": "...", "experienceId": "def-456", ...},
  {"text": "...", "experienceId": "ghi-789", ...},
  {"text": "...", "experienceId": "jkl-012", ...},
  {"text": "...", "experienceId": "mno-345", ...}
]

FORMATTING:
- Order bullets from most relevant to least relevant based on job description alignment
- Use one of these structures:
  * "Result (with numbers if available) + Action verb + context"
  * "Action verb + context + quantified result"
  * "Result (with numbers if available) + Action verb"
- Target visual width: ${CONSTANTS.VISUAL_WIDTH_TARGET} characters (acceptable range: ${CONSTANTS.VISUAL_WIDTH_MIN}-${CONSTANTS.VISUAL_WIDTH_MAX})
- IMPORTANT: Generate bullets even if they fall outside the target range - we will display them with warnings
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
        "text": "bullet point text",
        "experienceId": "exp_id_from_that_role",
        "keywordsUsed": ["keywords in this bullet"],
        "relevanceScore": 10
      }
    ],
    "Another Company - Another Role": [
      {
        "text": "another bullet",
        "experienceId": "exp_id_from_this_other_role",
        "keywordsUsed": ["keywords"],
        "relevanceScore": 9
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

    // Format experiences with explicit role grouping
    const formattedExperiences = experiences.map(exp => ({
      id: exp.id,
      company: exp.roles.companies.name,
      role: exp.roles.title,
      roleKey: `${exp.roles.companies.name} - ${exp.roles.title}`, // Add explicit role key
      title: exp.title,
      action: exp.action,
      result: exp.result,
      situation: exp.situation,
      task: exp.task
    }));

    // Group experiences by role for the prompt
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
        messages: [
          {
            role: 'system',
            content: 'You are a strict, objective resume analyzer. Your job is to provide ACCURATE fit scores, not to make candidates feel good. Be critical and honest. A 50% match is normal. Only exceptional candidates should score above 80%.'
          },
          { 
            role: 'user', 
            content: createUnifiedPrompt(jobDescription.trim(), experiencesByRole, keywordMatchType)
          }
        ],
        max_tokens: 8000,
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
      const allKeywordsInBullets = new Set<string>();
      const keywordMatchType = req.headers.get('x-keyword-match-type') || 'exact';
      
      // Helper function to check if keyword is actually in text
      const isKeywordInText = (text: string, keyword: string, matchType: string): boolean => {
        const lowerText = text.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        
        if (matchType === 'exact') {
          // Exact phrase match with word boundaries
          const regex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\      // Helper function to check if keyword is actually in text
      const isKeywordInText = (text: string, keyword: string, matchType: string): boolean => {
        const lowerText = text.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        
        if (matchType === 'exact') {
          // Exact phrase match
          return lowerText.includes(lowerKeyword);
        } else {
          // Word-stem: check if root words are present
          const keywordWords = lowerKeyword.split(/\s+/);
          return keywordWords.every(word => {
            // Remove common suffixes for stem matching
            const stem = word.replace(/(ing|ed|s|es|tion|ment|ly)$/i, '');
            return lowerText.includes(stem) || lowerText.includes(word);
          });
        }
      };')}\\b`, 'i');
          return regex.test(text);
        } else {
          // Word-stem: ALL words in the keyword must have stems present in text
          const keywordWords = lowerKeyword.split(/\s+/).filter(w => w.length > 0);
          
          // Skip very short keywords that would match everywhere
          if (keywordWords.length === 1 && keywordWords[0].length <= 2) {
            return false;
          }
          
          return keywordWords.every(word => {
            // For short words (<=3 chars), require exact match
            if (word.length <= 3) {
              const regex = new RegExp(`\\b${word}\\b`, 'i');
              return regex.test(lowerText);
            }
            
            // For longer words, check stem (remove common suffixes)
            const stem = word.replace(/(ing|ed|s|es|tion|ment|ly|ize|ise|ization|isation)$/i, '');
            
            // Stem must be at least 3 characters to avoid false positives
            if (stem.length < 3) {
              return lowerText.includes(word);
            }
            
            // Check if stem appears as part of a word
            const stemRegex = new RegExp(`\\b\\w*${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\      // Helper function to check if keyword is actually in text
      const isKeywordInText = (text: string, keyword: string, matchType: string): boolean => {
        const lowerText = text.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        
        if (matchType === 'exact') {
          // Exact phrase match
          return lowerText.includes(lowerKeyword);
        } else {
          // Word-stem: check if root words are present
          const keywordWords = lowerKeyword.split(/\s+/);
          return keywordWords.every(word => {
            // Remove common suffixes for stem matching
            const stem = word.replace(/(ing|ed|s|es|tion|ment|ly)$/i, '');
            return lowerText.includes(stem) || lowerText.includes(word);
          });
        }
      };')}\\w*\\b`, 'i');
            return stemRegex.test(text);
          });
        }
      };
      
      Object.entries(analysis.bulletPoints).forEach(([roleKey, bullets]: [string, any]) => {
        // Sort by relevanceScore (highest first) if provided
        const sortedBullets = bullets.sort((a: any, b: any) => 
          (b.relevanceScore || 0) - (a.relevanceScore || 0)
        );

        processedBullets[roleKey] = sortedBullets.map((bullet: any) => {
          const visualWidth = calculateVisualWidth(bullet.text);
          const isWithinRange = visualWidth >= CONSTANTS.VISUAL_WIDTH_MIN && 
                                visualWidth <= CONSTANTS.VISUAL_WIDTH_MAX;
          
          // Validate keywords are actually in the bullet text
          const claimedKeywords = bullet.keywordsUsed || [];
          const verifiedKeywords = claimedKeywords.filter((kw: string) => 
            isKeywordInText(bullet.text, kw, keywordMatchType)
          );
          
          // Collect verified keywords
          verifiedKeywords.forEach((kw: string) => allKeywordsInBullets.add(kw));
          
          // Log discrepancies
          if (claimedKeywords.length !== verifiedKeywords.length) {
            const unverified = claimedKeywords.filter((kw: string) => !verifiedKeywords.includes(kw));
            console.log(`Bullet keyword mismatch: AI claimed ${claimedKeywords.length}, verified ${verifiedKeywords.length}`, {
              bulletStart: bullet.text.substring(0, 50),
              unverifiedKeywords: unverified
            });
          }
          
          return {
            text: bullet.text,
            visualWidth: Math.round(visualWidth),
            exceedsMax: visualWidth > CONSTANTS.VISUAL_WIDTH_MAX,
            belowMin: visualWidth < CONSTANTS.VISUAL_WIDTH_MIN,
            isWithinRange: isWithinRange,
            experienceId: bullet.experienceId,
            keywordsUsed: verifiedKeywords, // Use verified keywords only
            keywordsClaimed: claimedKeywords.length,
            keywordsVerified: verifiedKeywords.length,
            relevanceScore: bullet.relevanceScore || 0
          };
        });
      });

      // Override the AI's keywordsUsed with actual verified keywords found in bullets
      const actualKeywordsUsed = Array.from(allKeywordsInBullets);
      const allKeywords = analysis.allKeywords || [];
      const actualKeywordsNotUsed = allKeywords.filter((kw: string) => !allKeywordsInBullets.has(kw));

      console.log('Keyword validation:', {
        totalKeywords: allKeywords.length,
        aiReportedUsed: analysis.keywordsUsed?.length || 0,
        actualVerifiedUsed: actualKeywordsUsed.length,
        aiReportedNotUsed: analysis.keywordsNotUsed?.length || 0,
        actualNotUsed: actualKeywordsNotUsed.length
      });

      analysis.bulletPoints = processedBullets;
      analysis.keywordsUsed = actualKeywordsUsed;
      analysis.keywordsNotUsed = actualKeywordsNotUsed;

      // Format for frontend compatibility - group by company, then roles
      const companyRoleMap: Record<string, any[]> = {};
      
      Object.entries(processedBullets).forEach(([roleKey, bullets]: [string, any]) => {
        // Split on ' - ' to get company and role
        const dashIndex = roleKey.indexOf(' - ');
        if (dashIndex === -1) {
          console.error(`Invalid roleKey format: ${roleKey}`);
          return;
        }
        
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

      console.log('Company-Role mapping:', Object.keys(companyRoleMap).map(company => ({
        company,
        roleCount: companyRoleMap[company].length,
        roles: companyRoleMap[company].map(r => r.title)
      })));

      const bulletOrganization = Object.entries(companyRoleMap).map(([company, roles]) => ({
        name: company,
        roles: roles
      }));

      analysis.resumeBullets = {
        bulletOrganization,
        keywordsUsed: analysis.keywordsUsed || [],
        keywordsNotUsed: analysis.keywordsNotUsed || [],
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
