import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Copy, Check, AlertTriangle, TrendingUp, Target, XCircle,
  CheckCircle, ArrowRight, Users, FileText, Lightbulb
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useJobAnalysis } from "@/hooks/useJobAnalysis";

// Unified interface matching the new backend response
interface UnifiedAnalysisResult {
  overallScore: number;
  fitLevel: string;
  isFit: boolean;
  jobRequirements: Array<{
    requirement: string;
    importance: string;
  }>;
  matchedRequirements: Array<{
    jobRequirement: string;
    experienceEvidence: string;
    experienceSource: string;
  }>;
  unmatchedRequirements: Array<{
    requirement: string;
    importance: string;
  }>;
  // Only if not fit
  criticalGaps?: string[];
  recommendations?: {
    forCandidate: string[];
  };
  // Only if fit
  bulletKeywords?: Record<string, string[]>;
  bulletPoints?: Record<string, any[]>;
  resumeBullets?: {
    bulletOrganization: any[];
    keywordsUsed: string[];
    keywordsNotUsed: string[];
  };
  actionPlan: {
    readyForApplication: boolean;
    readyForBulletGeneration: boolean;
    criticalGaps?: string[];
  };
}

export const JobAnalysisResult = () => {
  const [analysisResult, setAnalysisResult] = useState<UnifiedAnalysisResult | null>(null);
  const [copiedSection, setCopiedSection] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAnalyzing } = useJobAnalysis();

  useEffect(() => {
    if (isAnalyzing) {
      navigate('/app/job-description');
      return;
    }

    const stored = localStorage.getItem('jobAnalysisResult');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('Unified analysis result:', parsed);
        setAnalysisResult(parsed);
      } catch (error) {
        console.error('Failed to parse stored analysis result:', error);
      }
    }
  }, [isAnalyzing, navigate]);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(""), 2000);
      toast({
        title: "Copied to clipboard",
        description: "The content has been copied to your clipboard.",
      });
    });
  };

  if (!analysisResult) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No analysis results found.</p>
              <Button onClick={() => navigate('/app/job-description')}>
                Analyze a Job Description
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { overallScore, isFit, fitLevel } = analysisResult;
  const criticalGaps = analysisResult.criticalGaps || [];

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreColorBg = (score: number) => {
    if (score >= 80) return "bg-green-100 border-green-200";
    if (score >= 60) return "bg-yellow-100 border-yellow-200";
    return "bg-red-100 border-red-200";
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Job Fit Analysis Report</h1>
          <p className="text-muted-foreground">
            Assessment of your professional experience match
          </p>
        </div>
      </div>

      {/* Overall Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Overall Job Fit Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`border rounded-lg p-6 ${getScoreColorBg(overallScore)}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-4xl font-bold ${getScoreColor(overallScore)} mb-2`}>
                  {overallScore}%
                </div>
                <div className="text-lg font-semibold mb-1">{fitLevel} Match</div>
                <div className="text-sm text-muted-foreground">
                  {isFit ? 'Ready for bullet generation' : 'Profile improvement needed'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="font-medium">
                  {isFit ? 'Application Ready' : 'Needs Improvement'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resume Keywords (only if fit) */}
      {isFit && analysisResult.bulletKeywords && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Resume Keywords Available
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(
                  Object.values(analysisResult.bulletKeywords || {}).flat().join(', '),
                  'bulletKeywords'
                )}
              >
                {copiedSection === 'bulletKeywords' ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                Copy All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(analysisResult.bulletKeywords).map(([category, keywords]) => (
                <div key={category} className="space-y-2">
                  <h4 className="font-semibold text-sm capitalize text-green-600">
                    {category}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {(keywords as string[]).slice(0, 8).map((keyword: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-800">
                        {keyword}
                      </Badge>
                    ))}
                    {(keywords as string[]).length > 8 && (
                      <Badge variant="outline" className="text-xs">
                        +{(keywords as string[]).length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requirements Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Matched Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Matched Requirements ({analysisResult.matchedRequirements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {analysisResult.matchedRequirements.map((match, index) => (
                <div key={index} className="border border-green-200 rounded-lg p-3 bg-green-50">
                  <div className="mb-2">
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
                      {match.jobRequirement}
                    </Badge>
                  </div>
                  <p className="text-sm text-green-800">
                    <span className="font-medium">{match.experienceSource}:</span> {match.experienceEvidence}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Unmatched Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Missing Requirements ({analysisResult.unmatchedRequirements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {analysisResult.unmatchedRequirements.map((req, index) => (
                <div key={index} className="border border-red-200 rounded-lg p-3 bg-red-50">
                  <div className="flex items-start justify-between">
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs">
                      {req.requirement}
                    </Badge>
                    <Badge className={
                      req.importance === 'critical' 
                        ? "bg-red-100 text-red-800 border-red-200 text-xs" 
                        : "bg-orange-100 text-orange-800 border-orange-200 text-xs"
                    } variant="secondary">
                      {req.importance}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Gaps Warning */}
      {criticalGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Critical Missing Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 mb-3">
                These requirements are marked as critical and may prevent application success:
              </p>
              <div className="space-y-2">
                {criticalGaps.map((gap, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-sm text-red-800 font-medium">{gap}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Action Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            Recommended Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`border rounded-lg p-4 mb-6 ${
            isFit ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {isFit ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <h3 className={`font-semibold ${
                isFit ? 'text-green-800' : 'text-red-800'
              }`}>
                {isFit ? 'Ready for Application' : 'Profile Enhancement Required'}
              </h3>
            </div>

            {!isFit && criticalGaps.length > 0 && (
              <div className="mt-3">
                <h4 className="font-medium text-red-800 mb-2">Critical gaps to address:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {criticalGaps.map((gap, index) => (
                    <div key={index} className="flex items-start gap-2 bg-red-100 p-2 rounded">
                      <XCircle className="w-4 h-4 mt-0.5 text-red-600 flex-shrink-0" />
                      <span className="text-sm text-red-800">{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysisResult.recommendations?.forCandidate && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Recommended Actions:</h4>
                <div className="space-y-2">
                  {analysisResult.recommendations.forCandidate.map((action, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                      <span className="text-sm">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 justify-center">
            {isFit ? (
              <Button 
                onClick={() => navigate('/app/resume-bullets')}
                size="lg"
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                View Resume Bullets
              </Button>
            ) : (
              <Button 
                onClick={() => navigate('/app/experiences')}
                size="lg"
                variant="default"
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Add/Edit Experiences
              </Button>
            )}
            
            <Button 
              onClick={() => navigate('/app/job-description')}
              variant="outline" 
              size="lg"
            >
              <Target className="w-4 h-4 mr-2" />
              Analyze Another Job
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default JobAnalysisResult;
