import { CONSTANTS } from '../constants.ts';

export function calculateVisualWidth(text: string): number {
  let score = 0;
  for (const char of text) {
    if (char === ' ') score += 0.55;
    else if (['W', 'M', '@', '%', '&'].includes(char)) score += 1.25;
    else if (['m', 'w', 'Q', 'G', 'O', 'D', 'B', 'H', 'N', 'U', 'A', 'K', 'R'].includes(char)) score += 1.15;
    else if (['i', 'l', 'j', 't', 'f', 'r', 'I', 'J', '1', '!', ';', ':', '.', ',', "'", '"', '`', '|', '/'].includes(char)) score += 0.55;
    else if (char === '-') score += 0.70;
    else if (['0', '2', '3', '4', '5', '6', '7', '8', '9'].includes(char)) score += 1.00;
    else if (char >= 'A' && char <= 'Z') score += 1.10;
    else if (char >= 'a' && char <= 'z') score += 1.00;
    else score += 0.80;
  }
  return score;
}

export function isWithinTargetRange(width: number): boolean {
  return width >= CONSTANTS.VISUAL_WIDTH_MIN && width <= CONSTANTS.VISUAL_WIDTH_MAX;
}

export function exceedsMaxWidth(width: number): boolean {
  return width > CONSTANTS.VISUAL_WIDTH_MAX;
}

export function belowMinWidth(width: number): boolean {
  return width < CONSTANTS.VISUAL_WIDTH_MIN;
}
