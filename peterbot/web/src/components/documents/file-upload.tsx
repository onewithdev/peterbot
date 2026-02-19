import { useState, useCallback } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface FileUploadProps {
  onUpload: (file: File, name: string) => Promise<void>;
}

export function FileUpload({ onUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Validate file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("File too large (max 10MB)");
      return;
    }

    // Validate file type
    const allowedTypes = [
      "text/plain",
      "text/markdown",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Supported: TXT, MD, PDF, DOC, DOCX");
      return;
    }

    setSelectedFile(file);
    setName(file.name.replace(/\.[^/.]+$/, ""));
  };

  const handleUpload = async () => {
    if (!selectedFile || !name.trim()) return;

    setIsUploading(true);
    try {
      await onUpload(selectedFile, name.trim());
      setSelectedFile(null);
      setName("");
      toast.success("File uploaded successfully");
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  if (selectedFile) {
    return (
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-500" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedFile(null);
              setName("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Document name"
        />

        <Button
          onClick={handleUpload}
          disabled={isUploading || !name.trim()}
          className="w-full"
        >
          {isUploading ? "Uploading..." : "Upload Document"}
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
    >
      <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
      <p className="text-sm text-muted-foreground mb-2">
        Drag and drop a file here, or{" "}
        <label className="text-primary cursor-pointer hover:underline">
          browse
          <input
            type="file"
            className="hidden"
            accept=".txt,.md,.pdf,.doc,.docx"
            onChange={handleFileSelect}
          />
        </label>
      </p>
      <p className="text-xs text-muted-foreground">
        Supported: TXT, MD, PDF, DOC, DOCX (max 10MB)
      </p>
    </div>
  );
}
