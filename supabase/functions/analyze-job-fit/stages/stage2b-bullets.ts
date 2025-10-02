import { callOpenAIWithRetry } from '../utils/openai-client.ts';
import { buildStage2bPrompt, getStage2bSystemMessage } from '../prompts/stage2b-bullets-prompt.ts';
import { STAGE2B_BULLETS_SCHEMA } from '../types/json-schemas.ts';
import { 
  MatchedRequirement,
  ExperienceWithRole
} from '../types/index.ts';
import { AI_CONFIG, CONSTANTS } from '../constants.ts';
import { Logger } from '../utils/logger.ts';
import { calculateVisualWidth } from '../utils/visual-width.ts';
import { verifyKeywordsInBullets } from '../matching/keyword-validator.ts';

const logger = new Logger();

function validateStage2bResponse(response: any): any {
  if (!response.bulletPoints || typeof response.bulletPoints !== 'object') {
    throw new Error('Invalid Stage 2b response: missing bulletPoints');
  }
  
  if (!Array.isArray(response.keywordsUsed) || !Array.isArray(response.keywordsNotUsed)) {
    throw new Error('Invalid Stage 2b response: missing keyword arrays');
  }
  
  return response;
}

export async function generateBullets(
  apiKey: string,
  experiencesByRole: Record<string, ExperienceWithRole[]>,
  matchedRequirements: MatchedRequirement[],
  allKeywords: string[],
  keywordMatchType: 'exact' | 'flexible',
  userId: string
): Promise<{
  bulletPoints: Record<string, any[]>;
  keywordsUsed: string[];
  keywordsNotUsed: string[];
}> {
  logger.info('Starting Stage 2b: Bullet generation', {
    userId,
    experienceCount: Object.values(experiencesByRole).reduce((sum, arr) => sum + arr.length, 0),
    keywordCount: allKeywords.length
  });

  const messages = [
    {
      role: 'system' as const,
      content: getStage2bSystemMessage()
    },
    {
      role: 'user' as const,
      content: buildStage2bPrompt(
        experiencesByRole,
        matchedRequirements,
        allKeywords,
        keywordMatchType
      )
    }
  ];

  const stage2bResults = await callOpenAIWithRetry(
    apiKey,
    messages,
    AI_CONFIG.STAGE2B_MAX_TOKENS,
    { userId, stage: 'stage2b' },
    validateStage2bResponse,
    STAGE2B_BULLETS_SCHEMA,
    AI_CONFIG.TEMPERATURE_BULLETS
  );

  // Verify keywords
  const { verifiedBullets, actualKeywordsUsed, actualKeywordsNotUsed } = 
    verifyKeywordsInBullets(
      stage2bResults.bulletPoints,
      allKeywords,
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

  logger.info('Stage 2b complete', {
    userId,
    totalBullets: Object.values(processedBullets).reduce((sum, arr) => sum + arr.length, 0),
    keywordsUsed: actualKeywordsUsed.length,
    keywordsNotUsed: actualKeywordsNotUsed.length
  });

  return {
    bulletPoints: processedBullets,
    keywordsUsed: actualKeywordsUsed,
    keywordsNotUsed: actualKeywordsNotUsed
  };
}
