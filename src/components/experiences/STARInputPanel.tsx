import { useState, useEffect, useRef } from "react";
import { Save, FileText, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Experience, STARFormData } from "@/types/experience";
import { useToast } from "@/hooks/use-toast";

interface STARInputPanelProps {
  experience: Experience | null;
  onSave: (data: STARFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  isLoading?: boolean;
}

export const STARInputPanel = ({
  experience,
  onSave,
  onDelete,
  isLoading = false,
}: STARInputPanelProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<STARFormData>({
    title: "",
    situation: "",
    task: "",
    action: "",
    result: "",
    keywords: [],
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const situationRef = useRef<HTMLInputElement>(null);

  // Focus situation input when new experience is created
  useEffect(() => {
    if (experience && !experience.title && !experience.situation) {
      setTimeout(() => situationRef.current?.focus(), 100);
    }
  }, [experience]);

  // Update form when experience changes
  useEffect(() => {
    if (experience) {
      setFormData({
        title: experience.title || "",
        situation: experience.situation || "",
        task: experience.task || "",
        action: experience.action || "",
        result: experience.result || "",
        keywords: experience.keywords || [],
      });
      setHasUnsavedChanges(false);
    } else {
      // Clear form when no experience selected
      setFormData({
        title: "",
        situation: "",
        task: "",
        action: "",
        result: "",
        keywords: [],
      });
      setHasUnsavedChanges(false);
    }
  }, [experience]);

  // Debounced autosave
  useEffect(() => {
    if (hasUnsavedChanges && experience) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        setIsAutosaving(true);
        try {
          await onSave(formData);
          setHasUnsavedChanges(false);
          setLastSaved(new Date());
        } catch (error) {
          console.error("Autosave failed:", error);
        } finally {
          setIsAutosaving(false);
        }
      }, 1000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, formData, experience, onSave]);

  const handleInputChange = (field: keyof STARFormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleKeywordsChange = (value: string) => {
    const keywords = value.split(",").map(k => k.trim()).filter(k => k.length > 0);
    handleInputChange("keywords", keywords);
  };

  const handleSave = async () => {
    if (!experience) return;
    
    try {
      await onSave(formData);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      toast({
        title: "Experience saved",
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Failed to save your changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !experience) return;
    
    try {
      await onDelete();
      toast({
        title: "Experience deleted",
        description: "The experience has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete the experience. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!experience) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Select an experience to edit, or create a new one</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Experience Details
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isAutosaving && (
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            )}
            {lastSaved && !isAutosaving && !hasUnsavedChanges && (
              <span className="flex items-center gap-1 text-green-600">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
            {hasUnsavedChanges && !isAutosaving && (
              <span className="text-orange-600">Unsaved changes</span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange("title", e.target.value)}
            placeholder="Brief title for this experience"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="situation">Situation</Label>
          <Input
            id="situation"
            ref={situationRef}
            value={formData.situation}
            onChange={(e) => handleInputChange("situation", e.target.value)}
            placeholder="Describe the context or challenge you faced"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task">Task</Label>
          <Input
            id="task"
            value={formData.task}
            onChange={(e) => handleInputChange("task", e.target.value)}
            placeholder="What was your specific responsibility or goal?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="action">Action</Label>
          <Textarea
            id="action"
            value={formData.action}
            onChange={(e) => handleInputChange("action", e.target.value)}
            placeholder="Detail the specific steps you took to address the situation"
            className="min-h-[120px] resize-y"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="result">Result</Label>
          <Textarea
            id="result"
            value={formData.result}
            onChange={(e) => handleInputChange("result", e.target.value)}
            placeholder="What was the outcome? Include metrics if possible"
            className="min-h-[60px] resize-y"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="keywords">Keywords/Tools</Label>
          <input
            id="keywords"
            type="text"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            value={formData.keywords.join(", ")}
            onChange={(e) => {
              console.log("Raw input onChange triggered:", e.target.value);
              handleKeywordsChange(e.target.value);
            }}
            onKeyDown={(e) => {
              console.log("Raw KeyDown event:", e.key, e.code, "Prevented:", e.defaultPrevented);
            }}
            placeholder="SQL, A/B Testing, Amplitude (comma separated)"
            autoComplete="off"
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isLoading || !hasUnsavedChanges}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              Save
            </Button>
          </div>
          
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isLoading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};