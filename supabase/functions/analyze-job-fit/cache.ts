import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { Logger } from './utils/logger.ts';
import { Stage1Results } from './types.ts';
import { CACHE_CONFIG } from './constants.ts';

const logger = new Logger();

// Simple hash function for job description
async function hashJobDescription(jobDescription: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(jobDescription.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getCachedStage1Results(
  supabase: any,
  userId: string,
  jobDescription: string
): Promise<Stage1Results | null> {
  if (!CACHE_CONFIG.ENABLED) {
    logger.debug('Cache disabled, skipping lookup', { userId });
    return null;
  }

  try {
    const hash = await hashJobDescription(jobDescription);
    
    logger.debug('Looking up cached Stage 1 results', { userId, hash });
    
    // Query cache table (you'll need to create this table)
    const { data, error } = await supabase
      .from('job_description_cache')
      .select('*')
      .eq('jd_hash', hash)
      .eq('user_id', userId)
      .gte('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) {
      logger.debug('Cache miss', { userId, hash, error: error?.message });
      return null;
    }
    
    logger.info('Cache hit - using cached Stage 1 results', { 
      userId, 
      hash,
      cachedAt: data.created_at 
    });
    
    return data.stage1_results as Stage1Results;
    
  } catch (error) {
    logger.warn('Cache lookup failed, proceeding without cache', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export async function setCachedStage1Results(
  supabase: any,
  userId: string,
  jobDescription: string,
  results: Stage1Results
): Promise<void> {
  if (!CACHE_CONFIG.ENABLED) {
    return;
  }

  try {
    const hash = await hashJobDescription(jobDescription);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_CONFIG.TTL_HOURS);
    
    logger.debug('Caching Stage 1 results', { userId, hash, expiresAt });
    
    // Upsert into cache table
    const { error } = await supabase
      .from('job_description_cache')
      .upsert({
        user_id: userId,
        jd_hash: hash,
        stage1_results: results,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,jd_hash'
      });
    
    if (error) {
      logger.warn('Failed to cache Stage 1 results', {
        userId,
        hash,
        error: error.message
      });
    } else {
      logger.info('Successfully cached Stage 1 results', { userId, hash });
    }
    
  } catch (error) {
    logger.warn('Cache storage failed', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
