import { ApiKeyTest } from '@/components/ApiKeyTest';

const ApiKeyTestPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">API Key Configuration Test</h1>
        <p className="text-muted-foreground">
          Test the separate OpenAI API keys for your job analysis functions
        </p>
      </div>
      <ApiKeyTest />
    </div>
  );
};

export default ApiKeyTestPage;