import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User, LogOut, Crown } from "lucide-react";
import { Link } from "wouter";

export function Header() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Grader Pro
            </span>
          </div>
        </Link>

        {/* Right side - Auth & User Info */}
        <div className="flex items-center space-x-3">
          {isLoading ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          ) : isAuthenticated ? (
            <>
              {/* Usage Badge */}
              {user?.usage && (
                <Badge 
                  variant={user.subscriptionStatus === "active" ? "default" : user.usage.assessmentsUsed >= user.usage.assessmentsLimit ? "destructive" : "secondary"}
                  className="hidden sm:flex items-center space-x-1"
                >
                  {user.subscriptionStatus === "active" ? (
                    <>
                      <Crown className="h-3 w-3" />
                      <span>Pro</span>
                    </>
                  ) : (
                    <span>{user.usage.assessmentsUsed}/{user.usage.assessmentsLimit}</span>
                  )}
                </Badge>
              )}

              {/* Upgrade Button */}
              {user?.subscriptionStatus !== "active" && (
                <Link href="/subscribe">
                  <Button variant="outline" size="sm" className="hidden sm:flex items-center space-x-1">
                    <Crown className="h-4 w-4" />
                    <span>Upgrade</span>
                  </Button>
                </Link>
              )}

              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium hidden md:block">
                  {user?.firstName || user?.email || "User"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = "/api/logout"}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <Button
              onClick={() => window.location.href = "/api/login"}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <User className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}