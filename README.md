# Bharat Enterprise - Billing System MVP

A complete MERN stack billing and inventory management system for pharmaceutical distributors.

## Features

- ✅ **Admin Authentication** - Secure login with JWT
- ✅ **Product Management** - Create, edit, delete products with stock tracking
- ✅ **Customer Management** - Customer profiles with search and history
- ✅ **Invoice Creation** - Multi-item invoices with real-time GST calculations
- ✅ **Invoice History** - View and print past invoices
- ✅ **Dashboard** - Quick statistics and low stock alerts

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

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: `http://localhost:3000`

### 3. Login

- **Email**: admin@bharat.com
- **Password**: admin123

> ⚠️ Change these credentials immediately in production!

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
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current admin

### Products
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Customers
- `GET /api/customers` - List customers
- `GET /api/customers/search?q=` - Search customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Invoices
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice (with stock reduction)
- `GET /api/invoices/:id` - Get invoice details
- `GET /api/invoices/customer/:id` - Get customer invoices

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/low-stock` - Low stock alerts

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

## License

Proprietary - Bharat Enterprise
