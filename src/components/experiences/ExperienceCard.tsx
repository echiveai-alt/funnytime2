import { MoreVertical, Edit, Copy, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Experience } from "@/types/experience";

interface ExperienceCardProps {
  experience: Experience;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const ExperienceCard = ({
  experience,
  isSelected,
  onClick,
  onEdit,
  onDuplicate,
  onDelete,
}: ExperienceCardProps) => {
  return (
    <Card
      className={`p-4 cursor-pointer transition-all hover:shadow-soft ${
        isSelected 
          ? "border-primary bg-primary/5 shadow-soft" 
          : "border-border hover:border-border/80"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate mb-3">
            {experience.title || "Untitled Experience"}
          </h3>
          
          {experience.keywords && experience.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {experience.keywords.map((keyword, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="text-xs px-2 py-1"
                >
                  {keyword}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-muted"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
};