import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Scoring configuration for consistency
const SCORING_CONFIG = {
  WEIGHTS: {
    technical: 0.35,
    soft_skill: 0.20,
    industry: 0.15,
    qualification: 0.15,
    function: 0.15
  },
  IMPORTANCE_MULTIPLIERS: {
    high: 1.0,
    medium: 0.7,
    low: 0.4
  },
  MATCH_TYPE_SCORES: {
    exact: 1.0,
    synonym: 0.8,
    related: 0.6
  },
  EVIDENCE_MULTIPLIERS: {
    strong: 1.0,
    moderate: 0.7,
    weak: 0.4
  },
  THRESHOLD: 85
};


// Helper function to calculate weighted scores
function calculateWeightedScore(matches: any[], jobPhrases: any[]): number {
  let totalPossibleScore = 0;
  let achievedScore = 0;

  // Group phrases by category and importance
  const phrasesByCategory: any = {};
  jobPhrases.forEach((phrase: any) => {
    if (!phrasesByCategory[phrase.category]) {
      phrasesByCategory[phrase.category] = [];
    }
    phrasesByCategory[phrase.category].push(phrase);
  });

  // Calculate scores for each category
  Object.keys(phrasesByCategory).forEach(category => {
    const phrases = phrasesByCategory[category];
    const categoryWeight = SCORING_CONFIG.WEIGHTS[category] || 0.1;
    
    phrases.forEach((phrase: any) => {
      const importanceMultiplier = SCORING_CONFIG.IMPORTANCE_MULTIPLIERS[phrase.importance];
      const maxPhraseScore = categoryWeight * importanceMultiplier * 100;
      totalPossibleScore += maxPhraseScore;

      // Find matching experience for this phrase
      const match = matches.find(m => m.jobPhrase === phrase.phrase);
      if (match) {
        const matchTypeScore = SCORING_CONFIG.MATCH_TYPE_SCORES[match.matchType];
        const evidenceScore = SCORING_CONFIG.EVIDENCE_MULTIPLIERS[match.evidenceStrength];
        achievedScore += maxPhraseScore * matchTypeScore * evidenceScore;
      }
    });
  });

  return Math.round((achievedScore / totalPossibleScore) * 100);
}

// Optimized prompt for cost efficiency while maintaining semantic matching
function createAnalysisPrompt(jobDescription: string, experiences: any[], education: any) {
  return `
Analyze job fit between candidate experience and job requirements. Focus on FUNCTIONAL matches, not just keywords.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE EXPERIENCES:
${JSON.stringify(experiences, null, 2)}

EDUCATION: ${education ? JSON.stringify(education, null, 2) : 'None provided'}

ANALYSIS RULES:
1. Extract job phrases in categories: technical, soft_skill, industry, qualification, function
2. Rate importance: high (must-have), medium (preferred), low (nice-to-have)
3. Find matches using:
   - EXACT: identical terms
   - SYNONYM: equivalent terms (MySQL=SQL, React=frontend framework)
   - RELATED: same function different words (led team=leadership, optimized=performance)
4. Evidence strength: strong (clear examples + results), moderate (some context), weak (minimal)
5. Search ALL experience fields (situation, task, action, result, tags, titles)

CRITICAL: Extract comprehensive keywords for bullet generation including:
- Technical skills, tools, languages, frameworks
- Action verbs and power words from job description
- Industry terminology and domain-specific phrases
- Key responsibilities and job functions
- Qualifications and requirements
- Metrics/measurement terms (performance, efficiency, etc.)
- Company values and culture keywords

SCORING WEIGHTS: Technical 35%, Soft Skills 20%, Industry 15%, Qualifications 15%, Functions 15%

Return JSON only:
{
  "extractedJobPhrases": [{"phrase": "text", "category": "technical|soft_skill|industry|qualification|function", "importance": "high|medium|low"}],
  "bulletKeywords": {
    "technical": ["Python", "AWS", "microservices", "REST APIs"],
    "actionVerbs": ["developed", "implemented", "optimized", "led", "collaborated"],
    "industry": ["fintech", "compliance", "data privacy", "scalability"],
    "metrics": ["performance", "efficiency", "ROI", "uptime", "response time"],
    "responsibilities": ["code review", "mentoring", "architecture design", "deployment"],
    "qualifications": ["Bachelor's degree", "5+ years experience", "Agile methodology"],
    "culture": ["innovation", "teamwork", "continuous learning", "customer-focused"]
  },
  "matchedPhrases": [{"jobPhrase": "text", "experienceMatch": "text", "experienceContext": "field", "matchType": "exact|synonym|related", "evidenceStrength": "strong|moderate|weak"}],
  "unmatchedPhrases": [{"phrase": "text", "category": "category", "importance": "level"}],
  "relevantExperiences": [{"id": "id", "roleTitle": "title", "companyName": "company", "title": "exp_title", "situation": "sit", "task": "task", "action": "action", "result": "result", "tags": ["tags"], "relevanceScore": 85, "matchingPhrases": ["phrases"]}],
  "overallScore": 75,
  "fitLevel": "Good",
  "strengths": ["strengths"],
  "gaps": ["gaps"],
  "recommendations": ["recommendations"],
  "summary": "brief summary"
}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!geminiApiKey || !supabaseUrl || !supabaseServiceKey) {
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

    // Fetch data with better error handling
    const [experiencesResult, profileResult] = await Promise.allSettled([
      supabase
        .from('experiences')
        .select(`
          *,
          roles!inner(
            title,
            companies!inner(name)
          )
        `)
        .eq('user_id', user.id),
      supabase
        .from('profiles')
        .select('school, degree, graduation_date')
        .eq('user_id', user.id)
        .single()
    ]);

    if (experiencesResult.status === 'rejected' || experiencesResult.value.error) {
      throw new Error('Failed to fetch experiences: ' + 
        (experiencesResult.value?.error?.message || experiencesResult.reason));
    }

    const experiences = experiencesResult.value.data;
    if (!experiences || experiences.length === 0) {
      throw new Error('No experiences found. Please add at least one experience before analyzing job fit.');
    }

    const profile = profileResult.status === 'fulfilled' && !profileResult.value.error 
      ? profileResult.value.data 
      : null;

    // Format data
    const formattedExperiences = experiences.map(exp => ({
      id: exp.id,
      company: exp.roles.companies.name,
      role: exp.roles.title,
      title: exp.title,
      situation: exp.situation,
      task: exp.task,
      action: exp.action,
      result: exp.result,
      tags: exp.tags || []
    }));

    const formattedEducation = profile ? {
      school: profile.school,
      degree: profile.degree,
      graduationDate: profile.graduation_date
    } : null;

    // Create enhanced prompt
    const prompt = createAnalysisPrompt(jobDescription, formattedExperiences, formattedEducation);

    // Call Gemini API with retry logic
    let geminiResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }],
              generationConfig: {
                temperature: 0.1, // Lower for more consistency
                topK: 20,         // Lower for more focused responses
                topP: 0.8,        // Lower for more consistency
                maxOutputTokens: 3072, // Increased for detailed analysis
              }
            }),
          }
        );
        
        if (geminiResponse.ok) break;
        
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    if (!geminiResponse?.ok) {
      throw new Error('Failed to get response from Gemini API');
    }

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response structure from Gemini API');
    }

    const responseText = geminiData.candidates[0].content.parts[0].text;
    
    // Enhanced JSON parsing
    let analysis: any;
    try {
      // Try to find JSON block
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      analysis = JSON.parse(jsonMatch[0]);
      
      // Validate required fields including bulletKeywords
      const requiredFields = ['extractedJobPhrases', 'bulletKeywords', 'matchedPhrases', 'unmatchedPhrases', 
                             'relevantExperiences', 'overallScore', 'fitLevel'];
      
      for (const field of requiredFields) {
        if (!(field in analysis)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Recalculate score for consistency
      if (analysis.extractedJobPhrases && analysis.matchedPhrases) {
        const recalculatedScore = calculateWeightedScore(
          analysis.matchedPhrases, 
          analysis.extractedJobPhrases
        );
        
        // Use recalculated score if significantly different
        if (Math.abs(recalculatedScore - analysis.overallScore) > 5) {
          console.log(`Score adjustment: ${analysis.overallScore} → ${recalculatedScore}`);
          analysis.overallScore = recalculatedScore;
        }
      }

      // Update fit level based on score
      if (analysis.overallScore >= 90) analysis.fitLevel = "Excellent";
      else if (analysis.overallScore >= 75) analysis.fitLevel = "Good"; 
      else if (analysis.overallScore >= 60) analysis.fitLevel = "Fair";
      else analysis.fitLevel = "Poor";

      // Group experiences by role and get top 6 per role
      if (analysis.relevantExperiences) {
        // Group by role (company + role title combination) 
        const experienceIdsByRole = {};
        
        analysis.relevantExperiences.forEach(exp => {
          const roleKey = `${exp.companyName}-${exp.roleTitle}`;
          
          if (!experienceIdsByRole[roleKey]) {
            experienceIdsByRole[roleKey] = {
              company: exp.companyName,
              roleTitle: exp.roleTitle,
              experienceIds: []
            };
          }
          
          experienceIdsByRole[roleKey].experienceIds.push(exp.id);
        });
        
        // Sort and limit to top 6 experience IDs per role
        Object.keys(experienceIdsByRole).forEach(roleKey => {
          const roleExperiences = analysis.relevantExperiences
            .filter(exp => {
              const expRoleKey = `${exp.companyName}-${exp.roleTitle}`;
              return expRoleKey === roleKey;
            })
            .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
            .slice(0, 6);
          
          experienceIdsByRole[roleKey].experienceIds = roleExperiences.map(exp => exp.id);
        });
        
        // CRITICAL: Add experienceIdsByRole for generate-resume-bullets
        analysis.experienceIdsByRole = experienceIdsByRole;
        
        // Keep experiencesByRole for analytics/debugging (ANALYTICS ONLY)
        const experiencesByRole = {};
        Object.entries(experienceIdsByRole).forEach(([roleKey, roleData]: [string, any]) => {
          const roleExperiences = analysis.relevantExperiences
            .filter(exp => roleData.experienceIds.includes(exp.id));
          
          experiencesByRole[roleKey] = {
            company: roleData.company,
            roleTitle: roleData.roleTitle,
            experiences: roleExperiences
          };
        });
        analysis.experiencesByRole = experiencesByRole; // ANALYTICS ONLY
      }

      // Enhanced recommendations based on score
      if (analysis.overallScore < SCORING_CONFIG.THRESHOLD) {
        // Focus on improvement areas
        const highImportanceGaps = analysis.unmatchedPhrases?.filter(p => p.importance === 'high') || [];
        
        if (highImportanceGaps.length > 0) {
          analysis.recommendations = analysis.recommendations || [];
          analysis.recommendations.unshift(
            `Critical gaps identified: ${highImportanceGaps.map(g => g.phrase).join(', ')}. Consider gaining experience in these areas through projects, certifications, or targeted learning.`
          );
        }
        
        analysis.actionPlan = {
          priority: "skill_development",
          suggestedActions: [
            "Identify specific courses or certifications for missing technical skills",
            "Seek projects or volunteer opportunities to gain relevant experience", 
            "Update existing experiences to better highlight transferable skills",
            "Consider informational interviews with professionals in the target role"
          ]
        };
      } else {
        // High score - prepare for bullet generation
        analysis.actionPlan = {
          priority: "bullet_generation",
          experienceIds: analysis.relevantExperiences.map(exp => exp.id),
          readyForBulletGeneration: true
        };
      }

    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Response text:', responseText);
      throw new Error('Failed to parse analysis results: ' + parseError.message);
    }

    console.log(`Job fit analysis completed: ${analysis.overallScore}% match (${analysis.fitLevel})`);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-job-fit function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
