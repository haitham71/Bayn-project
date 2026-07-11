// Pulls a human-readable message out of an axios error. The backend returns
// either { detail: "message" } (our AppExceptions) or { detail: [ ... ] }
// (FastAPI/pydantic validation errors).
export function getApiErrorMessage(error, fallback = 'Something went wrong.') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) return detail[0]?.msg || fallback;
  if (error?.code === 'ERR_NETWORK') return fallback;
  return error?.message || fallback;
}
