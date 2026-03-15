import { AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface StepDisclaimerProps {
  onAccept: () => void;
}

export function StepDisclaimer({ onAccept }: StepDisclaimerProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full">
        <CardContent className="p-8 space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h2
              className="text-2xl font-semibold text-foreground"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Not Financial Advice
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ETF IQ is a portfolio tracking and research tool. It does{" "}
              <span className="text-foreground font-medium">not</span> provide
              financial advice, recommendations, or solicitations to buy or sell
              securities.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are responsible for your own investment decisions. The AI-powered
              insights, theme detection, and correlation analysis are informational
              tools only. Always conduct your own due diligence.
            </p>
          </div>

          <Button className="w-full" onClick={onAccept}>
            I Understand, Let's Build <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
