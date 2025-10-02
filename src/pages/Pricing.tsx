import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Pricing = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign up or log in to subscribe",
          variant: "destructive",
        });
        navigate("/signup");
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start subscription process",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to open customer portal",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground">
            Start with a free trial, then upgrade to unlimited access
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Free Trial Card */}
          <Card className="p-8 relative">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Free Trial</h3>
              <div className="text-4xl font-bold mb-4">
                $0
              </div>
              <p className="text-muted-foreground">Perfect to get started</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <Check className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                <span>3 free resume bullet point generations</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                <span>AI-powered job matching analysis</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                <span>STAR method experience tracking</span>
              </li>
            </ul>

            <Button 
              onClick={() => navigate("/signup")}
              variant="outline" 
              className="w-full"
            >
              Sign Up Free
            </Button>
          </Card>

          {/* Pro Plan Card */}
          <Card className="p-8 relative border-primary shadow-lg">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Resume Builder Pro</h3>
              <div className="text-4xl font-bold mb-4">
                $15
                <span className="text-lg font-normal text-muted-foreground">/month</span>
              </div>
              <p className="text-muted-foreground">Unlimited resume generation</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <Check className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                <span className="font-semibold">Unlimited resume bullet points</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                <span>Advanced AI job fit analysis</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                <span>Priority support</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                <span>Export to multiple formats</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                <span>Cancel anytime</span>
              </li>
            </ul>

            <Button 
              onClick={handleSubscribe}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Processing..." : "Subscribe Now"}
            </Button>
            
            <Button 
              onClick={handleManageSubscription}
              variant="ghost"
              disabled={isLoading}
              className="w-full mt-2"
            >
              Manage Subscription
            </Button>
          </Card>
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>All plans include access to our STAR method experience tracking system.</p>
          <p className="mt-2">Need help? Contact our support team anytime.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
