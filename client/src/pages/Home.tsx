import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileUpload } from '@/components/FileUpload';
import { uploadFile, deleteFile, getUploadedFiles, submitGradingJob, getGradingStatus, getGradingResults } from '@/lib/fileProcessing';
import { FileUploadResponse, GradingResult, ProcessingStatus } from '@/types';

export default function Home() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [rubricFiles, setRubricFiles] = useState<FileUploadResponse[]>([]);
  const [submissionFiles, setSubmissionFiles] = useState<FileUploadResponse[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    status: 'processing',
    progress: 0
  });
  const [gradingResults, setGradingResults] = useState<GradingResult[]>([]);
  const [activeResultTab, setActiveResultTab] = useState('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [rubricComment, setRubricComment] = useState('');
  const [submissionComment, setSubmissionComment] = useState('');
  
  useEffect(() => {
    // Load any existing uploaded files
    const loadFiles = async () => {
      try {
        const rubrics = await getUploadedFiles("rubric");
        const submissions = await getUploadedFiles("submission");
        
        setRubricFiles(rubrics);
        setSubmissionFiles(submissions);
        
        // Update max step based on uploaded files
        if (rubrics.length > 0) {
          setMaxStep(prev => Math.max(prev, 2));
        }
        if (submissions.length > 0) {
          setMaxStep(prev => Math.max(prev, 3));
        }
      } catch (error) {
        console.error("Failed to load files:", error);
      }
    };
    
    loadFiles();
  }, []);

  useEffect(() => {
    // Poll for job status if there's an active job
    if (currentJobId && isProcessing) {
      const pollInterval = setInterval(async () => {
        try {
          const status = await getGradingStatus(currentJobId);
          setProcessingStatus(status);
          
          if (status.status === 'complete') {
            setIsProcessing(false);
            clearInterval(pollInterval);
            const results = await getGradingResults(currentJobId);
            setGradingResults(results);
            
            if (results.length > 0) {
              setActiveResultTab(results[0].submissionId);
              setCurrentStep(3);
            }
          } else if (status.status === 'error') {
            setIsProcessing(false);
            clearInterval(pollInterval);
            toast({
              title: "Error Processing Submission",
              description: status.error || "An unknown error occurred",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error("Failed to poll job status:", error);
        }
      }, 1000);
      
      return () => clearInterval(pollInterval);
    }
  }, [currentJobId, isProcessing, toast]);
  
  const handleRubricUpload = async (files: File[]) => {
    try {
      const uploadPromises = files.map(file => uploadFile(file, "rubric"));
      const uploadedFiles = await Promise.all(uploadPromises);
      
      setRubricFiles(prev => [...prev, ...uploadedFiles]);
      setMaxStep(prev => Math.max(prev, 2));
      
      toast({
        title: "Files Uploaded",
        description: `Successfully uploaded ${files.length} rubric file(s)`,
      });
    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive"
      });
    }
  };
  
  const handleSubmissionUpload = async (files: File[]) => {
    try {
      const uploadPromises = files.map(file => uploadFile(file, "submission"));
      const uploadedFiles = await Promise.all(uploadPromises);
      
      setSubmissionFiles(prev => [...prev, ...uploadedFiles]);
      setMaxStep(prev => Math.max(prev, 3));
      
      toast({
        title: "Files Uploaded",
        description: `Successfully uploaded ${files.length} submission file(s)`,
      });
    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive"
      });
    }
  };
  
  const handleDeleteFile = async (id: string, fileType: 'rubric' | 'submission') => {
    try {
      await deleteFile(id);
      
      if (fileType === 'rubric') {
        setRubricFiles(prev => prev.filter(file => file.id !== id));
        if (rubricFiles.length <= 1) {
          setMaxStep(1);
          if (currentStep > 1) {
            setCurrentStep(1);
          }
        }
      } else {
        setSubmissionFiles(prev => prev.filter(file => file.id !== id));
        if (submissionFiles.length <= 1) {
          setMaxStep(2);
          if (currentStep > 2) {
            setCurrentStep(2);
          }
        }
      }
      
      toast({
        title: "File Deleted",
        description: "File has been successfully removed",
      });
    } catch (error) {
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete file",
        variant: "destructive"
      });
    }
  };
  
  const startGrading = async () => {
    if (rubricFiles.length === 0 || submissionFiles.length === 0) {
      toast({
        title: "Missing Files",
        description: "You need both rubric and submission files to start grading",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsProcessing(true);
      const request = {
        rubricIds: rubricFiles.map(file => file.id),
        submissionIds: submissionFiles.map(file => file.id)
      };
      
      const { jobId } = await submitGradingJob(request);
      setCurrentJobId(jobId);
      
      // Initial status update
      setProcessingStatus({
        status: 'processing',
        progress: 0,
        currentFile: submissionFiles[0]?.originalname,
        totalFiles: submissionFiles.length
      });
    } catch (error) {
      setIsProcessing(false);
      toast({
        title: "Failed to Start Grading",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  };
  
  const goToStep = (step: number) => {
    if (step <= maxStep) {
      setCurrentStep(step);
    }
  };
  
  const nextStep = () => {
    if (currentStep < maxStep) {
      if (currentStep === 2) {
        // Start grading when moving from step 2 to 3
        startGrading();
      } else {
        setCurrentStep(prev => prev + 1);
      }
    }
  };
  
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  // Find the current result based on active tab
  const currentResult = gradingResults.find(result => result.submissionId === activeResultTab);
  
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="material-icons text-primary mr-3">school</span>
              <h1 className="text-xl font-bold font-medium text-primary-foreground">GradeAssist</h1>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <a href="#" className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium">Dashboard</a>
              <a href="#" className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium">Assignments</a>
              <a href="#" className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium">Reports</a>
              <a href="#" className="text-muted-foreground hover:text-primary px-3 py-2 rounded-md text-sm font-medium">Settings</a>
            </div>
          </div>
        </div>
        <div className="block md:hidden">
          <div className="flex justify-between px-4 py-2 border-t border-neutral-100">
            <a href="#" className="text-muted-foreground hover:text-primary px-3 py-2 text-sm font-medium">Dashboard</a>
            <a href="#" className="text-muted-foreground hover:text-primary px-3 py-2 text-sm font-medium">Assignments</a>
            <a href="#" className="text-muted-foreground hover:text-primary px-3 py-2 text-sm font-medium">Reports</a>
            <a href="#" className="text-muted-foreground hover:text-primary px-3 py-2 text-sm font-medium">Settings</a>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">AI Grading Assistant</h2>
          <p className="mt-1 text-muted-foreground">Upload a rubric and student submission to receive automated feedback and scoring.</p>
        </div>
        
        {/* Grading Workflow */}
        <Card className="overflow-hidden">
          {/* Steps */}
          <div className="border-b border-border">
            <nav className="flex" aria-label="Progress">
              <ol role="list" className="bg-background border border-border rounded-t-lg divide-y divide-border md:flex md:divide-y-0 w-full">
                <li className="relative md:flex-1 md:flex">
                  <button 
                    className="group flex items-center w-full"
                    onClick={() => goToStep(1)}
                    aria-current={currentStep === 1 ? "step" : undefined}
                  >
                    <span className="px-6 py-4 flex items-center text-sm font-medium">
                      <span className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${currentStep >= 1 ? 'bg-primary' : 'bg-neutral-200'}`}>
                        <span className={currentStep >= 1 ? 'text-primary-foreground' : 'text-muted-foreground'}>1</span>
                      </span>
                      <span className={`ml-4 ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>Upload Rubric</span>
                    </span>
                  </button>
                </li>

                <li className="relative md:flex-1 md:flex">
                  <button 
                    className="group flex items-center w-full"
                    onClick={() => goToStep(2)}
                    disabled={maxStep < 2}
                    aria-current={currentStep === 2 ? "step" : undefined}
                  >
                    <span className="px-6 py-4 flex items-center text-sm font-medium">
                      <span className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${currentStep >= 2 ? 'bg-primary' : 'bg-neutral-200'}`}>
                        <span className={currentStep >= 2 ? 'text-primary-foreground' : 'text-muted-foreground'}>2</span>
                      </span>
                      <span className={`ml-4 ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>Upload Submissions</span>
                    </span>
                  </button>
                </li>

                <li className="relative md:flex-1 md:flex">
                  <button 
                    className="group flex items-center w-full"
                    onClick={() => goToStep(3)}
                    disabled={maxStep < 3 || isProcessing}
                    aria-current={currentStep === 3 ? "step" : undefined}
                  >
                    <span className="px-6 py-4 flex items-center text-sm font-medium">
                      <span className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${currentStep >= 3 ? 'bg-primary' : 'bg-neutral-200'}`}>
                        <span className={currentStep >= 3 ? 'text-primary-foreground' : 'text-muted-foreground'}>3</span>
                      </span>
                      <span className={`ml-4 ${currentStep >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>Review Results</span>
                    </span>
                  </button>
                </li>
              </ol>
            </nav>
          </div>

          <CardContent className="p-6">
            {/* Step 1: Upload Rubric */}
            {currentStep === 1 && (
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/2 space-y-4">
                  <FileUpload
                    title="Upload Rubric/Reference Material"
                    description="Upload your grading rubric and any reference materials needed for assessment."
                    icon="upload_file"
                    acceptedFileTypes=".pdf,.docx,.doc"
                    onFileSelect={handleRubricUpload}
                    multiple={true}
                  />
                  
                  {/* Additional Context for Rubric */}
                  <div className="space-y-2">
                    <Label htmlFor="rubric-comment" className="text-sm font-medium">
                      Additional Context for Grader (Optional)
                    </Label>
                    <Textarea
                      id="rubric-comment"
                      placeholder="Add any additional context about the assignment, special instructions, or emphasis areas that the AI should consider when grading..."
                      value={rubricComment}
                      onChange={(e) => setRubricComment(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                </div>
                <div className="md:w-1/2">
                  <div className="bg-accent rounded-lg p-6 h-full">
                    <h3 className="text-lg font-medium text-foreground mb-4">Tips for Effective Rubrics</h3>
                    
                    <div className="space-y-4">
                      <img 
                        src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80" 
                        alt="Professor reviewing assignments with rubric" 
                        className="w-full h-auto rounded-lg mb-4 object-cover"
                      />
                      
                      <div className="flex items-start">
                        <span className="material-icons text-primary mr-2 mt-0.5">check_circle</span>
                        <p className="text-foreground">Include clear scoring criteria for each section</p>
                      </div>
                      <div className="flex items-start">
                        <span className="material-icons text-primary mr-2 mt-0.5">check_circle</span>
                        <p className="text-foreground">Specify point values or grading scales</p>
                      </div>
                      <div className="flex items-start">
                        <span className="material-icons text-primary mr-2 mt-0.5">check_circle</span>
                        <p className="text-foreground">Provide examples of different achievement levels</p>
                      </div>
                      <div className="flex items-start">
                        <span className="material-icons text-primary mr-2 mt-0.5">check_circle</span>
                        <p className="text-foreground">Structure rubrics with clear sections for AI processing</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Step 2: Upload Submissions */}
            {currentStep === 2 && (
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/2 space-y-4">
                  <FileUpload
                    title="Upload Student Submissions"
                    description="Upload one or multiple student submissions to be graded against your rubric."
                    icon="description"
                    acceptedFileTypes=".pdf,.docx,.doc"
                    onFileSelect={handleSubmissionUpload}
                    multiple={true}
                  />
                  
                  {/* Additional Context for Submissions */}
                  <div className="space-y-2">
                    <Label htmlFor="submission-comment" className="text-sm font-medium">
                      Additional Context for Submissions (Optional)
                    </Label>
                    <Textarea
                      id="submission-comment"
                      placeholder="Add any specific context about these submissions, known issues, or special considerations the AI should be aware of when grading..."
                      value={submissionComment}
                      onChange={(e) => setSubmissionComment(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                </div>
                <div className="md:w-1/2">
                  <div className="bg-accent rounded-lg p-6 h-full">
                    <h3 className="text-lg font-medium text-foreground mb-4">Uploaded Files</h3>
                    
                    {/* Rubric Files List */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-foreground mb-2">Rubric/Reference</h4>
                      {rubricFiles.length > 0 ? (
                        rubricFiles.map(file => (
                          <div key={file.id} className="flex items-center justify-between bg-background p-3 rounded-md shadow-sm mb-2">
                            <div className="flex items-center overflow-hidden">
                              <span className="material-icons text-muted-foreground mr-2">description</span>
                              <span className="text-foreground truncate">{file.originalname}</span>
                            </div>
                            <button 
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteFile(file.id, 'rubric')}
                            >
                              <span className="material-icons">delete</span>
                            </button>
                          </div>
                        ))
                      ) : (
                        <Alert className="mb-2">
                          <AlertDescription>No rubric files uploaded yet</AlertDescription>
                        </Alert>
                      )}
                    </div>
                    
                    {/* Submission Files List */}
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Student Submissions</h4>
                      {submissionFiles.length > 0 ? (
                        submissionFiles.map(file => (
                          <div key={file.id} className="flex items-center justify-between bg-background p-3 rounded-md shadow-sm mb-2">
                            <div className="flex items-center overflow-hidden">
                              <span className="material-icons text-muted-foreground mr-2">description</span>
                              <span className="text-foreground truncate">{file.originalname}</span>
                            </div>
                            <button 
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteFile(file.id, 'submission')}
                            >
                              <span className="material-icons">delete</span>
                            </button>
                          </div>
                        ))
                      ) : (
                        <div>
                          <p className="text-muted-foreground text-sm italic mb-4">Upload student submissions to see them here</p>
                          <img 
                            src="https://images.unsplash.com/photo-1577896851231-70ef18881754?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80" 
                            alt="Teacher providing feedback on student work" 
                            className="w-full h-auto rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Processing View */}
            {isProcessing && (
              <div className="py-8">
                <div className="text-center">
                  <div className="animate-pulse flex flex-col items-center justify-center">
                    <span className="material-icons text-5xl text-primary/70 mb-4">psychology</span>
                    <h3 className="text-xl font-medium text-foreground mb-2">AI Grading in Progress</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Our AI is analyzing the submissions against your rubric. This may take a few moments depending on the complexity and length of the documents.
                    </p>
                  </div>
                  
                  <div className="max-w-md mx-auto mb-6">
                    <Progress 
                      value={processingStatus.progress} 
                      className="h-2.5"
                    />
                  </div>
                  
                  <div className="text-muted-foreground text-sm">
                    <p>
                      {processingStatus.currentFile 
                        ? `Processing ${processingStatus.currentFile}` 
                        : 'Initializing...'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Step 3: Results */}
            {currentStep === 3 && !isProcessing && (
              <div>
                <div className="mb-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-foreground">Grading Results</h3>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="gap-1">
                        <span className="material-icons text-sm">print</span>
                        Print
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1">
                        <span className="material-icons text-sm">download</span>
                        Export
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Tabs for multiple submissions */}
                {gradingResults.length > 0 && (
                  <>
                    <div className="mb-6 border-b border-border">
                      <Tabs value={activeResultTab} onValueChange={setActiveResultTab}>
                        <TabsList className="mb-0">
                          {gradingResults.map(result => (
                            <TabsTrigger key={result.submissionId} value={result.submissionId}>
                              {result.submissionName}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>
                    </div>
                    
                    {/* Document review image */}
                    <img 
                      src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-1.2.1&auto=format&fit=crop&w=1100&q=80" 
                      alt="Document with detailed review annotations" 
                      className="w-full h-64 object-cover rounded-lg shadow-md mb-6"
                    />
                    
                    {currentResult && (
                      <>
                        {/* Summary Card */}
                        <div className="bg-accent p-4 rounded-lg shadow-sm mb-6">
                          <div className="flex flex-col sm:flex-row justify-between mb-2">
                            <h4 className="text-lg font-medium text-foreground">
                              Final Grade: <span className="text-primary">{currentResult.totalScore}/{currentResult.maxPossibleScore}</span>
                            </h4>
                            <div className="mt-2 sm:mt-0">
                              <Badge variant={currentResult.status === 'pass' ? 'default' : 'destructive'}>
                                {currentResult.status === 'pass' ? 'Pass' : 'Fail'}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-muted-foreground">{currentResult.overallFeedback}</p>
                        </div>
                        
                        {/* Detailed Section Feedback */}
                        <div className="space-y-6">
                          {Object.entries(currentResult.sectionFeedback).map(([sectionName, feedback]) => (
                            <Accordion type="single" collapsible key={sectionName}>
                              <AccordionItem value={sectionName} className="border-none">
                                <Card>
                                  <AccordionTrigger className="px-6 py-4 border-b border-border hover:no-underline w-full flex justify-between items-center">
                                    <h3 className="text-md font-medium text-foreground">{sectionName}</h3>
                                    <div className="flex items-center">
                                      <span className="mr-3 font-medium text-primary">{feedback.score}/{feedback.maxScore}</span>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="px-6 py-4 bg-accent mt-0">
                                    <h4 className="text-sm font-medium text-foreground mb-2">Feedback</h4>
                                    <div className="prose prose-sm max-w-none text-muted-foreground">
                                      <p>{feedback.feedback}</p>
                                      
                                      <h5 className="text-foreground font-medium mt-3 mb-1">Strengths:</h5>
                                      <ul className="list-disc pl-5 space-y-1">
                                        {feedback.strengths.map((strength, idx) => (
                                          <li key={idx}>{strength}</li>
                                        ))}
                                      </ul>
                                      
                                      <h5 className="text-foreground font-medium mt-3 mb-1">Areas for Improvement:</h5>
                                      <ul className="list-disc pl-5 space-y-1">
                                        {feedback.improvements.map((improvement, idx) => (
                                          <li key={idx}>{improvement}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </AccordionContent>
                                </Card>
                              </AccordionItem>
                            </Accordion>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
                
                {gradingResults.length === 0 && (
                  <Alert className="mb-6">
                    <AlertDescription>No grading results available yet. Please grade some submissions to see results here.</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between">
              <Button 
                variant="outline" 
                onClick={prevStep}
                disabled={currentStep === 1 || isProcessing}
              >
                Back
              </Button>
              <Button 
                onClick={nextStep}
                disabled={(currentStep >= maxStep) || isProcessing}
              >
                {currentStep === 2 ? 'Start Grading' : 'Continue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <footer className="bg-white border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex justify-center md:justify-start space-x-6">
              <a href="#" className="text-muted-foreground hover:text-foreground">About</a>
              <a href="#" className="text-muted-foreground hover:text-foreground">Help</a>
              <a href="#" className="text-muted-foreground hover:text-foreground">Privacy</a>
              <a href="#" className="text-muted-foreground hover:text-foreground">Terms</a>
            </div>
            <div className="mt-8 md:mt-0">
              <p className="text-center text-sm text-muted-foreground">&copy; 2023 GradeAssist. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
