## Components, Classes, and Database Design
 
### Backend Classes by Feature
 
#### identity
| Class | Type | Key Attributes |
|---|---|---|
| `User` | Model | id, first/second/third/last_name_ar, first/second/third/last_name_en, national_id (UK), email (UK), username (UK), phone_country_id (FK), phone_number, industry_id (FK), role, password_hash, avatar_key, calcom_user_id/access_token/refresh_token, is_active, is_email_verified, is_number_verified, deleted_at |
| `UserRole` | Enum | ADMIN \| USER — platform-wide only |
| `ExternalProject` | Model | id, user_id (FK), title, role, year_completed, description, project_url |
| `UserCreate / UserLogin / UserUpdate` | Pydantic schemas | Request payload validation |
| `UserResponse / TokenResponse` | Pydantic schemas | Output — never exposes password_hash or tokens |
| `get_current_user() → get_current_active_user() → require_admin()` | Dependencies | Chained JWT guards — checks deleted_at, is_active, is_email_verified in order |
 
#### catalog
| Class | Type | Key Attributes |
|---|---|---|
| `Country` | Model | id, name_en, name_ar, iso2 (UK), dial_code — pre-seeded |
| `Skill / Specialization` | Model | id, name (UK), is_approved |
| `Industry` | Model | id, name (UK) |
| `UserSkill / UserSpecialization` | Model (join tables) | id, user_id (FK), skill_id / specialization_id (FK) |
 
#### projects
| Class | Type | Key Attributes |
|---|---|---|
| `Project` | Model | id, title, description, more_info, specialization_id (FK), industry_id (FK), is_hidden |
| `ProjectMembership` | Model | id, user_id (FK), project_id (FK), role (OWNER \| MEMBER) |
| `ProjectRole` | Enum | OWNER \| MEMBER — per-project, separate from UserRole |
 
#### meetings
| Class | Type | Key Attributes |
|---|---|---|
| `MeetingRequest` | Model | id, requester_id (FK), owner_id (FK), project_id (FK), proposed_start_time, proposed_end_time, message, status, expires_at, resulting_meeting_id (FK) |
| `MeetingRequestStatus` | Enum | PENDING \| ACCEPTED \| REJECTED \| CANCELLED \| EXPIRED |
| `Meeting` | Model | id, user_id (FK), counterpart_id (FK), project_id (FK), title, start_time, end_time, is_initial_meeting, calcom_booking_id, video_link |
| `MeetingAttendance` | Model | id, meeting_id (FK), membership_id (FK), status (present \| absent \| late), joined_at, left_at |
 
#### contracts
| Class | Type | Key Attributes |
|---|---|---|
| `Contract` | Model | id, contract_type, status, meeting_id (FK), project_id (FK), confidentiality_period_months, party_one_user_id (FK), party_one_name, party_one_national_id, party_one_token (UK), party_one_signature_image, party_one_signed_pdf, party_one_signed_at, party_one_signer_ip, party_two_*(same set), generated_pdf_key |
| `ContractStatus` | Enum | PENDING_PARTY_ONE → PENDING_PARTY_TWO → SIGNED \| EXPIRED |
| `ContractType` | Enum | NDA \| COMMITMENT |
 
#### livechat
| Class | Type | Key Attributes |
|---|---|---|
| `ChatChannel` | Model | id, project_id (FK, unique), created_at — one channel per project |
| `ChatMember` | Model | id, channel_id (FK), user_id (FK), is_online |
| `Message` | Model | id, channel_id (FK), sender_id (FK), content, file_url, mentioned_user_id (FK), created_at |
 
#### tasks
| Class | Type | Key Attributes |
|---|---|---|
| `Task` | Model | id, project_id (FK), created_by_membership_id (FK), assigned_to_membership_id (FK), title, description, status, priority, start_date, due_date |
| `TaskStatus` | Enum | TODO \| IN_PROGRESS \| DONE |
| `TaskPriority` | Enum | LOW \| MEDIUM \| HIGH |
 
---
 
### Database Schema Reference
 
All tables use a UUID primary key and inherit `created_at` / `updated_at` from `BaseMixin`.
 
| Table | Feature | Purpose |
|---|---|---|
| `users` | identity | Core account record |
| `authentica_otp_log` | identity | OTP request log (reference_id from Authentica) |
| `external_projects` | identity | Self-reported off-platform project history |
| `countries` | catalog | Pre-seeded country reference (iso2, dial_code) |
| `skills / specializations` | catalog | User-extensible reference banks |
| `industries` | catalog | Industry reference (one per user via FK) |
| `user_skills / user_specializations` | catalog | Many-to-many join tables |
| `projects` | projects | Project listings |
| `project_memberships` | projects | User ↔ Project with role (max 2 active per user) |
| `meeting_requests` | meetings | Pre-join negotiation (Talent → Owner) |
| `meetings` | meetings | Confirmed Cal.com bookings with Daily.co room links |
| `meeting_attendance` | meetings | Presence record per member per meeting |
| `contracts` | contracts | NDA / Commitment — two-stage signing flow |
| `chat_channels` | livechat | One channel per project (created on project creation) |
| `chat_members` | livechat | Channel membership (mirrors project_memberships) |
| `messages` | livechat | Full message storage (text + file_url) |
| `tasks` | tasks | Project tasks with status, priority, and due dates |
| `project_files` | documents | Organized file storage per project |
 
---
 
 
## Database Schema — Entity-Relationship Diagram

```mermaid
erDiagram

  USER {
    uuid id PK
    string first_name_ar
    string second_name_ar
    string third_name_ar
    string last_name_ar
    string first_name_en
    string second_name_en
    string third_name_en
    string last_name_en
    string national_id UK
    string email UK
    string username UK
    uuid phone_country_id FK
    string city
    integer phone_number
    uuid industry_id FK
    enum role
    string password_hash
    string git_profile
    string avatar_key
    string calcom_user_id
    string calcom_access_token
    string calcom_refresh_token
    bool is_active
    bool is_email_verified
    bool is_number_verified
    datetime deleted_at
    datetime created_at
    datetime updated_at
  }

  COUNTRY {
    uuid id PK
    string name_en
    string name_ar
    string iso2 UK
    string dial_code
    datetime created_at
    datetime updated_at
  }

  AUTHENTICA_OTP_LOG {
    uuid id PK
    uuid user_id FK
    enum channel
    string reference_id
    enum status
    datetime sent_at
    datetime verified_at
    datetime created_at
  }

  EXTERNAL_PROJECT {
    uuid id PK
    uuid user_id FK
    string title
    string role
    string year_completed
    string description
    datetime created_at
  }

  SKILL {
    uuid id PK
    string name UK
    bool is_approved
    datetime created_at
  }

  SPECIALIZATION {
    uuid id PK
    string name UK
    bool is_approved
    datetime created_at
  }

  INDUSTRY {
    uuid id PK
    string name UK
    datetime created_at
  }

  USER_SKILL {
    uuid id PK
    uuid user_id FK
    uuid skill_id FK
  }

  USER_SPECIALIZATION {
    uuid id PK
    uuid user_id FK
    uuid specialization_id FK
  }

  PROJECT {
    uuid id PK
    string title
    string description
    string more_info
    uuid specialization_id FK
    uuid industry_id FK
    bool is_hidden
    datetime created_at
    datetime updated_at
  }

  PROJECT_MEMBERSHIP {
    uuid id PK
    uuid user_id FK
    uuid project_id FK
    enum role
    datetime created_at
    datetime updated_at
  }

  MEETING_REQUEST {
    uuid id PK
    uuid requester_id FK
    uuid owner_id FK
    uuid project_id FK
    datetime proposed_start_time
    datetime proposed_end_time
    string message
    enum status
    datetime expires_at
    uuid resulting_meeting_id FK
    datetime created_at
    datetime updated_at
  }

  MEETING {
    uuid id PK
    uuid user_id FK
    uuid counterpart_id FK
    uuid project_id FK
    string title
    datetime start_time
    datetime end_time
    bool is_initial_meeting
    string calcom_booking_id
    string video_link
    datetime created_at
    datetime updated_at
  }

  CONTRACT {
    uuid id PK
    enum contract_type
    enum status
    uuid meeting_id FK
    uuid project_id FK
    int confidentiality_period_months
    uuid party_one_user_id FK
    string party_one_name
    string party_one_national_id
    string party_one_token UK
    string party_one_signature_image
    string party_one_signed_pdf
    datetime party_one_signed_at
    string party_one_signer_ip
    uuid party_two_user_id FK
    string party_two_name
    string party_two_national_id
    string party_two_token UK
    string party_two_signature_image
    datetime party_two_signed_at
    string party_two_signer_ip
    string generated_pdf_key
    datetime created_at
    datetime updated_at
  }

  CHAT_CHANNEL {
    uuid id PK
    uuid project_id FK
    datetime created_at
    datetime updated_at
  }

  CHAT_MEMBER {
    uuid id PK
    uuid channel_id FK
    uuid user_id FK
    bool is_online
    datetime created_at
  }

  MESSAGE {
    uuid id PK
    uuid channel_id FK
    uuid sender_id FK
    string content
    string file_url
    uuid mentioned_user_id FK
    bool is_deleted
    datetime created_at
  }

  TASK {
    uuid id PK
    uuid project_id FK
    uuid created_by_membership_id FK
    uuid assigned_to_membership_id FK
    string title
    string description
    enum status
    enum priority
    datetime start_date
    datetime due_date
    datetime created_at
    datetime updated_at
  }

  COUNTRY ||--o{ USER : "phone country"
  USER ||--o{ AUTHENTICA_OTP_LOG : "receives"
  USER ||--o{ EXTERNAL_PROJECT : "lists"
  USER ||--o{ USER_SKILL : "has"
  USER ||--o{ USER_SPECIALIZATION : "has"
  USER }o--|| INDUSTRY : "belongs to"
  USER ||--o{ PROJECT_MEMBERSHIP : "holds (max 2)"
  USER ||--o{ MEETING_REQUEST : "sends"
  USER ||--o{ MEETING_REQUEST : "receives as owner"
  USER ||--o{ MEETING : "participates"
  USER ||--o{ CONTRACT : "signs party one"
  USER ||--o{ CONTRACT : "signs party two"
  USER ||--o{ CHAT_MEMBER : "is member"
  USER ||--o{ MESSAGE : "sends"

  SKILL ||--o{ USER_SKILL : "tagged by"
  SPECIALIZATION ||--o{ USER_SPECIALIZATION : "tagged by"

  PROJECT ||--o{ PROJECT_MEMBERSHIP : "has"
  PROJECT ||--o{ MEETING_REQUEST : "subject of"
  PROJECT ||--o{ MEETING : "hosts"
  PROJECT ||--o{ CONTRACT : "commitment for"
  PROJECT ||--|| CHAT_CHANNEL : "owns"
  PROJECT ||--o{ TASK : "has"

  MEETING_REQUEST ||--o| MEETING : "becomes on accept"
  MEETING ||--o{ CONTRACT : "gated by NDA"

  PROJECT_MEMBERSHIP ||--o{ TASK : "created tasks"
  PROJECT_MEMBERSHIP ||--o{ TASK : "assigned tasks"

  CHAT_CHANNEL ||--o{ CHAT_MEMBER : "has"
  CHAT_CHANNEL ||--o{ MESSAGE : "contains"
```

 
