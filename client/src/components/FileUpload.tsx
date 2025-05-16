import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  title: string;
  description: string;
  icon?: string;
  acceptedFileTypes?: string;
  onFileSelect: (files: File[]) => void;
  multiple?: boolean;
}

export function FileUpload({
  title,
  description,
  icon = "upload_file",
  acceptedFileTypes = ".pdf,.docx,.doc",
  onFileSelect,
  multiple = false,
}: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (fileList: FileList) => {
    const files = Array.from(fileList);
    onFileSelect(files);
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onFileSelect(files);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      
      <Card 
        className={cn(
          "flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary/30 rounded-lg mt-2 flex-grow transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/5",
          isDragActive && "border-primary bg-primary/10"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <span className="material-icons text-4xl text-muted-foreground mb-3">{icon}</span>
        <p className="text-muted-foreground text-center mb-2">
          Drag and drop your {multiple ? "files" : "file"} here, or
        </p>
        <Button>Browse Files</Button>
        <FileInput 
          ref={fileInputRef}
          id="file-upload" 
          multiple={multiple} 
          accept={acceptedFileTypes}
          onFileSelect={handleFileSelect}
          className="hidden"
        />
        <p className="text-muted-foreground text-xs mt-2">
          Accepts {acceptedFileTypes.split(',').join(', ')}
        </p>
      </Card>
    </div>
  );
}
