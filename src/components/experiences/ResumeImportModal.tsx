import { useState, useCallback } from "react";
import { Upload, FileText, X, Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

interface ResumeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (data: ParsedExperience[]) => void;
}

export const ResumeImportModal = ({
  isOpen,
  onClose,
  onImportComplete
}: ResumeImportModalProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file && isValidFileType(file)) {
      setSelectedFile(file);
      setError(null);
    } else {
      setError("Please upload a PDF, DOCX, or TXT file");
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isValidFileType(file)) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError("Please upload a PDF, DOCX, or TXT file");
      }
    }
  }, []);

  const isValidFileType = (file: File): boolean => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const validExtensions = ['.pdf', '.docx', '.txt'];
    
    return validTypes.includes(file.type) || 
           validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const handleParse = async () => {
    if (!selectedFile && !resumeText.trim()) {
      setError("Please upload a file or paste resume text");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      
      if (selectedFile) {
        formData.append('file', selectedFile);
      } else {
        formData.append('resumeText', resumeText);
      }

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
      
      if (!success || responseError) {
        throw new Error(responseError || 'Failed to parse resume');
      }

      toast({
        title: "Resume Parsed Successfully!",
        description: message,
      });

      // Call the callback with the parsed data if provided
      if (onImportComplete && data) {
        onImportComplete(data);
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
    setSelectedFile(null);
    setResumeText("");
    setError(null);
    setIsLoading(false);
    onClose();
  };

  const removeFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Resume</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* File Upload Area */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Upload Resume File</h3>
            
            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                )}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Drag and drop your resume here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports PDF, DOCX, and TXT files
                  </p>
                  <div className="pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.docx,.txt"
                          onChange={handleFileSelect}
                        />
                        Choose File
                      </label>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <FileText className="w-8 h-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Paste Resume Text</h3>
            <Textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here..."
              className="min-h-[120px] resize-none"
              disabled={!!selectedFile}
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
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleParse} disabled={isLoading || (!selectedFile && !resumeText.trim())}>
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
      </DialogContent>
    </Dialog>
  );
};