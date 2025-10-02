import { callOpenAIWithRetry } from '../utils/openai-client.ts';
import { buildStage2aPrompt, getStage2aSystemMessage } from '../prompts/stage2a-matching-prompt.ts';
import { validateStage2Response } from '../validation/response-validator.ts';
import { STAGE2A_MATCHING_SCHEMA } from '../types/json-schemas.ts';
import { 
  Stage1Results, 
  Stage2Results, 
  ExperienceWithRole, 
  Education, 
  RoleWithDuration,
  MatchedRequirement,
  UnmatchedRequirement,
  ImportanceLevel
} from '../types.ts';
import { AI_CONFIG, CONSTANTS } from '../constants.ts';
import { Logger } from '../utils/logger.ts';
import { 
  meetsEducationRequirement, 
  getLowestDegreeRequirement 
} from '../matching/education-matcher.ts';

const logger = new Logger();

export async function matchCandidateToJob(
  apiKey: string,
  stage1Results: Stage1Results,
  experiencesByRole: Record<string, ExperienceWithRole[]>,
  educationInfo: Education[],
  userRoles: RoleWithDuration[],
  userId: string
): Promise<Omit<Stage2Results, 'bulletPoints' | 'keywordsUsed' | 'keywordsNotUsed'>> {
  logger.info('Starting Stage 2a: Candidate matching (no bullets)', {
    userId,
    totalRequirements: stage1Results.jobRequirements.length
  });

  // Pre-process education degree requirements
  const preMatchedRequirements: MatchedRequirement[] = [];
  const educationDegreeReqs = stage1Results.jobRequirements.filter(
    req => req.category === 'education_degree'
  );

  if (educationDegreeReqs.length > 0 && educationInfo.length > 0) {
    const lowestRequiredDegree = getLowestDegreeRequirement(stage1Results.jobRequirements);
    
    if (lowestRequiredDegree) {
      const educationCheck = meetsEducationRequirement(educationInfo, lowestRequiredDegree);
      
      if (educationCheck.meets) {
        educationDegreeReqs.forEach(req => {
          preMatchedRequirements.push({
            jobRequirement: req.requirement,
            experienceEvidence: educationCheck.evidence,
            experienceSource: educationCheck.source
          });
        });
        
        logger.info('Education degree requirements pre-matched', {
          userId,
          required: lowestRequiredDegree,
          userHas: educationCheck.evidence,
          matchedCount: educationDegreeReqs.length
        });
      }
    }
  }

  // Filter out education_degree from requirements sent to AI
  const requirementsForAI = stage1Results.jobRequirements.filter(
    req => req.category !== 'education_degree'
  );

  const stage1ResultsForAI = {
    ...stage1Results,
    jobRequirements: requirementsForAI
  };

  logger.info('Requirements distribution', {
    userId,
    total: stage1Results.jobRequirements.length,
    preMatched: preMatchedRequirements.length,
    sentToAI: requirementsForAI.length
  });

  // Call AI for matching with JSON schema
  const messages = [
    {
      role: 'system' as const,
      content: getStage2aSystemMessage()
    },
    {
      role: 'user' as const,
      content: buildStage2aPrompt(
        stage1ResultsForAI,
        experiencesByRole,
        educationInfo,
        userRoles
      )
    }
  ];

  const stage2aResults = await callOpenAIWithRetry(
    apiKey,
    messages,
    AI_CONFIG.STAGE2A_MAX_TOKENS,
    { userId, stage: 'stage2a' },
    validateStage2Response,
    STAGE2A_MATCHING_SCHEMA,
    AI_CONFIG.TEMPERATURE_MATCHING
  );

  // Log the AI's calculations for debugging
  logger.info('Stage 2a AI calculations', {
    userId,
    experienceRequirements: stage2aResults.matchedRequirements
      .filter(m => m.experienceSource.includes('mo'))
      .map(m => ({
        requirement: m.jobRequirement.substring(0, 50),
        calculation: m.experienceSource
      }))
  });

  // Merge pre-matched education requirements
  stage2aResults.matchedRequirements = [
    ...preMatchedRequirements,
    ...(stage2aResults.matchedRequirements || [])
  ];

  // ===== WEIGHTED SCORING CALCULATION =====
  const allRequirements = stage1Results.jobRequirements;
  
  const matchedSet = new Set(
    stage2aResults.matchedRequirements.map(m => m.jobRequirement.toLowerCase().trim())
  );
  
  const IMPORTANCE_WEIGHTS: Record<ImportanceLevel, number> = {
    absolute: 1.0,
    critical: 1.0,
    high: 1.0,
    medium: 0.75,
    low: 0.5
  };
  
  let totalWeight = 0;
  let matchedWeight = 0;
  
  allRequirements.forEach(req => {
    const weight = IMPORTANCE_WEIGHTS[req.importance] || 1.0;
    totalWeight += weight;
    
    const isMatched = matchedSet.has(req.requirement.toLowerCase().trim());
    if (isMatched) {
      matchedWeight += weight;
    }
  });
  
  const weightedScore = totalWeight > 0 
    ? Math.round((matchedWeight / totalWeight) * 100)
    : 0;

  logger.info('Weighted score calculation', {
    userId,
    totalWeight: totalWeight.toFixed(2),
    matchedWeight: matchedWeight.toFixed(2),
    rawPercentage: totalWeight > 0 ? ((matchedWeight / totalWeight) * 100).toFixed(2) : '0',
    weightedScore
  });

  const absoluteUnmatched = (stage2aResults.unmatchedRequirements || [])
    .filter((req: UnmatchedRequirement) => req.importance === 'absolute');
  
  const criticalUnmatched = (stage2aResults.unmatchedRequirements || [])
    .filter((req: UnmatchedRequirement) => req.importance === 'critical');

  if (absoluteUnmatched.length > 0) {
    stage2aResults.overallScore = Math.min(weightedScore, 79);
    stage2aResults.absoluteGaps = absoluteUnmatched.map((req: UnmatchedRequirement) => req.requirement);
    stage2aResults.absoluteGapExplanation = 
      `Cannot proceed: Missing absolute requirements (${absoluteUnmatched.map((r: UnmatchedRequirement) => r.requirement).join(', ')}).`;
    
    logger.warn('Score capped at 79% due to missing absolute requirements', {
      userId,
      weightedScore,
      cappedScore: stage2aResults.overallScore,
      absoluteGapsCount: absoluteUnmatched.length
    });
  } else {
    stage2aResults.overallScore = weightedScore;
    
    if (criticalUnmatched.length > 0) {
      stage2aResults.criticalGaps = criticalUnmatched.map((req: UnmatchedRequirement) => req.requirement);
    }
  }

  stage2aResults.isFit = stage2aResults.overallScore >= CONSTANTS.FIT_THRESHOLD;

  logger.info('Stage 2a complete', {
    userId,
    score: stage2aResults.overallScore,
    isFit: stage2aResults.isFit,
    matchedCount: stage2aResults.matchedRequirements.length,
    unmatchedCount: stage2aResults.unmatchedRequirements.length
  });

  return stage2aResults;
}
