import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyPill } from "./key-pill";
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

interface ProviderCardProps {
  provider: Provider;
  displayName: string;
  keys: MaskedKey[];
  isPrimary: boolean;
  onSetPrimary: () => void;
  isSettingPrimary: boolean;
  onKeysChanged: () => void;
}

interface AddKeyResponse {
  key: {
    id: string;
    provider: Provider;
    maskedKey: string;
    label: string | null;
    isValid: boolean;
    lastError: string | null;
    validatedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export function ProviderCard({
  provider,
  displayName,
  keys,
  isPrimary,
  onSetPrimary,
  isSettingPrimary,
  onKeysChanged,
}: ProviderCardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const hasValidKey = keys.some((k) => k.isValid);
  const canSetPrimary = hasValidKey;

  // Add key mutation
  const addKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await api.settings.keys.$post({
        json: {
          provider,
          key: newKey,
          label: newLabel || undefined,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { message?: string }).message ?? "Failed to add key"
        );
      }
      return response.json() as Promise<AddKeyResponse>;
    },
    onSuccess: () => {
      setShowAddForm(false);
      setNewKey("");
      setNewLabel("");
      setAddError(null);
      onKeysChanged();
      toast.success("Key added — click Test to validate.");
    },
    onError: (error: Error) => {
      setAddError(error.message ?? "Failed to add key");
    },
  });

  const handleSaveKey = () => {
    if (!newKey.trim()) {
      setAddError("API Key is required");
      return;
    }
    setAddError(null);
    addKeyMutation.mutate();
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setNewKey("");
    setNewLabel("");
    setAddError(null);
  };

  return (
    <Card>
      <CardHeader className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold">{displayName}</CardTitle>
            {isPrimary && (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                Primary
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onSetPrimary}
            disabled={!canSetPrimary || isPrimary || isSettingPrimary}
          >
            {isSettingPrimary ? "Setting…" : "Set as Primary"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {keys.map((key) => (
            <KeyPill
              key={key.id}
              keyData={key}
              onTested={onKeysChanged}
              onDeleted={onKeysChanged}
            />
          ))}
          <Button
            variant="outline"
            className="border-dashed min-w-[140px] h-auto py-2"
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
          >
            + Add Key
          </Button>
        </div>

        {/* Inline add-key form */}
        {showAddForm && (
          <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20 mt-2">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor={`key-${provider}`}>API Key</Label>
                <Input
                  id={`key-${provider}`}
                  type="password"
                  placeholder="Enter API key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  required
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor={`label-${provider}`}>Label (optional)</Label>
                <Input
                  id={`label-${provider}`}
                  type="text"
                  placeholder="e.g., Production"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
            </div>
            {addError && (
              <p className="text-xs text-destructive mt-2">{addError}</p>
            )}
            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleSaveKey}
                disabled={addKeyMutation.isPending}
              >
                {addKeyMutation.isPending ? "Saving…" : "Save Key"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Hint text when primary button is disabled */}
        {!canSetPrimary && !isPrimary && (
          <p className="text-xs text-muted-foreground mt-2">
            Add and test a key (must be 🟢 valid) to set {displayName} as
            primary.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
