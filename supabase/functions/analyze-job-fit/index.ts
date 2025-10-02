import { extractJobRequirements } from './stages/stage1-extraction.ts';
import { matchCandidateToJob } from './stages/stage2a-matching.ts';
import { generateBullets } from './stages/stage2b-bullets.ts';
import { Stage2Results, UnifiedAnalysisResult, ExperienceWithRole, Education, RoleWithDuration } from './types/index.ts';
import { Logger } from './utils/logger.ts';
import { CONSTANTS } from './constants.ts';

const logger = new Logger();

export async function analyzeJobFit(
  apiKey: string,
  jobDescription: string,
  experiencesByRole: Record<string, ExperienceWithRole[]>,
  educationInfo: Education[],
  userRoles: RoleWithDuration[],
  keywordMatchType: 'exact' | 'flexible',
  userId: string
): Promise<UnifiedAnalysisResult> {
  
  logger.info('Starting job fit analysis', {
    userId,
    jdLength: jobDescription.length,
    experienceCount: Object.values(experiencesByRole).reduce((sum, arr) => sum + arr.length, 0),
    rolesCount: userRoles.length,
    educationCount: educationInfo.length,
    keywordMatchType
  });

  try {
    // ===== STAGE 1: Extract job requirements =====
    const stage1Results = await extractJobRequirements(
      apiKey,
      jobDescription,
      userId
    );

    logger.info('Stage 1 results', {
      userId,
      requirementsExtracted: stage1Results.jobRequirements.length,
      keywordsExtracted: stage1Results.allKeywords.length,
      jobTitle: stage1Results.jobTitle
    });

    // ===== STAGE 2A: Match candidate to job (no bullets) =====
    const stage2aResults = await matchCandidateToJob(
      apiKey,
      stage1Results,
      experiencesByRole,
      educationInfo,
      userRoles,
      userId
    );

    logger.info('Stage 2a results', {
      userId,
      score: stage2aResults.overallScore,
      isFit: stage2aResults.isFit,
      matchedCount: stage2aResults.matchedRequirements.length,
      unmatchedCount: stage2aResults.unmatchedRequirements.length
    });

    // ===== STAGE 2B: Generate bullets (only if fit) =====
    let bulletData: {
      bulletPoints?: Record<string, any[]>;
      keywordsUsed?: string[];
      keywordsNotUsed?: string[];
    } = {};

    if (stage2aResults.isFit) {
      logger.info('Candidate is a fit - generating bullets', { userId });
      
      bulletData = await generateBullets(
        apiKey,
        experiencesByRole,
        stage2aResults.matchedRequirements,
        stage1Results.allKeywords,
        keywordMatchType,
        userId
      );

      logger.info('Stage 2b results', {
        userId,
        totalBullets: Object.values(bulletData.bulletPoints || {}).reduce((sum, arr) => sum + arr.length, 0),
        keywordsUsed: bulletData.keywordsUsed?.length || 0,
        keywordsNotUsed: bulletData.keywordsNotUsed?.length || 0
      });
    } else {
      logger.info('Candidate is not a fit - skipping bullet generation', { 
        userId,
        score: stage2aResults.overallScore 
      });
    }

    // ===== Combine all results =====
    const unifiedResults: UnifiedAnalysisResult = {
      // From Stage 1
      jobRequirements: stage1Results.jobRequirements,
      allKeywords: stage1Results.allKeywords,
      jobTitle: stage1Results.jobTitle,
      companySummary: stage1Results.companySummary,

      // From Stage 2a
      overallScore: stage2aResults.overallScore,
      isFit: stage2aResults.isFit,
      fitLevel: stage2aResults.fitLevel,
      matchedRequirements: stage2aResults.matchedRequirements,
      unmatchedRequirements: stage2aResults.unmatchedRequirements,
      absoluteGaps: stage2aResults.absoluteGaps,
      absoluteGapExplanation: stage2aResults.absoluteGapExplanation,
      criticalGaps: stage2aResults.criticalGaps,
      recommendations: stage2aResults.recommendations,

      // From Stage 2b (if generated)
      bulletPoints: bulletData.bulletPoints,
      keywordsUsed: bulletData.keywordsUsed,
      keywordsNotUsed: bulletData.keywordsNotUsed,

      // Action plan
      actionPlan: {
        readyForApplication: stage2aResults.isFit && !stage2aResults.absoluteGaps?.length,
        readyForBulletGeneration: stage2aResults.isFit,
        criticalGaps: stage2aResults.criticalGaps || [],
        absoluteGaps: stage2aResults.absoluteGaps || []
      }
    };

    // Add resume bullets metadata if bullets were generated
    if (bulletData.bulletPoints) {
      unifiedResults.resumeBullets = {
        bulletOrganization: Object.entries(bulletData.bulletPoints).map(([roleKey, bullets]) => {
          const [companyName, roleTitle] = roleKey.split(' - ');
          return {
            name: companyName,
            roles: [{
              title: roleTitle,
              bulletPoints: bullets
            }]
          };
        }),
        keywordsUsed: bulletData.keywordsUsed || [],
        keywordsNotUsed: bulletData.keywordsNotUsed || [],
        generatedFrom: {
          totalExperiences: Object.values(experiencesByRole).reduce((sum, arr) => sum + arr.length, 0),
          keywordMatchType,
          scoreThreshold: CONSTANTS.FIT_THRESHOLD,
          visualWidthRange: {
            min: CONSTANTS.VISUAL_WIDTH_MIN,
            max: CONSTANTS.VISUAL_WIDTH_MAX,
            target: CONSTANTS.VISUAL_WIDTH_TARGET
          }
        }
      };
    }

    logger.info('Analysis complete', {
      userId,
      overallScore: unifiedResults.overallScore,
      isFit: unifiedResults.isFit,
      hasBullets: !!unifiedResults.bulletPoints,
      readyForApplication: unifiedResults.actionPlan.readyForApplication
    });

    return unifiedResults;

  } catch (error: any) {
    logger.error('Analysis failed', {
      userId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Export for use in API handlers or other modules
export default analyzeJobFit;
