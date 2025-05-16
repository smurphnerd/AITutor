import * as React from "react"
import { cn } from "@/lib/utils"

export interface FileInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onFileSelect?: (files: FileList) => void
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, onFileSelect, onChange, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
        if (onFileSelect) {
          onFileSelect(event.target.files)
        }
      }
      
      if (onChange) {
        onChange(event)
      }
    }

    return (
      <input
        type="file"
        className={cn(
          "hidden",
          className
        )}
        onChange={handleChange}
        ref={ref}
        {...props}
      />
    )
  }
)

FileInput.displayName = "FileInput"

export { FileInput }
