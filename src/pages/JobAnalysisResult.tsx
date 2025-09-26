import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Check, AlertTriangle, TrendingUp, Target, Info, Key, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getStoredJobKeyPhrases, getStoredJobDescription } from "@/utils/jobAnalysis";

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
      experience: string[];
      education: string[];
      industry: string[];
      soft_skills: string[];
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
  fitAssessment?: {
    overallScore: number;
    fitLevel: string;
    categoryBreakdown?: {
      technical: { score: number; confidence: string };
      experience_level: { score: number; confidence: string };
      domain_industry: { score: number; confidence: string };
      leadership_impact: { score: number; confidence: string };
      cultural_soft: { score: number; confidence: string };
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
      case 'leadership_impact': return "bg-orange-100 text-orange-800 border-orange-200";
      case 'cultural_soft': return "bg-pink-100 text-pink-800 border-pink-200";
      case 'soft_skill': return "bg-green-100 text-green-800 border-green-200";
      case 'industry': return "bg-purple-100 text-purple-800 border-purple-200";
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
                <Badge className="bg-orange-100 text-orange-800 border-orange-200" variant="secondary">Leadership/Impact</Badge>
                <Badge className="bg-pink-100 text-pink-800 border-pink-200" variant="secondary">Cultural/Soft Skills</Badge>
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
              <h4 className="font-semibold mb-2">Evidence Strength</h4>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-100 text-green-800 border-green-200" variant="secondary">Quantified (Has metrics)</Badge>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200" variant="secondary">Demonstrated (Clear examples)</Badge>
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200" variant="secondary">Mentioned (Basic indication)</Badge>
                <Badge className="bg-gray-100 text-gray-800 border-gray-200" variant="secondary">Implied (Inferred)</Badge>
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
          
          {/* Fixed Action Plan Status - Correct logic for bullet generation readiness */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Extracted Keywords - NEW SECTION */}
      {analysisResult.extractedKeywords && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Extracted Keywords
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-red-700">Requirements (Must-haves)</h4>
              <div className="space-y-2">
                {Object.entries(analysisResult.extractedKeywords.requirements).map(([category, keywords]) => (
                  <div key={category}>
                    <p className="text-sm font-medium text-muted-foreground mb-1 capitalize">
                      {category.replace('_', ' ')}:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {keywords.map((keyword: string, index: number) => (
                        <Badge key={index} className="bg-red-50 text-red-700 border-red-200 text-xs" variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-blue-700">Responsibilities (Nice-to-haves)</h4>
              <div className="space-y-2">
                {Object.entries(analysisResult.extractedKeywords.responsibilities).map(([category, keywords]) => (
                  <div key={category}>
                    <p className="text-sm font-medium text-muted-foreground mb-1 capitalize">
                      {category.replace('_', ' ')}:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {keywords.map((keyword: string, index: number) => (
                        <Badge key={index} className="bg-blue-50 text-blue-700 border-blue-200 text-xs" variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Requirements with Type Differentiation */}
      {analysisResult.jobRequirements && analysisResult.jobRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Key Requirements & Responsibilities from Job Description
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(
                  analysisResult.jobRequirements?.map((req: any) => req.requirement).join(', ') || '',
                  'requirements'
                )}
              >
                {copiedSection === 'requirements' ? (
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
              {/* Separate Requirements and Responsibilities */}
              <div>
                <h4 className="font-semibold mb-2 text-red-700">Requirements (Must-haves)</h4>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.jobRequirements
                    .filter(req => req.type === 'requirement')
                    .map((req: any, index: number) => (
                    <div key={index} className="flex items-center gap-1">
                      <Badge className={getCategoryColor(req.category)} variant="secondary">
                        {req.requirement}
                      </Badge>
                      <Badge className={`${getImportanceColor(req.importance)} text-xs`} variant="outline">
                        {req.importance}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-blue-700">Responsibilities (Nice-to-haves)</h4>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.jobRequirements
                    .filter(req => req.type === 'responsibility')
                    .map((req: any, index: number) => (
                    <div key={index} className="flex items-center gap-1">
                      <Badge className={getCategoryColor(req.category)} variant="secondary">
                        {req.requirement}
                      </Badge>
                      <Badge className={`${getImportanceColor(req.importance)} text-xs`} variant="outline">
                        {req.importance}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weak Evidence Experiences - FIXED SECTION */}
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
                    <Badge className={`${getEvidenceColor(weak.evidenceStrength)} text-xs`} variant="secondary">
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

      {/* Matched Requirements */}
      {analysisResult.matchedRequirements && analysisResult.matchedRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Matched Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysisResult.matchedRequirements.map((match, index) => (
                <div key={index} className="border border-green-200 rounded-lg p-3 bg-green-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                        {match.jobRequirement}
                      </Badge>
                      <Badge className={getTypeColor(match.type)} variant="outline" className="text-xs">
                        {match.type}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {match.matchType}
                      </Badge>
                      <Badge className={`${getEvidenceColor(match.evidenceStrength)} text-xs`} variant="secondary">
                        {match.evidenceStrength}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-green-800">
                    <span className="font-medium">Found in {match.experienceContext}:</span> {match.experienceEvidence}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unmatched Requirements */}
      {analysisResult.unmatchedRequirements && analysisResult.unmatchedRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Missing Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Separate unmatched requirements and responsibilities */}
              <div>
                <h4 className="font-semibold mb-2 text-red-700">Missing Requirements (Critical)</h4>
                <div className="space-y-3">
                  {analysisResult.unmatchedRequirements
                    .filter(req => req.type === 'requirement')
                    .map((unmatched, index) => (
                    <div key={index} className="border border-red-200 rounded-lg p-3 bg-red-50">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                          {unmatched.requirement}
                        </Badge>
                        <div className="flex gap-2">
                          <Badge className={getCategoryColor(unmatched.category)} variant="secondary">
                            {unmatched.category}
                          </Badge>
                          <Badge className={`${getImportanceColor(unmatched.importance)} text-xs`} variant="secondary">
                            {unmatched.importance}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-red-800">{unmatched.suggestionToImprove}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {analysisResult.unmatchedRequirements.some(req => req.type === 'responsibility') && (
                <div>
                  <h4 className="font-semibold mb-2 text-blue-700">Missing Responsibilities (Nice-to-have)</h4>
                  <div className="space-y-3">
                    {analysisResult.unmatchedRequirements
                      .filter(req => req.type === 'responsibility')
                      .map((unmatched, index) => (
                      <div key={index} className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                            {unmatched.requirement}
                          </Badge>
                          <div className="flex gap-2">
                            <Badge className={getCategoryColor(unmatched.category)} variant="secondary">
                              {unmatched.category}
                            </Badge>
                            <Badge className={`${getImportanceColor(unmatched.importance)} text-xs`} variant="secondary">
                              {unmatched.importance}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-blue-800">{unmatched.suggestionToImprove}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bullet Keywords for Resume Generation */}
      {analysisResult.bulletKeywords && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Resume Keywords & Phrases
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
            <div className="space-y-3">
              {Object.entries(analysisResult.bulletKeywords).map(([category, keywords]) => (
                <div key={category}>
                  <p className="text-sm font-medium text-muted-foreground mb-2 capitalize">
                    {category.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(keywords as string[]).map((keyword: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Relevant Experiences */}
      {analysisResult.relevantExperiences && analysisResult.relevantExperiences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Most Relevant Experiences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResult.relevantExperiences
                .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
                .slice(0, 5) // Show top 5
                .map((exp, index) => (
                <div key={exp.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{exp.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {exp.companyName} - {exp.roleTitle} - {exp.title}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {exp.relevanceScore}% relevance
                      </Badge>
                      <Badge className={`${getEvidenceColor(exp.strengthOfEvidence)} text-xs`} variant="secondary">
                        {exp.strengthOfEvidence}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {exp.situation && (
                      <p><span className="font-medium">Situation:</span> {exp.situation}</p>
                    )}
                    {exp.task && (
                      <p><span className="font-medium">Task:</span> {exp.task}</p>
                    )}
                    <p><span className="font-medium">Action:</span> {exp.action}</p>
                    <p><span className="font-medium">Result:</span> {exp.result}</p>
                  </div>
                  
                  {exp.matchingRequirements.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-1">Matches requirements:</p>
                      <div className="flex flex-wrap gap-1">
                        {exp.matchingRequirements.slice(0, 3).map((req, reqIndex) => (
                          <Badge key={reqIndex} variant="outline" className="text-xs">
                            {req}
                          </Badge>
                        ))}
                        {exp.matchingRequirements.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{exp.matchingRequirements.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths and Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>

      {/* Recommendations */}
      {analysisResult.recommendations && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {analysisResult.recommendations.forCandidate && analysisResult.recommendations.forCandidate.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600 text-sm">For You</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysisResult.recommendations.forCandidate.map((rec, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {analysisResult.recommendations.forInterview && analysisResult.recommendations.forInterview.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-purple-600 text-sm">Interview Prep</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysisResult.recommendations.forInterview.map((rec, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {analysisResult.recommendations.forApplication && analysisResult.recommendations.forApplication.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600 text-sm">Application Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysisResult.recommendations.forApplication.map((rec, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Action Plan */}
      {analysisResult.actionPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className={`border rounded-lg p-3 ${
                analysisResult.actionPlan.readyForApplication 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <p className={`font-medium ${
                  analysisResult.actionPlan.readyForApplication 
                    ? 'text-green-800' 
                    : 'text-amber-800'
                }`}>
                  Priority: {analysisResult.actionPlan.priority.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
                {analysisResult.actionPlan.criticalGaps && analysisResult.actionPlan.criticalGaps.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-amber-800">Critical gaps to address:</p>
                    <ul className="text-sm text-amber-700 mt-1">
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
