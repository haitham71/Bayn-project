import { useEffect, useState } from 'react';
import { getAnalyticsOverview } from '../services/analyticsService';

// Public platform counts for the hero and the stats band. Failures stay silent:
// the landing still reads fine with zeros rather than an error state.
export function useLandingStats() {
  const [stats, setStats] = useState({ users: 0, ideas: 0, teams: 0 });

  useEffect(() => {
    getAnalyticsOverview()
      .then((d) => setStats({ users: d.users || 0, ideas: d.ideas || 0, teams: d.teams || 0 }))
      .catch(() => {});
  }, []);

  return stats;
}
