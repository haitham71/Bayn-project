// A join request moves through more states than the owner needs to think about,
// so the UI collapses them into the five stages of the actual process:
//
//   pending -> signing -> meeting -> approved
//                                 -> rejected
//
// `rejected` is a catch-all for every way a request can end without membership,
// whichever side ended it — the owner only cares that it's over.
export const STAGES = ['pending', 'signing', 'meeting', 'approved', 'rejected'];

const BY_STATUS = {
  pending: 'pending',
  awaiting_signatures: 'signing',
  scheduled: 'meeting',
  // predates the NDA gate, when accepting created the meeting outright
  accepted: 'meeting',
  approved: 'approved',
  declined: 'rejected',
  rejected: 'rejected',
  cancelled: 'rejected',
  expired: 'rejected',
};

export function stageOf(request) {
  return BY_STATUS[request.status] || 'rejected';
}

export function countByStage(requests) {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const r of requests) counts[stageOf(r)] += 1;
  return counts;
}

// Mirrors the backend's FINALIZE_GRACE_PERIOD see meetings/service.py
// finalize unlocks 5 minutes after the meeting was due to start.
const FINALIZE_GRACE_PERIOD_MS = 5 * 60 * 1000;

// The owner can only judge someone after actually meeting them, which is the
// same rule the backend enforces on POST /requests/{id}/finalize.
export function canFinalize(request, now = Date.now()) {
  return (
    stageOf(request) === 'meeting' &&
    new Date(request.proposed_start_time).getTime() + FINALIZE_GRACE_PERIOD_MS <= now
  );
}

// Signature-System reports one status rather than a flag per party, so the
// backend flattens it to two booleans. Absent until a contract exists.
export function signatureLabel(request) {
  const s = request.signatures;
  if (!s) return null;
  if (!s.requester_signed) return 'waitingOnRequester';
  if (!s.owner_signed) return 'waitingOnYou';
  return 'bothSigned';
}
