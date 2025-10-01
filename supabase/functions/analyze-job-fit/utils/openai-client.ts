import { AI_CONFIG } from '../constants.ts';
import { Logger } from './logger.ts';
import { AnalysisError } from '../validation/response-validator.ts';

const logger = new Logger();

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callOpenAI(
  apiKey: string,
  messages: OpenAIMessage[],
  maxTokens: number
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: AI_CONFIG.MODEL,
      messages: messages,
      max_tokens: maxTokens,
      temperature: AI_CONFIG.TEMPERATURE
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('OpenAI API error', new Error(errorText), {
      status: response.status,
      statusText: response.statusText
    });
    throw new AnalysisError(
      `OpenAI API error: ${response.status} - ${response.statusText}`,
      'OPENAI_ERROR',
      500
    );
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function buildRetryPrompt(error: unknown): string {
  if (error instanceof AnalysisError) {
    switch (error.code) {
      case 'INVALID_RESPONSE':
        return `CRITICAL: Your previous response was missing required fields. You MUST include:
1. Both matchedRequirements and unmatchedRequirements arrays with proper structure
2. For scores < 80%, you MUST include recommendations.forCandidate array with 3-5 specific recommendations
3. For matched requirements: jobRequirement, experienceEvidence, experienceSource
4. For unmatched requirements: requirement, importance
Return valid JSON only with all required fields.`;
      
      case 'INVALID_RESPONSE_FORMAT':
        return `CRITICAL: Your response must be valid JSON. Ensure:
1. Properly closed brackets and braces
2. No trailing commas
3. Strings properly escaped
4. Return ONLY the JSON object, no additional text
Please provide a complete, valid JSON response.`;
      
      default:
        return `CRITICAL: Please fix the error in your previous response and provide a complete, valid response.`;
    }
  }
  return `CRITICAL: An error occurred. Please provide a complete, valid response.`;
}

export async function callOpenAIWithRetry(
  apiKey: string,
  messages: OpenAIMessage[],
  maxTokens: number,
  context: { userId: string; stage: string },
  validator: (parsed: any) => any,
  maxAttempts: number = AI_CONFIG.MAX_RETRIES
): Promise<any> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug('OpenAI API call starting', {
        ...context,
        attempt,
        maxAttempts,
        messageCount: messages.length,
        maxTokens
      });
      
      const startTime = Date.now();
      const responseText = await callOpenAI(apiKey, messages, maxTokens);
      const duration = Date.now() - startTime;
      
      logger.info('OpenAI API call succeeded', {
        ...context,
        attempt,
        duration,
        responseLength: responseText.length
      });
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new AnalysisError(
          'No JSON found in OpenAI response',
          'INVALID_RESPONSE_FORMAT',
          500
        );
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const validated = validator(parsed);
      
      return validated;
      
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      
      logger.warn('OpenAI API call failed', {
        ...context,
        attempt,
        maxAttempts,
        isLastAttempt,
        errorType: error instanceof AnalysisError ? error.code : 'UNKNOWN',
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      
      if (isLastAttempt) {
        logger.error('Max retry attempts exhausted', error as Error, {
          ...context,
          totalAttempts: maxAttempts
        });
        throw error;
      }
      
      // Add retry prompt
      messages.push({
        role: 'assistant',
        content: 'I need to provide a more complete response.'
      });
      messages.push({
        role: 'user',
        content: buildRetryPrompt(error)
      });
      
      logger.info('Retrying OpenAI call with enhanced prompt', {
        ...context,
        nextAttempt: attempt + 1
      });
    }
  }
  
  throw new AnalysisError('Unreachable code after retry loop', 'INTERNAL_ERROR', 500);
}
