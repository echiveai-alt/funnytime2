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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/verify/error" element={<VerifyError />} />
            <Route path="/onboarding/education" element={<EducationOnboarding />} />
            <Route path="/app/experiences" element={<Experiences />} />
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
