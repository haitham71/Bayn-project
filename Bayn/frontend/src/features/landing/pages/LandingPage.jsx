import { useRef } from 'react';
// Base first: the tokens and shared primitives every section stylesheet builds on.
import './LandingPage.css';
import { useLandingStats } from '../hooks/useLandingStats';
import { useLandingMotion } from '../hooks/useLandingMotion';
import LandingNav from '../components/LandingNav';
import HeroSection from '../components/HeroSection';
import FeaturesSection from '../components/FeaturesSection';
import HowItWorks from '../components/HowItWorks';
import MarketplaceShowcase from '../components/MarketplaceShowcase';
import StatsBand from '../components/StatsBand';
import DashboardShowcase from '../components/DashboardShowcase';
import NdaShowcase from '../components/NdaShowcase';
import CtaSection from '../components/CtaSection';
import TeamSection from '../components/TeamSection';
import LandingFooter from '../components/LandingFooter';

// Public marketing page. Everything is scoped under `.lp`, and the entrance
// animations are wired from this level because the observer needs one root to
// sweep for `.reveal` targets.
export default function LandingPage() {
  const rootRef = useRef(null);
  const stats = useLandingStats();

  useLandingMotion(rootRef);

  return (
    <div className="lp" ref={rootRef}>
      <LandingNav />
      <HeroSection stats={stats} />
      <FeaturesSection />
      <HowItWorks />
      <MarketplaceShowcase />
      <StatsBand stats={stats} />
      <DashboardShowcase />
      <NdaShowcase />
      <CtaSection />
      <TeamSection />
      <LandingFooter />
    </div>
  );
}
