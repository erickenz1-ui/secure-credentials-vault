# 🔐 Secure Credentials Vault

A full-stack enterprise-grade secrets and credentials management system built with Node.js, Express, React, and PostgreSQL. Securely store, manage, audit, and share sensitivity-graded credentials across organization teams with Role-Based Access Control (RBAC).

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** React.js, Tailwind CSS, Axios, React Context API (`AuthContext`)
- **Backend:** Node.js, Express.js REST API (`nodemon`, middleware-based RBAC)
- **Database:** PostgreSQL (Schema migrations, Seed data, Audit log trails)
- **Containerization:** Docker / Docker Compose setup (`backend/docker-compose.yml`)

---

## 📂 Repository Structure

```text
Vault/
├── 002_seed_data.sql        # Database initialization & demo accounts
├── backend/
│   ├── migrations/         # SQL schema migration files
│   ├── scripts/            # Key generation & database migration runners
│   ├── src/
│   │   ├── config/         # Database connection pool & app setup
│   │   ├── controllers/    # API endpoint request handlers
│   │   ├── middleware/     # JWT Auth, authorization, and validation
│   │   ├── routes/         # Express API routes
│   │   ├── services/       # Encryption algorithms & data services
│   │   └── utils/          # Custom logger & error handlers
│   ├── docker-compose.yml  # PostgreSQL container stack definition
│   ├── server.js           # Backend entry point
│   └── package.json
└── frontend/
    ├── public/             # HTML shell and assets
    ├── src/
    │   ├── components/     # Reusable UI controls (Button, Card, Input, Modal, Layout)
    │   ├── contexts/       # Authentication Context Provider
    │   ├── pages/          # Dashboard, Credentials, Teams, Users, Audit, Login
    │   ├── services/       # API integration module
    │   └── styles/         # Custom UI theme tokens
    └── package.json
