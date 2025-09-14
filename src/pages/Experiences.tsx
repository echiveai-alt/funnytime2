import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const Experiences = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
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
              <Brain className="w-8 h-8 text-primary-foreground animate-pulse" />
            </div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-primary rounded-xl shadow-soft">
                <Brain className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-foreground">echive.ai</span>
            </div>
            <Button variant="ghost" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Your Experiences
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Add your work experiences and achievements to generate compelling resume bullet points.
          </p>
        </div>

        <Card className="p-12 shadow-soft text-center">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-center w-16 h-16 bg-muted rounded-xl shadow-soft mx-auto mb-6">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              No experiences yet
            </h2>
            <p className="text-muted-foreground mb-8">
              Start by adding your first work experience or achievement to begin generating professional resume bullet points.
            </p>
            <Button size="lg" className="shadow-soft">
              Add Your First Experience
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Experiences;