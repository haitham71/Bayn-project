import { useState, useEffect } from 'react';
import { getIndustries, searchSkills } from '@/features/identity/services/authService';

export const EMPTY_IDEA = {
  title: '',
  description: '',
  skills: [],
  teamSize: '',
  roles: '',
  category: '',
  stage: '',
  visibility: 'public',
};

// Shared form state for the create- and edit-idea pages: the fields, the
// industry (category) options, and the skill autocomplete — which also tracks
// each chosen skill's id so a save can resend skill_ids.
export function useIdeaForm() {
  const [form, setFormState] = useState(EMPTY_IDEA);
  const setField = (key, value) => setFormState((f) => ({ ...f, [key]: value }));
  const setForm = (patch) => setFormState((f) => ({ ...f, ...patch }));

  const [industryOptions, setIndustryOptions] = useState([]);
  const [skillIdByName, setSkillIdByName] = useState({});

  // Categories come from the industries catalog (value = industry id).
  useEffect(() => {
    getIndustries()
      .then((rows) => setIndustryOptions(rows.map((r) => ({ value: r.id, label: r.name }))))
      .catch(() => {});
  }, []);

  // Skill suggestions come from the backend catalog (same source as the profile
  // pages), so the list stays in sync instead of a hardcoded one.
  async function handleSkillQuery(q) {
    const results = await searchSkills(q).catch(() => []);
    setSkillIdByName((prev) => {
      const next = { ...prev };
      results.forEach((r) => { next[r.name] = r.id; });
      return next;
    });
    return results.map((r) => r.name);
  }

  // Seed the name->id map from an existing project's skills (edit page).
  const seedSkillIds = (projectSkills) =>
    setSkillIdByName((prev) => {
      const next = { ...prev };
      (projectSkills || []).forEach((s) => { next[s.name] = s.id; });
      return next;
    });

  // Resolve the chosen skill names back to ids for the API payload.
  const skillIds = () => form.skills.map((name) => skillIdByName[name]).filter(Boolean);

  return { form, setField, setForm, industryOptions, handleSkillQuery, seedSkillIds, skillIds };
}
