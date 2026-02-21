import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Provider = "anthropic" | "google" | "zai" | "moonshot";

interface MaskedKey {
  id: string;
  provider: Provider;
  maskedKey: string;
  label: string | null;
  isValid: boolean;
  lastError: string | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KeyPillProps {
  keyData: MaskedKey;
  onTested: () => void;
  onDeleted: () => void;
}

interface TestKeyResponse {
  valid: boolean;
  error?: string;
}

export function KeyPill({ keyData, onTested, onDeleted }: KeyPillProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Determine status dot color
  const getStatusColor = () => {
    if (keyData.isValid) return "bg-green-500";
    if (keyData.validatedAt !== null) return "bg-red-500";
    return "bg-yellow-400";
  };

  // Test key mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await api.settings.keys[":id"].test.$post({
        param: { id: keyData.id },
      });
      if (!response.ok) {
        throw new Error("Failed to test key");
      }
      return response.json() as Promise<TestKeyResponse>;
    },
    onSuccess: (result) => {
      if (!result.valid) {
        setTestError(result.error ?? "Validation failed");
      } else {
        setTestError(null);
      }
      onTested();
    },
    onError: (error: Error) => {
      const message = error.message ?? "Failed to test key";
      setTestError(message);
      toast.error(message);
    },
  });

  // Delete key mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.settings.keys[":id"].$delete({
        param: { id: keyData.id },
      });
      if (!response.ok) {
        throw new Error("Failed to delete key");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowDeleteDialog(false);
      onDeleted();
      toast.success("Key deleted.");
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Failed to delete key");
    },
  });

  const handleTest = () => {
    setTestError(null);
    testMutation.mutate();
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <>
      <div className="border rounded-lg p-2 bg-muted/30 flex flex-col gap-1 min-w-[140px]">
        {/* Row 1: Status dot + masked key */}
        <div className="flex items-center gap-2">
          <div className={`rounded-full w-2 h-2 ${getStatusColor()}`} />
          <span className="font-mono text-xs">{keyData.maskedKey}</span>
        </div>

        {/* Row 2: Test and Delete buttons */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={testMutation.isPending}
          >
            {testMutation.isPending ? "Testing…" : "Test"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteDialog(true)}
          >
            ×
          </Button>
        </div>

        {/* Row 3: Test error (conditional) */}
        {testError && (
          <p className="text-xs text-destructive">{testError}</p>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this key?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The key will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <code className="bg-muted rounded px-2 py-1 text-xs font-mono">
              {keyData.maskedKey}
            </code>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
