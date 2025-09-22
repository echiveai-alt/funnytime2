import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExperiences } from "@/hooks/useExperiences";
import { useJobAnalysis } from "@/hooks/useJobAnalysis";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ResumeImportModal } from "@/components/experiences/ResumeImportModal";

const MainTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { experiences, companies, roles, createCompany, createRole, createExperience, updateExperience, setSelectedRole } = useExperiences();
  const { analyzeJobFit, isAnalyzing } = useJobAnalysis();
  const { toast } = useToast();
  const [showResumeImportModal, setShowResumeImportModal] = useState(false);

  const handleResumeImport = async (parsedData: any[]) => {
    try {
      for (const experience of parsedData) {
        // Create or find company
        const existingCompany = companies.find(c => 
          c.name.toLowerCase() === experience.company.toLowerCase()
        );
        
        let companyId = existingCompany?.id;
        
        if (!existingCompany) {
          const companyData = {
            name: experience.company,
            start_date: experience.startDate || new Date().toISOString().split('T')[0],
            end_date: experience.endDate,
            is_current: !experience.endDate
          };
          const newCompany = await createCompany(companyData, experience.role);
          companyId = newCompany?.id;
        }
        
        if (!companyId) continue;
        
        // Create or find role
        const existingRole = roles.find(r => 
          r.company_id === companyId && 
          r.title.toLowerCase() === experience.role.toLowerCase()
        );
        
        let roleId = existingRole?.id;
        
        if (!existingRole) {
          const roleData = {
            company_id: companyId,
            title: experience.role,
            start_date: experience.startDate || new Date().toISOString().split('T')[0],
            end_date: experience.endDate,
            is_current: !experience.endDate
          };
          const newRole = await createRole(roleData);
          roleId = newRole?.id;
        }
        
        if (!roleId) continue;
        
        // Set the role as selected to create experiences for it
        const targetRole = roles.find(r => r.id === roleId) || 
                          (existingRole || { id: roleId, company_id: companyId, title: experience.role, start_date: experience.startDate, end_date: experience.endDate, is_current: !experience.endDate, user_id: '', created_at: '', updated_at: '' });
        setSelectedRole(targetRole);
        
        // Create experiences for each bullet
        for (const bullet of experience.bullets) {
          const newExperience = await createExperience();
          if (newExperience) {
            await updateExperience(newExperience.id, {
              title: bullet.title,
              situation: bullet.situation || '',
              task: bullet.task || '',
              action: bullet.action || '',
              result: bullet.result || '',
              tags: []
            });
          }
        }
      }
      
      toast({
        title: "Resume Imported Successfully",
        description: `Created ${parsedData.length} work experience${parsedData.length > 1 ? 's' : ''} with ${parsedData.reduce((sum, exp) => sum + exp.bullets.length, 0)} STAR stories`,
      });
      
    } catch (error) {
      console.error("Failed to import resume:", error);
      toast({
        title: "Import Failed",
        description: "There was an error importing your resume. Please try again.",
        variant: "destructive",
      });
    }
  };
  
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

  const handleAnalyzeAndCreate = async () => {
    const jobDescriptionText = getJobDescriptionText().trim();
    
    // Check if job description exists first
    if (!jobDescriptionText) {
      // Set flag for JobDescription page to show inline error
      localStorage.setItem('showJobDescriptionError', 'required');
      navigate("/app/job-description");
      toast({
        title: "Validation Error",
        description: "Job description is required",
        variant: "destructive",
      });
      return;
    }
    
    if (jobDescriptionText.length < 100) {
      navigate("/app/job-description");
      toast({
        title: "Validation Error",
        description: "Job description must be at least 100 characters",
        variant: "destructive",
      });
      return;
    }

    if (!hasExperiences) {
      toast({
        title: "No Experiences Found",
        description: "Please add some experiences before analyzing",
        variant: "destructive",
      });
      navigate("/app/experiences");
      return;
    }

    // Trigger the job analysis
    const result = await analyzeJobFit(jobDescriptionText);
    
    if (result) {
      // Navigate to job analysis result page
      navigate("/app/job-analysis-result");
    }
  };

  return (
    <>
      <div className="bg-background/95 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center py-3">
            <div className="flex space-x-1">
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
                onClick={handleAnalyzeAndCreate}
                disabled={isAnalyzing}
                className={cn(
                  "px-6 py-2 h-auto text-base font-medium transition-colors rounded-lg",
                  isAnalyzing
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {isAnalyzing ? "Analyzing..." : "3. Analyze & Create"}
              </Button>
            </div>
            
            {/* Import Resume button - only show on Experiences page */}
            {location.pathname === "/app/experiences" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResumeImportModal(true)}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                Import Resume
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Resume Import Modal */}
      <ResumeImportModal
        isOpen={showResumeImportModal}
        onClose={() => setShowResumeImportModal(false)}
        onImportComplete={handleResumeImport}
      />
    </>
  );
};

export { MainTabs };