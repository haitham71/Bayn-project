// A user can belong to at most this many projects (owner + member) — mirrors
// the backend's MAX_MEMBERSHIPS_PER_USER.
export const MAX_PROJECTS = 3;

// Maps a backend ProjectStage to its translated label (reuses the create-idea keys).
export const STAGE_LABEL = {
  planning: 'createIdea.stagePlanning',
  development: 'createIdea.stageDevelopment',
  launching: 'createIdea.stageLaunching',
};

export function daysSince(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}
