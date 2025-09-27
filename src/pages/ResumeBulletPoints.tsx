import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Edit3, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ResumeBulletsResult } from "@/hooks/useResumeBullets";

// Types for the component
interface JobAnalysisResult {
  overallScore?: number;
  fitLevel?: string;
  strengths?: string[];
  gaps?: string[];
  recommendations?: string[];
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
}


const ResumeBulletPoints = () => {
  const [analysisResult, setAnalysisResult] = useState<JobAnalysisResult | null>(null);
  const [resumeBullets, setResumeBullets] = useState<ResumeBulletsResult | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Load analysis results and resume bullets from localStorage
    const analysisData = localStorage.getItem('jobAnalysisResult');
    const bulletsData = localStorage.getItem('resumeBullets');

    if (analysisData) {
      setAnalysisResult(JSON.parse(analysisData));
    }

    if (bulletsData) {
      setResumeBullets(JSON.parse(bulletsData));
    }
  }, []);

  const isHighScore = (analysisResult?.overallScore || 0) >= 80;

  const copyToClipboard = async () => {
    if (!isHighScore || !resumeBullets?.bulletOrganization) return;
    
    let clipboardText = "";
    resumeBullets.bulletOrganization.forEach(company => {
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
          <p className="text-sm text-red-500 mt-2 font-medium">Bullet points will not be created.</p>
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
          <p className="text-muted-foreground mb-6">Please complete a job analysis first.</p>
          <Button onClick={() => navigate('/app/job-description')}>
            Analyze New Job Description
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[1080px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Job Alignment Analysis and Fitted Experiences
        </h1>
        <p className="text-lg text-muted-foreground">
          Based on your professional experiences and target job description
        </p>
      </div>

      <Card className="shadow-soft border border-border/50 mb-8">
        <CardContent className="p-8">
          <ScoreIndicator 
            score={analysisResult.overallScore || 0} 
            fitLevel={analysisResult.fitLevel || 'Unknown'} 
            isSuccess={isHighScore} 
          />
        </CardContent>
      </Card>

      {isHighScore && resumeBullets ? (
        <>
          {/* Missing Keywords Section */}
          {resumeBullets.missingKeywords && resumeBullets.missingKeywords.length > 0 && (
            <Card className="shadow-soft border border-border/50 mb-8">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-foreground">
                  Keywords That Could Not Be Fit
                </CardTitle>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="flex flex-wrap gap-2">
                  {resumeBullets.missingKeywords.map((keyword, index) => (
                    <Badge key={index} variant="outline" className="px-3 py-1">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resume Bullet Points */}
          <Card className="shadow-soft border border-border/50 mb-8">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">
                Resume Bullet Points
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="space-y-8">
                {resumeBullets.bulletOrganization.map((company, companyIndex) => (
                  <div key={companyIndex} className="bg-secondary/30 rounded-lg p-6">
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-foreground">
                        {company.name}
                      </h2>
                    </div>
                    
                    <div className="space-y-6">
                      {company.roles.map((role, roleIndex) => (
                        <div key={roleIndex} className="bg-background rounded-md p-5 shadow-sm">
                          <div className="mb-4">
                            <h3 className="text-lg font-medium text-foreground">
                              {role.title}
                            </h3>
                          </div>
                          
                          <div className="space-y-3">
                            {role.bulletPoints.map((bullet, index) => (
                              <div key={index}>
                                {bullet.exceedsWidth && (
                                  <p className="text-orange-600 text-sm font-medium mb-1">
                                    • Could not fit within requested width
                                  </p>
                                )}
                                <p className={`leading-relaxed ${bullet.exceedsWidth ? 'text-orange-700 ml-2' : 'text-foreground'}`}>
                                  • {bullet.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={copyToClipboard}
              className="flex items-center gap-2"
              size="lg"
            >
              <Copy className="w-4 h-4" />
              Copy to Clipboard
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/app/experiences')}
              className="flex items-center gap-2"
              size="lg"
            >
              <Edit3 className="w-4 h-4" />
              Edit Experiences
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Low Score Analysis Section */}
          <Card className="shadow-soft border border-border/50 mb-8">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Job Fit Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="space-y-6">
                {/* Strengths */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-green-600">Strengths</h3>
                  <ul className="space-y-2">
                    {analysisResult.strengths?.map((strength: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Gaps */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-orange-600">Areas for Improvement</h3>
                  <ul className="space-y-2">
                    {analysisResult.gaps?.map((gap: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-orange-500 mt-1">△</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-blue-600">Recommendations</h3>
                  <ul className="space-y-2">
                    {analysisResult.recommendations?.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">💡</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Matched/Unmatched Phrases */}
                {(analysisResult.matchedPhrases || analysisResult.unmatchedPhrases) && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Phrase Analysis</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {analysisResult.matchedPhrases && (
                        <div>
                          <h4 className="font-medium text-green-600 mb-2">Matched Phrases</h4>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.matchedPhrases.map((phrase, index) => (
                              <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                                {phrase.jobPhrase}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysisResult.unmatchedPhrases && (
                        <div>
                          <h4 className="font-medium text-orange-600 mb-2">Unmatched Phrases</h4>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.unmatchedPhrases.map((phrase, index) => (
                              <span key={index} className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                                {phrase.phrase}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Button */}
          <div className="flex justify-center">
            <Button 
              onClick={() => navigate('/app/experiences')}
              className="flex items-center gap-2"
              size="lg"
            >
              <Edit3 className="w-4 h-4" />
              Revise Experiences
            </Button>
          </div>
        </>
      )}
    </main>
  );
};

export default ResumeBulletPoints;
