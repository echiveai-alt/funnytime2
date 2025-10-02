import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import AuthCallback from "./pages/AuthCallback";
import VerifyError from "./pages/VerifyError";
import EducationOnboarding from "./pages/EducationOnboarding";
import Experiences from "./pages/Experiences";
import JobDescription from "./pages/JobDescription";
import ResumeBulletPoints from "./pages/ResumeBulletPoints";
import { JobAnalysisResult } from "./pages/JobAnalysisResult";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";
import { AppLayout } from "@/components/AppLayout";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/verify/error" element={<VerifyError />} />
            <Route path="/onboarding/education" element={<EducationOnboarding />} />
            <Route path="/app/experiences" element={<AppLayout><Experiences /></AppLayout>} />
            <Route path="/app/job-description" element={<AppLayout><JobDescription /></AppLayout>} />
            <Route path="/app/job-analysis-result" element={<AppLayout><JobAnalysisResult /></AppLayout>} />
            <Route path="/app/resume-bullets" element={<AppLayout><ResumeBulletPoints /></AppLayout>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
          <Sonner />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
