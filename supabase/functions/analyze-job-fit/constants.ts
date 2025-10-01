export const CONSTANTS = {
  FIT_THRESHOLD: 80,
  VISUAL_WIDTH_MIN: 150,
  VISUAL_WIDTH_MAX: 179,
  VISUAL_WIDTH_TARGET: 165,
} as const;

export const VALIDATION_LIMITS = {
  MIN_JOB_DESCRIPTION_LENGTH: 400,
  MIN_JOB_DESCRIPTION_REASON: 'Job descriptions under 400 chars lack sufficient detail for meaningful analysis',
  
  MAX_JOB_DESCRIPTION_LENGTH: 10000,
  MAX_JOB_DESCRIPTION_REASON: 'Descriptions over 10k chars may indicate scraping errors or spam',
  
  MIN_EXPERIENCES_REQUIRED: 1,
  MIN_EXPERIENCES_REASON: 'Need at least one experience to generate meaningful matches',
  
  MIN_WORD_COUNT: 50,
  MIN_WORD_COUNT_REASON: 'Job description lacks enough words to extract requirements',
} as const;

export const DEGREE_HIERARCHY = {
  "Other": 0,
  "Diploma": 0,
  "Associate": 1,
  "Bachelor's": 2,
  "Master's": 3,
  "PhD": 4
} as const;

export const AI_CONFIG = {
  MODEL: 'gpt-4o-mini',
  TEMPERATURE: 0.1,
  MAX_RETRIES: 2,
  STAGE1_MAX_TOKENS: 3000,
  STAGE2_MAX_TOKENS: 8000,
} as const;

export const CACHE_CONFIG = {
  ENABLED: true,
  TTL_HOURS: 24, // Cache Stage 1 results for 24 hours
} as const;
