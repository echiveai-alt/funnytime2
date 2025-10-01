import { callOpenAIWithRetry } from '../utils/openai-client.ts';
import { buildStage2Prompt, getStage2SystemMessage } from '../prompts/stage2-prompt.ts';
import { validateStage2Response } from '../validation/response-validator.ts';
import { 
  Stage1Results, 
  Stage2Results, 
  ExperienceWithRole, 
  Education, 
  RoleWithDuration,
  MatchedRequirement,
  UnmatchedRequirement 
} from '../types.ts';
import { AI_CONFIG, CONSTANTS } from '../constants.ts';
import { Logger } from '../utils/logger.ts';
import { 
  meetsEducationRequirement, 
  getLowestDegreeRequirement 
} from '../matching/education-matcher.ts';
import { calculateVisualWidth } from '../utils/visual-width.ts';
import { verifyKeywordsInBullets } from '../matching/keyword-validator.ts';

const logger = new Logger();

export async function matchCandidateToJob(
  apiKey: string,
  stage1Results: Stage1Results,
  experiencesByRole: Record<string, ExperienceWithRole[]>,
  educationInfo: Education[],
  userRoles: RoleWithDuration[],
  keywordMatchType: 'exact' | 'flexible',
  userId: string
): Promise<Stage2Results> {
  logger.info('Starting Stage 2: Candidate matching', {
    userId,
    totalRequirements: stage1Results.jobRequirements.length,
    keywordMatchType
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
      } else {
        logger.info('Education degree requirements NOT met', {
          userId,
          required: lowestRequiredDegree,
          userHas: educationCheck.evidence
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

  // Log what AI will receive for debugging
  logger.debug('Stage 2 AI Input Summary', {
    userId,
    rolesProvided: Object.keys(experiencesByRole),
    roleSpecialties: userRoles.map(r => ({ 
      title: r.title, 
      specialty: r.specialty, 
      months: r.durationMonths,
      years: r.durationYears
    })),
    totalExperiences: Object.values(experiencesByRole).reduce((sum, arr) => sum + arr.length, 0)
  });

  // Call AI for matching
  const messages = [
    {
      role: 'system' as const,
      content: getStage2SystemMessage()
    },
    {
      role: 'user' as const,
      content: buildStage2Prompt(
        stage1ResultsForAI,
        experiencesByRole,
        educationInfo,
        userRoles,
        keywordMatchType
      )
    }
  ];

  const stage2Results = await callOpenAIWithRetry(
    apiKey,
    messages,
    AI_CONFIG.STAGE2_MAX_TOKENS,
    { userId, stage: 'stage2' },
    validateStage2Response
  );

  // Merge pre-matched education requirements
  stage2Results.matchedRequirements = [
    ...preMatchedRequirements,
    ...(stage2Results.matchedRequirements || [])
  ];

  // Recalculate score
  const totalRequirements = stage1Results.jobRequirements.length;
  const totalMatched = stage2Results.matchedRequirements.length;
  const recalculatedScore = Math.floor((totalMatched / totalRequirements) * 100);

  // Check for absolute gaps
  const absoluteUnmatched = (stage2Results.unmatchedRequirements || [])
    .filter((req: UnmatchedRequirement) => req.importance === 'absolute');
  
  // Check for critical gaps (for logging/reporting only - no score cap)
  const criticalUnmatched = (stage2Results.unmatchedRequirements || [])
    .filter((req: UnmatchedRequirement) => req.importance === 'critical');

  // Apply scoring logic - ONLY absolute requirements cap score
  if (absoluteUnmatched.length > 0) {
    stage2Results.overallScore = Math.min(recalculatedScore, 79);
    stage2Results.absoluteGaps = absoluteUnmatched.map((req: UnmatchedRequirement) => req.requirement);
    stage2Results.absoluteGapExplanation = 
      `Cannot proceed: Missing absolute requirements (${absoluteUnmatched.map((r: UnmatchedRequirement) => r.requirement).join(', ')}). These are explicitly required by the employer and non-negotiable.`;
    
    logger.warn('Score capped at 79% due to missing absolute requirements', {
      userId,
      absoluteGapsCount: absoluteUnmatched.length,
      absoluteGaps: stage2Results.absoluteGaps
    });
  } else {
    // No caps - use calculated score
    stage2Results.overallScore = recalculatedScore;
    
    if (criticalUnmatched.length > 0) {
      stage2Results.criticalGaps = criticalUnmatched.map((req: UnmatchedRequirement) => req.requirement);
      logger.info('Critical gaps identified (no score cap applied)', {
        userId,
        criticalGapsCount: criticalUnmatched.length,
        score: recalculatedScore
      });
    }
  }

  // Update fit status
  stage2Results.isFit = stage2Results.overallScore >= CONSTANTS.FIT_THRESHOLD;

  // Process bullets if fit
  if (stage2Results.isFit && stage2Results.bulletPoints) {
    const { verifiedBullets, actualKeywordsUsed, actualKeywordsNotUsed } = 
      verifyKeywordsInBullets(
        stage2Results.bulletPoints,
        stage1Results.allKeywords,
        keywordMatchType
      );

    // Add visual width calculations
    const processedBullets: Record<string, any[]> = {};
    Object.entries(verifiedBullets).forEach(([roleKey, bullets]) => {
      processedBullets[roleKey] = bullets.map((bullet: any) => {
        const width = calculateVisualWidth(bullet.text);
        return {
          ...bullet,
          visualWidth: Math.round(width),
          exceedsMax: width > CONSTANTS.VISUAL_WIDTH_MAX,
          belowMin: width < CONSTANTS.VISUAL_WIDTH_MIN,
          isWithinRange: width >= CONSTANTS.VISUAL_WIDTH_MIN && width <= CONSTANTS.VISUAL_WIDTH_MAX
        };
      });
    });

    stage2Results.bulletPoints = processedBullets;
    stage2Results.keywordsUsed = actualKeywordsUsed;
    stage2Results.keywordsNotUsed = actualKeywordsNotUsed;

    logger.info('Bullet processing complete', {
      userId,
      totalBullets: Object.values(processedBullets).reduce((sum, arr) => sum + arr.length, 0),
      keywordsUsed: actualKeywordsUsed.length,
      keywordsNotUsed: actualKeywordsNotUsed.length
    });
  }

  logger.info('Stage 2 complete', {
    userId,
    score: stage2Results.overallScore,
    isFit: stage2Results.isFit,
    matchedCount: stage2Results.matchedRequirements.length,
    unmatchedCount: stage2Results.unmatchedRequirements.length,
    hasAbsoluteGaps: (stage2Results.absoluteGaps?.length || 0) > 0,
    hasCriticalGaps: (stage2Results.criticalGaps?.length || 0) > 0
  });

  return stage2Results;
}
