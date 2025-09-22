import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Target, Zap } from "lucide-react";
import heroBackground from "@/assets/hero-background.jpg";
const Hero = () => {
  return <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background with gradient overlay */}
      <div className="absolute inset-0 bg-gradient-hero opacity-95"></div>
      <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{
      backgroundImage: `url(${heroBackground})`
    }}></div>
      
      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        <div className="mb-8 pt-20">
          <div className="inline-flex items-center gap-2 bg-background/10 backdrop-blur-sm rounded-full px-6 py-3 mb-8 border border-white/20">
            <Brain className="w-5 h-5 text-accent-foreground" />
            <span className="text-primary-foreground font-medium">AI-Powered Resume Enhancement</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold text-primary-foreground mb-6 leading-tight">
            Transform Your Experience Into
            <span className="bg-gradient-to-r from-accent to-white bg-clip-text text-transparent block">Perfect Resume</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-primary-foreground/90 mb-12 max-w-4xl mx-auto leading-relaxed">Create targeted resume bullet points from a library of your professional experiences. Let AI craft compelling bullets that match any job description with precision.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
          <Button variant="accent" size="lg" className="text-lg px-8 py-6 h-auto" onClick={() => window.location.href = '/signup'}>
            Start Creating Bullet Points
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button variant="outline_primary" size="lg" className="text-lg px-8 py-6 h-auto border-white/30 text-primary-foreground hover:bg-white/10">
            See How It Works
          </Button>
        </div>
        
        {/* Feature highlights */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-background/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <Target className="w-8 h-8 text-primary-foreground mb-4 mx-auto" />
            <h3 className="text-primary-foreground font-semibold mb-2">Targeted Matching</h3>
            <p className="text-primary-foreground/80 text-sm">AI analyzes job descriptions to create perfectly aligned bullet points</p>
          </div>
          
          <div className="bg-background/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <Brain className="w-8 h-8 text-primary-foreground mb-4 mx-auto" />
            <h3 className="text-primary-foreground font-semibold mb-2">STAR Format</h3>
            <p className="text-primary-foreground/80 text-sm">Input experiences once in proven Situation-Task-Action-Result format</p>
          </div>
          
          <div className="bg-background/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <Zap className="w-8 h-8 text-primary-foreground mb-4 mx-auto" />
            <h3 className="text-primary-foreground font-semibold mb-2">Instant Results</h3>
            <p className="text-primary-foreground/80 text-sm">Generate multiple versions for different roles in seconds</p>
          </div>
        </div>
      </div>
    </section>;
};
export default Hero;
