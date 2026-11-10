import { useMe } from "../lib/query";
import { useTheme } from "../lib/theme";
import { useRootScale } from "../lib/use-root-scale";
import { API_URL } from "../lib/api";
import { Navbar } from "../components/landing/Navbar";
import { HeroSection } from "../components/landing/HeroSection";
import { PartnerFeaturesSection } from "../components/landing/PartnerFeaturesSection";
import { WorkflowTimelineSection } from "../components/landing/WorkflowTimelineSection";
import { ComparisonSection } from "../components/landing/ComparisonSection";
import { DocsSection } from "../components/landing/DocsSection";
import { FaqSection } from "../components/landing/FaqSection";
import { IntegrationsFooterSection } from "../components/landing/IntegrationsFooterSection";

export default function LandingPage() {
  const me = useMe();
  const { theme, setTheme, resolvedTheme } = useTheme();
  useRootScale("cs-landing-root");

  const signedIn = Boolean(me.data?.user);
  const connectHref = signedIn ? "/dashboard" : `${API_URL}/auth/github`;

  return (
    <div
      className="cs-landing min-h-screen w-full overflow-x-hidden selection:bg-[#f48d16]/20"
      data-theme={resolvedTheme}
    >
      <Navbar connectHref={connectHref} theme={theme} onThemeChange={setTheme} />
      <main>
        <HeroSection connectHref={connectHref} />
        <PartnerFeaturesSection />
        <WorkflowTimelineSection />
        <ComparisonSection />
        <DocsSection />
        <FaqSection />
        <IntegrationsFooterSection connectHref={connectHref} />
      </main>
    </div>
  );
}
