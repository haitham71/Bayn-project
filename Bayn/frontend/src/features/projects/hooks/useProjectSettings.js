import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getProject, getProjectSlots, updateProject, replaceSlots } from '@/features/projects/services/projectService';
import { slotsToSchedulerValue, meetingsToSlots } from '@/features/meetings/lib/slots';
import { getApiErrorMessage } from '@/shared/lib/apiError';

// Right-rail management for a project: its visibility and meeting slots, loaded
// on mount and saved together.
export function useProjectSettings(projectId) {
  const { t } = useTranslation();
  const [project, setProject] = useState(null);
  const [schedInitial, setSchedInitial] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [visibility, setVisibility] = useState('public');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    Promise.all([getProject(projectId), getProjectSlots(projectId).catch(() => [])])
      .then(([p, sl]) => {
        setProject(p);
        setVisibility(p.is_hidden ? 'private' : 'public');
        const val = slotsToSchedulerValue(sl || []);
        setSchedInitial(val);
        setMeetings(val);
      })
      .catch(() => {});
  }, [projectId]);

  async function handleSave() {
    if (!projectId) return;
    setSaving(true);
    setSaveMsg('');
    setSaveError('');
    try {
      await updateProject(projectId, { is_hidden: visibility === 'private' });
      await replaceSlots(projectId, meetingsToSlots(meetings));
      setSaveMsg(t('joinRequests.saved'));
    } catch (e) {
      setSaveError(getApiErrorMessage(e, t('joinRequests.saveError')));
    } finally {
      setSaving(false);
    }
  }

  return {
    project, schedInitial, setMeetings,
    visibility, setVisibility,
    saving, saveMsg, saveError, handleSave,
  };
}
