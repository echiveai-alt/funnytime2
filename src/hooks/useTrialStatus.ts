import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TrialStatus {
  isTrialExpired: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
}

export const useTrialStatus = () => {
  const [status, setStatus] = useState<TrialStatus>({
    isTrialExpired: false,
    isSubscribed: false,
    isLoading: true,
  });

  useEffect(() => {
    const checkTrialStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setStatus({ isTrialExpired: false, isSubscribed: false, isLoading: false });
          return;
        }

        // Check subscription status
        const { data: subscriptionData } = await supabase.functions.invoke('check-subscription');
        const isSubscribed = subscriptionData?.subscribed || false;

        // Check profile trial usage
        const { data: profile } = await supabase
          .from('profiles')
          .select('free_analyses_used, free_bullets_generated, has_free_access')
          .eq('user_id', user.id)
          .single();

        if (!profile) {
          setStatus({ isTrialExpired: false, isSubscribed, isLoading: false });
          return;
        }

        // Trial is expired if:
        // - User has used 10+ analyses OR 3+ bullet generations
        // - AND doesn't have free access
        // - AND is not subscribed
        const analysisLimitReached = profile.free_analyses_used >= 10;
        const bulletLimitReached = profile.free_bullets_generated >= 3;
        const hasNoFreeAccess = !profile.has_free_access;

        const isTrialExpired = 
          (analysisLimitReached || bulletLimitReached) && 
          hasNoFreeAccess && 
          !isSubscribed;

        setStatus({ isTrialExpired, isSubscribed, isLoading: false });
      } catch (error) {
        console.error('Error checking trial status:', error);
        setStatus({ isTrialExpired: false, isSubscribed: false, isLoading: false });
      }
    };

    checkTrialStatus();

    // Set up subscription to profile changes
    const channel = supabase
      .channel('trial-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          checkTrialStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return status;
};
