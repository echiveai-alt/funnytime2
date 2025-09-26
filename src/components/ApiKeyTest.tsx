import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface ApiKeyResult {
  exists: boolean;
  length: number;
  prefix: string;
  apiTest?: string;
}

interface TestResults {
  analyzeJobFitKey: ApiKeyResult;
  generateResumeBulletsKey: ApiKeyResult;
  originalOpenaiKey: ApiKeyResult;
  timestamp: string;
}

export const ApiKeyTest = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<TestResults | null>(null);
  const { toast } = useToast();

  const testApiKeys = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-api-keys');
      
      if (error) {
        throw error;
      }

      setResults(data);
      toast({
        title: "API Key Test Complete",
        description: "Check the results below for each function's API key status.",
      });
    } catch (error) {
      console.error('API key test error:', error);
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Failed to test API keys",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (result: ApiKeyResult) => {
    if (!result.exists) return <XCircle className="h-4 w-4 text-destructive" />;
    if (result.apiTest === 'SUCCESS') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (result.apiTest?.startsWith('ERROR') || result.apiTest?.startsWith('FAILED')) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (result: ApiKeyResult) => {
    if (!result.exists) return <Badge variant="destructive">Missing</Badge>;
    if (result.apiTest === 'SUCCESS') return <Badge variant="default" className="bg-green-500">Working</Badge>;
    if (result.apiTest?.startsWith('ERROR') || result.apiTest?.startsWith('FAILED')) {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">Unknown</Badge>;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          API Key Configuration Test
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Test the separate OpenAI API keys for analyze-job-fit and generate-resume-bullets functions
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testApiKeys} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? "Testing API Keys..." : "Test API Keys"}
        </Button>

        {results && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Last tested: {new Date(results.timestamp).toLocaleString()}
            </div>
            
            <div className="grid gap-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(results.analyzeJobFitKey)}
                    <span className="font-medium">analyze-job-fit Function</span>
                  </div>
                  {getStatusBadge(results.analyzeJobFitKey)}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Key exists: {results.analyzeJobFitKey.exists ? 'Yes' : 'No'}</div>
                  {results.analyzeJobFitKey.exists && (
                    <>
                      <div>Key length: {results.analyzeJobFitKey.length} characters</div>
                      <div>Prefix: {results.analyzeJobFitKey.prefix}</div>
                      {results.analyzeJobFitKey.apiTest && (
                        <div className={`font-medium ${results.analyzeJobFitKey.apiTest === 'SUCCESS' ? 'text-green-600' : 'text-destructive'}`}>
                          API Test: {results.analyzeJobFitKey.apiTest}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(results.generateResumeBulletsKey)}
                    <span className="font-medium">generate-resume-bullets Function</span>
                  </div>
                  {getStatusBadge(results.generateResumeBulletsKey)}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Key exists: {results.generateResumeBulletsKey.exists ? 'Yes' : 'No'}</div>
                  {results.generateResumeBulletsKey.exists && (
                    <>
                      <div>Key length: {results.generateResumeBulletsKey.length} characters</div>
                      <div>Prefix: {results.generateResumeBulletsKey.prefix}</div>
                      {results.generateResumeBulletsKey.apiTest && (
                        <div className={`font-medium ${results.generateResumeBulletsKey.apiTest === 'SUCCESS' ? 'text-green-600' : 'text-destructive'}`}>
                          API Test: {results.generateResumeBulletsKey.apiTest}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(results.originalOpenaiKey)}
                    <span className="font-medium">Original OPENAI_API_KEY (for reference)</span>
                  </div>
                  {getStatusBadge(results.originalOpenaiKey)}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Key exists: {results.originalOpenaiKey.exists ? 'Yes' : 'No'}</div>
                  {results.originalOpenaiKey.exists && (
                    <>
                      <div>Key length: {results.originalOpenaiKey.length} characters</div>
                      <div>Prefix: {results.originalOpenaiKey.prefix}</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {results.analyzeJobFitKey.exists && results.generateResumeBulletsKey.exists && 
             results.analyzeJobFitKey.apiTest === 'SUCCESS' && results.generateResumeBulletsKey.apiTest === 'SUCCESS' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">All API keys are working correctly!</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  Both functions now have separate API keys for independent billing and usage tracking.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};