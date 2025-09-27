import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Check, AlertTriangle, TrendingUp, Target, Info, Key, Tag, Zap, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getStoredJobKeyPhrases, getStoredJobDescription } from "@/utils/jobAnalysis";

// Updated interface to match the streamlined edge function response
interface AnalysisResult {
  jobKeywords?: Array<{
    keyword: string;
    type: "requirement" | "responsibility";
    category: string;
    importance: string;
    matchStatus: "matched" | "unmatched" | "transformable";
    matchEvidence?: string;
  }>;
  matchedRequirements?: Array<{
    jobRequirement: string;
    type: "requirement" | "responsibility";
    experienceEvidence: string;
    experienceContext: string;
    matchType: string;
    evidenceStrength: string;
  }>;
  unmatchedRequirements?: Array<{
    requirement: string;
    type: "requirement" | "responsibility";
    category: string;
    importance: string;
    suggestionToImprove: string;
  }>;
  fitAssessment?: {
    overallScore: number;
    fitLevel: string;
    categoryBreakdown?: {
      technical: { score: number; confidence: string };
      experience_level: { score: number; confidence: string };
      domain_industry: { score: number; confidence: string };
      business_impact: { score: number; confidence: string };
    };
    scoreBreakdown?: any;
  };
  weakEvidenceExperiences?: {
    message: string;
    experiences: Array<{
      experienceIdentifier: string;
      requirement: string;
      currentEvidence: string;
      evidenceStrength: string;
    }>;
    suggestion: string;
  };
  strengths?: string[];
  gaps?: string[];
  experienceImprovementPlan?: Array<{
    missingRequirement: string;
    priority: string;
    suggestedActions: string[];
    timeframe: string;
  }>;
  summary?: string;
  actionPlan?: {
    priority: string;
    focus?: string;
    criticalGaps?: string[];
    readyForApplication: boolean;
    readyForBulletGeneration: boolean;
    nextSteps?: string[];
  };
}

export const JobAnalysisResult = () => {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [keyPhrases, setKeyPhrases] = useState<any[]>([]);
  const [jobDescription, setJobDescription] = useState<string>("");
  const [copiedSection, setCopiedSection] = useState<string>("");
  const [showLegend, setShowLegend] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Load stored analysis result from localStorage
    const stored = localStorage.getItem('jobAnalysisResult');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('Loaded analysis result:', parsed);
        setAnalysisResult(parsed);
      } catch (error) {
        console.error('Failed to parse stored analysis result:', error);
      }
    }

    // Load stored key phrases and job description
    setKeyPhrases(getStoredJobKeyPhrases());
    setJobDescription(getStoredJobDescription());
  }, []);

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

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'technical': return "bg-blue-100 text-blue-800 border-blue-200";
      case 'experience_level': return "bg-purple-100 text-purple-800 border-purple-200";
      case 'domain_industry': return "bg-green-100 text-green-800 border-green-200";
      case 'business_impact': return "bg-orange-100 text-orange-800 border-orange-200";
      case 'soft_skill': return "bg-pink-100 text-pink-800 border-pink-200";
      case 'industry': return "bg-green-100 text-green-800 border-green-200";
      case 'qualification': return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'critical': return "bg-red-100 text-red-800 border-red-200";
      case 'high': return "bg-orange-100 text-orange-800 border-orange-200";
      case 'medium': return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'low': return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getEvidenceColor = (strength: string) => {
    switch (strength) {
      case 'quantified': return "bg-green-100 text-green-800 border-green-200";
      case 'demonstrated': return "bg-blue-100 text-blue-800 border-blue-200";
      case 'mentioned': return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'implied': return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'requirement': return "bg-red-50 text-red-700 border-red-200";
      case 'responsibility': return "bg-blue-50 text-blue-700 border-blue-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getMatchStatusColor = (status: string) => {
    switch (status) {
      case 'matched': return "bg-green-100 text-green-800 border-green-200";
      case 'transformable': return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'unmatched': return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const currentScore = analysisResult.fitAssessment?.overallScore || 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Job Fit Analysis Results</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLegend(!showLegend)}
        >
          <Info className="w-4 h-4 mr-2" />
          Legend
        </Button>
      </div>

      {/* Legend */}
      {showLegend && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Color Legend
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Categories</h4>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-blue-100 text-blue-800 border-blue-200" variant="secondary">Technical Skills</Badge>
                <Badge className="bg-purple-100 text-purple-800 border-purple-200" variant="secondary">Experience Level</Badge>
                <Badge className="bg-green-100 text-green-800 border-green-200" variant="secondary">Domain/Industry</Badge>
                <Badge className="bg-orange-100 text-orange-800 border-orange-200" variant="secondary">Business Impact</Badge>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Importance Levels</h4>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-red-100 text-red-800 border-red-200" variant="secondary">Critical (Deal-breaker)</Badge>
                <Badge className="bg-orange-100 text-orange-800 border-orange-200" variant="secondary">High (Strongly preferred)</Badge>
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200" variant="secondary">Medium (Nice to have)</Badge>
                <Badge className="bg-green-100 text-green-800 border-green-200" variant="secondary">Low (Bonus)</Badge>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Match Status</h4>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-100 text-green-800 border-green-200" variant="secondary">Matched (You have this)</Badge>
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200" variant="secondary">Transformable (Can adapt from experience)</Badge>
                <Badge className="bg-red-100 text-red-800 border-red-200" variant="secondary">Unmatched (Missing)</Badge>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Requirement Types</h4>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-red-50 text-red-700 border-red-200" variant="secondary">Requirement (Must-have)</Badge>
                <Badge className="bg-blue-50 text-blue-700 border-blue-200" variant="secondary">Responsibility (Nice-to-have)</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Overall Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className={`text-4xl font-bold ${getScoreColor(currentScore)}`}>
              {currentScore}%
            </div>
            <div>
              <div className="text-lg font-semibold">{analysisResult.fitAssessment?.fitLevel || 'Unknown'} Match</div>
              <div className="text-sm text-muted-foreground">Job Fit Level</div>
            </div>
          </div>
          
          {/* Bullet Generation Status - Fixed Logic */}
          <div className={`border rounded-lg p-3 mb-4 ${
            currentScore >= 80 
              ? 'bg-green-50 border-green-200' 
              : 'bg-amber-50 border-amber-200'
          }`}>
            <p className={`text-sm font-medium ${
              currentScore >= 80
                ? 'text-green-800' 
                : 'text-amber-800'
            }`}>
              {currentScore >= 80
                ? '✓ Ready for resume bullet generation'
                : 'Resume points will only be generated for scores 80% and higher. Please provide more details on experiences if you believe you are a good fit.'
              }
            </p>
          </div>

          {analysisResult.summary && (
            <p className="text-muted-foreground">{analysisResult.summary}</p>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {analysisResult.fitAssessment?.categoryBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(analysisResult.fitAssessment.categoryBreakdown).map(([category, data]) => (
                <div key={category} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getCategoryColor(category)} variant="secondary">
                      {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                    <span className={`font-semibold ${getScoreColor(data.score)}`}>
                      {data.score}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Confidence: {data.confidence}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Keywords with Match Status - PRIMARY FEATURE */}
      {analysisResult.jobKeywords && analysisResult.jobKeywords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Job Keywords & Match Analysis
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(
                  analysisResult.jobKeywords?.map((kw: any) => kw.keyword).join(', ') || '',
                  'keywords'
                )}
              >
                {copiedSection === 'keywords' ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                Copy All Keywords
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Requirements */}
              <div>
                <h4 className="font-semibold mb-3 text-red-700 flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Requirements (Must-haves)
                </h4>
                <div className="space-y-2">
                  {analysisResult.jobKeywords
                    .filter(kw => kw.type === 'requirement')
                    .map((keyword, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 border rounded">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getCategoryColor(keyword.category)} variant="secondary">
                            {keyword.keyword}
                          </Badge>
                          <Badge className={getImportanceColor(keyword.importance)} variant="outline" className="text-xs">
                            {keyword.importance}
                          </Badge>
                          <Badge className={getMatchStatusColor(keyword.matchStatus)} variant="outline" className="text-xs">
                            {keyword.matchStatus}
                          </Badge>
                        </div>
                        {keyword.matchEvidence && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Evidence:</span> {keyword.matchEvidence}
                          </p>
                        )}
                      </div>
                      {keyword.matchStatus === 'matched' && <Check className="w-4 h-4 text-green-600 mt-1" />}
                      {keyword.matchStatus === 'transformable' && <Zap className="w-4 h-4 text-yellow-600 mt-1" />}
                      {keyword.matchStatus === 'unmatched' && <X className="w-4 h-4 text-red-600 mt-1" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Responsibilities */}
              <div>
                <h4 className="font-semibold mb-3 text-blue-700 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Responsibilities (Nice-to-haves)
                </h4>
                <div className="space-y-2">
                  {analysisResult.jobKeywords
                    .filter(kw => kw.type === 'responsibility')
                    .map((keyword, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 border rounded">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getCategoryColor(keyword.category)} variant="secondary">
                            {keyword.keyword}
                          </Badge>
                          <Badge className={getImportanceColor(keyword.importance)} variant="outline" className="text-xs">
                            {keyword.importance}
                          </Badge>
                          <Badge className={getMatchStatusColor(keyword.matchStatus)} variant="outline" className="text-xs">
                            {keyword.matchStatus}
                          </Badge>
                        </div>
                        {keyword.matchEvidence && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Evidence:</span> {keyword.matchEvidence}
                          </p>
                        )}
                      </div>
                      {keyword.matchStatus === 'matched' && <Check className="w-4 h-4 text-green-600 mt-1" />}
                      {keyword.matchStatus === 'transformable' && <Zap className="w-4 h-4 text-yellow-600 mt-1" />}
                      {keyword.matchStatus === 'unmatched' && <X className="w-4 h-4 text-red-600 mt-1" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weak Evidence Experiences - Only show if score < 80% */}
      {currentScore < 80 && analysisResult.weakEvidenceExperiences && analysisResult.weakEvidenceExperiences.experiences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Experiences Needing Stronger Evidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 mb-2">
                {analysisResult.weakEvidenceExperiences.message}
              </p>
              <p className="text-xs text-amber-700">
                {analysisResult.weakEvidenceExperiences.suggestion}
              </p>
            </div>
            <div className="space-y-3">
              {analysisResult.weakEvidenceExperiences.experiences.map((weak, index) => (
                <div key={index} className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 mb-2">
                        {weak.requirement}
                      </Badge>
                      <div className="text-sm font-medium text-amber-900">
                        {weak.experienceIdentifier}
                      </div>
                    </div>
                    <Badge className={getEvidenceColor(weak.evidenceStrength)} variant="secondary" className="text-xs">
                      {weak.evidenceStrength}
                    </Badge>
                  </div>
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">Current evidence:</span> {weak.currentEvidence}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unmatched Requirements - Focus on gaps for improvement */}
      {analysisResult.unmatchedRequirements && analysisResult.unmatchedRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Missing Requirements - Action Needed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Critical Requirements First */}
              {analysisResult.unmatchedRequirements.some(req => req.importance === 'critical') && (
                <div>
                  <h4 className="font-semibold mb-3 text-red-700">🚨 Critical Requirements (Deal-breakers)</h4>
                  <div className="space-y-3">
                    {analysisResult.unmatchedRequirements
                      .filter(req => req.importance === 'critical')
                      .map((unmatched, index) => (
                      <div key={index} className="border-2 border-red-300 rounded-lg p-3 bg-red-50">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                            {unmatched.requirement}
                          </Badge>
                          <div className="flex gap-2">
                            <Badge className={getCategoryColor(unmatched.category)} variant="secondary">
                              {unmatched.category}
                            </Badge>
                            <Badge className={getTypeColor(unmatched.type)} variant="outline" className="text-xs">
                              {unmatched.type}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-red-800 font-medium">{unmatched.suggestionToImprove}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* High Priority Requirements */}
              {analysisResult.unmatchedRequirements.some(req => req.importance === 'high') && (
                <div>
                  <h4 className="font-semibold mb-3 text-orange-700">⚡ High Priority Requirements</h4>
                  <div className="space-y-3">
                    {analysisResult.unmatchedRequirements
                      .filter(req => req.importance === 'high')
                      .map((unmatched, index) => (
                      <div key={index} className="border border-orange-300 rounded-lg p-3 bg-orange-50">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                            {unmatched.requirement}
                          </Badge>
                          <div className="flex gap-2">
                            <Badge className={getCategoryColor(unmatched.category)} variant="secondary">
                              {unmatched.category}
                            </Badge>
                            <Badge className={getTypeColor(unmatched.type)} variant="outline" className="text-xs">
                              {unmatched.type}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-orange-800">{unmatched.suggestionToImprove}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Requirements */}
              {analysisResult.unmatchedRequirements.some(req => !['critical', 'high'].includes(req.importance)) && (
                <div>
                  <h4 className="font-semibold mb-3 text-yellow-700">📝 Other Missing Requirements</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysisResult.unmatchedRequirements
                      .filter(req => !['critical', 'high'].includes(req.importance))
                      .map((unmatched, index) => (
                      <div key={index} className="border border-yellow-300 rounded-lg p-3 bg-yellow-50">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            {unmatched.requirement}
                          </Badge>
                          <Badge className={getImportanceColor(unmatched.importance)} variant="secondary" className="text-xs">
                            {unmatched.importance}
                          </Badge>
                        </div>
                        <p className="text-xs text-yellow-800">{unmatched.suggestionToImprove}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Experience Improvement Plan - Action-focused */}
      {analysisResult.experienceImprovementPlan && analysisResult.experienceImprovementPlan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <Zap className="w-5 h-5" />
              Your Experience Building Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResult.experienceImprovementPlan.map((plan, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={getImportanceColor(plan.priority)} variant="secondary">
                      {plan.missingRequirement}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Priority: {plan.priority}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {plan.timeframe}
                    </Badge>
                  </div>
                  <div>
                    <h5 className="font-medium mb-2">Action Steps:</h5>
                    <ul className="space-y-1">
                      {plan.suggestedActions.map((action, actionIndex) => (
                        <li key={actionIndex} className="text-sm flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths and Gaps - Concise view */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {analysisResult.strengths && analysisResult.strengths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">✅ Key Strengths</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysisResult.strengths.slice(0, 5).map((strength, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                    <span className="text-sm">{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {analysisResult.gaps && analysisResult.gaps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">❌ Critical Gaps</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysisResult.gaps.slice(0, 5).map((gap, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <X className="w-4 h-4 mt-0.5 text-red-600 flex-shrink-0" />
                    <span className="text-sm">{gap}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Plan - Next Steps */}
      {analysisResult.actionPlan && (
        <Card>
          <CardHeader>
            <CardTitle>🎯 Your Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className={`border rounded-lg p-4 ${
                analysisResult.actionPlan.readyForApplication 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {analysisResult.actionPlan.readyForApplication ? (
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  ) : (
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  )}
                  <p className={`font-medium ${
                    analysisResult.actionPlan.readyForApplication 
                      ? 'text-green-800' 
                      : 'text-amber-800'
                  }`}>
                    Status: {analysisResult.actionPlan.priority.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>

                {analysisResult.actionPlan.nextSteps && analysisResult.actionPlan.nextSteps.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Immediate Actions:</h4>
                    <ul className="space-y-1">
                      {analysisResult.actionPlan.nextSteps.map((step, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className={analysisResult.actionPlan?.readyForApplication ? 'text-green-600' : 'text-amber-600'}>
                            {index + 1}.
                          </span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysisResult.actionPlan.criticalGaps && analysisResult.actionPlan.criticalGaps.length > 0 && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm font-medium text-red-800 mb-1">Critical gaps to address first:</p>
                    <ul className="text-sm text-red-700">
                      {analysisResult.actionPlan.criticalGaps.map((gap, index) => (
                        <li key={index}>• {gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
