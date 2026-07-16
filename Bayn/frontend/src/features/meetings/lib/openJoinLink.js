import { getMeetingJoinLink } from '@/features/meetings/services/meetingService';

// Open a meeting's video room in a new tab under the user's real name.
//
// The personalised link is fetched from the backend on click (it embeds a
// per-user Daily token). A browser only treats window.open as user-initiated if
// it runs synchronously inside the click, so we open a blank tab first and set
// its location once the link arrives — opening after the await would be caught
// by the popup blocker.
//
// The initial open deliberately omits `noopener`: passing it makes window.open
// return null, leaving no handle to navigate. Instead we sever `opener`
// ourselves before pointing the tab at Daily, so the room page still can't
// reach back into this one. On failure the placeholder tab is closed and false
// is returned so the caller can surface an error.
export async function openJoinLink(meetingId) {
  const tab = window.open('about:blank', '_blank');
  try {
    const url = await getMeetingJoinLink(meetingId);
    if (tab) {
      tab.opener = null;
      tab.location = url;
    } else {
      // popup was blocked outright — fall back to a direct open
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    return true;
  } catch (err) {
    if (tab) tab.close();
    return false;
  }
}
