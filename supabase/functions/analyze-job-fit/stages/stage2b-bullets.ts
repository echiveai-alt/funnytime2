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

/**
 * Detects if a bullet has quantitative results
 * Looks for: numbers, percentages, dollar amounts, time periods, etc.
 */
function hasQuantitativeResult(bulletText: string): boolean {
  // Patterns for quantitative indicators
  const quantPatterns = [
    /\d+%/,                          // Percentages (40%, 25%)
    /\$\d+[KMB]?/i,                  // Dollar amounts ($500K, $2M)
    /\d+[KMB]\+?/,                   // Large numbers (500K, 2M+)
    /\d+x/i,                         // Multipliers (2x, 10x)
    /\d+\s*-\s*\d+/,                 // Ranges (5-10, 100-200)
    /reduced.*?\d+/i,                // Reduced by X
    /increased.*?\d+/i,              // Increased by X
    /grew.*?\d+/i,                   // Grew by X
    /saved.*?\d+/i,                  // Saved X
    /generated.*?\d+/i,              // Generated X
    /improved.*?\d+/i,               // Improved by X
    /decreased.*?\d+/i,              // Decreased by X
    /raised.*?\d+/i,                 // Raised X
    /achieved.*?\d+/i,               // Achieved X
    /\d+\s*(month|year|week|day)/i,  // Time periods
    /within\s+\d+/i,                 // Within X timeframe
  ];
  
  return quantPatterns.some(pattern => pattern.test(bulletText));
}

/**
 * Calculates a sorting priority score for a bullet
 * Higher score = higher priority (appears first)
 */
function calculateBulletPriority(bullet: any): number {
  const hasQuant = hasQuantitativeResult(bullet.text);
  const relevance = bullet.relevanceScore || 5; // Default to 5 if not provided
  
  // Priority formula:
  // - Quantitative bullets get +100 bonus
  // - Relevance score (1-10) is added
  // This ensures all quantitative bullets appear before non-quantitative ones
  const quantBonus = hasQuant ? 100 : 0;
  
  return quantBonus + relevance;
}

/**
 * Sorts bullets within each role by priority
 * Priority: Quantitative + High Relevance first
 */
function sortBulletsByPriority(bullets: any[]): any[] {
  return bullets.sort((a, b) => {
    const priorityA = calculateBulletPriority(a);
    const priorityB = calculateBulletPriority(b);
    return priorityB - priorityA; // Descending order (highest priority first)
  });
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

  // Note: We don't use STAGE2B_BULLETS_SCHEMA because patternProperties isn't supported in OpenAI structured outputs
  // Instead, we rely on the explicit JSON format example in the prompt
  const stage2bResults = await callOpenAIWithRetry(
    apiKey,
    messages,
    AI_CONFIG.STAGE2B_MAX_TOKENS,
    { userId, stage: 'stage2b' },
    validateStage2bResponse,
    undefined, // No strict schema due to dynamic keys
    AI_CONFIG.TEMPERATURE_BULLETS
  );

  // Verify keywords
  const { verifiedBullets, actualKeywordsUsed, actualKeywordsNotUsed } = 
    verifyKeywordsInBullets(
      stage2bResults.bulletPoints,
      allKeywords,
      keywordMatchType
    );

  // Add visual width calculations AND smart sorting
  const processedBullets: Record<string, any[]> = {};
  Object.entries(verifiedBullets).forEach(([roleKey, bullets]) => {
    // First, add visual width to each bullet
    const bulletsWithWidth = bullets.map((bullet: any) => {
      const width = calculateVisualWidth(bullet.text);
      const hasQuant = hasQuantitativeResult(bullet.text);
      
      return {
        ...bullet,
        visualWidth: Math.round(width),
        exceedsMax: width > CONSTANTS.VISUAL_WIDTH_MAX,
        belowMin: width < CONSTANTS.VISUAL_WIDTH_MIN,
        isWithinRange: width >= CONSTANTS.VISUAL_WIDTH_MIN && width <= CONSTANTS.VISUAL_WIDTH_MAX,
        hasQuantitativeResult: hasQuant, // Add this flag for UI display if needed
      };
    });
    
    // Then, sort by priority (quantitative + relevance)
    processedBullets[roleKey] = sortBulletsByPriority(bulletsWithWidth);
  });

  logger.info('Stage 2b complete with smart sorting', {
    userId,
    totalBullets: Object.values(processedBullets).reduce((sum, arr) => sum + arr.length, 0),
    quantitativeBullets: Object.values(processedBullets).reduce(
      (sum, arr) => sum + arr.filter((b: any) => b.hasQuantitativeResult).length, 
      0
    ),
    keywordsUsed: actualKeywordsUsed.length,
    keywordsNotUsed: actualKeywordsNotUsed.length
  });

  return {
    bulletPoints: processedBullets,
    keywordsUsed: actualKeywordsUsed,
    keywordsNotUsed: actualKeywordsNotUsed
  };
}