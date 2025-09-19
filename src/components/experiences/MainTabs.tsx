import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useExperiences } from "@/hooks/useExperiences";

const MainTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { experiences } = useExperiences();
  
  const tabs = [
    { id: "experiences", label: "1. Experiences", path: "/app/experiences" },
    { id: "job-description", label: "2. Job Description", path: "/app/job-description" },
  ];

  const isActiveTab = (path: string) => location.pathname === path;

  // Check if job description is filled out (from localStorage or current state)
  const getJobDescriptionText = () => {
    const savedJobDescription = localStorage.getItem('jobDescription') || "";
    if (location.pathname === "/app/job-description") {
      // If we're on job description page, check the textarea value
      const textarea = document.querySelector('textarea[placeholder*="job description"]') as HTMLTextAreaElement;
      const currentValue = textarea?.value || "";
      // Save to localStorage if there's content
      if (currentValue.length > 0) {
        localStorage.setItem('jobDescription', currentValue);
      }
      return currentValue || savedJobDescription;
    }
    return savedJobDescription;
  };

  const hasJobDescription = getJobDescriptionText().trim().length >= 100;
  const hasExperiences = experiences.length > 0;
  const canCreate = hasExperiences && hasJobDescription;

  return (
    <div className="bg-background/95 backdrop-blur-lg border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex space-x-1 py-3">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => navigate(tab.path)}
              className={cn(
                "px-6 py-2 h-auto text-base font-medium transition-colors rounded-lg",
                isActiveTab(tab.path)
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {tab.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            onClick={() => canCreate && navigate("/app/resume-bullets")}
            disabled={!canCreate}
            className={cn(
              "px-6 py-2 h-auto text-base font-medium transition-colors rounded-lg",
              canCreate
                ? "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                : "text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            3. Analyze & Create
          </Button>
        </div>
      </div>
    </div>
  );
};

export { MainTabs };
