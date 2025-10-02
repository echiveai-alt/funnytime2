import { callOpenAIWithRetry } from '../utils/openai-client.ts';
import { buildStage1Prompt, getStage1SystemMessage } from '../prompts/stage1-prompt.ts';
import { Stage1Results, JobRequirement } from '../types/index.ts';
import { AI_CONFIG } from '../constants.ts';
import { Logger } from '../utils/logger.ts';
import { AnalysisError } from '../validation/response-validator.ts';

const logger = new Logger();

function validateStage1Response(response: any): Stage1Results {
  if (!Array.isArray(response.jobRequirements)) {
    throw new AnalysisError(
      'Invalid Stage 1 response: missing jobRequirements array',
      'INVALID_RESPONSE',
      500
    );
  }

  if (!Array.isArray(response.allKeywords)) {
    throw new AnalysisError(
      'Invalid Stage 1 response: missing allKeywords array',
      'INVALID_RESPONSE',
      500
    );
  }

  if (!response.jobTitle || typeof response.jobTitle !== 'string') {
    logger.warn('Stage 1 response missing jobTitle, using default');
    response.jobTitle = 'Position';
  }

  if (!response.companySummary || typeof response.companySummary !== 'string') {
    logger.warn('Stage 1 response missing companySummary, using default');
    response.companySummary = 'Company';
  }

  logger.info('Stage 1 validation passed', {
    requirementsCount: response.jobRequirements.length,
    keywordsCount: response.allKeywords.length,
    jobTitle: response.jobTitle
  });

  return response as Stage1Results;
}

export async function extractJobRequirements(
  apiKey: string,
  jobDescription: string,
  userId: string
): Promise<Stage1Results> {
  logger.info('Starting Stage 1: Job requirement extraction', {
    userId,
    jdLength: jobDescription.length
  });

  const messages = [
    {
      role: 'system' as const,
      content: getStage1SystemMessage()
    },
    {
      role: 'user' as const,
      content: buildStage1Prompt(jobDescription.trim())
    }
  ];

  const stage1Results = await callOpenAIWithRetry(
    apiKey,
    messages,
    AI_CONFIG.STAGE1_MAX_TOKENS,
    { userId, stage: 'stage1' },
    validateStage1Response
  );

  logger.info('Stage 1 complete', {
    userId,
    requirementsExtracted: stage1Results.jobRequirements.length,
    keywordsExtracted: stage1Results.allKeywords.length,
    requirementsByCategory: stage1Results.jobRequirements.reduce((acc: any, req: any) => {
      acc[req.category] = (acc[req.category] || 0) + 1;
      return acc;
    }, {})
  });

  logger.info('Stage 1 results - job requirements', {
    userId,
    jobRequirements: stage1Results.jobRequirements.map((req: JobRequirement) => ({
      requirement: req.requirement,
      category: req.category,
      importance: req.importance,
      specificRole: (req as any).specificRole || null,
      minimumYears: (req as any).minimumYears || null
    }))
  });

  return stage1Results;
}
