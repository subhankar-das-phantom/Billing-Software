# Bharat Enterprise - Billing System MVP

A complete MERN stack billing and inventory management system for pharmaceutical distributors.

## Features

### Core Functionality
- ✅ **Secure Authentication** - JWT-based login with role-based access control
- ✅ **Product Management** - Create, edit, delete products with real-time stock tracking
- ✅ **Customer Management** - Customer profiles with credit limits, search, and transaction history
- ✅ **Invoice Creation** - Multi-item invoices with real-time GST calculations (CGST/SGST)
- ✅ **Invoice History** - View, print, and export past invoices
- ✅ **Payment Recording** - Track partial and full payments against invoices
- ✅ **Dashboard** - Quick statistics, low stock alerts, and business overview

### Advanced Features
- ✅ **Invoice Export** - Export invoices to Excel (.xlsx) and CSV formats with date range filtering
- ✅ **Admin-Controlled Employee Accounts** - No self-signup; admins create and manage employee access
- ✅ **Employee Activity Tracking** - All actions (invoices, payments, inventory updates) are attributed to the logged-in user
- ✅ **Credit Aging Dashboard** - View outstanding amounts categorized by aging buckets (30/60/90+ days)
- ✅ **Monthly Sales Analytics** - Revenue trends, top customers, and product performance insights
- ✅ **Snapshot-Based Invoices** - Invoice data is captured at creation time for audit-safe historical integrity
- 🔜 **PDF Export** - PDF invoice generation (planned)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Auth | JWT + Bcrypt |
| HTTP | Axios |

## Quick Start

### Prerequisites

- Node.js v16+
- MongoDB running locally or MongoDB Atlas connection string

### 1. Backend Setup

```bash
cd backend

# Copy .env.example to .env and fill in your values
cp .env.example .env

# Install dependencies
npm install

# Create admin user (uses .env config)
npm run seed:admin

# Start development server
npm run dev
```

Backend runs at: `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend

# Copy .env.example to .env and fill in your values
cp .env.example .env

# Install dependencies
npm install

# Start development server
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
- `POST /api/products` - Create product
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
- `POST /api/invoices` - Create invoice (with stock reduction)
- `GET /api/invoices/:id` - Get invoice details
- `PUT /api/invoices/:id` - Update invoice
- `GET /api/invoices/customer/:id` - Get customer invoices
- `PUT /api/invoices/:id/status` - Update invoice status
- `GET /api/invoices/export` - Export invoices (Excel/CSV)

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
2. Search and add products
3. View real-time GST calculations
4. Validate stock availability
5. Save invoice → Stock automatically reduced

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
- Mobile-responsive design for on-the-go invoice creation
- Optimized for real-world usage patterns in small business environments

---

## License

Proprietary - Bharat Enterprise
