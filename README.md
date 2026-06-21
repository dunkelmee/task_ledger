# StudioLedger — Freelance OS

A full-stack workflow management app for solo graphic designers covering the complete client → invoice pipeline.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Recharts + DnD Kit
- **Backend**: FastAPI + SQLAlchemy + Pydantic v2
- **Database**: PostgreSQL 15
- **Container**: Docker + Docker Compose

## Quick Start

```bash
# Clone and enter the project
cd freelance_platform

# Start all services
docker compose up --build
```

- **Frontend**: http://localhost:3000
- **API docs**: http://localhost:8000/docs
- **API base**: http://localhost:8000/api

## Development (without Docker)

### Backend
```bash
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql://freelance:freelance_pass@localhost:5432/freelance_db uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # runs on http://localhost:5173
```

## Features

| Module | Capabilities |
|---|---|
| **Clients** | Create/manage clients, contacts, lifecycle status |
| **Proposals** | Line items, pricing models, status tracking, convert to project |
| **Projects** | Budget tracking, revisions, Kanban board |
| **Kanban** | Drag-and-drop tasks across 6 columns |
| **Invoices** | Auto-numbering, line items, tax/discount, send/mark paid |
| **Payments** | Record payments, link to invoices, payment methods |
| **Expenses** | Categories, tax deductible flag, project linking |
| **Reports** | Revenue/expense charts, P&L summary, YTD metrics |
| **Dashboard** | Stats overview, income chart, proposal rate, project progress |
| **Settings** | Business info, invoice format, default currency/tax |

## Project Structure

```
freelance_platform/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py         # FastAPI app + CORS
│       ├── database.py     # SQLAlchemy setup
│       ├── models.py       # All ORM models
│       ├── schemas.py      # All Pydantic schemas
│       └── routers/        # One file per entity
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── api/            # Axios API layer
        ├── components/     # Layout, Sidebar, UI primitives
        ├── pages/          # One file per page
        └── types.ts        # TypeScript types
```
