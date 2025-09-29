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
          Job Alignment Analysis and Resume Bullets
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

      {isHighScore && analysisResult.resumeBullets ? (
        <>
          {/* Keywords Used */}
          {analysisResult.resumeBullets.keywordsUsed && analysisResult.resumeBullets.keywordsUsed.length > 0 && (
            <Card className="shadow-soft border border-border/50 mb-8">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Keywords Successfully Embedded ({analysisResult.resumeBullets.keywordsUsed.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="flex flex-wrap gap-2">
                  {analysisResult.resumeBullets.keywordsUsed.map((keyword, index) => (
                    <Badge key={index} variant="outline" className="px-3 py-1 bg-green-50 text-green-700">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Missing Keywords */}
          {analysisResult.resumeBullets.keywordsNotUsed && analysisResult.resumeBullets.keywordsNotUsed.length > 0 && (
            <Card className="shadow-soft border border-border/50 mb-8">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  Keywords That Could Not Be Embedded ({analysisResult.resumeBullets.keywordsNotUsed.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <p className="text-sm text-muted-foreground mb-3">
                  These keywords could not be naturally embedded based on your actual experience evidence.
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.resumeBullets.keywordsNotUsed.map((keyword, index) => (
                    <Badge key={index} variant="outline" className="px-3 py-1 bg-orange-50 text-orange-700">
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
                {analysisResult.resumeBullets.bulletOrganization.map((company, companyIndex) => (
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
                                    • Could not fit within requested width ({bullet.visualWidth} chars)
                                  </p>
                                )}
                                <p className={`leading-relaxed ${bullet.exceedsWidth ? 'text-orange-700 ml-2' : 'text-foreground'}`}>
                                  • {bullet.text}
                                </p>
                                {bullet.keywordsUsed && bullet.keywordsUsed.length > 0 && (
                                  <div className="ml-4 mt-1 flex flex-wrap gap-1">
                                    {bullet.keywordsUsed.map((kw: string, kwIndex: number) => (
                                      <Badge key={kwIndex} variant="secondary" className="text-xs">
                                        {kw}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
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
          {/* Low Score - Show Gaps */}
          <Card className="shadow-soft border border-border/50 mb-8">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Why Bullets Were Not Generated
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <p className="text-sm text-muted-foreground mb-4">
                Your job fit score is below the 80% threshold required for bullet generation. 
                Address the gaps below to improve your profile.
              </p>

              {analysisResult.criticalGaps && analysisResult.criticalGaps.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 text-red-600">Critical Missing Requirements</h3>
                  <div className="space-y-2">
                    {analysisResult.criticalGaps.map((gap: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 bg-red-50 p-3 rounded border border-red-200">
                        <span className="text-red-500 mt-1">✗</span>
                        <span className="text-red-800">{gap}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisResult.recommendations?.forCandidate && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-blue-600">Recommendations</h3>
                  <div className="space-y-2">
                    {analysisResult.recommendations.forCandidate.map((rec: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 bg-blue-50 p-3 rounded border border-blue-200">
                        <span className="text-blue-500 mt-1">💡</span>
                        <span className="text-blue-800">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              Add/Revise Experiences
            </Button>
          </div>
        </>
      )}
    </main>
  );
};

export default ResumeBulletPoints;
