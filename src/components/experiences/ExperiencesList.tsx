import { useState } from "react";
import { Plus, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExperienceCard } from "./ExperienceCard";
import { Experience } from "@/types/experience";

interface ExperiencesListProps {
  experiences: Experience[];
  selectedExperience: Experience | null;
  onSelectExperience: (experience: Experience) => void;
  onAddExperience: () => void;
  onEditExperience: (experience: Experience) => void;
  onDuplicateExperience: (experience: Experience) => void;
  onDeleteExperience: (experience: Experience) => void;
  isLoading?: boolean;
}

type SortOption = "newest" | "oldest" | "title";

export const ExperiencesList = ({
  experiences,
  selectedExperience,
  onSelectExperience,
  onAddExperience,
  onEditExperience,
  onDuplicateExperience,
  onDeleteExperience,
  isLoading = false,
}: ExperiencesListProps) => {
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const sortedExperiences = [...experiences].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "title":
        return (a.title || "").localeCompare(b.title || "");
      default:
        return 0;
    }
  });

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Experiences</CardTitle>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="title">By Title</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-3 overflow-hidden">
          {sortedExperiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No experiences yet
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Add your first STAR experience to get started with building your professional story.
              </p>
              <Button onClick={onAddExperience} disabled={isLoading}>
                <Plus className="w-4 h-4 mr-2" />
                Add Experience
              </Button>
            </div>
          ) : (
            <>
              <div className="pb-4 border-b">
                <Button 
                  onClick={onAddExperience} 
                  className="w-full" 
                  disabled={isLoading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Experience
                </Button>
              </div>
              
              <div className="space-y-3 overflow-y-auto flex-1 pr-2 pt-4">
                {sortedExperiences.map((experience) => (
                  <ExperienceCard
                    key={experience.id}
                    experience={experience}
                    isSelected={selectedExperience?.id === experience.id}
                    onClick={() => onSelectExperience(experience)}
                    onEdit={() => onEditExperience(experience)}
                    onDuplicate={() => onDuplicateExperience(experience)}
                    onDelete={() => onDeleteExperience(experience)}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};