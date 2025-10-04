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
  allKeywords: string[];
  bulletPoints?: Record<string, any[]>;
  keywordsUsed?: string[];
  keywordsNotUsed?: string[];
  resumeBullets?: {
    bulletOrganization: any[];
    keywordsUsed: string[];
    keywordsNotUsed: string[];
  };
  matchableKeywords?: string[];
  unmatchableKeywords?: string[];
  criticalGaps?: string[];
  recommendations?: {
    forCandidate: string[];
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

      {/* Keywords Analysis Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Job Description Keywords
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(
                analysisResult.allKeywords.join(', '),
                'allKeywords'
              )}
            >
              {copiedSection === 'allKeywords' ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              Copy All
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* All Keywords */}
            <div>
              <h4 className="font-semibold text-sm mb-2">
                All Extracted Keywords ({analysisResult.allKeywords.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {analysisResult.allKeywords.map((keyword, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>

            {/* For Fit Candidates: Show Used vs Not Used */}
            {isFit && analysisResult.keywordsUsed && (
              <>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-green-600">
                      Keywords Used in Bullets ({analysisResult.keywordsUsed.length})
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {analysisResult.keywordsUsed.map((keyword, index) => (
                        <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-800 border-green-300">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-amber-600">
                      Keywords Not Embedded ({analysisResult.keywordsNotUsed?.length || 0})
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {analysisResult.keywordsNotUsed?.map((keyword, index) => (
                        <Badge key={index} variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* For Non-Fit Candidates: Show matchable/unmatchable */}
            {!isFit && analysisResult.matchableKeywords && analysisResult.unmatchableKeywords && 
             (analysisResult.matchableKeywords.length > 0 || analysisResult.unmatchableKeywords.length > 0) && (
              <>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysisResult.matchableKeywords.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 text-green-600">
                        Matchable to Your Experience ({analysisResult.matchableKeywords.length})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {analysisResult.matchableKeywords.map((keyword, index) => (
                          <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-800 border-green-300">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysisResult.unmatchableKeywords.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 text-red-600">
                        Not Found in Experience ({analysisResult.unmatchableKeywords.length})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {analysisResult.unmatchableKeywords.map((keyword, index) => (
                          <Badge key={index} variant="outline" className="text-xs bg-red-50 text-red-800 border-red-300">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

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

      {/* Resume Bullets Section - FIXED VERSION */}
      {isFit && analysisResult.resumeBullets?.bulletOrganization && Array.isArray(analysisResult.resumeBullets.bulletOrganization) && analysisResult.resumeBullets.bulletOrganization.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generated Resume Bullets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {analysisResult.resumeBullets.bulletOrganization.map((company: any, companyIndex: number) => (
              <div key={companyIndex}>
                <div className="mb-4">
                  <h3 className="text-xl font-semibold mb-1">{company.name}</h3>
                </div>
                
                <div className="space-y-4">
                  {company.roles && Array.isArray(company.roles) && company.roles.map((role: any, roleIndex: number) => (
                    <div key={roleIndex} className="border rounded-lg p-4 bg-card">
                      <div className="mb-3">
                        <h4 className="text-lg font-semibold text-muted-foreground">{role.title}</h4>
                      </div>
                      
                      <div className="space-y-2">
                        {role.bulletPoints && Array.isArray(role.bulletPoints) && role.bulletPoints.map((bullet: any, bulletIndex: number) => (
                          <div
                            key={bulletIndex}
                            className="flex items-start gap-3 p-3 border rounded-lg bg-background hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1">
                              <p className="text-sm leading-relaxed">• {bullet.text}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(bullet.text, `bullet-${companyIndex}-${roleIndex}-${bulletIndex}`)}
                            >
                              {copiedSection === `bullet-${companyIndex}-${roleIndex}-${bulletIndex}` ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="mt-6 flex justify-between items-center border-t pt-4">
              <div className="text-sm text-muted-foreground">
                {analysisResult.resumeBullets.bulletOrganization.reduce((total, company) => 
                  total + (company.roles?.reduce((sum: number, role: any) => sum + (role.bulletPoints?.length || 0), 0) || 0), 0
                )} bullets generated across {analysisResult.resumeBullets.bulletOrganization.length} companies
              </div>
              <Button onClick={() => navigate('/app/resume-bullets')}>
                <ArrowRight className="w-4 h-4 mr-2" />
                View All Bullets
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations - Only for non-fit candidates */}
      {!isFit && analysisResult.recommendations?.forCandidate && analysisResult.recommendations.forCandidate.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Next Steps to Improve Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysisResult.recommendations.forCandidate.map((rec, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JobAnalysisResult;
