import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getStoredJobKeyPhrases, getStoredJobDescription } from "@/utils/jobAnalysis";

interface AnalysisResult {
  jobRequirements?: Array<{
    requirement: string;
    category: string;
    importance: string;
    context?: string;
  }>;
  extractedJobPhrases?: Array<{
    phrase: string;
    category: string;
    importance: string;
  }>;
  matchedPhrases?: Array<{
    jobPhrase: string;
    experienceMatch: string;
    experienceContext: string;
    matchType: string;
    evidenceStrength: string;
  }>;
  unmatchedPhrases?: Array<{
    phrase: string;
    category: string;
    importance: string;
    reason: string;
  }>;
  overallScore?: number;
  fitLevel?: string;
  strengths?: string[];
  gaps?: string[];
  recommendations?: string[];
  summary?: string;
}

export const JobAnalysisResult = () => {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [keyPhrases, setKeyPhrases] = useState<any[]>([]);
  const [jobDescription, setJobDescription] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Load stored analysis result from localStorage
    const stored = localStorage.getItem('jobAnalysisResult');
    if (stored) {
      try {
        setAnalysisResult(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to parse stored analysis result:', error);
      }
    }

    // Load stored key phrases and job description
    setKeyPhrases(getStoredJobKeyPhrases());
    setJobDescription(getStoredJobDescription());
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'technical': return "bg-blue-100 text-blue-800";
      case 'soft_skill': return "bg-green-100 text-green-800";
      case 'industry': return "bg-purple-100 text-purple-800";
      case 'qualification': return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Job Fit Analysis Results</h1>
      </div>

      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className={`text-4xl font-bold ${getScoreColor(analysisResult.overallScore || 0)}`}>
              {analysisResult.overallScore || 0}%
            </div>
            <div>
              <div className="text-lg font-semibold">{analysisResult.fitLevel || 'Unknown'} Match</div>
              <div className="text-sm text-muted-foreground">Job Fit Level</div>
            </div>
          </div>
          {(analysisResult.overallScore || 0) < 80 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Resume points will only be generated for scores 80% and higher. Please provide more details on experiences if you believe you are a good fit.
              </p>
            </div>
          )}
          {analysisResult.summary && (
            <p className="text-muted-foreground">{analysisResult.summary}</p>
          )}
        </CardContent>
      </Card>

      {/* Job Requirements */}
      {analysisResult.jobRequirements && analysisResult.jobRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Key Requirements from Job Description
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(analysisResult.jobRequirements?.map((req: any) => req.requirement).join(', ') || '')}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysisResult.jobRequirements.map((req: any, index: number) => (
                <Badge
                  key={index}
                  className={getCategoryColor(req.category)}
                  variant="secondary"
                >
                  {req.requirement}
                  <span className="ml-1 text-xs">({req.importance})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matched Phrases */}
      {analysisResult.matchedPhrases && analysisResult.matchedPhrases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Matched Key Phrases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysisResult.matchedPhrases.map((match, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {match.jobPhrase}
                    </Badge>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {match.matchType}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {match.evidenceStrength}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Found in {match.experienceContext}:</span> {match.experienceMatch}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unmatched Phrases */}
      {analysisResult.unmatchedPhrases && analysisResult.unmatchedPhrases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">Missing Key Phrases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysisResult.unmatchedPhrases.map((unmatched, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">
                      {unmatched.phrase}
                    </Badge>
                    <div className="flex gap-2">
                      <Badge className={getCategoryColor(unmatched.category)} variant="secondary">
                        {unmatched.category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {unmatched.importance}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{unmatched.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths */}
      {analysisResult.strengths && analysisResult.strengths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Key Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysisResult.strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                  <span className="text-sm">{strength}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Gaps and Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {analysisResult.gaps && analysisResult.gaps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-orange-600">Areas to Address</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysisResult.gaps.map((gap, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {gap}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600">Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysisResult.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {rec}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};