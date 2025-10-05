import { Button } from "@/components/ui/button";
import KeystepLogo from "./KeystepLogo";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <KeystepLogo className="w-[30px] h-[18px] text-primary" />
            <span className="text-2xl font-bold text-foreground">keystep.ai</span>
          </div>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-smooth">
              How It Works
            </a>
            <a href="#benefits" className="text-muted-foreground hover:text-foreground transition-smooth">
              Benefits
            </a>
            <a href="/pricing" className="text-muted-foreground hover:text-foreground transition-smooth">
              Pricing
            </a>
          </nav>
          
          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              className="hidden sm:inline-flex"
              onClick={() => window.location.href = '/login'}
            >
              Log In
            </Button>
            <Button 
              variant="hero" 
              className="shadow-soft"
              onClick={() => window.location.href = '/signup'}
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;