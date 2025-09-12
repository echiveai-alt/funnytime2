import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Clock, RefreshCw, Target, TrendingUp, Users } from "lucide-react";

const Benefits = () => {
  const benefits = [
    {
      icon: Target,
      title: "Precision Targeting",
      description: "Every bullet point is crafted to match specific job requirements and company values.",
      stats: "95% keyword match rate"
    },
    {
      icon: Clock,
      title: "Save Hours of Work",
      description: "Transform tedious resume writing into a 5-minute automated process.",
      stats: "10x faster than manual writing"
    },
    {
      icon: RefreshCw,
      title: "Reuse Your Experience",
      description: "Build your STAR library once, generate unlimited targeted resumes for different roles.",
      stats: "One library, infinite applications"
    },
    {
      icon: TrendingUp,
      title: "Increase Response Rates",
      description: "Tailored content significantly improves your chances of landing interviews.",
      stats: "3x more interview invitations"
    },
    {
      icon: Users,
      title: "ATS Optimized",
      description: "Ensures your resume passes Applicant Tracking Systems with optimal keyword density.",
      stats: "99% ATS compatibility"
    },
    {
      icon: CheckCircle,
      title: "Proven STAR Method",
      description: "Built on the industry-standard framework that recruiters and hiring managers prefer.",
      stats: "HR-approved methodology"
    }
  ];

  return (
    <section className="py-24 bg-background">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Why echive.ai?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Stop spending hours crafting resume bullets. Let AI do the heavy lifting while you focus on what matters most.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div 
                key={index} 
                className="bg-card rounded-2xl p-8 shadow-soft hover:shadow-medium transition-smooth border border-border/50 group hover:border-primary/20"
              >
                <div className="flex items-center justify-center w-14 h-14 bg-gradient-primary rounded-xl mb-6 group-hover:shadow-glow transition-smooth">
                  <Icon className="w-7 h-7 text-primary-foreground" />
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-3">{benefit.title}</h3>
                <p className="text-muted-foreground mb-4 leading-relaxed">{benefit.description}</p>
                <div className="text-sm font-semibold text-primary">{benefit.stats}</div>
              </div>
            );
          })}
        </div>
        
        {/* CTA Section */}
        <div className="bg-gradient-primary rounded-3xl p-12 text-center shadow-medium">
          <h3 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
            Ready to Transform Your Resume Strategy?
          </h3>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who've accelerated their career growth with AI-powered resume optimization.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button variant="accent" size="lg" className="bg-background text-primary hover:bg-background/90 text-lg px-8 py-6 h-auto shadow-glow">
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="outline_primary" size="lg" className="text-lg px-8 py-6 h-auto border-white/30 text-primary-foreground hover:bg-white/10">
              View Pricing
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;