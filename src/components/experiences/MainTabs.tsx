import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MainTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const tabs = [
    { id: "experiences", label: "Experiences", path: "/app/experiences" },
    { id: "job-description", label: "Job Description", path: "/app/job-description" },
  ];

  const isActiveTab = (path: string) => location.pathname === path;

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
        </div>
      </div>
    </div>
  );
};

export { MainTabs };