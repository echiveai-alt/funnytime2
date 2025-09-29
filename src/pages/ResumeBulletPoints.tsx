import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Copy, Check, FileText, AlertTriangle, AlertCircle, CheckCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface BulletPoint {
  text: string;
  visualWidth: number;
  exceedsMax: boolean;
  belowMin: boolean;
  isWithinRange: boolean;
  experienceId: string;
  keywordsUsed: string[];
  relevanceScore?: number;
}

interface Role {
  title: string;
  bulletPoints: BulletPoint[];
}

interface BulletOrganization {
  name: string;
  roles: Role[];
}

interface ResumeBulletsData {
  bulletOrganization: BulletOrganization[];
  keywordsUsed: string[];
  keywordsNotUsed: string[];
  generatedFrom?: {
    totalExperiences: number;
    keywordMatchType: string;
    scoreThreshold: number;
    visualWidthRange?: {
      min: number;
      max: number;
      target: number;
    };
  };
}

export const ResumeBullets = () => {
  const [bulletsData, setBulletsData] = useState<ResumeBulletsData | null>(null);
  const [copiedSection, setCopiedSection] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem('resumeBullets');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('Resume bullets data:', parsed);
        setBulletsData(parsed);
      } catch (error) {
        console.error('Failed to parse stored resume bullets:', error);
      }
    }
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

  const copyAllBullets = () => {
    if (!bulletsData) return;
    
    const allText = bulletsData.bulletOrganization
      .map(company => 
        company.roles
          .map(role => 
            `${company.name} - ${role.title}\n` + 
            role.bulletPoints.map(bp => `• ${bp.text}`).join('\n')
          )
          .join('\n\n')
      )
      .join('\n\n');
    
    copyToClipboard(allText, 'all');
  };

  const getLengthBadge = (bullet: BulletPoint) => {
    if (bullet.isWithinRange) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
          <CheckCircle className="w-3 h-3 mr-1" />
          {bullet.visualWidth}
        </Badge>
      );
    } else if (bullet.exceedsMax) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {bullet.visualWidth} (too long)
        </Badge>
      );
    } else if (bullet.belowMin) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-xs">
          <AlertCircle className="w-3 h-3 mr-1" />
          {bullet.visualWidth} (too short)
        </Badge>
      );
    }
  };

  const getBulletBorderClass = (bullet: BulletPoint) => {
    if (bullet.isWithinRange) {
      return "border-green-200 bg-green-50/30";
    } else if (bullet.exceedsMax) {
      return "border-red-200 bg-red-50/30";
    } else if (bullet.belowMin) {
      return "border-yellow-200 bg-yellow-50/30";
    }
    return "border-gray-200";
  };

  if (!bulletsData) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No resume bullets found.</p>
              <Button onClick={() => navigate('/app/job-description')}>
                Generate Bullets
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const widthRange = bulletsData.generatedFrom?.visualWidthRange;
  const totalBullets = bulletsData.bulletOrganization.reduce(
    (sum, company) => sum + company.roles.reduce((roleSum, role) => roleSum + role.bulletPoints.length, 0),
    0
  );
  const bulletsInRange = bulletsData.bulletOrganization.reduce(
    (sum, company) => sum + company.roles.reduce(
      (roleSum, role) => roleSum + role.bulletPoints.filter(bp => bp.isWithinRange).length, 
      0
    ),
    0
  );
  const bulletsOverMax = bulletsData.bulletOrganization.reduce(
    (sum, company) => sum + company.roles.reduce(
      (roleSum, role) => roleSum + role.bulletPoints.filter(bp => bp.exceedsMax).length, 
      0
    ),
    0
  );
  const bulletsUnderMin = bulletsData.bulletOrganization.reduce(
    (sum, company) => sum + company.roles.reduce(
      (roleSum, role) => roleSum + role.bulletPoints.filter(bp => bp.belowMin).length, 
      0
    ),
    0
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Resume Bullets</h1>
          <p className="text-muted-foreground">
            Tailored bullet points for your target role
          </p>
        </div>
        <Button onClick={copyAllBullets}>
          {copiedSection === 'all' ? (
            <Check className="w-4 h-4 mr-2" />
          ) : (
            <Copy className="w-4 h-4 mr-2" />
          )}
          Copy All
        </Button>
      </div>

      {/* Length Summary Card */}
      {widthRange && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bullet Length Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-gray-700">{totalBullets}</div>
                <div className="text-sm text-muted-foreground">Total Bullets</div>
              </div>
              <div className="text-center p-4 border border-green-200 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{bulletsInRange}</div>
                <div className="text-sm text-green-600">
                  Within Range ({widthRange.min}-{widthRange.max})
                </div>
              </div>
              <div className="text-center p-4 border border-red-200 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{bulletsOverMax}</div>
                <div className="text-sm text-red-600">Too Long (&gt;{widthRange.max})</div>
              </div>
              <div className="text-center p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{bulletsUnderMin}</div>
                <div className="text-sm text-yellow-600">Too Short (&lt;{widthRange.min})</div>
              </div>
            </div>
            
            {(bulletsOverMax > 0 || bulletsUnderMin > 0) && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Bullets outside the ideal range are displayed with visual indicators. 
                  Consider editing overly long bullets for better readability on resumes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Keywords Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Keywords Summary</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(
                [...bulletsData.keywordsUsed, ...bulletsData.keywordsNotUsed].join(', '),
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-sm mb-2 text-green-600">
                Keywords Embedded ({bulletsData.keywordsUsed.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {bulletsData.keywordsUsed.map((keyword, index) => (
                  <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-800 border-green-300">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 text-amber-600">
                Keywords Not Embedded ({bulletsData.keywordsNotUsed.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {bulletsData.keywordsNotUsed.map((keyword, index) => (
                  <Badge key={index} variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Bullet Points by Company/Role */}
      {bulletsData.bulletOrganization.map((company, companyIndex) => (
        <Card key={companyIndex}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{company.name}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const text = company.roles
                    .map(role => 
                      `${company.name} - ${role.title}\n` + 
                      role.bulletPoints.map(bp => `• ${bp.text}`).join('\n')
                    )
                    .join('\n\n');
                  copyToClipboard(text, `company-${companyIndex}`);
                }}
              >
                {copiedSection === `company-${companyIndex}` ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                Copy Company
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {company.roles.map((role, roleIndex) => (
              <div key={roleIndex}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-700">{role.title}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const text = role.bulletPoints.map(bp => `• ${bp.text}`).join('\n');
                      copyToClipboard(text, `role-${companyIndex}-${roleIndex}`);
                    }}
                  >
                    {copiedSection === `role-${companyIndex}-${roleIndex}` ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    Copy Role
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {role.bulletPoints.map((bullet, bulletIndex) => (
                    <div
                      key={bulletIndex}
                      className={`border rounded-lg p-4 ${getBulletBorderClass(bullet)}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed">{bullet.text}</p>
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
                      
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {getLengthBadge(bullet)}
                        {bullet.keywordsUsed.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {bullet.keywordsUsed.slice(0, 5).map((keyword, kwIndex) => (
                              <Badge key={kwIndex} variant="secondary" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                            {bullet.keywordsUsed.length > 5 && (
                              <Badge variant="secondary" className="text-xs">
                                +{bullet.keywordsUsed.length - 5} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Generation Info */}
      {bulletsData.generatedFrom && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Generation Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Experiences:</span>
                <div className="font-medium">{bulletsData.generatedFrom.totalExperiences}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Match Type:</span>
                <div className="font-medium capitalize">{bulletsData.generatedFrom.keywordMatchType}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Score Threshold:</span>
                <div className="font-medium">{bulletsData.generatedFrom.scoreThreshold}%</div>
              </div>
              {widthRange && (
                <div>
                  <span className="text-muted-foreground">Target Width:</span>
                  <div className="font-medium">{widthRange.min}-{widthRange.max} ({widthRange.target})</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResumeBullets;
