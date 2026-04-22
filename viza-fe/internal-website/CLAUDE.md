# VIZA Admin Website - Project Documentation

> **UI work on `/client/*` — read `frontend.md` in this directory first.**
> It is the source of truth for design tokens (brand scale, typography, radius), shadcn conventions, client-shell patterns, and the UX rules distilled from ui-ux-pro-max. Loading it before any `/client` UI change is mandatory.

## 📋 Project Overview

**VIZA Admin Website** is a comprehensive visa practitioner management system built with Next.js 16, featuring separate portals for admins and administrative staff. The system manages users, visa orders, consultations, services, and visa timelines.

### Key Information

- **Project Name**: VIZA Admin Website (formerly VIZA CMS)
- **Tech Stack**: Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Shopify Integration, Cal.com Integration
- **Current Status**: ✅ Production Ready with Full Authentication
- **Deployment**: Google Cloud Run
- **Build Status**: ✅ Passing
- **Authentication**: ✅ Supabase Auth with Role-Based Access Control

---

## 🎯 Core Features

### Three-Portal Architecture

#### **Admin Portal** (`/admin-v2/*`)

Session-centric interface for admins to manage their assigned users and consultations during active appointments.

#### **Staff Portal** (`/staff/*`)

Full administrative access for managing all aspects of the visa practice.

#### **Admin Portal** (`/admin/*`)

System administration with full visibility into all user data and system overview.

---

## 🔀 Portal View Differences

### User Detail Page Comparison

| Feature                       | Admin Portal          | Staff Portal           | Admin Portal           |
| ----------------------------- | ---------------------- | ---------------------- | ---------------------- |
| **Layout Focus**              | Consultation-centric   | Administrative         | Administrative         |
| **Health Summary**            | Top (prominent)        | Above Visa Timeline | Above Visa Timeline |
| **Latest Order Card**         | Top (prominent)        | Above Visa Timeline | Above Visa Timeline |
| **User Information**       | Collapsible (bottom)   | Expanded card          | Expanded card          |
| **Staff Notes**               | ❌ Not shown           | ✅ Full CRUD           | ✅ Full CRUD           |
| **User Tags**              | ❌ Not shown           | ✅ Full CRUD           | ✅ Full CRUD           |
| **Shopify Linking**           | ❌ Not shown           | ✅ Full control        | ✅ Full control        |
| **Questionnaire Submissions** | ❌ Not shown           | ✅ Table view          | ✅ Table view          |
| **Past Orders List**          | ❌ Not shown           | ✅ Expandable          | ✅ Expandable          |
| **Visa Timeline**          | ✅ With admin's notes | ✅ With admin's notes | ✅ With admin's notes |
| **Consultation Controls**     | ✅ Start/End buttons   | ❌ Not applicable      | ❌ Not applicable      |
| **Decision Buttons**          | ✅ Approve/Reject/etc  | ❌ Not applicable      | ❌ Not applicable      |
| **Add Note Form**             | ✅ During consultation | ❌ Not shown           | ❌ Not shown           |
| **service document**      | ✅ During consultation | ❌ Not shown           | ❌ Not shown           |
| **Email Displayed**           | ✅ Visible             | ✅ Visible             | ✅ Visible             |

### Section Order by Portal

**Admin Portal** (`/admin-v2/users/[id]`) - Session-centric layout:

1. Header + Consultation Status Badge
2. **Health Summary (Questionnaire Summary)** ← Top
3. **Latest Order Card** ← Top
4. Decision Buttons (during active consultation)
5. Active Consultation Card (during consultation)
6. Visa Timeline
7. User Information (collapsible)
8. Add Note Form (during consultation)

**Staff Portal** (`/staff/users/[id]`) - Health Summary ABOVE Visa Timeline:

1. Header + Edit Button
2. User Information Card (expanded)
3. Staff Notes Section
4. Questionnaire Submissions Table
5. Past Orders List
6. Latest Order Card
7. **Health Summary (Questionnaire Summary)** ← Directly above Visa Timeline
8. Visa Timeline

**Admin Portal** (`/admin/users/[id]`) - Health Summary ABOVE Visa Timeline:

1. Header + Edit Button
2. User Information Card (expanded)
3. Staff Notes Section
4. Questionnaire Submissions Table
5. Past Orders List
6. Latest Order Card
7. **Health Summary (Questionnaire Summary)** ← Directly above Visa Timeline
8. Visa Timeline

### Navigation & Sidebar

| Feature              | Admin Portal            | Staff Portal          | Admin Portal             |
| -------------------- | ------------------------ | --------------------- | ------------------------ |
| **Theme Color**      | Brand (#C2785F)          | Brand (#C2785F)       | Purple                   |
| **Dashboard**        | ✅ `/admin-v2`          | ✅ `/staff`           | ✅ `/admin`              |
| **Users**         | ✅ `/admin-v2/users` | ✅ `/staff/users`  | ✅ `/admin/users`     |
| **Consultations**    | ✅ Session-centric       | ✅ Calendar + Reports | ❌ Not included          |
| **Orders**           | ❌ Not included          | ✅ Full management    | ❌ Not included          |
| **Products**         | ❌ Not included          | ✅ Shopify products + Inventory | ❌ Not included          |
| **User Management**  | ❌ Not included          | ✅ Full CRUD          | ❌ Not included          |
| **Settings**         | ❌ Not included          | ✅ Integrations       | ❌ Not included          |
| **Cal.com Bookings** | ❌ Not included          | ❌ Via Settings       | ✅ `/admin/cal-bookings` |

### Key Differences Summary

1. **Admin Portal**: Optimized for real-time consultation workflow

   - Health summary and order at top for quick reference
   - Consultation controls (start/end) always visible
   - Decision buttons for service approval/rejection
   - Email addresses visible for user identification
   - Add notes and service items during active sessions

2. **Staff Portal**: Optimized for administrative tasks

   - Full user profile management
   - Staff notes for customer profiling
   - Shopify customer linking
   - Complete order history with details
   - Health summary positioned above visa timeline for historical context

3. **Admin Portal**: Optimized for oversight and monitoring
   - System-wide visibility
   - Health summary positioned above visa timeline for historical context
   - Full access to user records
   - Purple theme for distinction
   - Cal.com bookings management

---

## 📊 Staff Portal Features (`/staff/*`)

### 1. Dashboard

**Overview Metrics** (Row 1):

- Total users, orders, consultations, pending questionnaires (all from Supabase)
- Brand-colored cards with custom #C2785F theme

**Performance Metrics** (Row 2) - with time period selector:

- **Time Period Selector**: Today, This Week, This Month, All Time
- **Total Revenue**: Sum of order totals for selected period (from `order_data.total_price`)
- **Revenue Change**: Percentage change vs previous period with trend indicator
- **Orders Count**: Number of orders in selected period
- **Open Orders**: Orders with status `open` or `ready_to_ship`
- **Returning Customers**: Customers with `orders_count > 1` from `shopify_customers`

**Recent Orders** (Row 3):

- Shows 10 most recent orders sorted by date
- Displays: Order number, customer name, total price, status badge, relative time
- "View All" link to orders page

**Key Files**:

- `/app/staff/page.tsx` - Dashboard page
- `/app/actions/dashboard.ts` - Server actions for metrics (`getDashboardMetrics`, `getRecentOrders`)
- `/components/dashboard-metrics.tsx` - Performance metrics with time period selector
- `/components/recent-orders-list.tsx` - Recent orders list component
- `/components/time-period-selector.tsx` - Time period dropdown

### 1.1 Settings Page (`/staff/settings`)

- **Integrations Management**: Moved from main dashboard for cleaner UI
- **Shopify Sync Section**: Manual sync for products, customers, inventory, orders
- **Cal.com Sync Section**: Manual sync for bookings with auto-create users/admins
- **Key Files**: `/app/staff/settings/page.tsx`

### 2. Users Module

**List View** (`/staff/users/page.tsx`):

- **Four-Tab System** with badge counts:
  - **All**: All users in the system
  - **Linked**: Users linked to Shopify customers
  - **Unlinked Users**: Users without Shopify customer link
  - **Unlinked Shopify**: Shopify customers not yet linked to users (with "Create User" action)
- Client-side rendering with server actions
- **Pagination**: Page size options (20/50/100 rows per page)
- **Search**: Debounced search (300ms) across name and email
- Registration dates and contact info
- Click-through to details

**Detail View** (`/staff/users/[id]/page.tsx`):

- Personal information (email, phone, DOB, address)
- **Shopify Customer Linking**: Search and link to Shopify customers
- **User Tags**: Color-coded tags for customer profiling (VIP, High Risk, etc.)
- **Staff Notes**: Notes with types (general, alert, flag, followup), pinning support
- **Past Visa Orders**: Orders with line items, financial/fulfillment status badges
  - Orders fetched via user_id AND shopify_customer_id matching
  - Summary showing total spent (paid & non-cancelled)
  - Expandable order cards with line item details
- **Questionnaire submissions** - view all forms with responses
- Consultation history with admin names
- Parallel data fetching for performance

**Key Files**:

- `/app/actions/user-orders.ts` - Orders server action (queries via shopify_customer_id)
- `/app/actions/staff-notes.ts` - Staff notes CRUD
- `/app/actions/user-tags.ts` - User tags CRUD
- `/components/user-orders-list.tsx` - Orders display with summary
- `/components/staff-notes-section.tsx` - Notes UI with pinning
- `/components/user-tags-section.tsx` - Tags UI with color picker
- `/components/order-status-badges.tsx` - Financial/fulfillment status badges

### 3. Orders Module

**Four-Tab System** (`/manage/orders/page.tsx`):

Tabs filter orders by **actual Shopify statuses** from `order_data` JSONB field:

| Tab | Filter Logic | Badge Color |
|-----|--------------|-------------|
| **Unfulfilled** | `fulfillment_status` IS NULL AND `cancelled_at` IS NULL | Yellow |
| **Fulfilled** | `fulfillment_status = 'fulfilled'` AND `cancelled_at` IS NULL | Green |
| **Partial** | `fulfillment_status = 'partial'` AND `cancelled_at` IS NULL | Blue |
| **Cancelled** | `cancelled_at` IS NOT NULL | Red |

**Note**: service orders approved by admins appear in the **Unfulfilled** tab once the Shopify order is created.

**Table Columns** (Shopify Orders):

- **Order ID**: Shopify order number (e.g., `#23218470`) from `order_data.name`
- **User**: Linked user name/email or "Not linked" badge
- **Order Date**: From `order_data.created_at`
- **Consultation Date**: From `order_data.metafields.consultation_date` (requires Shopify metafield)
- **Shopify Status**: Shows actual Shopify statuses using `OrderStatusBadges` component:
  - Cancelled orders: Shows "Cancelled" badge (red)
  - Non-cancelled: Shows both financial status (Paid/Pending/etc.) and fulfillment status (Fulfilled/Unfulfilled/etc.)
- **Actions**: View Details button

**Order Sources**:
- `shopify` - Regular orders synced from Shopify
- `service` - Orders from admin services (approved by admin at end of consultation)
- `upsell_add` - Upsell orders adding products
- `upsell_change` - Upsell orders changing products

**Approval Status**:
- `pending` - service created, awaiting admin approval at end of consultation
- `approved` - Admin approved, Shopify order created
- `rejected` - Admin rejected at end of consultation

**Features**:

- User linking display with joins
- **service Badge**: Orders starting with `RX-` show "service" badge
- **Source Badge**: Shows order source (service, Upsell - Add, Upsell - Change)
- Color-coded status badges
- **Pagination**: Page size options (20/50/100 rows per page)
- **Search**: Debounced search (300ms) across order ID, user name, and email
- **Sorting**: Server-side sorting via dropdown with options:
  - Date (Newest) - default, sorts by `order_data->created_at` descending
  - Date (Oldest) - sorts by `order_data->created_at` ascending
  - Order ID (Z-A) - sorts by `shopify_order_id` descending
  - Order ID (A-Z) - sorts by `shopify_order_id` ascending
- **Click "View Details"** → Opens modal with:
  - Complete order breakdown
  - Line items with quantities and prices
  - Customer/user information
  - Linkage status badge
  - Order total
  - **Order Source Badge** (for consultation orders)
  - **Admin Approval Status** (for consultation orders)
  - **service/Upsell Details** (schedule, service by, etc.)
  - **Order Metadata** section (from Shopify metafields)

**Order Metadata** (fetched via Shopify GraphQL API):

- Order Status (`custom.order_status`)
- service Required (`custom.service_required`) - Yes/No
- Consultation Required (`custom.consultation_required`) - Yes/No
- Consultation Status (`custom.consultation_status`) - e.g., "Scheduled", "Not booked"
- Assigned Admin (`custom.assigned_admin`)
- service Status (`custom.service_status`) - e.g., "Approved"
- Approved to Ship (`custom.approved_to_ship`) - Yes/No

**Order Status Display**:

The orders page now displays **actual Shopify statuses** directly from `order_data` JSONB field instead of using mapped status values. This ensures the orders page matches the user order history display:

- **Financial Status**: `paid`, `pending`, `authorized`, `refunded`, `partially_refunded`, `voided`, `partially_paid`
- **Fulfillment Status**: `fulfilled`, `partial`, `unfulfilled`, `restocked`, `null`
- **Cancelled Status**: Determined by `cancelled_at` timestamp presence

**Key Files**:

- `/app/manage/orders/page.tsx` - Orders list with tabs and search
- `/components/order-details-modal.tsx` - Order details with metadata and approval status
- `/lib/shopify.ts` - `fetchOrderMetafields()`, `createDraftOrder()`, `completeDraftOrder()` functions
- `/lib/order-utils.ts` - Shared utility for Shopify order creation (used by admin portal)
- `/app/api/shopify/webhooks/orders/route.ts` - Webhook handler (fetches metafields)
- `/lib/shopify-sync.ts` - Sync service (fetches metafields during sync)

### 4. Consultations Module

**Sidebar Navigation** (Collapsible submenu):

- **Calendar** (`/staff/consultations`) - Main calendar view
- **Reports** (`/staff/consultations/reports`) - Analytics dashboard

**React Big Calendar Integration** (`/staff/consultations/page.tsx`):

- Month/week/day views
- Admin filter dropdown
- Color-coded events by status (scheduled/completed/cancelled)

**Interactive Features**:

- **Click date slot** → Create new consultation with pre-filled time
- **Click event** → Edit consultation details
- **"New Consultation" button** → Open creation modal
- Full CRUD operations with Supabase
- Immediate updates on calendar

**Consultation Modal**:

- User dropdown (from Supabase)
- Admin dropdown (from Supabase)
- Date/time pickers
- Status selector
- Notes field
- Delete button with confirmation
- Real-time persistence

### 4.1 Consultation Reports (`/staff/consultations/reports`)

**Analytics Dashboard** with filterable metrics:

**Filters**:

- **Time Period**: Today, This Week, This Month, All Time
- **Admin**: All Admins or specific admin

**Summary Cards** (4 metrics):

- **Total Consultations**: Count in selected period
- **Cancellation Rate**: % of cancelled consultations (color-coded: green if <10%, red if >10%)
- **No-Show Rate**: % of missed consultations (color-coded)
- **Approval Rate**: % of approved services (color-coded: green if ≥80%)

**Charts**:

- **Consultation Status Breakdown**: Pie/donut chart showing completed/scheduled/cancelled/missed distribution
- **Treatment Decisions**: Horizontal bar chart showing approved/rejected/pending counts
- **Peak Booking Days**: Bar chart showing consultation density by day of week
- **Time to Appointment**: Admin availability metric showing time between booking and appointment
  - Stats: Average, Median, Min, Max wait times
  - Distribution chart: < 24 hrs (green), 24-48 hrs (blue), 2-7 days (amber), > 7 days (red)
  - Color-coded average indicator for quick assessment

**Admin Capacity Table**:

- Lists all admins with scheduled consultation counts
- Available slots (from Cal.com, shows "N/A" if unavailable)
- Utilization rate percentage

**Key Files**:

- `/app/staff/consultations/reports/page.tsx` - Reports page
- `/app/actions/reports.ts` - Server actions for all metrics
- `/components/reports/reports-content.tsx` - Main client component with state management
- `/components/reports/reports-filters.tsx` - Time period and admin filter dropdowns
- `/components/reports/reports-summary-cards.tsx` - Summary metric cards
- `/components/reports/consultation-status-chart.tsx` - Pie chart component
- `/components/reports/approval-rate-chart.tsx` - Bar chart component
- `/components/reports/peak-periods-chart.tsx` - Day-of-week bar chart
- `/components/reports/time-to-appointment-chart.tsx` - Time to appointment stats and distribution chart
- `/components/reports/admin-capacity-card.tsx` - Admin capacity table

**Dependencies**: `recharts` for chart visualizations

### 5. User Management

**Features** (`/staff/users/page.tsx`):

- Staff member listing from Supabase
- Role-based display (admin/admin/staff)
- User creation dates
- Role descriptions and permissions
- **Three-Tab System**:
  - **All Users**: Complete user list
  - **With Login**: Users with auth credentials (can log in)
  - **Without Login**: Auto-created users from Cal.com sync (need credentials)
- **Add Login** action for users without credentials (sets password via admin)

### 6. Cal.com Integration

**Dashboard** (`/staff/page.tsx`):

- Cal.com sync section with "Sync Bookings" button
- Last sync time display
- Total Cal.com consultations count
- Sync result feedback (bookings synced, users created, admins created)

**Features**:

- **Automatic Sync**: Syncs Cal.com bookings to `consultations` table
- **User Auto-Creation**: Creates user records for unknown attendee emails
- **Admin Auto-Creation**: Creates admin profiles (without auth) for unknown host emails
- **Calendar Display**: Cal.com bookings shown with blue left border indicator
- **Read-Only Mode**: Cal.com consultations are read-only (edits must be made in Cal.com)
- **Video Call Links**: "Join" button for Cal.com meeting URLs

**Consultation Modal Behavior**:

- Cal.com bookings display info banner: "This consultation was booked via Cal.com"
- User, admin, and time fields are disabled
- Meeting URL displayed with clickable link
- Status changes (except cancellation) require Cal.com

**API Routes**:

- `GET /api/calcom/sync` - Get sync status and last sync time
- `POST /api/calcom/sync` - Trigger manual sync
- `POST /api/cal/webhooks` - Webhook endpoint for real-time Cal.com events

**Sync Library** (`lib/calcom-sync.ts`):

- `syncCalcomBookings()` - Main sync function with date range options
- `getCalSyncStatus()` - Returns last sync time and consultation count
- `findOrCreateUser()` - Creates user if email not found
- `findOrCreateAdmin()` - Creates admin profile (no auth) if email not found

**Cal.com API Library** (`lib/cal.ts`):

- `calcom.getBookings()` - Fetch bookings with date filtering
- `calcom.getEventTypes()` - Fetch event types
- Handles Cal.com v2 API response format

**Data Flow**:

1. Cal.com API fetches bookings with date range
2. For each booking, user is matched or created by email
3. Admin is matched or created by email (without auth credentials)
4. Consultation created/updated with `cal_booking_uid` as unique key
5. Sync log tracks all operations

**Webhook Events Handled**:

- `BOOKING_CREATED` - Creates new consultation
- `BOOKING_RESCHEDULED` - Updates consultation times
- `BOOKING_CANCELLED` - Marks consultation as cancelled

### 7. Shopify Sync Module

**Dashboard** (`/staff/shopify/page.tsx`):

- Products and variants count from local database
- **Customers count** from `shopify_customers` table
- Inventory levels tracking
- Stock alerts (low stock, out of stock)
- Last sync times for products, customers, inventory, orders, and full sync
- Manual sync triggers (individual or all)
- Sync result feedback (success/error messages)

**Products & Inventory** (`/manage/products/page.tsx`):

Unified view combining products and inventory management:
- Browse all synced products from Shopify with expandable variants
- **Product Status Filter**: Active, Draft, Archived
  - **Active**: Products visible and purchasable on storefront
  - **Draft**: Hidden products still being set up
  - **Archived**: Discontinued products (soft deleted)
- **Stock Status Filter**: All Stock Levels, Low Stock (≤10), Out of Stock (0)
- **Stock Status Badges**: Visual indicators per product/variant
  - 🟢 In Stock (>10 units)
  - 🟡 Low Stock (1-10 units)
  - 🔴 Out of Stock (0 units)
- View variants with pricing, SKU, and real-time inventory
- Inventory data sourced from `shopify_inventory_levels.available` (authoritative)
- Search products by title
- External links to Shopify admin

**API Routes**:

- `GET /api/shopify/sync` - Get sync status and last sync times
- `POST /api/shopify/sync` - Trigger manual sync (products, customers, inventory, orders, or all)
- `GET /api/shopify/products` - Fetch synced products with variants and real-time inventory
  - Query params: `status`, `search`, `stockFilter` (all/low/out), `limit`, `offset`

**Sync Library** (`lib/shopify-sync.ts`):

- `syncProducts()` - Syncs all products and variants from Shopify
- `syncCustomers()` - Syncs all customers from Shopify to `shopify_customers` table
- `syncInventory()` - Syncs inventory levels for all variants
- `syncOrders()` - Syncs all orders from Shopify with user linking
- `syncAll()` - Full sync of products, customers, inventory, and orders
- `getSyncStatus()` - Returns counts, alerts, and last sync times

**Shopify API Library** (`lib/shopify.ts`):

- `fetchAllProducts()` - Fetch all products with pagination
- `fetchAllOrders()` - Fetch all orders with pagination
- `fetchOrder()` - Fetch single order by ID
- `getOrderCount()` - Get total order count
- `createDraftOrder()` - Create draft order for services
- `fetchDraftOrder()` - Fetch draft order by ID
- `fetchAllDraftOrders()` - Fetch all draft orders

**Data Flow**:

1. Shopify REST API fetches paginated data (250 items/page)
2. Products and variants upserted to `shopify_products` and `shopify_variants`
3. Customers synced to `shopify_customers` table (can be linked to users)
4. Inventory levels linked to variants via `inventory_item_id`
5. Orders synced to `orders` table with automatic user linking (by Shopify customer ID or email)
6. Sync log tracks all sync operations with timestamps and results

---

## 👨‍⚕️ Admin Portal Features (`/admin-v2/*`)

### User Identification

- Email addresses are displayed to admins for user identification
- User identifiers include **name**, **email**, and **order number**

### 1. Admin Home (`/admin-v2/home`)

Session-centric dashboard showing the admin's active and upcoming consultations.

### 2. User Detail & Consultation View (`/admin-v2/users/[id]`)

**One-Stop Consultation Page** - Optimized for admin decision-making during appointments.

**Header**:

- User name + Back button + Consultation status badge
- **Start Consultation button** - Begins the consultation
- **End Consultation button** - Opens approval dialog to review services before ending

**Questionnaire Summary** (`components/questionnaire-summary.tsx`):

- Grid display of key health metrics from `profile data` table
- Weight, Height, BMI (auto-calculated)
- Details, Current document, History, Goals, Conditions
- Data from `profile data` table and `questionnaires.responses` JSON

**Latest Order Card** (`components/consultation-order-card.tsx`):

- Order number (e.g., `#23218470` or `RX-1764547181024`)
- Line items with quantities and prices
- Financial status and fulfillment status badges
- Order total and creation date

**Decision Buttons** (`components/consultation-decision-buttons.tsx`):

- **On-hold**: Keeps consultation "in_progress" for later follow-up
- **Upsell**: Opens upsell modal with two options:
  - **Add Product**: service additional products to the user
  - **Change Product**: Modify existing service (dosage/product change)
- **No Show**: Sets consultation status to "missed"

**End Consultation Dialog** (`components/end-consultation-dialog.tsx`):

When admin clicks "End Consultation":
- **If services exist**: Shows list of pending items with approve/reject options
  - **Approve & End**: Creates Shopify orders and ends consultation
  - **Reject Order**: Marks orders as rejected and ends consultation
  - Optional note field for both actions
- **If no services**: Simple confirmation to end consultation

**Active Consultation Card**:

- Shows current consultation details if in progress

**Visa Timeline** (Collapsible):

- Mixed content types in chronological order
- **Right-aligned** (admin actions): Notes, document/service
- **Left-aligned** (system events): Registration, Consultations, Questionnaires, Treatments
- Color-coded cards by entry type

**Consultation History** (`components/consultation-history.tsx`):

- Dedicated section showing all user consultations (newest first)
- Summary badges: completed count, cancelled count, missed count
- Each entry shows: date/time, admin name, status badge
- **Cancelled consultations**: Shows cancellation timestamp, who cancelled, reason (when available)
- **Missed consultations**: Shows "not attended" note
- Supports cancellation tracking from both admin actions and Cal.com webhooks

**User Information** (Collapsible):

- Contact details and demographics
- Email shown for identification

**Add Note Form** (Bottom panel):

- Textarea for quick note entry
- **service document** button (opens service modal)
- **Add Note** button

**Key Server Actions**:

- `app/actions/user-health.ts` - `getUserHealthSummary()`, `getConsultationOrder()`
- `app/actions/consultations.ts` - `updateConsultationDecision()`

**Data Fetching**:

- Uses `createAdminClient()` to bypass RLS for all queries
- Parallel fetching for user data, health summary, and consultation order

### 3. Consultation Session View (`/admin-v2/users/[id]/sessions/[sessionId]`)

Dedicated view for an active consultation session with the user.

### 4. Consultation Lifecycle Management

**Status Flow**:

```
scheduled → ready → in_progress → completed
              ↓
            missed
```

**Statuses**:
| Status | Description |
|--------|-------------|
| `scheduled` | Future appointment booked |
| `ready` | Consultation time window has arrived (auto-updated by pg_cron) |
| `in_progress` | Admin clicked "Begin Consultation" |
| `completed` | Admin clicked "End Consultation" |
| `missed` | Scheduled time passed without beginning (auto-updated by pg_cron) |
| `cancelled` | Appointment was cancelled |

**Key Components**:

- `lib/consultation-status.ts` - Status badge config and helpers
- `app/actions/consultations.ts` - Server actions for begin/end/cancel
- `components/consultation-controls.tsx` - Begin/End button component

**pg_cron Job** (runs every minute):

- Auto-updates `scheduled` → `ready` when start_time arrives
- Auto-updates `scheduled`/`ready` → `missed` when end_time passes

### 5. service System

**service Modal** (`components/service-item-modal.tsx`):

- **Product dropdown** - Fetches active products from `shopify_products` table
- **Variant dropdown** - Shows variants with price and stock info
- **Quantity** - Number input
- **Schedule dropdown** - Pre-defined options (Once daily, Twice daily, Weekly, etc.)
- **Start/End dates** - Date pickers
- **Notes** - Optional additional instructions

**service Workflow** (`app/actions/services.ts`):

1. Creates local order with `RX-{timestamp}` ID and `status: pending_approval`
2. Creates service record with Shopify product/variant IDs in `plan_json`
3. Inserts item record (name, dosage, schedule, dates)
4. Revalidates user detail page
5. service appears in timeline (right-aligned)
6. **No Shopify order created yet** - awaits admin approval

**Admin Approval at End of Consultation** (`app/actions/consultations.ts`):

When admin clicks "End Consultation":
1. Dialog shows all pending services for the consultation
2. Admin reviews and clicks "Approve & End" or "Reject Order"
3. If approved: `createAndCompleteShopifyOrder()` creates actual Shopify order
4. Order moves to `status: open` and appears in Unfulfilled tab
5. Consultation ends with `status: completed`

**Shopify Order Creation** (`lib/order-utils.ts`):

- `createAndCompleteShopifyOrder()` - Creates draft order and completes it
- Customer linked via Shopify customer ID or email
- Includes `SKIP_SHOPIFY_API` flag for testing mode

### 6. Consultations (`/admin-v2/consultations`)

- Consultations list filtered by authenticated admin ID
- Color-coded status badges (Ready=green, In Progress=blue, Missed=red, etc.)
- Email displayed for user identification

---

## 🔐 Authentication & Security

### Authentication System

**Login** (`/app/login/page.tsx`):

- Email/password authentication via Supabase
- Real authentication (no demo mode)
- Error handling and validation
- Loading states

**Server Actions** (`app/actions/auth.ts`):

- `signIn()`: Authenticates user, checks role, redirects appropriately
- `signOut()`: Clears session, redirects to login

**OAuth Callback** (`app/auth/callback/route.ts`):

- Handles authentication redirects
- Exchanges code for session
- Role-based redirection
- Production-ready with forwarded host support

### Role-Based Access Control

**Middleware** (`middleware.ts` + `lib/supabase/middleware.ts`):

- Protects all `/staff/*` and `/admin-v2/*` routes
- Fetches user role from `users` table
- **Auto-redirect on login**:
  - `role = 'admin'` → `/admin-v2`
  - `role = 'admin' | 'staff'` → `/staff`
- **Cross-access prevention**:
  - Admins cannot access `/staff/*`
  - Staff/admin cannot access `/admin-v2/*`

**Session Management**:

- Server components use `await createClient()`
- Client components use `createBrowserClient()`
- All admin pages fetch authenticated user ID
- Authorization checks with "Unauthorized" fallbacks

### User Impersonation (`/manage/impersonate`)

Allows authorized admins to view the client portal (`/client/*`) as any user for support and auditing.

**How it works**:
1. Admin searches for user, enters reason, clicks "View as User"
2. Server generates a signed token stored in `impersonation_tokens` table
3. New tab opens → callback validates token → sets `impersonation_session` cookie (JWT, 1hr, path: `/client`)
4. Client portal checks for impersonation cookie before Supabase session
5. Admin's Supabase session in `/manage` remains untouched (no session collision)

**Key Files**:
- `/app/manage/impersonate/page.tsx` - Impersonation UI
- `/app/auth/impersonate-callback/route.ts` - Token validation, cookie creation
- `/lib/impersonation-session.ts` - Cookie utilities (`createImpersonationCookie`, `getImpersonationSession`)
- `/app/actions/impersonation.ts` - Token generation, audit logging

**Impersonation-Aware Actions** (check impersonation cookie first):
- `/lib/auth/get-authenticated-user.ts` - Shared helper
- `/app/actions/client-lab-reports.ts` - Uses admin API endpoints for impersonation to bypass user role check
- `/app/actions/user-profile.ts`, `/app/actions/profile data.ts`, `/app/actions/action-plans.ts`

**Database Tables**: `impersonation_allowed_users`, `impersonation_tokens`, `impersonation_audit_log`

### Logout Functionality

**Both Portals**:

- Logout button in sidebar
- Loading states during logout
- Server action clears session
- Redirects to login page

---

## 🏗️ Architecture

### Tech Stack Details

**Frontend**:

- Next.js 16 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- shadcn/ui component library
- React Big Calendar
- Lucide React icons

**Backend/Database**:

- Supabase (PostgreSQL)
- Supabase Auth
- Row Level Security (RLS)
- Server-side rendering (SSR)
- Client-side rendering (CSR) where needed

**Authentication**:

- Supabase Auth with email/password
- Session-based authentication
- Role-based middleware routing
- Secure cookie management

**E-commerce Integration**:

- Shopify Admin API
- Webhooks for order syncing
- Hybrid approach: webhooks + on-demand queries

**Deployment**:

- Docker containerized
- Google Cloud Run
- Artifact Registry
- Cloud Build (CI/CD ready)

### Project Structure

```
admin-website/
├── app/
│   ├── actions/
│   │   ├── auth.ts                      # signIn/signOut server actions
│   │   └── services.ts             # service workflow
│   ├── api/
│   │   └── shopify/
│   │       ├── sync/                    # Shopify sync API (GET status, POST trigger)
│   │       ├── products/                # Products + Inventory API endpoint
│   │       └── webhooks/orders/         # Shopify webhook handler
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts                 # OAuth callback handler
│   ├── staff/                           # Staff Portal
│   │   ├── consultations/               # Calendar with CRUD
│   │   ├── orders/                      # Orders with tabs + service badges
│   │   ├── users/                    # User list + detail
│   │   │   └── [id]/                    # User detail page
│   │   ├── products/                    # Products + Inventory page (unified view)
│   │   ├── settings/                    # Settings with Shopify sync
│   │   ├── users/                       # User management
│   │   ├── layout.tsx                   # Staff layout
│   │   └── page.tsx                     # Staff dashboard
│   ├── admin-v2/                        # Admin Portal (v2, session-centric)
│   │   ├── consultations/               # Admin's consultations
│   │   ├── home/                        # Admin home page
│   │   ├── users/
│   │   │   └── [id]/                    # User detail
│   │   │       └── sessions/[sessionId] # Consultation session view
│   │   ├── layout.tsx                   # Admin layout
│   │   └── page.tsx                     # Admin dashboard redirect
│   ├── login/                           # Login page (real auth)
│   ├── layout.tsx                       # Root layout
│   ├── globals.css                      # Global styles + calendar
│   └── page.tsx                         # Root redirect
├── components/
│   ├── ui/                              # shadcn/ui components (20+)
│   ├── sidebar.tsx                      # Staff navigation + logout
│   ├── login-form.tsx                   # Authentication form
│   ├── consultation-modal.tsx           # CRUD modal
│   ├── order-details-modal.tsx          # Order viewer
│   ├── user-search.tsx               # Search form
│   ├── service-item-button.tsx  # service trigger
│   ├── service-item-modal.tsx   # service form
│   ├── visa-timeline.tsx             # Timeline aggregator
│   └── timeline/
│       ├── timeline-entry.tsx           # Polymorphic entry display
│       └── add-note-form.tsx            # Quick note addition
├── lib/
│   ├── supabase/
│   │   ├── client.ts                    # Client-side
│   │   ├── server.ts                    # Server-side
│   │   └── middleware.ts                # Auth middleware with role routing
│   ├── shopify.ts                       # Shopify REST/GraphQL API helpers
│   ├── shopify-sync.ts                  # Sync logic (products, inventory)
│   └── utils.ts                         # Utilities
├── types/
│   ├── database.ts                      # Supabase generated types
│   ├── shopify.ts                       # Shopify API types
│   └── index.ts                         # Exported types
├── public/fonts/                        # Sofia Pro font files
├── middleware.ts                        # Auth enabled
├── Dockerfile                           # Cloud Run deployment
├── supabase-schema.sql                  # Database schema
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🎨 Design System

### Brand Colors

- **Primary**: `#C2785F`
- **Variations**: 50-900 scale in `tailwind.config.ts`
- **Background**: White
- **Dark Mode**: Disabled (future enhancement)

### Typography

- **Font**: Sofia Pro (commercial font - files in `/public/fonts/`)
- **Fallback**: System fonts (currently active)
- **To enable**: Uncomment font config in `app/layout.tsx`

### UI Components (shadcn/ui)

- Button, Card, Table, Badge
- Input, Select, Tabs, Dialog
- Sheet (mobile menu), Scroll Area
- Skeleton, Dropdown, Separator
- Avatar, Textarea, Label, Form

### Currency Formatting

All currency displays use **Philippine Pesos (PHP)** with the `₱` symbol.

**Shared Utility** (`lib/utils.ts`):
```typescript
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}
```

**Usage**: Import `formatCurrency` from `@/lib/utils` in any component that needs to display monetary values.

**Files using currency formatting**:
- `components/dashboard-metrics.tsx` - Total revenue display
- `components/recent-orders-list.tsx` - Order totals
- `components/user-orders-list.tsx` - Order history
- `components/consultation-order-card.tsx` - Latest order card
- `components/order-details-modal.tsx` - Order details
- `components/shopify-customer-search.tsx` - Customer total spent
- `components/shopify-link-modal.tsx` - Linked customer info
- `components/service-item-modal.tsx` - Product prices
- `app/admin/users/page.tsx` - Shopify customers table
- `app/staff/users/page.tsx` - Shopify customers table
- `app/staff/products/page.tsx` - Product prices
- `app/manage/products/page.tsx` - Product and variant prices + inventory

### Supabase Query Limits

**IMPORTANT:** Supabase's PostgREST API defaults to returning a maximum of **1,000 rows** per query. This affects any query that could return more than 1,000 records.

**When writing queries that may exceed 1,000 rows:**

1. **For counts:** Always use `{ count: "exact", head: true }` instead of fetching rows and using `.length`
   ```typescript
   // GOOD - Uses database COUNT
   const { count } = await adminClient
     .from("orders")
     .select("*", { count: "exact", head: true });

   // BAD - Capped at 1000
   const { data } = await adminClient.from("orders").select("*");
   const count = data?.length; // Max 1000!
   ```

2. **For aggregations (SUM, AVG):** Use database RPC functions
   ```typescript
   // GOOD - Single value from database
   const { data } = await (adminClient as any).rpc('get_order_revenue', { ... });

   // BAD - Fetches all rows, caps at 1000
   const { data } = await adminClient.from("orders").select("order_data");
   const total = data?.reduce(...); // Missing data!
   ```

3. **For listing data:** Use `.range()` pagination
   ```typescript
   // GOOD - Explicit pagination
   const { data } = await adminClient
     .from("orders")
     .select("*")
     .range(0, 99); // Page 1
   ```

**Database RPC functions available:**
- `get_order_revenue(start_date, end_date)` - Sum of order totals
- `get_consultation_status_counts(start_date, end_date, admin_filter)` - Consultation status breakdown
- `get_service_approval_counts(start_date, end_date, admin_filter)` - Treatment approval breakdown

**Files with pagination/RPC implemented:**
- `app/actions/dashboard.ts` - Uses RPC for revenue, count for orders
- `app/actions/reports.ts` - Uses RPC functions for consultation and service metrics
- `app/actions/consultations.ts` - Uses date windowing + pagination
- `app/staff/users/page.tsx` - Uses pagination for user list

---

## 🗄️ Database Schema

### Tables (Supabase PostgreSQL)

**users**:

- id (UUID, references auth.users)
- email, role (admin/admin/staff), name
- Row Level Security enabled

**users**:

- id, email, name, phone
- shopify_customer_id (for linking)
- date_of_birth, address, notes
- Auto/manual Shopify linking

**questionnaires**:

- id, user_id (FK)
- submitted_at, responses (JSONB)
- questionnaire_type, status

**consultations**:

- id, user_id (FK), admin_id (FK)
- start_time, end_time
- status: `scheduled` | `ready` | `in_progress` | `completed` | `missed` | `cancelled`
- notes, admin_notes (JSON array for session-based notes)
- Cal.com fields: cal_booking_uid, cal_event_id, cal_meeting_url, cal_metadata
- **Cancellation Tracking** (added 2025-12-12):
  - cancelled_at - Timestamp when cancelled
  - cancelled_by (FK to users) - User who cancelled
  - cancellation_reason - Free text reason
  - cancellation_source: `admin` | `user` | `admin` | `system` | `calcom`
- created_at

**services**:

- id, user_id (FK)
- product, status
- plan_json (JSONB)
- created_at

**items**:

- id, service_id (FK)
- name, dosage, schedule
- start_date, end_date

**orders**:

- id, user_id (FK), shopify_order_id
- status (open/ready_to_ship/closed/pending_approval/rejected)
- synced_at, order_data (JSONB)
- RX- or DRAFT- prefix for service orders
- **Consultation Order Tracking** (added 2025-12-10):
  - consultation_id (FK) - Links to source consultation
  - order_source: `shopify` | `service` | `upsell_add` | `upsell_change`
  - admin_approval_status: `pending` | `approved` | `rejected`
  - admin_approved_by (FK to users) - Admin who approved/rejected
  - admin_approved_at - Timestamp of approval/rejection
  - parent_order_id (FK to orders) - For upsell_change orders

**user_notes**:

- id, user_id (FK), admin_id (FK)
- note (TEXT)
- created_at
- Independent of consultations (admins can add notes anytime)

**staff_notes**:

- id, user_id (FK), user_id (FK)
- note (TEXT), note_type (general/alert/flag/followup)
- is_pinned (BOOLEAN)
- created_at, updated_at
- For customer profiling by staff (separate from visa notes)

**user_tags**:

- id, user_id (FK)
- tag (TEXT), color (gray/red/orange/yellow/green/blue/purple/pink)
- created_by (FK to users)
- created_at
- UNIQUE(user_id, tag)

**shopify_customers**:

- id, shopify_customer_id (BIGINT)
- email, first_name, last_name, phone
- orders_count, total_spent
- customer_data (JSONB)
- synced_at, created_at, updated_at

**shopify_products**:

- id (Shopify product ID, BIGINT)
- title, handle, product_type, vendor
- status (active/archived/draft)
- created_at, updated_at
- synced_at (last sync timestamp)

**shopify_variants**:

- id (Shopify variant ID, BIGINT)
- product_id (FK to shopify_products)
- title, sku, barcode
- price, compare_at_price
- inventory_item_id (for inventory tracking)
- inventory_quantity
- created_at, updated_at, synced_at

**shopify_inventory_levels**:

- inventory_item_id (Shopify inventory item ID)
- location_id (Shopify location ID)
- available (stock quantity)
- updated_at, synced_at

**shopify_sync_log**:

- id (UUID)
- sync_type (products/inventory/all)
- status (success/error/partial)
- records_synced, errors (JSONB)
- started_at, completed_at

### Indexes

- Email lookups (users)
- Shopify customer ID (users)
- User/admin references (consultations)
- Order status (orders)

### RLS Policies

- Authenticated users can view all data
- Admins can manage users
- Role-based access control ready

---

## 🔄 Data Flow

### Server Components (SSR)

- Admin-v2 home
- Admin-v2 user detail
- Staff users list
- Staff user detail
- Staff users management

**Pattern:**

```typescript
const supabase = await createClient();
const { data } = await supabase.from("table").select("*");
```

### Client Components (CSR)

- Admin-v2 consultations
- Staff consultations calendar
- Staff orders
- Login form
- Timeline add note form
- service modal

**Pattern:**

```typescript
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Shopify Integration (Hybrid Approach)

**Webhooks** → Sync to Supabase:

1. Order created/updated in Shopify
2. Webhook fires to `/api/shopify/webhooks/orders`
3. Signature verified
4. Order synced to `orders` table
5. User auto-linked by email match
6. Shopify customer ID saved

**On-Demand** → Real-time queries:

- Click "View Details" → Fetch from Shopify API
- Always current data
- No rate limit concerns for viewing

### User-Order Linking

- **Automatic**: Email matching in webhook handler
- **Manual**: Override in user details (UI placeholder)

---

## 📊 Authentication Flow

### Login Flow

1. User visits `/` or `/login`
2. Enters email/password in `LoginForm`
3. Server action `signIn()` authenticates with Supabase
4. Middleware checks user role from `users` table
5. Redirects based on role:
   - `role = 'admin'` → `/admin-v2`
   - `role = 'admin' | 'staff'` → `/staff`

### Route Protection

- Unauthenticated users cannot access `/staff/*` or `/admin-v2/*`
- Admins cannot access `/staff/*`
- Staff/admin cannot access `/admin-v2/*`
- All enforced in middleware

### Logout Flow

1. User clicks "Logout" button in sidebar
2. Client component calls `signOut()` server action
3. Server clears Supabase session
4. Redirects to `/login`

---

## 🏥 service Workflow

### Admin Side

1. Opens user detail (`/admin-v2/users/[id]`)
2. Clicks "service document" button
3. Fills form: item name, dosage, schedule, dates, notes
4. Submits → Server action creates:
   - Treatment record
   - document record with details
   - Order record with `RX-{timestamp}` ID
5. Page refreshes, service appears in timeline

### Staff Side

1. Opens orders tab (`/staff/orders`)
2. Sees new order with "service" badge
3. Can view details, process order
4. Order has user linked automatically

---

## 🚀 Deployment

### Google Cloud Run

**Prerequisites**:

- Google Cloud account with billing
- gcloud CLI installed
- Docker installed

**Quick Deploy**:

```bash
# Build image
docker build -t viza-admin-website .

# Push to Artifact Registry
docker tag viza-admin-website us-central1-docker.pkg.dev/PROJECT_ID/viza-admin-website/app:latest
docker push us-central1-docker.pkg.dev/PROJECT_ID/viza-admin-website/app:latest

# Deploy
gcloud run deploy viza-admin-website \
  --image us-central1-docker.pkg.dev/PROJECT_ID/viza-admin-website/app:latest \
  --region us-central1 \
  --allow-unauthenticated
```

### Environment Variables (Production)

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Shopify (optional - for product sync and orders)
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# Cal.com (optional - for booking sync)
CALCOM_API_KEY=cal_live_xxxxx
CAL_WEBHOOK_SECRET=your-webhook-secret
```

---

## 🔧 Development

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Test Docker build
docker build -t viza-admin-website .
docker run -p 8080:8080 viza-admin-website
```

### Key Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run start            # Start production server

# Linting
npm run lint             # ESLint check

# Add shadcn component
npx shadcn@latest add [component-name]
```

### User Roles Setup

**In Supabase `users` table:**

```sql
-- Admin users
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';

-- Staff users
UPDATE users SET role = 'staff' WHERE email = 'staff@example.com';

-- Admin users
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

### Creating Test Users

```sql
-- Insert into auth.users (via Supabase Dashboard or API)
-- Then link to public.users table
INSERT INTO public.users (id, email, name, role)
VALUES
  ('uuid-here', 'admin@example.com', 'Dr. John Smith', 'admin'),
  ('uuid-here', 'staff@example.com', 'Jane Doe', 'staff');
```

---

## 📚 Documentation Files

### Core Docs

- **README.md** - Project overview, features, tech stack
- **CLAUDE.md** - This file (complete project documentation)
- **ENHANCEMENTS.md** - UI enhancements and Phase 5 implementation details

### Deployment

- **Dockerfile** - Multi-stage Docker build
- **.dockerignore** - Build optimization

### Database

- **supabase-schema.sql** - Complete SQL schema with RLS policies

---

## 🔐 Security

### Authentication

- Supabase Auth with Row Level Security
- Middleware protects dashboard and admin routes
- Role-based access (admin/admin/staff)
- Session management via cookies

### API Security

- Shopify webhook signature verification
- Environment variables for secrets
- HTTPS only (Cloud Run automatic)
- No sensitive data in client code

### Database

- RLS policies on all tables
- Authenticated users only
- Admin-only user management
- Secure foreign key constraints

---

## 📝 Logging Standards

### Webhook Logging

All webhook handlers use structured JSON logging via `/lib/webhook-logger.ts` for Cloud Logging compatibility.

**Log Format:**
```typescript
{
  level: "info" | "warn" | "error",
  service: "webhook",
  provider: "shopify" | "calcom",
  event: "orders/create" | "BOOKING_CREATED" | etc,
  status: "received" | "processing" | "success" | "failed",
  resourceId: "12345",
  resourceType: "order" | "customer" | "booking" | etc,
  metadata: { ... },  // Optional: key business fields (NO PII)
  error: "message",   // Only on failures
  timestamp: "ISO8601"
}
```

**Usage:**
```typescript
import { logWebhook, getSafeErrorMessage } from "@/lib/webhook-logger";

// Log webhook received
logWebhook({
  level: "info",
  provider: "shopify",
  event: "orders/create",
  status: "received",
  resourceId: orderId,
  resourceType: "order",
  metadata: { financial_status: "paid" }
});

// Log errors safely
logWebhook({
  level: "error",
  provider: "shopify",
  event: "orders/create",
  status: "failed",
  resourceId: orderId,
  resourceType: "order",
  error: getSafeErrorMessage(error)
});
```

**What to Log:**
| Event Type | Fields to Include |
|------------|-------------------|
| Orders | order_id, status, financial_status, fulfillment_status |
| Customers | customer_id, event_type |
| Inventory | inventory_item_id, location_id, available_qty |
| Products | product_id, title, status |
| Fulfillments | fulfillment_id, order_id, status |
| Draft Orders | draft_order_id, name, status |
| Cal.com Bookings | booking_uid, event_type, consultation_id |

**What NOT to Log (Privacy/Security):**
- Email addresses (PII)
- Phone numbers (PII)
- Full names (PII)
- Webhook secrets or HMAC values
- Full request/response payloads
- Stack traces (use `getSafeErrorMessage()` instead)

**Key Files:**
- `/lib/webhook-logger.ts` - Logger utility
- `/app/api/shopify/webhooks/*/route.ts` - Shopify webhook handlers
- `/app/api/cal/webhooks/route.ts` - Cal.com webhook handler

---

## 🎓 How to Use This Project

### As a Developer

**Understanding the Code**:

1. Start with `middleware.ts` - see auth flow
2. Check `lib/supabase/middleware.ts` - role-based routing
3. Review `app/admin-v2/home/page.tsx` - server component pattern
4. Review `app/login/page.tsx` - authentication
5. Read `supabase-schema.sql` - database design

**Making Changes**:

1. All data comes from Supabase (no mock data)
2. Modify UI in respective page files
3. Add components in `components/` directory
4. Run `npm run build` to verify

**Adding New Features**:

1. Server actions in `app/actions/`
2. Client components for interactivity
3. Server components for data fetching
4. Update types in `types/` directory

### As a Visa Staff Member

**Staff Portal Access**:

1. Visit deployed URL
2. Sign in with staff/admin credentials
3. Dashboard shows all practice metrics
4. Access to all users, orders, consultations, users

**Key Pages**:

- Dashboard - Overview metrics
- Users - Search, view details, see history
- Orders - Manage all orders including services
- Consultations - Calendar view with CRUD
- User Management - Manage staff and admins

### As a Admin

**Admin Portal Access**:

1. Visit deployed URL
2. Sign in with admin credentials
3. Automatically redirected to `/admin-v2`
4. Session-centric view of your users and consultations

**Key Pages**:

- Home (`/admin-v2/home`) - Active and upcoming consultations
- User Detail (`/admin-v2/users/[id]`) - Timeline, service items
- Session View (`/admin-v2/users/[id]/sessions/[sessionId]`) - Active consultation
- Consultations (`/admin-v2/consultations`) - All consultations

**Prescribing Workflow**:

1. Open user detail page
2. Click "service document"
3. Fill in item details
4. Submit to create service order

---

## 🐛 Troubleshooting

### Build Fails

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Rebuild
npm run build
```

### Authentication Issues

- Check environment variables are set
- Verify user exists in `auth.users` and `public.users`
- Ensure role is set correctly in `users` table
- Check middleware is enabled

### Cannot Access Routes

- Ensure authenticated with valid session
- Check user role matches route access
- Verify middleware routing logic

### Docker Build Issues

- Ensure `output: "standalone"` in `next.config.ts`
- Check Dockerfile syntax
- Verify Node version compatibility (20+)
- Run `npm run build` first to catch errors

---

## 📈 Future Enhancements

### Planned Features

- [ ] Real-time collaboration (Supabase subscriptions)
- [ ] Email notifications for consultations
- [ ] User portal for questionnaire submission
- [ ] Advanced analytics and reporting
- [ ] Bulk import users
- [ ] Export calendar to PDF/ICS
- [ ] Dark mode support
- [ ] Mobile app (React Native)
- [ ] Video consultation integration
- [ ] E-prescribing integration

### Technical Improvements

- [ ] E2E testing (Playwright)
- [ ] Unit tests (Jest)
- [ ] Storybook for components
- [ ] Performance monitoring
- [ ] Error tracking (Sentry)
- [ ] CDN for static assets

---

## ✅ Complete Feature List

| Feature           | Admin Portal                            | Staff Portal                               | Admin Portal                |
| ----------------- | ---------------------------------------- | ------------------------------------------ | --------------------------- |
| Dashboard         | ✅ Admin-specific metrics               | ✅ All metrics                             | ✅ System overview stats    |
| My Users       | ✅ Consulted users + search           | ✅ All users + search                   | ✅ All users + search    |
| User Detail    | ✅ Consultation view + decision buttons  | ✅ Full administrative view                | ✅ Full administrative view |
| Health Summary    | ✅ Top (prominent)                       | ✅ Above visa timeline                  | ✅ Above visa timeline   |
| Latest Order Card | ✅ Top (prominent)                       | ✅ Above visa timeline                  | ✅ Above visa timeline   |
| Visa Timeline  | ✅ With admin's notes                   | ✅ With admin's notes                     | ✅ With admin's notes      |
| Staff Notes       | ❌ Not shown                             | ✅ Full CRUD                               | ✅ Full CRUD                |
| User Tags      | ❌ Not shown                             | ✅ Full CRUD                               | ✅ Full CRUD                |
| Orders            | ✅ Latest order + approval at end        | ✅ All orders + 4 tabs                     | ✅ Past orders list         |
| Consultations     | ✅ List view (upcoming/past)             | ✅ Calendar CRUD + Reports                 | ❌ Not included             |
| Users             | ❌ No access                             | ✅ Management                              | ❌ Not included             |
| Products          | ❌ No access                             | ✅ Products + Inventory (unified)          | ❌ Not included             |
| Cal.com Bookings  | ❌ No access                             | ✅ Via Settings                            | ✅ Dedicated page           |
| Decision Buttons  | ✅ On-hold/Upsell/No Show + End Approval | ❌ Not applicable                          | ❌ Not applicable           |
| service     | ✅ Can service                         | ✅ View only                               | ✅ View only                |
| Authentication    | ✅ Login/Logout                          | ✅ Login/Logout                            | ✅ Login/Logout             |
| Email Privacy     | ✅ Visible                               | ✅ Visible                                 | ✅ Visible                  |
| Theme Color       | Brand (#C2785F)                          | Brand (#C2785F)                            | Purple                      |

---

## 📞 Support & Resources

### Documentation

- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- Shopify API: https://shopify.dev/docs/api
- shadcn/ui: https://ui.shadcn.com
- React Big Calendar: https://jquense.github.io/react-big-calendar
- Google Cloud Run: https://cloud.google.com/run/docs

### Project Links

- Repository: [GitHub URL]
- Deployment: [Cloud Run URL]
- Supabase Dashboard: [Supabase Project URL]
- Shopify Admin: [Shopify Store URL]

---

## 📝 License

This project is proprietary software for VIZA visa practice.

---

## 🎯 Quick Reference

### Important Files

| File                                           | Purpose                                               |
| ---------------------------------------------- | ----------------------------------------------------- |
| `middleware.ts`                                | Auth enabled                                          |
| `lib/supabase/middleware.ts`                   | Role-based routing                                    |
| `lib/supabase/admin.ts`                        | Admin client (bypasses RLS)                           |
| `lib/consultation-status.ts`                   | Consultation status helpers                           |
| `lib/shopify.ts`                               | Shopify REST/GraphQL API + draft orders               |
| `lib/shopify-sync.ts`                          | Sync logic for products and inventory                 |
| `lib/cal.ts`                                   | Cal.com API client                                    |
| `lib/calcom-sync.ts`                           | Cal.com booking sync logic                            |
| `app/actions/auth.ts`                          | signIn/signOut                                        |
| `app/actions/impersonation.ts`                 | User impersonation token generation + audit        |
| `lib/impersonation-session.ts`                 | Impersonation cookie utilities (JWT signing)          |
| `app/auth/impersonate-callback/route.ts`       | Impersonation token validation + cookie creation      |
| `app/manage/impersonate/page.tsx`              | User impersonation UI                              |
| `app/actions/services.ts`                 | service workflow + Shopify draft orders          |
| `app/actions/consultations.ts`                 | Begin/end/cancel/decision actions (uses admin client) |
| `app/actions/user-health.ts`                | User health summary + consultation order           |
| `app/actions/calcom-sync.ts`                   | Cal.com sync server actions                           |
| `app/actions/users.ts`                         | User management + auth linking                        |
| `app/actions/dashboard.ts`                     | Dashboard metrics + recent orders server actions      |
| `app/api/calcom/sync/route.ts`                 | Cal.com sync API endpoint                             |
| `app/api/cal/webhooks/route.ts`                | Cal.com webhook handler                               |
| `app/admin-v2/users/[id]/page.tsx`          | User detail view with consultation controls        |
| `app/admin-v2/users/[id]/sessions/[sessionId]/page.tsx` | Active consultation session view    |
| `app/admin-v2/home/page.tsx`                  | Admin home page                                      |
| `app/manage/products/page.tsx`                 | Products + Inventory unified page                     |
| `app/manage/settings/page.tsx`                 | Settings with Shopify sync                            |
| `components/visa-timeline.tsx`              | Timeline aggregator                                   |
| `components/timeline/timeline-entry.tsx`       | Timeline entry with left/right alignment              |
| `components/timeline/add-note-form.tsx`        | Note form + service button                          |
| `components/start-consultation-button.tsx`     | Start consultation button                             |
| `components/end-consultation-button.tsx`       | End consultation button (opens approval dialog)       |
| `components/end-consultation-dialog.tsx`       | service approval dialog at end of consultation   |
| `components/service-item-modal.tsx`    | service modal with Shopify products              |
| `lib/order-utils.ts`                           | Shared utility for Shopify order creation             |
| `components/questionnaire-summary.tsx`         | User health metrics display                        |
| `components/consultation-order-card.tsx`       | Latest order display for consultations                |
| `components/consultation-decision-buttons.tsx` | On-hold/Upsell/No Show buttons (Approve/Reject removed) |
| `components/upsell-modal.tsx`                  | Two-step upsell modal (Add/Change product)            |
| `app/actions/admin-orders.ts`                  | Order server actions (approval funcs deprecated)      |
| `app/manage/orders/page.tsx`                   | Orders page with 4 tabs (Unfulfilled/Fulfilled/etc.)  |
| `components/calcom-sync-section.tsx`           | Cal.com sync UI component                             |
| `components/consultation-modal.tsx`            | Consultation modal (read-only for Cal.com)            |
| `components/dashboard-metrics.tsx`             | Performance metrics with time period selector         |
| `components/recent-orders-list.tsx`            | Recent orders list component                          |
| `components/time-period-selector.tsx`          | Time period dropdown selector                         |
| `app/staff/settings/page.tsx`                  | Settings page with sync integrations                  |
| `app/staff/consultations/reports/page.tsx`     | Consultation reports & analytics page                 |
| `app/actions/reports.ts`                       | Report metrics server actions                         |
| `components/reports/*`                         | Report chart and filter components                    |
| `database/schema.sql`                          | Database schema (in monorepo root)                    |
| `Dockerfile`                                   | Cloud Run deployment                                  |

### Key Commands

| Command                                  | Description         |
| ---------------------------------------- | ------------------- |
| `npm run dev`                            | Start dev server    |
| `npm run build`                          | Production build    |
| `docker build -t viza-admin-website .` | Build Docker image  |
| `gcloud run deploy`                      | Deploy to Cloud Run |

### Data Counts (Sample)

| Type          | Production                    |
| ------------- | ----------------------------- |
| Users      | From Supabase                 |
| Orders        | From Supabase                 |
| Consultations | From Supabase                 |
| Users         | From Supabase                 |
| Admins       | From Supabase (role='admin') |

---

## ✅ Project Status

**Current State**: ✅ Production Ready
**Build**: ✅ Passing
**Authentication**: ✅ Enabled with role-based routing
**Data Migration**: ✅ Complete - All pages use Supabase
**Tests**: ⚠️ Manual testing completed
**Deployment**: ✅ Cloud Run configured
**Documentation**: ✅ Complete

**Implementation Phases Complete**:

1. ✅ Data migration to Supabase (all pages)
2. ✅ Admin portal v2 (session-centric, `/admin-v2/*`)
3. ✅ Visa timeline with mixed content types
4. ✅ service/order creation workflow
5. ✅ Authentication with role-based routing
6. ✅ Old admin portal (`/admin`) removed

**Next Steps**:

1. Deploy to Google Cloud Run
2. Configure Supabase production instance
3. Set up user accounts with roles
4. Train staff and admins on system usage
5. Monitor and optimize performance

---

**Last Updated**: February 2026
**Version**: 2.3.0
**Maintained By**: Development Team

---

_This project was built with Next.js 16, TypeScript, Supabase, and modern web technologies to provide a robust, scalable management system for visa practitioners with separate portals for admins and administrative staff._
