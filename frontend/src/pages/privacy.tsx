import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

        <div className="prose prose-invert max-w-none space-y-6 text-sm text-muted-foreground">
          <p><strong>Effective Date:</strong> March 2026</p>

          <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
          <p>
            We collect information you provide directly: email address (via Auth0 authentication),
            portfolio data (ETF positions, allocations, transaction history), and chat conversations
            with the AI assistant.
          </p>

          <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide and maintain the PortfolioIQ service</li>
            <li>Generate personalized portfolio analysis and reports</li>
            <li>Send alert notifications and weekly digest emails (configurable)</li>
            <li>Improve the accuracy of AI agent analyses over time</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">3. Data Storage and Security</h2>
          <p>
            Your data is stored in PostgreSQL databases with encryption at rest and in transit.
            Authentication is handled by Auth0, a trusted identity provider. We do not store
            your authentication credentials directly.
          </p>

          <h2 className="text-lg font-semibold text-foreground">4. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Auth0:</strong> Authentication and identity management</li>
            <li><strong>Google Gemini:</strong> AI analysis generation (portfolio context is sent to Google's API)</li>
            <li><strong>Resend:</strong> Transactional email delivery</li>
            <li><strong>yfinance / justETF:</strong> Market data retrieval (no personal data shared)</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">5. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. You may request deletion
            of your account and associated data at any time by contacting us.
          </p>

          <h2 className="text-lg font-semibold text-foreground">6. Your Rights</h2>
          <p>
            You have the right to: access your personal data; correct inaccurate data;
            request deletion of your data; export your data; and opt out of email notifications
            via your account preferences.
          </p>

          <h2 className="text-lg font-semibold text-foreground">7. Cookies</h2>
          <p>
            We use essential cookies for authentication session management. We do not use
            tracking or advertising cookies.
          </p>

          <h2 className="text-lg font-semibold text-foreground">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes via email or a prominent notice on the Service.
          </p>
        </div>
      </div>
    </div>
  );
}
