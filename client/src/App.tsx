import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuthModal } from "@/components/auth/auth-modal";
import { MainLayout } from "@/components/layout/main-layout";
import { useState, useEffect } from "react";

// Pages
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Chat from "@/pages/chat";
import Lawyers from "@/pages/lawyers";
import Sessions from "@/pages/sessions";
import Knowledge from "@/pages/knowledge";
import Profile from "@/pages/profile";
import { About } from "@/pages/about";
import NotFound from "@/pages/not-found";
import "./index.css";

function AuthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/dashboard">
        <MainLayout title="Dashboard" subtitle="Welcome to your legal assistant">
          <Dashboard />
        </MainLayout>
      </Route>
      <Route path="/chat">
        <MainLayout title="AI Legal Chat" subtitle="Get instant legal assistance">
          <Chat />
        </MainLayout>
      </Route>
      <Route path="/lawyers">
        <MainLayout title="Lawyer Directory" subtitle="Find qualified legal professionals">
          <Lawyers />
        </MainLayout>
      </Route>
      <Route path="/sessions">
        <MainLayout title="Chat Sessions" subtitle="Manage your consultation history">
          <Sessions />
        </MainLayout>
      </Route>
      <Route path="/knowledge">
        <MainLayout title="Legal Knowledge" subtitle="Explore Cameroon law resources">
          <Knowledge />
        </MainLayout>
      </Route>
      <Route path="/profile">
        <MainLayout title="Profile Settings" subtitle="Manage your account">
          <Profile />
        </MainLayout>
      </Route>
      <Route path="/">
        <MainLayout title="Dashboard" subtitle="Welcome to your legal assistant">
          <Dashboard />
        </MainLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setShowAuthModal(true);
    } else {
      setShowAuthModal(false);
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading LawHelp...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Switch>
        {isAuthenticated ? (
          <Route>
            <AuthenticatedRoutes />
          </Route>
        ) : (
          <>
            <Route path="/about" component={About} />
            <Route path="/" component={Landing} />
          </>
        )}
      </Switch>
      
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
