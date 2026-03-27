# Bharat Enterprise - Billing System MVP

[![CI](https://github.com/subhankar-das-phantom/Billing-Software/actions/workflows/ci.yml/badge.svg)](https://github.com/subhankar-das-phantom/Billing-Software/actions/workflows/ci.yml)

A Billing System optimized for both desktop workflows and mobile accessibility without compromising usability, zero-cost billing and inventory system built for small pharmaceutical distributors who cannot afford expensive software like Marg or Tally.

Designed for real-world usage, the system focuses on speed, simplicity, and data integrity — featuring atomic invoice editing, snapshot-based billing, and GST-compliant workflows.

## Why This Project?

Most small distributors rely on expensive or overly complex billing software.

This system is built as a free, fast, and mobile-friendly alternative that:
- works on low-resource devices
- simplifies billing workflows
- avoids unnecessary complexity like batch/FIFO systems
- ensures strong data integrity with minimal user effort

## Live Demo

Frontend: https://billing-software-sigma.vercel.app    

Test Credentials:
- Email: admin@bharat.com  
- Password: admin123

## Features

### ⭐ Key Highlight

- **Atomic Invoice Editing (Delta-Based)**  
  Unlike traditional systems that reprocess full invoices, this system updates stock using a delta-based approach (`newQty - oldQty`).  
  This ensures:
  - No double deduction bugs  
  - Safe concurrent edits  
  - Accurate stock with minimal operations

### Core Functionality
- ✅ **Invoice & Payment Engine** - Multi-item GST calculations, full/partial payment tracking, and GST-compliant sales returns (Credit Notes)
- ✅ **Product & Customer Management** - Real-time stock tracking with informational MRP/Batch tracking, and customer credit profiles
- ✅ **Analytics & Reporting** - Monthly sales trends, top customers, credit aging dashboards (30/60/90+ days), and employee performance
- ✅ **Secure Authentication** - JWT-based login with admin-controlled employee accounts (No self-signup)

### Advanced Capabilities
- ✅ **Simplified Stock Tracking** - Inventory is managed at the product level natively, skipping unnecessary batch/FIFO complexity
- ✅ **SWR Caching & Infinite Scroll** - SWR-based data fetching and background revalidation with seamless Intersection Observer scrolling for large inventories
- ✅ **Real-Time Global Statistics** - Dedicated aggregations calculate true database metrics instantly, independent of frontend pagination limits
- ✅ **Snapshot-Based Invoices** - Invoice data is captured at creation time for audit-safe historical integrity
- ✅ **Cross-Device Optimization** - Optimized for both desktop workflows and mobile accessibility without compromising usability
- ✅ **Customisable Invoice** - Toggle which columns appear on printed invoices with preferences persisting via localStorage
- ✅ **Continuous Integration** - Automated GitHub Actions pipeline for continuous validation

## 📘 Documentation

- User Guide: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Auth | JWT + Bcrypt |
| HTTP | Axios |

## Architecture Overview

The application follows a typical MERN stack layered architecture:

- **Frontend**: React + Vite SPA using SWR caching and Axios for API communication.
- **Backend**: Express.js REST API with controllers handling business logic.
- **Database**: MongoDB with Mongoose schemas for Products, Customers, Invoices, Payments, and Credit Notes.
- **Inventory Model**: Stock is tracked at the product level using `Product.currentStockQty`. Invoice creation deducts stock and credit notes restore stock. Editing an invoice uses an atomic delta-based approach (deducting or restoring only the difference) protected by idempotency checks and MongoDB transactions, ensuring zero data corruption.

## Quick Start

### Prerequisites

- Node.js v16+
- MongoDB running locally or MongoDB Atlas connection string

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run seed:admin
npm run dev
```

Backend runs at: `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at: `http://localhost:3000`

> **Note:** The frontend uses `HashRouter` for client-side routing. This means page URLs will be prefixed with a `#` (e.g., `http://localhost:3000/#/dashboard`).

### 3. Login

- **Email**: admin@bharat.com
- **Password**: admin123

> ⚠️ Change these credentials immediately in production!

## User Roles

The system implements role-based access control with two distinct user types:

### Admin
Full system access including:
- Employee account creation and management
- Firm settings and configuration
- Sales analytics and reporting dashboards
- Credit aging and financial insights
- All employee-level permissions

### Employee
Restricted access to core operational functions:
- ✅ Add and edit products
- ✅ Manage inventory quantities
- ✅ Create and view invoices
- ✅ Record customer payments
- ✅ Manage customer profiles
- ❌ Cannot manage other employees
- ❌ Cannot modify firm settings
- ❌ Cannot access admin analytics

> **Accountability**: All actions are attributed to the logged-in user, enabling complete audit trails for invoices, payments, and inventory changes.

## Project Structure

```
bharat-billing/
├── backend/
│   ├── config/         # Database, constants
│   ├── controllers/    # Business logic
│   ├── middleware/     # Auth, error handling
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API endpoints
│   ├── scripts/        # Seed scripts
│   ├── utils/          # Helpers
│   └── server.js       # Entry point
│
└── frontend/
    ├── src/
    │   ├── components/ # Reusable components
    │   ├── context/    # Auth, Toast contexts
    │   ├── pages/      # Page components
    │   ├── services/   # API services
    │   └── utils/      # Formatters, calculations
    └── index.html
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/employee/login` - Employee login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/heartbeat` - Session heartbeat
- `PUT /api/auth/profile` - Update profile (Admin only)

### Products
- `GET /api/products` - List products (with pagination)
- `GET /api/products/stats` - Global product statistics (total, low stock, out of stock)
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product details
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product


### Customers
- `GET /api/customers` - List customers
- `GET /api/customers/search?q=` - Search customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Employees (Admin only)
- `GET /api/employees` - List employees
- `POST /api/employees` - Create employee
- `GET /api/employees/:id` - Get employee details
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee
- `PUT /api/employees/:id/password` - Reset employee password
- `PUT /api/employees/:id/status` - Toggle employee status

### Invoices
- `GET /api/invoices` - List invoices (with pagination & filters)
- `POST /api/invoices` - Create invoice (stock auto-deducted from product)
- `GET /api/invoices/:id` - Get invoice details
- `PUT /api/invoices/:id` - Update invoice
- `GET /api/invoices/customer/:id` - Get customer invoices
- `PUT /api/invoices/:id/status` - Update invoice status
- `GET /api/invoices/export` - Export invoices (Excel/CSV)

### Credit Notes (Sales Returns)
- `POST /api/credit-notes` - Create credit note for returned items
- `GET /api/credit-notes` - List all credit notes
- `GET /api/credit-notes/invoice/:invoiceId` - Get credit notes linked to a specific invoice

### Payments
- `GET /api/payments` - List all payments
- `POST /api/payments` - Record a payment
- `GET /api/payments/:id` - Get payment details
- `DELETE /api/payments/:id` - Delete payment
- `GET /api/payments/customer/:id` - Get payments by customer
- `GET /api/payments/invoice/:id` - Get payments by invoice

### Notes
- `GET /api/notes` - Get all notes
- `POST /api/notes` - Create a note
- `GET /api/notes/:id` - Get note details
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `PATCH /api/notes/:id/pin` - Toggle pin status

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/low-stock` - Low stock alerts
- `GET /api/dashboard/invoice-count` - Invoice count for date range

### Analytics (Admin only)
- `GET /api/analytics/activity-log` - Detailed activity log
- `GET /api/analytics/employees` - Employee performance analytics
- `GET /api/analytics/employees/comparison` - Employee comparison
- `GET /api/analytics/employees/:id` - Individual employee details
- `GET /api/analytics/employees/:id/sessions` - Employee sessions
- `GET /api/analytics/sessions/summary` - Session analytics summary

### Reports
- `GET /api/reports/outstanding` - Outstanding balance report
- `GET /api/reports/ageing` - Credit aging report (30/60/90+ days)
- `GET /api/reports/credit-stats` - Credit dashboard statistics
- `GET /api/reports/recent-payments` - Recent payments list

## Key Workflows

### Creating an Invoice
1. Select customer (auto-fills address, GSTIN)
2. Search and add products specifying quantity
3. View real-time GST calculations
4. Validate overall stock availability
5. Save invoice → Stock automatically deducted from `Product.currentStockQty`

### Editing an Invoice
1. Open existing invoice and modify items (quantities, rates, or add/remove products)
2. System batch-fetches products to eliminate N+1 query bottlenecks
3. Smart duplicate validation groups identical items (same product, rate, discount)
4. Computes exact stock delta (new quantity - old quantity) per product
5. Conditionally updates stock using strict MongoDB transactions and `$gte` guards to prevent negative inventory

### Processing a Sales Return
1. Open original invoice and click "Create Return"
2. Select items to return and specify return quantities
3. System validates against originally sold quantities
4. Generate Credit Note → Stock automatically restored to `Product.currentStockQty`
5. Customer credit balance is updated for future adjustments

### GST Calculation
- Base Amount = Quantity × Rate
- Discount Amount = Base Amount × (Discount% / 100)
- Taxable Amount = Base Amount - Discount
- GST = Taxable Amount × (GST% / 100)
- CGST = GST / 2, SGST = GST / 2

## Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/bharat-billing
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
ADMIN_EMAIL=admin@bharat.com
ADMIN_PASSWORD=admin123
FIRM_NAME=Bharat Enterprise
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

## Design Decisions & Trade-offs

### Credit Limits Are Advisory, Not Enforced
In Indian SMB contexts, strict credit limit enforcement often disrupts business relationships. Distributors frequently extend informal credit based on trust and long-standing relationships. The system displays credit warnings but allows admins to override limits, reflecting real-world business practices.

### Invoice Snapshots for Historical Integrity
Invoices capture product details, prices, and customer information at creation time rather than referencing live data. This ensures:
- Invoices remain accurate even if product prices or customer details change later
- Audit-safe records for tax compliance and dispute resolution
- Historical accuracy for financial reporting

### MongoDB Atlas for Database Hosting
Chosen for its managed service benefits:
- Zero-maintenance cloud hosting with automatic backups
- Free tier sufficient for small business workloads
- Seamless scaling path as the business grows
- Built-in monitoring and performance insights

### Free-Tier Hosting Strategy
The application is designed to run on free-tier services (Render for backend, Vercel for frontend, MongoDB Atlas free tier):
- **Trade-off**: Cold starts on Render (backend spins down after inactivity)
- **Mitigation**: Acceptable for small business use cases with predictable usage patterns
- **Benefit**: Zero hosting cost for MVP validation and early production use

---

## Production Notes

### Deployment Architecture
- **Backend**: Node.js application deployable to Render, Railway, Heroku, or any Node.js hosting environment
- **Frontend**: Static build deployable to Vercel, Netlify, or any static hosting
- **Database**: MongoDB Atlas (cloud) or self-hosted MongoDB

### Free-Tier Hosting Constraints
| Service | Limitation | Impact |
|---------|------------|--------|
| Render (Backend) | Sleeps after 15 min inactivity | First request after sleep takes ~30s |
| MongoDB Atlas | 512MB storage limit | Sufficient for ~50,000 invoices |
| Vercel (Frontend) | 100GB bandwidth/month | Adequate for small teams |

### Stability Focus
This system prioritizes **reliability over feature bloat**:
- Battle-tested authentication flow with proper session management
- Comprehensive error handling and user feedback
- Responsive interface compatible across desktop and mobile devices
- Optimized for real-world usage patterns in small business environments

---

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.  
Copyright (c) 2026 Subhankar Das / Bharat Enterprise. All rights reserved.
