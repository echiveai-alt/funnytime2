import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Edit3, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

// Types matching unified backend
interface UnifiedAnalysisResult {
  overallScore: number;
  fitLevel: string;
  isFit: boolean;
  resumeBullets?: {
    bulletOrganization: Array<{
      name: string;
      roles: Array<{
        title: string;
        bulletPoints: Array<{
          text: string;
          visualWidth: number;
          exceedsWidth: boolean;
          keywordsUsed: string[];
        }>;
      }>;
    }>;
    keywordsUsed: string[];
    keywordsNotUsed: string[];
  };
  criticalGaps?: string[];
  recommendations?: {
    forCandidate: string[];
  };
}

const ResumeBulletPoints = () => {
  const [analysisResult, setAnalysisResult] = useState<UnifiedAnalysisResult | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Load analysis results from localStorage
    const analysisData = localStorage.getItem('jobAnalysisResult');

    if (analysisData) {
      try {
        const parsed = JSON.parse(analysisData);
        console.log('Unified analysis result:', parsed);
        setAnalysisResult(parsed);
      } catch (error) {
        console.error('Failed to parse analysis result:', error);
      }
    }
  }, []);

  const isHighScore = (analysisResult?.overallScore || 0) >= 80;

  const copyToClipboard = async () => {
    if (!isHighScore || !analysisResult?.resumeBullets?.bulletOrganization) return;
    
    let clipboardText = "";
    analysisResult.resumeBullets.bulletOrganization.forEach(company => {
      clipboardText += `${company.name}\n\n`;
      company.roles.forEach(role => {
        clipboardText += `${role.title}\n`;
        role.bulletPoints.forEach(bullet => {
          if (bullet.exceedsWidth) {
            clipboardText += `• Could not fit within requested width\n${bullet.text}\n`;
          } else {
            clipboardText += `• ${bullet.text}\n`;
          }
        });
        clipboardText += "\n";
      });
    });

    try {
      await navigator.clipboard.writeText(clipboardText);
      toast({
        title: "Copied to clipboard",
        description: "Resume bullet points have been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard. Please try again.",
        variant: "destructive",
      });
    }
  };

  const ScoreIndicator = ({ score, fitLevel, isSuccess }: { score: number; fitLevel: string; isSuccess: boolean }) => (
    <div className={`flex items-center justify-between p-6 rounded-lg ${isSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
      <div>
        <h3 className={`text-xl font-semibold ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
          {isSuccess ? 'Excellent Match!' : 'Insufficient Match'}
        </h3>
        <p className={`text-sm ${isSuccess ? 'text-green-600' : 'text-red-600'} mt-1`}>
          {isSuccess ? 'Your experiences align well with the job requirements' : 'Unfortunately, the input experiences are not well aligned to the job description.'}
        </p>
        {!isSuccess && (
          <p className="text-sm text-red-500 mt-2 font-medium">Bullet points were not generated.</p>
        )}
      </div>
      <div className="flex flex-col items-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {score}%
        </div>
        <span className={`text-sm font-medium mt-1 ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
          {fitLevel}
        </span>
      </div>
    </div>
  );

  if (!analysisResult) {
    return (
      <main className="max-w-[1080px] mx-auto px-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Analysis Results Found</h1>
