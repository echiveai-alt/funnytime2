import { Stage2Results, MatchedRequirement, UnmatchedRequirement } from '../types/index.ts';
import { Logger } from '../utils/logger.ts';

const logger = new Logger();

export class AnalysisError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export function validateJobDescription(jd: string): { valid: boolean; error?: string } {
  const trimmed = jd.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'Job description is required' };
  }
  
  if (trimmed.length < 400) {
    return { 
      valid: false, 
      error: `Job description too short (${trimmed.length} chars). Need at least 400 characters for meaningful analysis.`
    };
  }
  
  if (trimmed.length > 10000) {
    return {
      valid: false,
      error: 'Job description too long (max 10,000 characters). Please provide a more concise version.'
    };
  }
  
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 50) {
    return {
      valid: false,
      error: 'Job description must contain at least 50 words'
    };
  }
  
  return { valid: true };
}

export function validateStage2Response(stage2Results: any): Stage2Results {
  // Basic structure validation
  if (typeof stage2Results.overallScore !== 'number') {
    logger.warn('Missing or invalid overallScore, defaulting to 0', { stage2Results });
    stage2Results.overallScore = 0;
  }
  
  if (typeof stage2Results.isFit !== 'boolean') {
    logger.warn('Missing or invalid isFit, defaulting to false', { stage2Results });
    stage2Results.isFit = false;
  }
  
  if (!stage2Results.fitLevel) {
    stage2Results.fitLevel = stage2Results.isFit ? 'Good' : 'Poor';
  }

  // Validate matched requirements
  if (!Array.isArray(stage2Results.matchedRequirements)) {
    logger.warn('Missing matchedRequirements array, defaulting to empty array');
    stage2Results.matchedRequirements = [];
  } else {
    // Validate structure of each matched requirement
    stage2Results.matchedRequirements = stage2Results.matchedRequirements.filter(
      (match: any) => {
        const valid = match.jobRequirement && match.experienceEvidence && match.experienceSource;
        if (!valid) {
          logger.warn('Invalid matched requirement structure, filtering out', { match });
        }
        return valid;
      }
    );
  }

  // Validate unmatched requirements
  if (!Array.isArray(stage2Results.unmatchedRequirements)) {
    logger.warn('Missing unmatchedRequirements array, defaulting to empty array');
    stage2Results.unmatchedRequirements = [];
  } else {
    // Validate structure of each unmatched requirement
    stage2Results.unmatchedRequirements = stage2Results.unmatchedRequirements.filter(
      (unmatched: any) => {
        const valid = unmatched.requirement && unmatched.importance;
        if (!valid) {
          logger.warn('Invalid unmatched requirement structure, filtering out', { unmatched });
        }
        return valid;
      }
    );
  }

  // Validate fit-specific fields
  if (stage2Results.isFit) {
    if (!stage2Results.bulletPoints || typeof stage2Results.bulletPoints !== 'object') {
      logger.warn('Fit candidate missing bulletPoints, defaulting to empty object');
      stage2Results.bulletPoints = {};
    }
    if (!Array.isArray(stage2Results.keywordsUsed)) {
      logger.warn('Fit candidate missing keywordsUsed array, defaulting to empty array');
      stage2Results.keywordsUsed = [];
    }
    if (!Array.isArray(stage2Results.keywordsNotUsed)) {
      stage2Results.keywordsNotUsed = [];
    }
  }

  // Validate non-fit specific fields
  if (!stage2Results.isFit) {
    if (!Array.isArray(stage2Results.matchableKeywords)) {
      stage2Results.matchableKeywords = [];
    }
    if (!Array.isArray(stage2Results.unmatchableKeywords)) {
      stage2Results.unmatchableKeywords = [];
    }
    if (!Array.isArray(stage2Results.criticalGaps)) {
      stage2Results.criticalGaps = [];
    }
    if (!Array.isArray(stage2Results.absoluteGaps)) {
      stage2Results.absoluteGaps = [];
    }
    if (!stage2Results.recommendations?.forCandidate || !Array.isArray(stage2Results.recommendations.forCandidate)) {
      logger.warn('Non-fit candidate missing recommendations, adding defaults');
      stage2Results.recommendations = { 
        forCandidate: [
          'Review the unmatched requirements and consider how to gain experience in those areas',
          'Add more detailed STAR-format experiences that demonstrate relevant skills',
          'Consider taking online courses or certifications in key missing areas'
        ]
      };
    }
  }

  logger.info('Stage 2 response validation completed', {
    score: stage2Results.overallScore,
    isFit: stage2Results.isFit,
    matchedCount: stage2Results.matchedRequirements.length,
    unmatchedCount: stage2Results.unmatchedRequirements.length,
    hasRecommendations: !stage2Results.isFit ? stage2Results.recommendations?.forCandidate?.length > 0 : 'N/A'
  });

  return stage2Results as Stage2Results;
}
