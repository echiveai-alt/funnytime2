import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Edit3, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

// Types for the component
interface HighScoreData {
  score: number;
  fitLevel: string;
  message: string;
  missingKeywords: string[];
  companies: Company[];
}

interface LowScoreData {
  score: number;
  fitLevel: string;
  message: string;
  subMessage: string;
  analysis: {
    strengths: string[];
    gaps: string[];
    recommendations: string[];
    keywordMatch: {
      matchedKeywords: string[];
      missingKeywords: string[];
    };
  };
}

interface Company {
  id: string;
  name: string;
  dateRange: string;
  roles: Role[];
}

interface Role {
  id: string;
  title: string;
  dateRange: string;
  bulletPoints: string[];
}

// Mock data for demonstration
const mockHighScoreData: HighScoreData = {
  score: 92,
  fitLevel: "Excellent",
  message: "Your experiences align well with the job requirements",
  missingKeywords: ["machine learning", "kubernetes", "devops"],
  companies: [
    {
      id: "1",
      name: "TechCorp Inc.",
      dateRange: "2022 - Present",
      roles: [
        {
          id: "1",
          title: "Senior Software Engineer",
          dateRange: "2023 - Present",
          bulletPoints: [
            "• Developed and maintained scalable web applications serving 100K+ daily users using React and Node.js",
            "• Led cross-functional team of 5 engineers to deliver critical features on time, resulting in 25% improvement in user engagement",
            "• Architected microservices infrastructure that reduced system downtime by 40% and improved response times by 60%",
            "• Mentored junior developers through code reviews and technical discussions, improving team productivity by 30%"
          ]
        },
        {
          id: "2", 
          title: "Software Engineer",
          dateRange: "2022 - 2023",
          bulletPoints: [
            "• Implemented automated testing suite that increased code coverage from 60% to 95% and reduced bug reports by 50%",
            "• Collaborated with product managers to define technical requirements for new features, ensuring alignment with business goals",
            "• Optimized database queries and caching strategies, improving application performance by 45%"
          ]
        }
      ]
    },
    {
      id: "2",
      name: "StartupXYZ",
      dateRange: "2020 - 2022",
      roles: [
        {
          id: "3",
          title: "Full Stack Developer",
          dateRange: "2020 - 2022", 
          bulletPoints: [
            "• Built end-to-end web application from scratch using React, Express.js, and PostgreSQL, handling 10K+ concurrent users",
            "• Designed and implemented REST API with comprehensive documentation, reducing integration time for partners by 70%",
            "• Established CI/CD pipeline using GitHub Actions, reducing deployment time from 2 hours to 15 minutes"
          ]
        }
      ]
    }
  ]
};

const mockLowScoreData: LowScoreData = {
  score: 45,
  fitLevel: "Insufficient",
  message: "Unfortunately, the input experiences are not well aligned to the job description",
  subMessage: "Bullet points will not be created.",
  analysis: {
    strengths: [
      "Strong technical background in software development",
      "Good team collaboration experience"
    ],
    gaps: [
      "Missing required Python programming experience",
      "Lack of machine learning project experience",
      "No cloud infrastructure (AWS/Azure) experience",
      "Missing data analysis and visualization skills"
    ],
    recommendations: [
      "Add experiences showcasing Python development projects",
      "Include any machine learning or AI-related work",
      "Highlight cloud platform experience if available",
      "Consider taking courses in missing technical areas"
    ],
    keywordMatch: {
      matchedKeywords: ["javascript", "react", "database", "api"],
      missingKeywords: ["python", "machine learning", "aws", "tensorflow", "pandas"]
    }
  }
};

const ResumeBulletPoints = () => {
  const [isHighScore] = useState(false); // Toggle this for testing different states
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const data = isHighScore ? mockHighScoreData : mockLowScoreData;

  const copyToClipboard = async () => {
    if (!isHighScore || !('companies' in data)) return;
    
    let clipboardText = "";
    data.companies.forEach(company => {
      clipboardText += `${company.name} (${company.dateRange})\n\n`;
      company.roles.forEach(role => {
        clipboardText += `${role.title} (${role.dateRange})\n`;
        role.bulletPoints.forEach(bullet => {
          clipboardText += `${bullet}\n`;
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

  return (
    <main className="max-w-[1080px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Job Alignment Score and Resume Points
        </h1>
        <p className="text-lg text-muted-foreground">
          Based on your STAR experiences and target job description
        </p>
      </div>

      <Card className="shadow-soft border border-border/50 mb-8">
        <CardContent className="p-8">
          <ScoreIndicator score={data.score} fitLevel={data.fitLevel} isSuccess={isHighScore} />
        </CardContent>
      </Card>

      {isHighScore ? (
        <>
          {/* Missing Keywords Section */}
          {'missingKeywords' in data && data.missingKeywords && data.missingKeywords.length > 0 && (
            <Card className="shadow-soft border border-border/50 mb-8">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-foreground">
                  Keywords That Could Not Be Fit
                </CardTitle>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="flex flex-wrap gap-2">
                  {data.missingKeywords.map((keyword, index) => (
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
                {'companies' in data && data.companies.map((company) => (
                  <div key={company.id} className="bg-secondary/30 rounded-lg p-6">
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-foreground">
                        {company.name}
                      </h2>
                      <p className="text-muted-foreground">{company.dateRange}</p>
                    </div>
                    
                    <div className="space-y-6">
                      {company.roles.map((role) => (
                        <div key={role.id} className="bg-background rounded-md p-5 shadow-sm">
                          <div className="mb-4">
                            <h3 className="text-lg font-medium text-foreground">
                              {role.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">{role.dateRange}</p>
                          </div>
                          
                          <div className="space-y-3">
                            {role.bulletPoints.map((bullet, index) => (
                              <p key={index} className="text-foreground leading-relaxed">
                                {bullet}
                              </p>
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
                    {'analysis' in data && data.analysis.strengths?.map((strength: string, index: number) => (
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
                    {'analysis' in data && data.analysis.gaps?.map((gap: string, index: number) => (
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
                    {'analysis' in data && data.analysis.recommendations?.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">💡</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Keyword Match */}
                {'analysis' in data && data.analysis.keywordMatch && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Keyword Analysis</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-green-600 mb-2">Matched Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {'analysis' in data && data.analysis.keywordMatch.matchedKeywords?.map((keyword: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-orange-600 mb-2">Missing Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {'analysis' in data && data.analysis.keywordMatch.missingKeywords?.map((keyword: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
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
