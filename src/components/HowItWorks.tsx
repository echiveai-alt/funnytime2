import { ArrowRight, Edit3, FileText, Target, Zap } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      icon: Edit3,
      title: "Create An Experience Library",
      description: "Add your professional experiences using the proven STAR format (Situation, Task, Action, Result).",
      color: "text-primary"
    },
    {
      icon: FileText,
      title: "Paste Job Description",
      description: "Copy any job description you're applying for. Our AI analyzes requirements, keywords, and company culture.",
      color: "text-accent"
    },
    {
      icon: Target,
      title: "AI Matches & Creates",
      description: "Advanced AI selects your most relevant experiences and crafts compelling bullet points with exact keyword matching for the specific role.",
      color: "text-primary"
    },
    {
      icon: Zap,
      title: "Get Perfect Bullets",
      description: "Receive tailored resume bullet points that showcase your achievements in the exact language employers want to see for that specific job.",
      color: "text-accent"
    }
  ];

  return (
    <section className="py-24 bg-muted/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            How keystep.ai Works
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Transform your career story into targeted bullet points with our AI-powered platform
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                <div className="bg-card rounded-2xl p-8 shadow-soft hover:shadow-medium transition-smooth h-full border border-border/50">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-2xl mb-6 mx-auto shadow-glow">
                    <Icon className="w-8 h-8 text-primary-foreground" />
                  </div>
                  
                  <div className="text-center">
                    <div className="text-sm font-semibold text-primary mb-2">STEP {index + 1}</div>
                    <h3 className="text-xl font-bold text-foreground mb-4">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </div>
                
                {/* Arrow connector */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-6 h-6 text-primary/30" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;