import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";
import { applyMindSensePreferences } from "@/lib/preferences";

const Index = lazy(() => import("./pages/Index.tsx"));
const SignIn = lazy(() => import("./pages/SignIn.tsx"));
const SignUp = lazy(() => import("./pages/SignUp.tsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Features = lazy(() => import("./pages/Features.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const DepressionTest = lazy(() => import("./pages/DepressionTest.tsx"));
const Therapy = lazy(() => import("./pages/Therapy.tsx"));
const Mood = lazy(() => import("./pages/Mood.tsx"));
const History = lazy(() => import("./pages/History.tsx"));
const Resources = lazy(() => import("./pages/Resources.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const Logout = lazy(() => import("./pages/Logout.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const PreferenceBoot = () => {
  useEffect(() => {
    const applyPreferences = () => applyMindSensePreferences();
    applyPreferences();
    window.addEventListener("storage", applyPreferences);
    return () => window.removeEventListener("storage", applyPreferences);
  }, []);

  return null;
};

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
    Loading...
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PreferenceBoot />
          <ScrollToTop />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/features" element={<Features />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/test" element={<ProtectedRoute><DepressionTest /></ProtectedRoute>} />
              <Route path="/therapy" element={<ProtectedRoute><Therapy /></ProtectedRoute>} />
              <Route path="/mood" element={<ProtectedRoute><Mood /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
              <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/logout" element={<Logout />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
