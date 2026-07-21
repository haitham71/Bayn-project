import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNow } from '@/shared/hooks/useNow';
import {
  listMeetingRequests,
  acceptMeetingRequest,
  rejectMeetingRequest,
  finalizeMeetingRequest,
} from '@/features/meetings/services/meetingService';
import { countByStage, stageOf } from '@/features/meetings/lib/requestStatus';
import { getApiErrorMessage } from '@/shared/lib/apiError';

// Incoming join requests for a project + the owner's accept/reject/finalize
// actions. Only one action runs at a time; the list refetches after each.
export function useJoinRequests(projectId) {
  const { t } = useTranslation();
  // The finalize button only unlocks once the meeting has ended, so we need a
  // live clock rather than whatever time the page happened to render at.
  const now = useNow();

  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [actioningId, setActioningId] = useState(null);
  const [actionError, setActionError] = useState('');
  // The pending request whose accept dialog is open, plus its (optional) title.
  const [acceptId, setAcceptId] = useState(null);
  const [acceptTitle, setAcceptTitle] = useState('');

  function load() {
    listMeetingRequests('incoming', projectId)
      .then((rows) => setRequests(rows || []))
      .catch(() => {});
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  async function runAction(id, fn) {
    setActioningId(id);
    setActionError('');
    try {
      await fn();
      load();
    } catch (e) {
      setActionError(getApiErrorMessage(e, t('joinRequests.actionError')));
    } finally {
      setActioningId(null);
    }
  }

  const openAccept = (id) => { setAcceptId(id); setAcceptTitle(''); };
  const closeAccept = () => setAcceptId(null);
  function confirmAccept() {
    const id = acceptId;
    setAcceptId(null);
    runAction(id, () => acceptMeetingRequest(id, acceptTitle.trim() || null));
  }
  const handleReject = (id) => runAction(id, () => rejectMeetingRequest(id));
  const handleFinalize = (id, approve) => runAction(id, () => finalizeMeetingRequest(id, approve));

  const counts = countByStage(requests);
  const visible = requests.filter((r) => stageOf(r) === tab);

  return {
    tab, setTab,
    counts, visible,
    actioningId, actionError, now,
    acceptId, acceptTitle, setAcceptTitle,
    openAccept, closeAccept, confirmAccept,
    handleReject, handleFinalize,
  };
}
