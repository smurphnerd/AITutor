import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  Clock, 
  Star, 
  TrendingUp,
  BookOpen,
  Target,
  Zap,
  Crown,
  ArrowRight,
  Users
} from "lucide-react";

interface FileUpload {
  id: string;
  name: string;
  type: 'rubric' | 'submission';
}

interface GradingResult {
  id: string;
  submissionId: string;
  submissionName: string;
  totalScore: number;
  maxPossibleScore: number;
  overallFeedback: string;
  status: 'pass' | 'fail' | 'pending';
  sectionFeedback: {
    [sectionName: string]: {
      score: number;
      maxScore: number;
      feedback: string;
      strengths: string[];
      improvements: string[];
    };
  };
  createdAt: string;
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [rubricFiles, setRubricFiles] = useState<FileUpload[]>([]);
  const [submissionFiles, setSubmissionFiles] = useState<FileUpload[]>([]);
  const [rubricComment, setRubricComment] = useState('');
  const [submissionComment, setSubmissionComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [gradingResults, setGradingResults] = useState<GradingResult[]>([]);
  const [activeResultTab, setActiveResultTab] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const rubricInputRef = useRef<HTMLInputElement>(null);
  const submissionInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList, type: 'rubric' | 'submission') => {
    if (!isAuthenticated) {
      toast({
        title: "Please Sign In",
        description: "You need to sign in to upload files and use the grading service.",
        variant: "destructive",
      });
      return;
    }

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', type);

      try {
        const response = await fetch(`/api/upload/${type}`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          const newFile: FileUpload = {
            id: result.id,
            name: file.name,
            type,
          };

          if (type === 'rubric') {
            setRubricFiles(prev => [...prev, newFile]);
          } else {
            setSubmissionFiles(prev => [...prev, newFile]);
          }

          toast({
            title: "File Uploaded",
            description: `${file.name} uploaded successfully`,
          });
        }
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }
  };

  const startGrading = async () => {
    if (!rubricFiles.length || !submissionFiles.length) {
      toast({
        title: "Missing Files",
        description: "Please upload both rubric and submission files",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setCurrentStep(3);
    setProcessingProgress(0);

    try {
      const response = await apiRequest("POST", "/api/grade", {
        rubricIds: rubricFiles.map(f => f.id),
        submissionIds: submissionFiles.map(f => f.id),
        rubricComment,
        submissionComment,
      });

      const data = await response.json();
      
      // Poll for results using real backend status
      const pollForResults = async (jobId: string) => {
        const statusResponse = await apiRequest("GET", `/api/grade/${jobId}/status`);
        const status = await statusResponse.json();
        
        // Update progress from backend
        setProcessingProgress(status.progress || 0);
        
        if (status.status === 'complete') {
          setProcessingProgress(100);
          
          const resultsResponse = await apiRequest("GET", `/api/grade/${jobId}/results`);
          const results = await resultsResponse.json();
          
          setGradingResults(results);
          setActiveResultTab(results[0]?.submissionId || '');
          setIsProcessing(false);
        } else if (status.status === 'error') {
          setIsProcessing(false);
          toast({
            title: "Grading Failed",
            description: status.error || "An error occurred during grading",
            variant: "destructive",
          });
        } else {
          setTimeout(() => pollForResults(jobId), 2000);
        }
      };

      pollForResults(data.jobId);
    } catch (error) {
      setIsProcessing(false);
      toast({
        title: "Error",
        description: "Failed to start grading process",
        variant: "destructive",
      });
    }
  };

  const resetGrading = () => {
    setCurrentStep(1);
    setRubricFiles([]);
    setSubmissionFiles([]);
    setRubricComment('');
    setSubmissionComment('');
    setGradingResults([]);
    setActiveResultTab('');
    setProcessingProgress(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Hero Section */}
      {currentStep === 1 && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 -z-10" />
          <div className="container mx-auto px-4 py-16 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
                AI-Powered Grading
              </h1>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
                Upload your rubric and submissions for instant, detailed feedback. Our advanced AI provides consistent, 
                comprehensive grading with actionable insights.
              </p>
              
              {!isAuthenticated ? (
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                  <Button 
                    onClick={() => window.location.href = "/api/login"}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8"
                  >
                    Get Started Free
                  </Button>
                  <p className="text-sm text-slate-500">3 free assessments per month</p>
                </div>
              ) : (
                <div className="flex justify-center mb-12">
                  <Button 
                    onClick={() => setCurrentStep(2)}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8"
                  >
                    Start Grading
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              )}

              {/* Features Grid */}
              <div className="grid md:grid-cols-3 gap-8 mt-16">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="text-center">
                    <div className="mx-auto h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                      <Zap className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle>Lightning Fast</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Grade assignments in seconds, not hours. Our AI processes submissions instantly.</p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="text-center">
                    <div className="mx-auto h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                      <Target className="h-6 w-6 text-purple-600" />
                    </div>
                    <CardTitle>Precise Feedback</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Get detailed, section-by-section analysis with specific improvement suggestions.</p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="text-center">
                    <div className="mx-auto h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                      <Users className="h-6 w-6 text-green-600" />
                    </div>
                    <CardTitle>Consistent Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Eliminate grading bias with standardized, objective assessment criteria.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      {currentStep === 2 && (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Upload Your Files</h2>
              <p className="text-muted-foreground">Upload rubric files and student submissions to begin grading</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Rubric Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5" />
                    <span>Rubric Files</span>
                  </CardTitle>
                  <CardDescription>
                    Upload your grading rubric (PDF, DOCX, or TXT)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                    onClick={() => rubricInputRef.current?.click()}
                  >
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">Click to upload rubric files</p>
                  </div>
                  
                  <input
                    ref={rubricInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files, 'rubric')}
                  />

                  {rubricFiles.map((file) => (
                    <div key={file.id} className="flex items-center space-x-2 p-2 bg-muted rounded-lg">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                  ))}

                  <div className="space-y-2">
                    <Label htmlFor="rubric-comment">Additional Context (Optional)</Label>
                    <Textarea
                      id="rubric-comment"
                      placeholder="Provide any additional context about the rubric or grading criteria..."
                      value={rubricComment}
                      onChange={(e) => setRubricComment(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Submission Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Student Submissions</span>
                  </CardTitle>
                  <CardDescription>
                    Upload student assignment submissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                    onClick={() => submissionInputRef.current?.click()}
                  >
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">Click to upload submission files</p>
                  </div>
                  
                  <input
                    ref={submissionInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files, 'submission')}
                  />

                  {submissionFiles.map((file) => (
                    <div key={file.id} className="flex items-center space-x-2 p-2 bg-muted rounded-lg">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                  ))}

                  <div className="space-y-2">
                    <Label htmlFor="submission-comment">Additional Context (Optional)</Label>
                    <Textarea
                      id="submission-comment"
                      placeholder="Any special instructions or context for these submissions..."
                      value={submissionComment}
                      onChange={(e) => setSubmissionComment(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center mt-8 space-x-4">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button 
                onClick={startGrading}
                disabled={!rubricFiles.length || !submissionFiles.length}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Start Grading
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Processing & Results */}
      {currentStep === 3 && (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {isProcessing ? (
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center space-x-2">
                    <Clock className="h-5 w-5 animate-spin" />
                    <span>Processing Your Submissions</span>
                  </CardTitle>
                  <CardDescription>
                    Our AI is analyzing your files and generating detailed feedback
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={processingProgress} className="w-full" />
                  <p className="text-center text-sm text-muted-foreground">
                    {processingProgress}% Complete
                  </p>
                </CardContent>
              </Card>
            ) : gradingResults.length > 0 ? (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-2">Grading Complete!</h2>
                  <p className="text-muted-foreground">Review your detailed feedback below</p>
                </div>

                <Tabs value={activeResultTab} onValueChange={setActiveResultTab}>
                  <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {gradingResults.map((result) => (
                      <TabsTrigger key={result.submissionId} value={result.submissionId}>
                        {result.submissionName}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {gradingResults.map((result) => (
                    <TabsContent key={result.submissionId} value={result.submissionId}>
                      <Card>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle>{result.submissionName}</CardTitle>
                              <CardDescription className="flex items-center space-x-2 mt-2">
                                <Badge variant={result.status === 'pass' ? 'default' : 'destructive'}>
                                  {result.status.toUpperCase()}
                                </Badge>
                                <span>Score: {result.totalScore}/{result.maxPossibleScore}</span>
                              </CardDescription>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-primary">
                                {Math.round((result.totalScore / result.maxPossibleScore) * 100)}%
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div>
                            <h4 className="font-semibold mb-2">Overall Feedback</h4>
                            <p className="text-muted-foreground">{result.overallFeedback}</p>
                          </div>

                          <Accordion type="single" collapsible>
                            {Object.entries(result.sectionFeedback).map(([sectionName, feedback]) => (
                              <AccordionItem key={sectionName} value={sectionName}>
                                <AccordionTrigger className="text-left">
                                  <div className="flex justify-between items-center w-full mr-4">
                                    <span>{sectionName}</span>
                                    <Badge variant="outline">
                                      {feedback.score}/{feedback.maxScore}
                                    </Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4">
                                  <div>
                                    <h5 className="font-medium mb-2">Feedback</h5>
                                    <p className="text-sm text-muted-foreground">{feedback.feedback}</p>
                                  </div>
                                  
                                  {feedback.strengths.length > 0 && (
                                    <div>
                                      <h5 className="font-medium mb-2 text-green-600">Strengths</h5>
                                      <ul className="text-sm space-y-1">
                                        {feedback.strengths.map((strength, idx) => (
                                          <li key={idx} className="flex items-start space-x-2">
                                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>{strength}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {feedback.improvements.length > 0 && (
                                    <div>
                                      <h5 className="font-medium mb-2 text-orange-600">Areas for Improvement</h5>
                                      <ul className="text-sm space-y-1">
                                        {feedback.improvements.map((improvement, idx) => (
                                          <li key={idx} className="flex items-start space-x-2">
                                            <TrendingUp className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                            <span>{improvement}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  ))}
                </Tabs>

                <div className="flex justify-center">
                  <Button onClick={resetGrading} variant="outline">
                    Grade New Submissions
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}