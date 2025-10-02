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
      keywordsExt
