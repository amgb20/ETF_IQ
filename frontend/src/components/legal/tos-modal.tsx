import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

interface Props {
  onAccepted: () => void;
}

export function TosModal({ onAccepted }: Props) {
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await apiFetch("/users/me/preferences", {
        method: "PUT",
        body: JSON.stringify({ accepted_tos: true }),
      });
      onAccepted();
    } catch (err) {
      console.error("Failed to accept TOS:", err);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4">Terms of Service</h2>
        <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-background p-4 text-sm text-muted-foreground space-y-3">
          <p>
            By using PortfolioIQ, you agree that all AI-generated analyses, predictions,
            and recommendations are for <strong>informational and educational purposes only</strong>.
          </p>
          <p>
            PortfolioIQ does not provide financial advice. You should always consult a qualified
            financial advisor before making investment decisions.
          </p>
          <p>
            The AI agents may produce inaccurate or incomplete information. The accuracy scores
            and confidence indicators are self-assessed and do not guarantee correctness.
          </p>
          <p>
            Read the full{" "}
            <Link to="/terms" className="underline text-primary" target="_blank">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline text-primary" target="_blank">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={handleAccept} disabled={accepting}>
            {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            I Agree
          </Button>
        </div>
      </div>
    </div>
  );
}
