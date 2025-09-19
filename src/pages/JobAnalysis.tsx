import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Brain, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useJobAnalysis } from '@/hooks/useJobAnalysis';
import { getStoredJobDescription } from '@/utils/jobAnalysis';

export const JobAnalysis = () => {
  const [jobDescription, setJobDescription] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();
  const { analyzeJobFit, isAnalyzing } = useJobAnalysis();

  useEffect(() => {
    // Load stored job description
    const stored = getStoredJobDescription();
    if (!stored) {
      navigate('/app/job-description');
      return;
    }
    setJobDescription(stored);
  }, [navigate]);

  useEffect(() => {
    if (isAnalyzing) {
      // Simulate progress
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 10;
        });
      }, 500);

      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [isAnalyzing]);

  const handleAnalyze = async () => {
    const result = await analyzeJobFit(jobDescription);
    if (result) {
      setProgress(100);
      setTimeout(() => {
        navigate('/app/analysis-results');
      }, 1000);
    }
  };

  if (!jobDescription) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No job description found</p>
              <Button onClick={() => navigate('/app/job-description')}>
                Add Job Description
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/app/job-description')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Job Fit Analysis</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analyze Your Job Match</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2">Job Description Preview:</p>
            <p className="text-sm line-clamp-3">{jobDescription}</p>
          </div>

          {isAnalyzing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Brain className="w-6 h-6 animate-pulse text-primary" />
                <div>
                  <p className="font-medium">Analyzing your job fit...</p>
                  <p className="text-sm text-muted-foreground">
                    Extracting key phrases and matching with your experiences
                  </p>
                </div>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                This may take 15-30 seconds
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">What this analysis will do:</h3>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>• Extract key phrases and requirements from the job description</li>
                  <li>• Match them comprehensively against all your experience content</li>
                  <li>• Identify matched and missing key phrases</li>
                  <li>• Provide recommendations for improving your application</li>
                  <li>• Store key phrases locally for creating tailored resume bullets</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleAnalyze} 
                className="w-full"
                size="lg"
              >
                <Brain className="w-5 h-5 mr-2" />
                Start Analysis
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};