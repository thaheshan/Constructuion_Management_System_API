# Construction Management System (CMS) — Backend API

Module-based NestJS architecture for Sri Lankan Construction Industry.

## Tech Stack
- **Framework:** NestJS 10 (Node.js)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT + Passport (Role-Based Access Control)
- **Real-Time:** WebSockets / Socket.io for push alerts & daily summaries
- **Compliance Engine:** Sri Lankan IRD VAT (18%), EPF (8%/12%), ETF (3%), Progressive PAYE

## Module Architecture
```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── prisma/
│   ├── guards/
│   └── utils/ (sri-lanka-tax.util.ts, epf-etf.util.ts)
└── modules/
    ├── auth/
    ├── users/
    ├── projects/
    ├── inventory/
    ├── labour/
    ├── payroll/
    └── tax-compliance/
```
