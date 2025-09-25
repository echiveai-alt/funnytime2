import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ParsedExperience {
  company: string;
  role: string;
  startDate: string | null;
  endDate: string | null;
  location?: string;
  bullets: Array<{
    bullet: string;
    title: string;
    situation: string | null;
    task: string | null;
    action: string | null;
    result: string | null;
  }>;
}

interface OnboardingResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (data: ParsedExperience[]) => void;
}

export const OnboardingResumeModal = ({
  isOpen,
  onClose,
  onImportComplete
}: OnboardingResumeModalProps) => {
  const [resumeText, setResumeText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleParse = async () => {
    if (!resumeText.trim()) {
      setError("Please paste resume text");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('resumeText', resumeText);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please log in to parse your resume");
      }

      const response = await supabase.functions.invoke('parse-resume', {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to parse resume');
      }

      const { success, message, data, error: responseError } = response.data;
      
      if (!success) {
        throw new Error(responseError || 'Failed to parse resume');
      }

      console.log('Resume parsing successful:', { success, message, data });

      toast({
        title: "Resume Parsed Successfully!",
        description: message,
      });

      // Call the callback with the parsed data if provided
      if (onImportComplete && data) {
        await onImportComplete(data);
      }

      handleClose();
    } catch (error) {
      console.error('Parse error:', error);
      setError(error instanceof Error ? error.message : 'Failed to parse resume. Please try again.');
      toast({
        title: "Parse Failed",
        description: error instanceof Error ? error.message : 'Failed to parse resume. Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setResumeText("");
    setError(null);
    setIsLoading(false);
    onClose();
  };

  const handleSkip = () => {
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Resume</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Custom message */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
            <p className="text-sm text-muted-foreground">
              Paste your resume text to kick things off. Then review and add specifics on the Experience cards—especially in the Actions—so our AI can craft JD-aligned bullet points. 
              We need your professional experience for each company and role, plus the start and end dates.
            </p>
          </div>

          {/* Text Input */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Paste Resume Text</h3>
            <Textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here..."
              className="min-h-[200px] resize-none"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={handleSkip} disabled={isLoading}>
              Skip for now
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleParse} disabled={isLoading || !resumeText.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  'Parse Resume'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
