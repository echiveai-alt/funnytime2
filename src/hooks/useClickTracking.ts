import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';

interface ClickData {
  component: string;
  label?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  metadata?: Record<string, any>;
}

export const useClickTracking = () => {
  const location = useLocation();

  const trackClick = useCallback(async (data: ClickData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const page = location.pathname.split('/')[1] || 'home';
      const sessionId = sessionStorage.getItem('session_id') || crypto.randomUUID();
      
      if (!sessionStorage.getItem('session_id')) {
        sessionStorage.setItem('session_id', sessionId);
      }

      await supabase.from('clicks').insert({
        user_id: user.id,
        page,
        component: data.component,
        label: data.label,
        cat1: data.cat1,
        cat2: data.cat2,
        cat3: data.cat3,
        session_id: sessionId,
        url: window.location.href,
        referrer: document.referrer,
        metadata: data.metadata || {}
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  }, [location.pathname]);

  return { trackClick };
};
