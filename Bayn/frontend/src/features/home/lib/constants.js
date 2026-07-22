// Backend ProjectStage values → translated labels (reuses the create-idea keys).
export const STAGE_LABEL = {
  planning: 'createIdea.stagePlanning',
  development: 'createIdea.stageDevelopment',
  launching: 'createIdea.stageLaunching',
};

// TaskPriority labels (reuse the dashboard's translation keys).
export const PRIORITY_KEY = {
  low: 'projectDashboard.priorityLow',
  medium: 'projectDashboard.priorityMedium',
  high: 'projectDashboard.priorityHigh',
};

// How many recommended ideas to surface on the home page.
export const REC_COUNT = 3;

// Accent colours cycled across the upcoming-meeting rows.
export const MEETING_ACCENTS = [
  { accent: '#3b82f7', tint: 'rgba(222, 235, 255, 0.5)' },
  { accent: '#21b07d', tint: 'rgba(217, 245, 235, 0.5)' },
  { accent: '#f59121', tint: 'rgba(255, 237, 217, 0.5)' },
  { accent: '#944ae3', tint: 'rgba(240, 227, 255, 0.5)' },
];

export const AVATAR_COLORS = ['#0f3d2e', '#295e4d', '#5ca18a', '#c9baa1', '#463e31'];
export const MAX_AVATARS = 3;

// A user can belong to at most this many projects (owner + member) — mirrors
// MyProjectsPage / the backend's MAX_MEMBERSHIPS_PER_USER.
export const MAX_PROJECTS = 2;

export function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'greetMorning';
  if (hour < 18) return 'greetAfternoon';
  return 'greetEvening';
}
