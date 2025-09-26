import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Copy, Check, AlertTriangle, TrendingUp, Target, Info, Key, Tag,
  CheckCircle, XCircle, Clock, Users, Brain, Code, Building, Award,
  FileText, MessageSquare, Lightbulb, ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getStoredJobKeyPhrases, getStoredJobDescription } from "@/utils/jobAnalysis";
import { useJobAnalysis } from "@/hooks/useJobAnalysis";

// Updated interface to match the improved edge function response
interface AnalysisResult {
  jobRequirements?: Array<{
    requirement: string;
    type: "requirement" | "responsibility";
    category: string;
    importance: string;
    context?: string;
  }>;
  extractedKeywords?: {
    requirements: {
      technical: string[];
      education: string[];
      industry: string[];
      soft_skills: string[];
      seniority: string[];
    };
    responsibilities: {
      daily_tasks: string[];
      outcomes: string[];
      management: string[];
    };
  };
  bulletKeywords?: {
    technical: string[];
    actionVerbs: string[];
    industry: string[];
    metrics: string[];
    behavioral: string[];
    qualifications: string[];
  };
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
  relevantExperiences?: Array<{
    id: string;
    roleTitle: string;
    companyName: string;
    title: string;
    situation?: string;
    task?: string;
    action: string;
    result: string;
    tags: string[];
    relevanceScore: number;
    matchingRequirements: string[];
    strengthOfEvidence: string;
  }>;
  experiencesByRole?: {
    [key: string]: {
      company: string;
      roleTitle: string;
      specialty: string | null;
      experiences: Array<{
        id: string;
        title: string;
        relevanceScore: number;
        strengthOfEvidence: string;
      }>;
    };
  };
  fitAssessment?: {
    overallScore: number;
    fitLevel: string;
    categoryBreakdown?: {
      technical: { score: number; possible: number; achieved: number };
      experience_level: { score: number; possible: number; achieved: number };
      domain_industry: { score: number; possible: number; achieved: number };
      leadership_impact: { score: number; possible: number; achieved: number };
      cultural_soft: { score: number; possible: number; achieved: number };
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
  recommendations?: {
    forCandidate?: string[];
    forInterview?: string[];
    forApplication?: string[];
  };
  summary?: string;
  actionPlan?: {
    priority: string;
    focus?: string;
    criticalGaps?: string[];
    suggestedActions?: string[];
    readyForApplication: boolean;
    readyForBulletGeneration: boolean;
    experienceIds?: string[];
  };
}

export const JobAnalysisResult = () => {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [keyPhrases, setKeyPhrases] = useState<any[]>([]);
  const [jobDescription, setJobDescription] = useState<string>("");
  const [copiedSection, setCopiedSection] = useState<string>("");
  const [activeSection, setActiveSection] = useState<string>("executive");
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
        setAnalysisResult(parsed);
      } catch (error) {
        console.error('Failed to parse stored analysis result:', error);
      }
    }

    setKeyPhrases(getStoredJobKeyPhrases());
    setJobDescription(getStoredJobDescription());
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

  const currentScore = analysisResult.fitAssessment?.overallScore || 0;
  const fitLevel = analysisResult.fitAssessment?.fitLevel || 'Unknown';
  const criticalGaps = analysisResult.unmatchedRequirements?.filter(req => 
    req.importance === 'critical' && req.type === 'requirement'
  ) || [];

  // Navigation sections
  const sections = [
    { id: "executive", label: "Executive Summary", icon: TrendingUp },
    { id: "detailed", label: "Detailed Analysis", icon: Target },
    { id: "gaps", label: "Gap Analysis", icon: AlertTriangle },
    { id: "resume", label: "Resume Optimization", icon: FileText },
    { id: "next-steps", label: "Next Steps", icon: ArrowRight },
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'technical': return Code;
      case 'experience_level': return Clock;
      case 'domain_industry': return Building;
      case 'leadership_impact': return Users;
      case 'cultural_soft': return Brain;
      default: return Target;
    }
  };

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
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Job Fit Analysis Report</h1>
          <p className="text-muted-foreground">
            Comprehensive assessment of your professional experience match
          </p>
        </div>
      </div>

      {/* Section Navigation */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveSection(section.id)}
                  className="flex items-center gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* EXECUTIVE SUMMARY SECTION */}
      {activeSection === "executive" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Overall Score */}
                <div className={`border rounded-lg p-4 ${getScoreColorBg(currentScore)}`}>
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${getScoreColor(currentScore)} mb-2`}>
                      {currentScore}%
                    </div>
                    <div className="text-lg font-semibold mb-1">{fitLevel} Match</div>
                    <div className="text-sm text-muted-foreground">Overall Job Fit</div>
                  </div>
                </div>

                {/* Application Status */}
                <div className={`border rounded-lg p-4 ${
                  analysisResult.actionPlan?.readyForApplication 
                    ? 'bg-green-100 border-green-200' 
                    : 'bg-amber-100 border-amber-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {analysisResult.actionPlan?.readyForApplication ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600" />
                    )}
                    <span className="font-semibold">
                      {analysisResult.actionPlan?.readyForApplication ? 'Application Ready' : 'Needs Improvement'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {analysisResult.actionPlan?.readyForBulletGeneration 
                      ? 'Ready for resume bullet generation' 
                      : 'Profile strengthening recommended'
                    }
                  </p>
                </div>

                {/* Critical Issues */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={`w-5 h-5 ${criticalGaps.length > 0 ? 'text-red-600' : 'text-green-600'}`} />
                    <span className="font-semibold">Critical Requirements</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {criticalGaps.length === 0 
                      ? 'All critical requirements met' 
                      : `${criticalGaps.length} critical gap(s) identified`
                    }
                  </p>
                </div>
              </div>

              {/* Top Strengths */}
              {analysisResult.strengths && analysisResult.strengths.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3 text-green-600">Key Strengths</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {analysisResult.strengths.slice(0, 4).map((strength, index) => (
                      <div key={index} className="flex items-start gap-2 bg-green-50 p-3 rounded-lg">
                        <Check className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                        <span className="text-sm">{strength}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {analysisResult.summary && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Assessment Summary</h3>
                  <p className="text-sm text-muted-foreground">{analysisResult.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* DETAILED ANALYSIS SECTION */}
      {activeSection === "detailed" && (
        <div className="space-y-6">
          {/* Category Breakdown */}
          {analysisResult.fitAssessment?.categoryBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle>Category Performance Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analysisResult.fitAssessment.categoryBreakdown).map(([category, data]) => {
                    const Icon = getCategoryIcon(category);
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span className="font-medium capitalize">
                              {category.replace('_', ' ')}
                            </span>
                          </div>
                          <span className={`font-semibold ${getScoreColor(data.score)}`}>
                            {data.score}%
                          </span>
                        </div>
                        <Progress value={data.score} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          Achieved: {data.achieved} / {data.possible} points
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Requirements vs Experiences Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Matched Requirements */}
            {analysisResult.matchedRequirements && analysisResult.matchedRequirements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Matched Requirements ({analysisResult.matchedRequirements.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {analysisResult.matchedRequirements.slice(0, 10).map((match, index) => (
                      <div key={index} className="border border-green-200 rounded-lg p-3 bg-green-50">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                            {match.jobRequirement}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {match.evidenceStrength}
                          </Badge>
                        </div>
                        <p className="text-sm text-green-800">
                          <span className="font-medium">{match.experienceContext}:</span> {match.experienceEvidence}
                        </p>
                      </div>
                    ))}
                    {analysisResult.matchedRequirements.length > 10 && (
                      <p className="text-sm text-muted-foreground text-center">
                        ... and {analysisResult.matchedRequirements.length - 10} more matches
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Relevant Experiences */}
            {analysisResult.relevantExperiences && analysisResult.relevantExperiences.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Top Relevant Experiences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {analysisResult.relevantExperiences
                      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
                      .slice(0, 5)
                      .map((exp, index) => (
                      <div key={exp.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{exp.title}</h4>
                            <p className="text-xs text-muted-foreground">
                              {exp.companyName} - {exp.roleTitle}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {exp.relevanceScore}% match
                          </Badge>
                        </div>
                        <div className="text-xs space-y-1">
                          <p><span className="font-medium">Action:</span> {exp.action}</p>
                          <p><span className="font-medium">Result:</span> {exp.result}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* GAP ANALYSIS SECTION */}
      {activeSection === "gaps" && (
        <div className="space-y-6">
          {/* Critical Gaps */}
          {criticalGaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Critical Gaps (Deal-breakers)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {criticalGaps.map((gap, index) => (
                    <div key={index} className="border border-red-200 rounded-lg p-3 bg-red-50">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                          {gap.requirement}
                        </Badge>
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-xs" variant="secondary">
                          {gap.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-red-800 font-medium">{gap.suggestionToImprove}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Weak Evidence Areas */}
          {analysisResult.weakEvidenceExperiences && analysisResult.weakEvidenceExperiences.experiences.length > 0 && (
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
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs" variant="secondary">
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

          {/* Other Missing Requirements */}
          {analysisResult.unmatchedRequirements && analysisResult.unmatchedRequirements.filter(req => req.importance !== 'critical' || req.type === 'responsibility').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysisResult.unmatchedRequirements
                    .filter(req => req.importance !== 'critical' || req.type === 'responsibility')
                    .slice(0, 8)
                    .map((gap, index) => (
                    <div key={index} className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                          {gap.requirement}
                        </Badge>
                        <div className="flex gap-1">
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs" variant="secondary">
                            {gap.importance}
                          </Badge>
                          <Badge className={gap.type === 'requirement' ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"} variant="outline">
                            {gap.type}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-amber-800">{gap.suggestionToImprove}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* RESUME OPTIMIZATION SECTION */}
      {activeSection === "resume" && (
        <div className="space-y-6">
          {/* Experience Grouping by Role */}
          {analysisResult.experiencesByRole && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Experiences Organized by Role
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analysisResult.experiencesByRole).map(([roleKey, roleData]) => (
                    <div key={roleKey} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{roleData.roleTitle}</h3>
                          <p className="text-sm text-muted-foreground">
                            {roleData.company} {roleData.specialty && `• ${roleData.specialty}`}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {roleData.experiences.length} experience{roleData.experiences.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {roleData.experiences.map((exp) => (
                          <div key={exp.id} className="text-sm p-2 bg-gray-50 rounded">
                            <div className="font-medium">{exp.title}</div>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {exp.relevanceScore}% relevant
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {exp.strengthOfEvidence}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resume Keywords */}
          {analysisResult.bulletKeywords && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    Resume Keywords & Phrases
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
                      <h4 className="font-semibold text-sm capitalize">
                        {category.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {(keywords as string[]).slice(0, 8).map((keyword: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
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
        </div>
      )}

      {/* NEXT STEPS SECTION */}
      {activeSection === "next-steps" && (
        <div className="space-y-6">
          {/* Action Plan */}
          {analysisResult.actionPlan && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="w-5 h-5" />
                  Action Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`border rounded-lg p-4 mb-4 ${
                  analysisResult.actionPlan.readyForApplication 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {analysisResult.actionPlan.readyForApplication ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600" />
                    )}
                    <h3 className={`font-semibold ${
                      analysisResult.actionPlan.readyForApplication 
                        ? 'text-green-800' 
                        : 'text-amber-800'
                    }`}>
                      Priority: {analysisResult.actionPlan.priority.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h3>
                  </div>
                  
                  {analysisResult.actionPlan.criticalGaps && analysisResult.actionPlan.criticalGaps.length > 0 && (
                    <div className="mt-3">
                      <h4 className="font-medium text-amber-800 mb-2">Critical gaps to address:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {analysisResult.actionPlan.criticalGaps.map((gap, index) => (
                          <div key={index} className="flex items-start gap-2 bg-red-100 p-2 rounded">
                            <XCircle className="w-4 h-4 mt-0.5 text-red-600 flex-shrink-0" />
                            <span className="text-sm text-red-800">{gap}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {analysisResult.actionPlan.readyForBulletGeneration && (
                    <div className="mt-3 p-3 bg-blue-100 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                          Ready for resume bullet generation
                        </span>
                      </div>
                      <p className="text-xs text-blue-700 mt-1">
                        Your profile meets the threshold for automated resume bullet creation.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations Grid */}
          {analysisResult.recommendations && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* For Candidate */}
              {analysisResult.recommendations.forCandidate && analysisResult.recommendations.forCandidate.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-blue-600 flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      For You
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analysisResult.recommendations.forCandidate.map((rec, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                          <ArrowRight className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                          <span className="text-sm">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* For Interview */}
              {analysisResult.recommendations.forInterview && analysisResult.recommendations.forInterview.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-purple-600 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Interview Prep
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analysisResult.recommendations.forInterview.map((rec, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg">
                          <ArrowRight className="w-4 h-4 mt-0.5 text-purple-600 flex-shrink-0" />
                          <span className="text-sm">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* For Application */}
              {analysisResult.recommendations.forApplication && analysisResult.recommendations.forApplication.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-600 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Application Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analysisResult.recommendations.forApplication.map((rec, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                          <ArrowRight className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                          <span className="text-sm">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Next Steps Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Immediate Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentScore < 60 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-semibold text-red-800 mb-2">Profile Strengthening Required</h4>
                    <div className="space-y-2 text-sm text-red-700">
                      <p>• Address critical gaps identified in the Gap Analysis section</p>
                      <p>• Add more detailed evidence to weak experiences</p>
                      <p>• Consider gaining experience in missing technical areas</p>
                      <p>• Re-analyze after profile improvements</p>
                    </div>
                  </div>
                ) : currentScore < 80 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-800 mb-2">Profile Optimization Recommended</h4>
                    <div className="space-y-2 text-sm text-amber-700">
                      <p>• Strengthen evidence in experiences marked as weak</p>
                      <p>• Address any critical requirements if present</p>
                      <p>• Enhance profile with quantified results</p>
                      <p>• Consider applying to similar roles while improving</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Ready to Apply</h4>
                    <div className="space-y-2 text-sm text-green-700">
                      <p>• Generate resume bullets using the Resume Optimization section</p>
                      <p>• Prepare for interviews using the Interview Prep recommendations</p>
                      <p>• Tailor your application using the Application Tips</p>
                      <p>• Highlight your key strengths from the Executive Summary</p>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button 
                    onClick={() => setActiveSection("resume")}
                    variant={analysisResult.actionPlan?.readyForBulletGeneration ? "default" : "secondary"}
                    size="sm"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Resume Keywords
                  </Button>
                  <Button 
                    onClick={() => setActiveSection("gaps")}
                    variant="outline" 
                    size="sm"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Review Gaps
                  </Button>
                  <Button 
                    onClick={() => navigate('/app/job-description')}
                    variant="outline" 
                    size="sm"
                  >
                    <Target className="w-4 h-4 mr-2" />
                    Analyze Another Job
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
