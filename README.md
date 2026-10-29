# Honey's World High School — CBT Examination & Student Assessment System
**Location:** Gaa Ajanaku, Ilorin, Kwara State, Nigeria  
**Institutional Motto:** *Knowledge, Character & Academic Excellence*  
**Platform Version:** 2.0.0 (Institutional Production Release)

---

## 1. Executive Summary

This repository contains the complete codebase for the official **Computer-Based Testing (CBT), Continuous Assessment (CA) Master Broadsheet, and Student Information System (SIS)** built specifically for **Honey's World High School**, located in Gaa Ajanaku, Ilorin, Kwara State.

The application serves three distinct institutional stakeholders with strict role isolation:
1. **Students**: University-style Student Information System (SIS) with matriculation numbers, scheduled CBT examination launchpads with strict access timeframes, real-time Continuous Assessment broadsheet synchronization, cumulative 5.00 CGPA transcripts, Google Gemini 3.8 Flash AI Academic Mentorship, interactive self-paced practice tests (Tutor & Timed Exam modes), passport photo upload, and personal password management.
2. **Teachers & Faculty Instructors**: Curriculum examination creation, access window timeframe controls, question bank authoring with bulk CSV importer, class-by-class student enrolment, auto-generated unique student access codes, and a comprehensive Continuous Assessment Master Broadsheet (40% Continuous Assessment / 60% Exam) with automatic CBT score synchronization and multi-level save controls.
3. **Institutional Administrators**: Super-administrative governance for school sessions, terms, pass marks, system backups, and global configuration.

---

## 2. Technology Stack & Architecture

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 19 (Functional Components, Custom Hooks, Context-free modular state) |
| **Language & Typing** | TypeScript 5+ (Strict type safety, complete domain interfaces) |
| **Bundler & Build Tool** | Vite 8 (Native ESM bundling, dynamic code splitting) |
| **Styling & Design System** | Tailwind CSS v4 (`@tailwindcss/vite`), Zero-Pill Typography, Responsive Layouts |
| **AI Academic Advisor** | Google GenAI SDK (`@google/genai`), Google Gemini 3.8 Flash (`gemini-3.8-flash`) |
| **Database & Real-time Sync** | Google Cloud Firestore (v13 Firebase SDK), Real-time Snapshots, Security Rules |
| **Production Server** | Node.js 22 + Express (Dynamic `$PORT` binding for Cloud Run / Container deployment) |
| **Icons & Visuals** | Lucide React, Canvas Confetti |

---

## 3. Codebase File Map & Directory Structure

Here is where every element and functionality of the application lives:

```text
├── .env.example                            # Template for environment variables (Gemini API keys, etc.)
├── firebase-applet-config.json             # Active Firebase project & Firestore database credentials
├── firebase-blueprint.json                # Firestore database schema blueprint and field constraints
├── firestore.rules                         # Production Firestore security rules with RBAC validation
├── index.html                              # HTML entry point with Honey's World High School meta tags
├── package.json                            # Scripts, dependencies (React 19, Firebase, GenAI, Express)
├── server.js                               # Node.js production web server (ES module for Cloud Run)
├── server.ts                               # TypeScript mirror of production web server
├── tsconfig.json                           # TypeScript compiler configuration (ES2022, bundler mode)
├── vite.config.ts                          # Vite 8 config with Tailwind v4 & React plugin integration
│
└── src/
    ├── App.tsx                             # Main client router, session state, navigation controller
    ├── main.tsx                            # React DOM entry root
    │
    ├── types/
    │   └── cbt.ts                          # Central domain models (Student, Examination, Question,
    │                                       # Submission, StaffMember, StudentAssessmentRecord,
    │                                       # SchoolSettings, CGPA calculators, grading scales)
    │
    ├── data/
    │   ├── initialSchoolData.ts            # Baseline default data for classes (JSS1-SS3), subjects,
    │   │                                   # default staff, initial students, and school settings
    │   └── practiceQuestionsData.ts        # Question bank and syllabus topics for Mathematics,
    │                                       # English, Physics, Chemistry, Biology, Economics, etc.
    │
    ├── services/
    │   ├── firebase.ts                     # Firestore persistence layer (real-time CA subscriptions,
    │   │                                   # student credentials auth, staff auth, CRUD operations)
    │   └── aiAdvisor.ts                    # Google Gemini 3.8 Flash academic mentor engine with
    │                                       # heuristic diagnostic fallback & 7-day study planner
    │
    └── components/
        ├── common/
        │   ├── InstitutionalHeader.tsx     # Institutional top navigation bar with school name & address
        │   └── LandingGateway.tsx          # Public institutional portal gateway for Honey's World High School
        │
        ├── student/
        │   ├── StudentLogin.tsx            # Clean, private student login (Passcode/Adm No OR Email + Password)
        │   ├── StudentDashboardView.tsx    # University SIS portal (matric banner, live gradebook sync, tabs)
        │   ├── StudentExamScreen.tsx       # Live CBT exam interface with countdown timer & auto-submission
        │   ├── StudentResultView.tsx       # Official printable examination result slip with verification ref
        │   ├── StudentCumulativeTranscript.tsx # Official cumulative transcript with 5.00 CGPA & print styles
        │   ├── StudentPracticeQuiz.tsx     # Self-paced practice tests (Tutor Mode & Timed Exam Mode)
        │   ├── StudentAiAdvisorView.tsx    # Gemini AI academic diagnostic, strengths, and study planner
        │   ├── StudentProfileView.tsx      # Student profile editor, passport photo upload, password reset
        │   ├── StudentHistoryView.tsx      # Historical log of completed examinations and scores
        │   └── CbtCalculator.tsx           # Floating on-screen scientific/standard calculator for exams
        │
        ├── teacher/
        │   ├── TeacherLogin.tsx            # Secure faculty login by Staff ID and password (no exposed lists)
        │   ├── TeacherPortal.tsx           # Main faculty dashboard, exam CRUD, student management
        │   ├── ContinuousAssessmentSheet.tsx # 40/60 Master Gradebook with auto-fill CBT & multi-level save
        │   ├── TeacherProfileSection.tsx   # Teacher profile, qualification, discipline, and password reset
        │   ├── StudentBatchUploadModal.tsx # Bulk student enrollment via CSV upload
        │   └── StudentSlipsModal.tsx       # Bulk printable student credential login slips
        │
        └── admin/
            ├── AdminLogin.tsx              # Secure multi-admin login (Super Admin & Delegated Administrators)
            ├── AdminPortal.tsx             # Master Institutional Governance Console (KPIs & Tab Orchestration)
            ├── AdminUserManagementTab.tsx  # Multi-admin manager: add co-admins, roles, passcodes, permissions
            ├── AdminBrandAndPoliciesTab.tsx# School branding editor: name, address, motto, principal, announcements
            ├── AdminGradingScaleTab.tsx    # CA Broadsheet weightings (10/10/20/60) & WAEC 9-grade scale thresholds
            ├── AdminCurriculumTab.tsx      # Curriculum governance: add/edit/delete classes and subjects
            ├── AdminExamsTab.tsx           # Global examinations schedule & Question Bank authoring modal
            ├── AdminBroadsheetTab.tsx      # Master CA broadsheet editor for any class/subject with CBT auto-fill
            ├── AdminSubmissionsTab.tsx     # CBT examination submissions audit & candidate retake reset
            └── StaffSlipsModal.tsx         # Bulk printable staff credential slips with unique login IDs
```

---

## 4. Step-by-Step Build & Implementation Breakdown

### A. The Student Information System (SIS) & Portal
- **University SIS Aesthetic (`src/components/student/StudentDashboardView.tsx`)**:
  - Displays the student's passport photograph, official matriculation/admission number (e.g., `STU/2025/001`), enrolled class cohort, and active academic session.
  - A pulsating real-time indicator (`Live Gradebook Sync`) connects to Firestore via `subscribeStudentAssessmentRecords` in `src/services/firebase.ts`. Whenever any subject teacher inputs or adjusts scores in the staff portal, marks update live without requiring a page reload.
  - Features an intuitive tab navigation: Examinations, Live Results Sheet, Cumulative Transcript (CGPA), Practice Tests, AI Academic Advisor, and Student Profile.

- **Class-Peculiar Examinations & Timeframe Enforcement (`src/components/student/StudentDashboardView.tsx`, `src/types/cbt.ts`)**:
  - Uses `isClassMatch` normalization so students only see examinations specific to their enrolled form (e.g., `SS 2`).
  - `checkExamTimeWindow(exam)` enforces start and closing dates/times. If a student attempts to take an exam before its opening or after its deadline, access is blocked with a clear notice.

- **Cumulative Results & 5.00 CGPA Transcript (`src/components/student/StudentCumulativeTranscript.tsx`)**:
  - Implements standard university 5.00 Grade Point Average calculations via `calculateGradePoint(totalScore)`:
    - `75–100%`: **A1 (5.00 Points — First Class Honours / Distinction)**
    - `70–74%`: **B2 (4.00 Points — Second Class Upper Division)**
    - `65–69%`: **B3 (3.50 Points — Upper Credit)**
    - `60–64%`: **C4 (3.00 Points — Credit)**
    - `55–59%`: **C5 (2.50 Points — Credit)**
    - `50–54%`: **C6 (2.00 Points — Credit)**
    - `45–49%`: **D7 (1.50 Points — Pass)**
    - `40–44%`: **E8 (1.00 Points — Pass)**
    - `0–39%`: **F9 (0.00 Points — Fail)**
  - Includes a print button formatted with CSS `@media print` rules, producing an official Statement of Academic Result with the Honey's World High School crest, registration details, grading key, and signature blocks.

- **Interactive Practice Test Engine (`src/components/student/StudentPracticeQuiz.tsx`)**:
  - Allows students to practice across Mathematics, English Language, Physics, Chemistry, Biology, Economics, and Computer Studies.
  - **Tutor Mode**: Offers immediate pedagogical feedback, displaying detailed step-by-step mathematical derivations or grammatical explanations as soon as an option is chosen.
  - **Timed Exam Mode**: Simulates CBT examination conditions with a countdown timer and a full post-test review scorecard.

- **Google Gemini 3.8 Flash AI Academic Mentor (`src/services/aiAdvisor.ts`, `src/components/student/StudentAiAdvisorView.tsx`)**:
  - Connects to Google Gemini (`gemini-3.8-flash`) via the modern `@google/genai` TypeScript SDK.
  - Ingests Continuous Assessment broadsheet scores and past CBT attempts to generate an executive diagnostic, projected CGPA tier, subject strengths, remediation instructions for weak areas, and a 7-day personalized revision timetable with daily durations and topics.
  - Includes an intelligent heuristic fallback engine so students still receive comprehensive analytical feedback even if offline or if API quotas are temporarily exhausted.

- **Student Profile, Passport Upload & Password Reset (`src/components/student/StudentProfileView.tsx`)**:
  - **Passport Upload**: Supports custom device file uploads (stored as base64 data URLs in Firestore) as well as preset academic portrait avatars.
  - **Connected Email**: Allows students to connect a personal email address for notifications.
  - **Password Management**: Lets students create or update their own personal security password.
  - **Credentials Card**: Displays the unique student passcode (`PRM-XXXXX`) and admission number with 1-click clipboard copy.

- **Secure Login (`src/components/student/StudentLogin.tsx`)**:
  - Supports dual authentication modes: **Passcode / Admission Number** OR **Connected Email + Password**.
  - All public directories of registered student names have been hidden to ensure complete student data privacy.

---

### B. The Teacher & Faculty Portal
- **Faculty Authentication (`src/components/teacher/TeacherLogin.tsx`)**:
  - Allows teachers to sign in using their Unique Staff ID (e.g., `TCH-1001`) and personal password.
  - Roster directories are kept private and hidden from the login screen.

- **Continuous Assessment Master Broadsheet (`src/components/teacher/ContinuousAssessmentSheet.tsx`)**:
  - Matches the standard Nigerian secondary school assessment format:
    - **Assignment** (10 Marks)
    - **Project / Practical** (10 Marks)
    - **CA Test** (20 Marks)
    - **CA Total** (Automatically calculated out of 40 Marks)
    - **Examination** (60 Marks)
    - **Total Score** (Automatically calculated out of 100 Marks)
    - **Grade & Remark** (Automatically computed: A1–F9, Excellent to Fail)
  - **Auto-Fill CBT Scores**: One-click button that scans all student objective CBT exam attempts for that subject, scales the percentage to 60 marks, and populates the Exam column automatically.
  - **Multi-Level Save System**:
    1. **Top Ribbon Save Button**: Prominent emerald button with unsaved change badges and saving spinners.
    2. **Bottom-of-Table Action Card**: A full-width footer card with `Save All Scores ([X] Students)` and `Auto-Fill CBT`.
    3. **Persistent Floating Toolbar**: Anchors to the bottom of the screen while scrolling through long class rosters so saving is always one click away.
    4. **Row-Level Save**: An individual Save button on every student row to commit single marks immediately.
  - **Sanitized Document IDs**: Record IDs are sanitized (`[^a-zA-Z0-9_-]` converted to underscores) to prevent Firestore nested subcollection path errors when admission numbers contain slashes (e.g., `STU/2025/001`).

- **Examination & Question Management (`src/components/teacher/TeacherPortal.tsx`)**:
  - Create and configure exams with title, duration, question count, and specific access timeframes (Start Date/Time and End Date/Time).
  - Add, edit, and delete multiple-choice questions with options A–D, correct answer key, syllabus topic, and explanation.
  - Bulk question import via CSV files with instant syntax validation.

- **Teacher Profile & Security (`src/components/teacher/TeacherProfileSection.tsx`)**:
  - Update qualification, discipline/course of study, phone number, bio, and avatar.
  - Set or reset custom faculty login passwords.

---

### C. Database & Security Layer (`firestore.rules`, `src/services/firebase.ts`)
- Configured for project `ai-studio-primecbtpractice-04b8cb97-2db7-4c39-a5cf-d6203d6d046e`.
- Security rules enforce schema constraints on `examinations`, `questions`, `students`, `teachers`, `attempts`, `submissions`, and `caRecords`.
- Real-time client listeners (`onSnapshot`) combined with cross-tab local storage broadcasts (`caRecordsUpdated`) ensure instant synchronization across student and teacher tabs.

---

## 5. Build & Setup Instructions

### Prerequisites
- Node.js version **20.x or 22.x** installed on your computer.
- npm version **9.x or 10.x**.

### Step 1: Clone the Repository
```bash
git clone https://github.com/<your-username>/honeys-world-cbt.git
cd honeys-world-cbt
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Run the Development Server
```bash
npm run dev
```
The application will launch locally at `http://localhost:3000`.

### Step 4: Verify Type Safety & Production Build
```bash
# Typecheck TypeScript files
npm run lint

# Compile optimized production assets
npm run build
```
Compiled assets will be placed cleanly into the `dist/` directory.

### Step 5: Test the Production Server Locally
```bash
npm start
```
Starts `server.ts` (or `server.js`) on `http://localhost:3000`, serving the production bundle with SPA fallback routing and a `/healthz` endpoint.

---

## 6. Resolving the "User Exceeded Cloud Services Quota" Error

### What Does This Error Mean?
When clicking **Publish** in Google AI Studio Build, the platform attempts to automatically deploy a container image to Google Cloud Run under your Google Cloud project.

The message **"user exceeded cloud services quota"** is a Google Cloud infrastructure limit error. It occurs because:
1. The free-tier quota for active Cloud Run services or revisions has been reached on your Google account.
2. The daily Cloud Build container build minutes quota has been exhausted.
3. Too many revisions or deployments are currently active in that Google Cloud project.

### How to Fix / Proceed:

#### Option 1: Clean Up Existing Cloud Run Services in Google Cloud Console
1. Visit the [Google Cloud Run Console](https://console.cloud.google.com/run).
2. Ensure you have selected the project associated with your account (`ai-studio-primecbtpractice-...` or your default AI Studio project).
3. Delete older or unused service revisions to free up your container quota.
4. If you have a billing account, ensure billing is enabled or request a quota increase under **IAM & Admin > Quotas**.

#### Option 2: Deploy to Free Alternatives (Vercel, Netlify, or Firebase Hosting)
Because this is a standard React + Vite SPA, you can deploy it in 2 minutes to any of the following free platforms:

##### Deploying to Vercel (Recommended):
1. Push this repository to GitHub (see Section 7 below).
2. Log into [vercel.com](https://vercel.com).
3. Click **Add New Project** and select your GitHub repository.
4. Vercel automatically detects Vite:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **Deploy**. Your app will be live with a free custom SSL domain.

##### Deploying to Firebase Hosting:
1. Install the Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in and initialize hosting:
   ```bash
   firebase login
   firebase init hosting
   ```
   - Select **Use an existing project** (`ai-studio-primecbtpractice-...`).
   - What do you want to use as your public directory? Enter `dist`.
   - Configure as a single-page app (rewrite all urls to /index.html)? Enter `Yes`.
3. Build and deploy:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

---

## 7. Step-by-Step Instructions to Push to GitHub

To push this entire codebase to your GitHub account:

### Step 1: Create a New Repository on GitHub
1. Log into your GitHub account at [https://github.com](https://github.com).
2. Click the **+** icon in the top-right corner and select **New repository**.
3. Name your repository (e.g., `honeys-world-high-school-cbt`).
4. Keep the repository public or private according to your preference.
5. **Do NOT** check "Add a README file" (we have already created this comprehensive one).
6. Click **Create repository**.
7. Copy the repository URL (e.g., `https://github.com/<your-username>/honeys-world-high-school-cbt.git`).

### Step 2: Initialize Git and Commit All Files Locally
Open your terminal in the root folder of this project and run:

```bash
# 1. Initialize git (if not already initialized)
git init

# 2. Add all project files
git add .

# 3. Create initial commit
git commit -m "feat: complete CBT platform and SIS for Honey's World High School"
```

### Step 3: Link Remote and Push to GitHub
```bash
# 4. Rename default branch to main
git branch -M main

# 5. Add your GitHub remote repository (replace with your actual URL)
git remote add origin https://github.com/<your-username>/honeys-world-high-school-cbt.git

# 6. Push code to GitHub
git push -u origin main
```

---

## 8. Summary of Institutional Credentials for Testing

- **School Name**: Honey's World High School
- **Campus Address**: Gaa Ajanaku, Ilorin, Kwara State, Nigeria
- **Administrator Portal Route**: `/admin` (Super-Admin: `fathertemitope@gmail.com`)
- **Teacher Portal Route**: `/teacher/login` (Sample Staff ID: `TCH-1001`, `TCH-1002`, `TCH-1003`)
- **Student Portal Route**: `/student/login` (Sample Admission No: `STU/2025/001`, `STU/2025/002` or Access Code: `PRM-4821`)

---
*Maintained by the Directorate of Academic Affairs & Educational Technology, Honey's World High School, Gaa Ajanaku, Ilorin, Kwara State.*
