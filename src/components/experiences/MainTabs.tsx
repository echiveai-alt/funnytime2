import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExperiences } from "@/hooks/useExperiences";

const MainTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Only pull what we use to avoid TS/ESLint unused warnings
  const { experiences } = useExperiences();

  // Create a custom event to trigger the resume modal in Experiences component
  const handleImportExperiencesClick = () => {
    const event = new CustomEvent("openResumeModal");
    window.dispatchEvent(event);
  };
  
  const tabs = [
    { id: "experiences", label: "1. Experiences", path: "/app/experiences" },
    { id: "job-description", label: "2. Job Description", path: "/app/job-description" },
    { id: "results", label: "3. Results", path: "/app/job-analysis-result" },
  ] as const;

  const isActiveTab = (path: string) => location.pathname === path;

  // Check if job description is filled out (from localStorage or current state)
  const getJobDescriptionText = () => {
    const savedJobDescription = localStorage.getItem("jobDescription") || "";

    if (location.pathname === "/app/job-description") {
      // Guard against SSR/non-DOM environments
      if (typeof document !== "undefined") {
        const textarea = document.querySelector(
          'textarea[placeholder*="job description"]'
        ) as HTMLTextAreaElement | null;

        const currentValue = textarea?.value ?? "";

        // Save to localStorage if there's content
        if (currentValue.length > 0) {
          localStorage.setItem("jobDescription", currentValue);
        }
        return currentValue || savedJobDescription;
      }
    }

    return savedJobDescription;
  };

  // Check if job analysis result exists
  const hasJobAnalysisResult = !!localStorage.getItem('jobAnalysisResult');

  return (
    <div className="bg-background/95 backdrop-blur-lg border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center py-3">
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => navigate(tab.path)}
                disabled={tab.id === "results" && !hasJobAnalysisResult}
                className={cn(
                  "px-6 py-2 h-auto text-base font-medium transition-colors rounded-lg",
                  isActiveTab(tab.path)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : tab.id === "results" && !hasJobAnalysisResult
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Import Experiences button - only show on Experiences page */}
          {location.pathname === "/app/experiences" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportExperiencesClick}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              Import Experiences
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export { MainTabs };
