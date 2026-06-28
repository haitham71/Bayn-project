# API Specifications

## External APIs

integrates four external services. All credentials are stored in environment variables and never hardcoded.

### Authentica (OTP Verification)
Used for email and SMS one-time password verification. The OTP code itself is never stored locally — only Authentica's `reference_id` is stored in `authentica_otp_log`.

| Operation | Method | Endpoint | Key Fields |
|---|---|---|---|
| Send OTP | POST | `https://api.authentica.sa/api/v2/otp/send` | Header: `X-Authorization`. Body: `{ channel: 'email'\|'sms', to: address }`. Returns: `reference_id` |
| Verify OTP | POST | `https://api.authentica.sa/api/v2/otp/verify` | Body: `{ reference_id, otp }`. Returns: `{ success: true\|false }` |

### Cal.com (Scheduling)
Used to fetch live availability and create bookings. Availability is never cached — always fetched live so stale slots are never shown.

| Operation | Method | Endpoint | Key Fields |
|---|---|---|---|
| Get availability slots | GET | `https://api.cal.com/v2/slots` | Header: `cal-api-version: 2024-09-04`. Params: `eventTypeId, start, end, timeZone` |
| Create booking | POST | `https://api.cal.com/v2/bookings` | Header: `cal-api-version: 2024-08-13`. Body: `{ start, eventTypeId, attendee: { name, email, timeZone } }`. Returns `uid` → stored as `MEETING.calcom_booking_id` |

### Daily.co (Video Meetings)
Used to create private video rooms and issue per-user meeting tokens.

| Operation | Method | Endpoint | Key Fields |
|---|---|---|---|
| Create room | POST | `https://api.daily.co/v1/rooms` | Body: `{ name, privacy: 'private', properties: { nbf, exp, max_participants: 2, eject_at_room_exp: true } }`. Returns `url` → stored as `MEETING.video_link` |
| Create meeting token | POST | `https://api.daily.co/v1/meeting-tokens` | Body: `{ properties: { room_name, user_name, is_owner, exp } }`. Returns `token`. Join URL = `video_link?t=token` |
| Delete room | DELETE | `https://api.daily.co/v1/rooms/{name}` | Called after meeting ends or is cancelled |

### Cloudflare R2 (Object Storage)
S3-compatible storage. Object keys (not full URLs) are stored in the database. Full URL = `R2_PUBLIC_URL + '/' + key`.

| What is stored | Key format |
|---|---|
| User avatar | `avatars/{user_id}.{ext}` |
| NDA signature image | `contracts/{contract_id}/sig_p1.png` or `sig_p2.png` |
| Intermediate PDF | `contracts/{contract_id}/signed_p1.pdf` |
| Final contract PDF | `contracts/{contract_id}/final.pdf` |
| Chat file attachment | `chat/{project_id}/{year}/{month}/{uuid}.{ext}` |
| Project file | `files/{project_id}/{folder}/{uuid}.{ext}` |

---

## Internal API Endpoints

**Base URL:** `https://api.bayn.sa/v1`
**Auth:** `Authorization: Bearer {access_token}` on all protected endpoints.

---

### Identity & Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | No | Register — creates user, returns JWT pair |
| POST | `/auth/login` | No | Login — validates credentials, returns JWT pair |
| POST | `/auth/refresh` | No | Refresh access token |
| GET | `/auth/me` | Yes | Get current user profile |
| PATCH | `/auth/me` | Yes | Update profile fields (partial) |
| DELETE | `/auth/me` | Yes | Soft-delete account (`deleted_at` set, data retained) |
| POST | `/auth/verify-email/send` | Yes | Send email OTP via Authentica |
| POST | `/auth/verify-email/confirm` | Yes | Verify email OTP → sets `is_email_verified = true` |
| POST | `/auth/verify-phone/send` | Yes | Send SMS OTP via Authentica |
| POST | `/auth/verify-phone/confirm` | Yes | Verify SMS OTP → sets `is_number_verified = true` |

---

### Profile & Catalog

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/profile/skills` | Yes | Add skill to profile |
| DELETE | `/profile/skills/{skill_id}` | Yes | Remove skill from profile |
| POST | `/profile/specializations` | Yes | Add specialization |
| POST | `/profile/external-projects` | Yes | Add past off-platform project |
| GET | `/catalog/skills/search?q=` | Yes | Autocomplete skill search |
| GET | `/catalog/countries` | No | List all countries (for phone picker) |
| GET | `/catalog/industries` | No | List all industries |

---

### Projects

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/projects` | Optional | List public non-hidden projects (Guests can filter, not search) |
| GET | `/projects/{id}` | Yes | Project detail — requires login |
| POST | `/projects` | Yes | Create project — creator auto-assigned as OWNER |
| PATCH | `/projects/{id}/visibility` | Yes (Owner) | Toggle `is_hidden` |

---

### Meeting Requests

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/projects/{id}/availability` | Yes | Fetch live slots from Owner's Cal.com calendar |
| POST | `/projects/{id}/meeting-requests` | Yes | Send join request with message and chosen time slot |
| GET | `/meeting-requests` | Yes | View list of sent and received requests |
| POST | `/meeting-requests/{id}/accept` | Yes (Owner) | Accept → Cal.com booking → Daily room → NDA auto-generated → chat channel created → emails sent |
| POST | `/meeting-requests/{id}/reject` | Yes (Owner) | Reject request |

#### POST `/projects/{id}/meeting-requests`
**Request:**
```json
{
  "proposed_start_time": "2026-07-01T09:00:00.000Z",
  "proposed_end_time":   "2026-07-01T09:30:00.000Z",
  "message": "I'm a Full Stack developer with 3 years of experience."
}
```
**Response `201`:**
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "owner_id": "uuid",
  "proposed_start_time": "2026-07-01T09:00:00.000Z",
  "proposed_end_time":   "2026-07-01T09:30:00.000Z",
  "message": "I'm a Full Stack developer with 3 years of experience.",
  "status": "pending",
  "expires_at": "2026-07-31T09:00:00.000Z",
  "created_at": "2026-06-24T10:00:00.000Z"
}
```

#### POST `/meeting-requests/{id}/accept`
**What happens internally (in order):**
1. `[External]` Cal.com → `POST /v2/bookings` — creates booking
2. `[External]` Daily.co → `POST /v1/rooms` — creates private room
3. `[Internal]` Creates `Meeting` row in DB
4. `[Internal]` Auto-generates `Contract` (NDA) row
5. `[Internal]` Creates `ChatChannel` + `ChatMember` rows for both parties
6. `[Internal]` Sends NDA signing emails via Gmail SMTP

**Response `200`:**
```json
{
  "meeting": {
    "id": "uuid",
    "start_time": "2026-07-01T09:00:00.000Z",
    "calcom_booking_id": "abc123xyz",
    "video_link": "https://bayn.daily.co/meeting-uuid",
    "is_initial_meeting": true,
    "is_accessible": false
  },
  "contract": {
    "id": "uuid",
    "contract_type": "nda",
    "status": "pending_party_one"
  },
  "chat_channel": {
    "id": "uuid",
    "project_id": "uuid"
  },
  "message": "Request accepted. NDA has been sent to both parties via email."
}
```

---

### Contracts (NDA)

> **Internal endpoint — external services called behind the scenes.**
> The client only submits a base64 PNG signature and receives a status response.
> All external calls (R2 upload, PDF generation, Gmail email) are invisible to the frontend.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/contracts/sign/{token}` | Token only | Contract preview for the signing page — token itself is the credential, no JWT needed |
| POST | `/contracts/sign/{token}` | Token only | Submit digital signature → **[Internal → R2 + Gmail]** signature PNG uploaded to R2 → PDF generated and stored in R2 → signing email sent via Gmail SMTP → if party two signs: `Meeting.is_accessible = true` |
| GET | `/contracts/{id}` | Yes | Retrieve signed contract including `generated_pdf_key` |

#### What happens inside `POST /contracts/sign/{token}` (in order):

1. `[Internal]` Validate token → identify which party (one or two) is signing
2. `[External → R2]` Upload signature PNG to `contracts/{contract_id}/sig_p1.png` or `sig_p2.png`
3. `[Internal]` Overlay signature on the NDA PDF using PyMuPDF
4. `[External → R2]` Store the resulting PDF:
   - If party one → `contracts/{contract_id}/signed_p1.pdf` (intermediate)
   - If party two → `contracts/{contract_id}/final.pdf` (final, fully signed)
5. `[External → Gmail SMTP]` Send email:
   - If party one signed → send signing link to party two
   - If party two signed → send final PDF link to both parties
6. `[Internal]` Update `CONTRACT.status`:
   - Party one signs → `pending_party_two`
   - Party two signs → `signed` + set `MEETING.is_accessible = true`

**Response `200` (Party One signs):**
```json
{
  "contract_id": "uuid",
  "status": "pending_party_two",
  "party_one_signed_at": "2026-06-24T11:00:00.000Z",
  "message": "Signature recorded. NDA sent to the other party for signing."
}
```

**Response `200` (Party Two signs — fully signed):**
```json
{
  "contract_id": "uuid",
  "status": "signed",
  "party_two_signed_at": "2026-06-24T12:00:00.000Z",
  "generated_pdf_url": "https://r2.bayn.sa/contracts/uuid/final.pdf",
  "meeting": {
    "id": "uuid",
    "start_time": "2026-07-01T09:00:00.000Z",
    "video_link": "https://bayn.daily.co/meeting-uuid",
    "is_accessible": true
  },
  "message": "NDA fully signed. The meeting is now accessible."
}
```

---

### Meetings

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/meetings` | Yes | List user's meetings |
| GET | `/meetings/{id}` | Yes | Meeting detail including `is_accessible` |
| GET | `/meetings/{id}/join` | Yes | Generate Daily.co token → returns `join_url` |
| POST | `/meetings/{id}/attendance` | Yes (Owner) | Record member attendance (present / absent / late) |

---

### Chat


| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/projects/{id}/chat` | Yes | Retrieve chat channel details (channel info + online members) |
| GET | `/projects/{id}/chat/messages` | Yes | Fetch historical messages (Pagination) |
| POST | `/projects/{id}/chat/upload` | Yes | Upload a file or image → stored in R2 → returns `file_url` to send in chat |
| WS | `/ws/projects/{id}/chat` | Yes | WebSocket: real-time messages, typing indicators, online status |

#### WebSocket — Request & Response

** Request (Client → Server — Send a message):**
```json
{
  "event": "message",
  "sender_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "content": "Hello, the files have been received and are being worked on.",
  "file_url": null,
  "mentioned_user_id": null
}
```

** Response (Server → all channel members — Broadcast):**
```json
{
  "event": "new_message",
  "message_id": "4a2d12bc-8f1a-4c2b-9e4f-1a5c8e2f3a1b",
  "channel_id": "7c3e21ab-4d2f-4b1a-9c3d-8f5a4e3b2c1d",
  "sender_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "sender_name": "Ahmed Al-Otaibi",
  "content": "Hello, the files have been received and are being worked on.",
  "file_url": null,
  "mentioned_user_id": null,
  "created_at": "2026-06-28T09:45:00Z"
}
```

**Other WebSocket events:**
```json
{ "event": "typing",       "sender_id": "uuid", "is_typing": true }
{ "event": "user_online",  "user_id": "uuid" }
{ "event": "user_offline", "user_id": "uuid" }
```

#### GET `/projects/{id}/chat`
**Response `200`:**
```json
{
  "channel_id": "uuid",
  "project_id": "uuid",
  "members": [
    { "id": "uuid", "username": "sara_dev", "is_online": true },
    { "id": "uuid", "username": "ahmed_dev", "is_online": false }
  ]
}
```

#### GET `/projects/{id}/chat/messages`
**Query params:** `?page=1&limit=50`

**Response `200`:**
```json
{
  "data": [
    {
      "message_id": "uuid",
      "channel_id": "uuid",
      "sender_id": "uuid",
      "sender_name": "Sara Mohammed",
      "content": "Welcome to the project!",
      "file_url": null,
      "mentioned_user_id": null,
      "is_deleted": false,
      "created_at": "2026-06-24T10:00:00.000Z"
    },
    {
      "message_id": "uuid",
      "channel_id": "uuid",
      "sender_id": "uuid",
      "sender_name": "Ahmed Ali",
      "content": null,
      "file_url": "https://r2.bayn.sa/chat/project-uuid/2026/06/brief.pdf",
      "mentioned_user_id": null,
      "is_deleted": false,
      "created_at": "2026-06-24T10:05:00.000Z"
    }
  ],
  "total": 2,
  "page": 1,
  "pages": 1
}
```

---

### Tasks & Dashboard

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/projects/{id}/tasks` | Yes | Create task |
| GET | `/projects/{id}/tasks` | Yes | List tasks — filterable by status, priority |
| PATCH | `/projects/{id}/tasks/{task_id}` | Yes | Update task |
| GET | `/projects/{id}/tasks/progress` | Yes | Progress summary: % done, overdue, top contributor |
| GET | `/dashboard` | Yes | Aggregated view: upcoming meetings, tasks, requests, contracts |
| GET | `/dashboard/calendar` | Yes | Calendar: combines `MEETING.start_time` + `TASK.due_date` |

---

## API Classification Summary

| # | Method | Endpoint | Type | Notes |
|---|---|---|---|---|
| 1 | POST | `/projects/{id}/meeting-requests` | Internal | Stored in DB |
| 2 | GET | `/meeting-requests` | Internal | DB query |
| 3 | POST | `/meeting-requests/{id}/accept` | Internal → [Cal.com + Daily.co] | Calls external APIs behind the scenes |
| 4 | POST | `/meeting-requests/{id}/reject` | Internal | DB update |
| 5 | GET | `/contracts/sign/{token}` | Internal | Token-secured, no JWT needed |
| 6 | POST | `/contracts/sign/{token}` | Internal → [R2 + Gmail SMTP] | Signature stored in R2, PDF generated in R2, email sent via Gmail |
| 7 | GET | `/projects/{id}/chat` | Internal | DB query |
| 8 | GET | `/projects/{id}/chat/messages` | Internal | DB query + pagination |
| 9 | POST | `/projects/{id}/chat/upload` | Internal → [R2] | File stored in R2, URL returned |
| 10 | WS | `/ws/projects/{id}/chat` | Internal (FastAPI WS) | No external service — pure FastAPI WebSocket |

> **Note:** Endpoints 3, 6, and 9 are internal from the client's perspective but call external services behind the scenes:
> - **Endpoint 3** calls Cal.com (create booking) and Daily.co (create private room)
> - **Endpoint 6** uploads the signature PNG to Cloudflare R2, generates the signed PDF and stores it in R2, then sends the signing link or final PDF via Gmail SMTP — the client only submits a base64 PNG and receives a status response
> - **Endpoint 9** uploads the file to Cloudflare R2 and returns the file URL
>
> The client never interacts with Cal.com, Daily.co, Cloudflare R2, or Gmail directly.

---

## Scalability and Efficiency

The architecture separates the system into independent components: frontend, backend, database, storage, scheduling, meetings, email, and real-time chat. This separation makes the MVP easier to maintain, test, and scale.

- **React** — flexible and responsive user interface
- **FastAPI** — lightweight async backend with built-in WebSocket support for real-time chat
- **PostgreSQL** — reliable structured storage for all platform data
- **Cal.com** — scheduling without building a calendar engine from scratch
- **Daily.co** — video rooms without managing WebRTC infrastructure
- **Cloudflare R2** — scalable object storage with CDN delivery and zero egress fees
- **Gmail SMTP** — transactional email for OTP, NDA signing links, and notifications
- **FastAPI WebSocket** — real-time chat handled natively by the backend, no third-party dependency