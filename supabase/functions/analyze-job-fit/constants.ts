import { DegreeLevel } from './types/index.ts';

// Degree hierarchy for comparison (higher number = higher degree)
export const DEGREE_HIERARCHY: Record<DegreeLevel, number> = {
  "Other": 0,
  "Diploma": 1,
  "Associate": 2,
  "Bachelor's": 3,
  "Master's": 4,
  "PhD": 5
};

// AI Configuration
export const AI_CONFIG = {
  MODEL: 'gpt-4o-mini',
  TEMPERATURE_MATCHING: 0.0,    // For deterministic matching logic
  TEMPERATURE_BULLETS: 0.15,    // For creative bullet generation
  MAX_RETRIES: 2,
  STAGE1_MAX_TOKENS: 3000,
  STAGE2A_MAX_TOKENS: 4000,     // Matching only (no bullets)
  STAGE2B_MAX_TOKENS: 4000,     // Bullets only
};

// Visual width constants for resume bullets
export const CONSTANTS = {
  FIT_THRESHOLD: 80,
  VISUAL_WIDTH_MIN: 420,
  VISUAL_WIDTH_MAX: 600,
  VISUAL_WIDTH_TARGET: 510,
};
