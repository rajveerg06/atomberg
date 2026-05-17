# GoalTrack Enterprise Goal Management Portal

A comprehensive web-based portal designed for enterprise-wide goal setting, approval, and tracking. Built to replace manual, fragmented goal-tracking workflows.

## Features Included (Phases 1 & 2)

- **Goal Creation & Approval Workflow**: Employees create goals, Managers review and approve/reject them.
- **Strict Validations**: Enforced 10% minimum weightage per goal, maximum 8 goals, and strict 100% total weightage before submission.
- **Role-Based Access Control**: Separate views and functionalities for Employees, Managers, and Admins.
- **Quarterly Check-ins**: Dedicated module for employees to input actual achievements against targets.
- **System-Computed Progress**: Auto-calculation of progress scores based on UoM types (Numeric, %, Timeline, Zero-based).
- **Premium Dynamic UI**: Modern glassmorphism UI with smooth animations, dark mode, and responsive layout.
- **Rich Dashboard Analytics**: Recharts integration for visual progress tracking and completion stats.
- **Audit Trails & Shared Goals**: Built-in backend support for detailed auditing and departmental KPI sharing.

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Recharts, Tailwind-style custom CSS.
- **Backend**: Node.js, Express, better-sqlite3 (SQLite database with WAL mode for production readiness).
- **Authentication**: JWT-based stateless authentication.

## How to Run the Application

Since terminal commands cannot be run automatically in this environment, please open your terminal (PowerShell or Command Prompt) and run the provided startup script, or follow the manual steps below.

### Option 1: Quick Start Script (Windows)

Open PowerShell as Administrator (or in this directory) and run:
```powershell
.\start.ps1
```
This script will install all dependencies and start both the Backend (Port 5000) and Frontend (Port 5173).

### Option 2: Manual Setup

1. **Install Root Dependencies**:
   Open a terminal window in the root `Atomberg` folder and install the concurrent task runner:
   ```bash
   npm install
   ```

2. **Start Both Servers Together**:
   Run the following command from the root folder:
   ```bash
   npm run dev
   ```
   *This will automatically start both the backend and frontend simultaneously in the same terminal window.*

3. **Open Application**:
   Navigate to `http://localhost:5173` in your browser.

## Demo Accounts

The database is pre-seeded with the following accounts (Password for all is `password123` or `admin123`/`manager123`/`emp123` as listed below):

- **Admin / HR**: `admin@atomberg.com` | Pass: `admin123`
- **Manager (Engineering)**: `raj.patel@atomberg.com` | Pass: `manager123`
- **Manager (Sales)**: `priya.singh@atomberg.com` | Pass: `manager123`
- **Employee**: `arjun.kumar@atomberg.com` | Pass: `emp123`

## Implementation Details

- **Database**: The system uses `better-sqlite3` which creates a file at `backend/data/goaltrack.db`. The schema is fully normalized and includes extensive constraints to guarantee data integrity.
- **Security**: Passwords are hashed using `bcryptjs`. API routes are protected by JWT tokens and role-based middleware.
- **Design System**: A custom CSS design system `index.css` implements a stunning "Glassmorphism" dark theme with glowing accents, matching the requirement for visual excellence.

Enjoy using GoalTrack!
