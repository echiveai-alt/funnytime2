import { callOpenAIWithRetry } from '../utils/openai-client.ts';
import { buildStage2aPrompt, getStage2aSystemMessage } from '../prompts/stage2a-matching-prompt.ts';
import { validateStage2aMatchingResponse } from '../validation/response-validator.ts';  // ← Changed!
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
} from '../types/index.ts';
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

  // ← Changed validator function!
  const stage2aResults = await callOpenAIWithRetry(
    apiKey,
    messages,
    AI_CONFIG.STAGE2A_MAX_TOKENS,
    { userId, stage: 'stage2a' },
    validateStage2aMatchingResponse,  // ← Now uses the Stage 2a-specific validator
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

  // ===== CALCULATE WEIGHTED SCORE =====
  
  const totalRequirements = stage1Results.jobRequirements.length;
  const matchedCount = stage2aResults.matchedRequirements.length;
  
  // Calculate importance-weighted score
  let totalImportancePoints = 0;
  let earnedImportancePoints = 0;
  
  const importanceWeights: Record<ImportanceLevel, number> = {
    'critical': 3,
    'high': 2,
    'medium': 1,
    'low': 0.5
  };
  
  // Calculate total possible points
  stage1Results.jobRequirements.forEach(req => {
    totalImportancePoints += importanceWeights[req.importance];
  });
  
  // Calculate earned points from matches
  stage2aResults.matchedRequirements.forEach(match => {
    const originalReq = stage1Results.jobRequirements.find(
      r => r.requirement === match.jobRequirement
    );
    if (originalReq) {
      earnedImportancePoints += importanceWeights[originalReq.importance];
    }
  });
  
  const weightedScore = totalImportancePoints > 0 
    ? Math.round((earnedImportancePoints / totalImportancePoints) * 100)
    : 0;

  logger.info('Weighted score calculation', {
    userId,
    totalRequirements,
    matchedCount,
    totalImportancePoints,
    earnedImportancePoints,
    weightedScore
  });

  // Update the score and fit status
  stage2aResults.overallScore = weightedScore;
  stage2aResults.isFit = weightedScore >= CONSTANTS.FIT_THRESHOLD;
  
  // Set fit level based on score
  if (weightedScore >= 90) {
    stage2aResults.fitLevel = 'Excellent';
  } else if (weightedScore >= CONSTANTS.FIT_THRESHOLD) {
    stage2aResults.fitLevel = 'Good';
  } else if (weightedScore >= 60) {
    stage2aResults.fitLevel = 'Fair';
  } else {
    stage2aResults.fitLevel = 'Poor';
  }

  logger.info('Stage 2a complete', {
    userId,
    score: stage2aResults.overallScore,
    isFit: stage2aResults.isFit,
    matchedCount: stage2aResults.matchedRequirements.length,
    unmatchedCount: stage2aResults.unmatchedRequirements.length
  });

  return stage2aResults;
}
