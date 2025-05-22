import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User, LogOut, Crown } from "lucide-react";

export function Header() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <h1 className="text-xl font-bold">AI Grader</h1>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <h1 className="text-xl font-bold">AI Grader</h1>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          {isAuthenticated ? (
            <>
              {/* Usage indicator */}
              {user?.usage && (
                <Card className="px-3 py-1">
                  <CardContent className="p-0 flex items-center space-x-2">
                    {user.subscriptionStatus === "active" ? (
                      <Badge variant="default" className="flex items-center space-x-1">
                        <Crown className="h-3 w-3" />
                        <span>Pro Plan</span>
                      </Badge>
                    ) : (
                      <Badge variant={user.usage.assessmentsUsed >= user.usage.assessmentsLimit ? "destructive" : "secondary"}>
                        {user.usage.assessmentsUsed}/{user.usage.assessmentsLimit} assessments
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* User avatar and info */}
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline-block">
                  {user?.firstName || user?.email || "User"}
                </span>
              </div>
              
              {/* Logout button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = "/api/logout"}
                className="flex items-center space-x-1"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </>
          ) : (
            <Button
              onClick={() => window.location.href = "/api/login"}
              className="flex items-center space-x-1"
            >
              <User className="h-4 w-4" />
              <span>Login</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}