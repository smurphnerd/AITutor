import { apiRequest } from "./queryClient";
import { FileUploadResponse, GradingRequest, GradingResult, ProcessingStatus } from "@/types";

export async function uploadFile(
  file: File,
  type: "rubric" | "submission"
): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileType", type);

  const response = await fetch(`/api/upload/${type}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return await response.json();
}

export async function getUploadedFiles(
  type: "rubric" | "submission"
): Promise<FileUploadResponse[]> {
  const response = await fetch(`/api/files/${type}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to get uploaded files");
  }

  return await response.json();
}

export async function deleteFile(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/files/${id}`, undefined);
}

export async function submitGradingJob(
  request: GradingRequest
): Promise<{ jobId: string }> {
  const response = await apiRequest("POST", "/api/grade", request);
  return response.json();
}

export async function getGradingStatus(jobId: string): Promise<ProcessingStatus> {
  const response = await fetch(`/api/grade/status/${jobId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to get grading status");
  }

  return await response.json();
}

export async function getGradingResults(jobId: string): Promise<GradingResult[]> {
  const response = await fetch(`/api/grade/results/${jobId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to get grading results");
  }

  return await response.json();
}
