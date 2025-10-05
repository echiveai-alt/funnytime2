import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import KeystepLogo from "@/components/KeystepLogo";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MainTabs } from "@/components/experiences/MainTabs";
import { AccountSettings } from "@/components/AccountSettings";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/signup");
          return;
        }
        setUser(session.user);
      } catch (error) {
        console.error("Auth check error:", error);
        navigate("/signup");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-subtle">
        <Card className="w-full max-w-4xl p-8 shadow-soft">
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-xl shadow-soft mx-auto mb-6">
              <KeystepLogo className="w-12 h-8 text-primary-foreground animate-pulse" />
            </div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-primary rounded-xl shadow-soft">
                <KeystepLogo className="w-10 h-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-foreground">keystep.ai</span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowAccountSettings(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <MainTabs />

      {/* Page Content */}
      {children}
      
      {/* Account Settings Modal */}
      <AccountSettings 
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
      />
    </div>
  );
};

export { AppLayout };