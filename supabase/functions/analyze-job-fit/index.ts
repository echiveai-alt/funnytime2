import { extractJobRequirements } from './stages/stage1-extraction.ts';
import { ExperienceWithRole, Education, RoleWithDuration } from './types/index.ts';
import { Logger } from './utils/logger.ts';

const logger = new Logger();

export async function analyzeJobFit(
  apiKey: string,
  jobDescription: string,
  experiencesByRole: Record<string, ExperienceWithRole[]>,
  educationInfo: Education[],
  userRoles: RoleWithDuration[],
  keywordMatchType: 'exact' | 'flexible',
  userId: string
): Promise<any> {
  
  logger.info('Starting job fit analysis - STAGE 1 ONLY TEST', {
    userId,
    jdLength: jobDescription.length
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

    // Return Stage 1 results wrapped in a simple structure
    return {
      jobRequirements: stage1Results.jobRequirements,
      allKeywords: stage1Results.allKeywords,
      jobTitle: stage1Results.jobTitle,
      companySummary: stage1Results.companySummary,
      overallScore: 0,
      isFit: false,
      fitLevel: "Test Mode - Stage 1 Only",
      matchedRequirements: [],
      unmatchedRequirements: [],
      actionPlan: {
        readyForApplication: false,
        readyForBulletGeneration: false,
        criticalGaps: [],
        absoluteGaps: []
      },
      testMode: true,
      message: "Stage 1 only - Stage 2 temporarily disabled for testing"
    };

  } catch (error: any) {
    logger.error('Stage 1 test failed', {
      userId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export default analyzeJobFit;
