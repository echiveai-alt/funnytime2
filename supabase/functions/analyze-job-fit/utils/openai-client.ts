import OpenAI from 'https://esm.sh/openai@4';
import { Logger } from './logger.ts';
import { AnalysisError } from '../validation/response-validator.ts';

const logger = new Logger();

export async function callOpenAIWithRetry<T>(
  apiKey: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  maxTokens: number,
  context: { userId?: string; stage?: string },
  validator: (response: any) => T,
  jsonSchema?: any,
  temperature: number = 0.1
): Promise<T> {
  const openai = new OpenAI({ apiKey });
  const maxRetries = 2;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info('Calling OpenAI', {
        ...context,
        attempt,
        maxTokens,
        temperature,
        hasSchema: !!jsonSchema
      });

      const requestParams: any = {
        model: 'gpt-4o-mini',
        messages,
        max_tokens: maxTokens,
        temperature
      };

      // Add JSON schema if provided
      if (jsonSchema) {
        requestParams.response_format = {
          type: "json_schema",
          json_schema: {
            name: "response",
            strict: true,
            schema: jsonSchema
          }
        };
      }

      const completion = await openai.chat.completions.create(requestParams);

      const content = completion.choices[0]?.message?.content;
      
      if (!content) {
        throw new AnalysisError(
          'OpenAI returned empty response',
          'EMPTY_RESPONSE',
          500
        );
      }

      logger.info('OpenAI response received', {
        ...context,
        attempt,
        contentLength: content.length,
        tokensUsed: completion.usage?.total_tokens
      });

      const parsed = JSON.parse(content);
      return validator(parsed);

    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      
      logger.error('OpenAI call failed', {
        ...context,
        attempt,
        error: error.message,
        willRetry: !isLastAttempt
      });

      if (isLastAttempt) {
        if (error instanceof AnalysisError) {
          throw error;
        }
        throw new AnalysisError(
          `AI analysis failed: ${error.message}`,
          'AI_ERROR',
          500
        );
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new AnalysisError(
    'Max retries exceeded',
    'MAX_RETRIES_EXCEEDED',
    500
  );
}
