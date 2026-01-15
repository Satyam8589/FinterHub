# FinterHub Backend - System Architecture & Workflow

## 🏗️ System Overview

FinterHub is a **Multi-Currency Expense Splitting Backend API** built with Node.js, Express, and MongoDB. It provides comprehensive expense management, group collaboration, and settlement calculation features.

---

## 📊 Architecture Layers

### 1. **Client Layer**
- Frontend Applications (Web/Mobile)
- External Services
- API Consumers

**Communication:** HTTP/HTTPS Requests → Express.js Server

---

### 2. **API Gateway Layer**

#### Express.js Server (Port 5000)
**Middleware Stack:**
- `express.json()` - JSON body parser
- `cookie-parser` - Cookie handling
- `cors()` - Cross-Origin Resource Sharing
- Custom authentication middleware

**Health Monitoring:**
- `GET /health` - Health check endpoint
  - Returns: status, timestamp, uptime, environment

---

### 3. **API Routes Layer**

The application is organized into **5 main modules**:

#### 🔐 **Authentication Module** (`/api/auth`)
Handles user authentication and authorization.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/signup` | User registration | ❌ |
| POST | `/login` | User login | ❌ |
| POST | `/logout` | User logout | ❌ |
| POST | `/refresh-token` | Refresh JWT token | ❌ |
| GET | `/profile` | Get user profile | ✅ |

**Features:**
- JWT-based authentication
- Secure password hashing (bcrypt)
- Token refresh mechanism
- Cookie-based session management

---

#### 👥 **Group Management Module** (`/api/group`)
Manages expense groups and memberships.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/create-group` | Create new group | ✅ |
| POST | `/invite-user-to-group/:groupId` | Invite user to group | ✅ |
| GET | `/get-group-members/:groupId` | Get group members | ✅ |
| POST | `/remove-user-from-group/:groupId` | Remove user from group | ✅ |
| GET | `/list-all-groups-user-presents` | List user's groups | ✅ |
| POST | `/delete-group/:groupId` | Delete group | ✅ |

**Features:**
- Group creation and management
- Member invitation system
- Role-based permissions
- Group deletion with validation

---

#### 💰 **Expense Management Module** (`/api/expense`)
Handles expense creation, tracking, and management.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/add-expense` | Add new expense | ✅ |
| GET | `/get-expenses/:groupId` | Get group expenses | ✅ |
| PUT | `/update-expense/:expenseId` | Update expense | ✅ |
| DELETE | `/delete-expense/:expenseId` | Delete expense | ✅ |

**Features:**
- Multi-currency support
- Split type management (equal, percentage, exact amounts)
- Expense categorization
- Expense history tracking

---

#### 💱 **Currency Module** (`/api/currency`)
Provides currency conversion and exchange rate services.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/list` | List supported currencies | ❌ |
| GET | `/convert` | Convert between currencies | ❌ |
| GET | `/rates` | Get exchange rates | ❌ |

**Features:**
- Real-time currency conversion
- Multiple currency support
- Exchange rate management
- Currency validation

---

#### 🧾 **Settlement Module** (`/api/settlement`)
Calculates and manages debt settlements between group members.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/calculate` | Calculate settlements | ✅ |
| POST | `/record` | Record settlement payment | ✅ |
| GET | `/history/:groupId` | Get settlement history | ✅ |

**Features:**
- Automated settlement calculation
- Debt optimization algorithms
- Settlement history tracking
- Multi-currency settlement support

---

### 4. **Middleware Layer**

#### Authentication Middleware (`auth.js`)
- **Purpose:** Protect routes requiring authentication
- **Mechanism:** JWT token verification
- **Location:** Applied to protected routes
- **Functionality:**
  - Extracts JWT from cookies/headers
  - Verifies token validity
  - Attaches user info to request object
  - Handles token expiration

**Protected Routes:** All routes marked with 🔒 require authentication

---

### 5. **Controller Layer**

Controllers handle business logic and request processing:

1. **Auth Controller** (`auth.controller.js`)
   - User registration and validation
   - Login authentication
   - Token generation and refresh
   - User profile management

2. **Group Controller** (`group.controller.js`)
   - Group CRUD operations
   - Member management
   - Permission validation
   - Group listing and filtering

3. **Expense Controller** (`expense.controller.js`)
   - Expense creation and validation
   - Split calculation
   - Expense updates and deletion
   - Expense retrieval and filtering

4. **Currency Controller** (`currency.controller.js`)
   - Currency listing
   - Exchange rate fetching
   - Currency conversion logic

5. **Settlement Controller** (`settlement.controller.js`)
   - Settlement calculation algorithms
   - Debt optimization
   - Settlement recording
   - History management

---

### 6. **Service Layer**

Handles complex business logic:
- Validation services
- Calculation services
- Data transformation
- External API integration

---

### 7. **Database Layer**

#### MongoDB Collections:

1. **Users Collection**
   - User credentials
   - Profile information
   - Authentication tokens

2. **Groups Collection**
   - Group metadata
   - Member lists
   - Group settings

3. **Expenses Collection**
   - Expense details
   - Split information
   - Currency data
   - Timestamps

4. **Settlements Collection**
   - Settlement records
   - Payment history
   - Debt tracking

5. **Currencies Collection**
   - Currency codes
   - Exchange rates
   - Currency metadata

---

## 🐳 Docker Deployment Architecture

### Container Setup:

#### 1. **Backend Container**
- **Image:** `satyam8589/finterhub-backend:latest`
- **Base:** Node.js 20 Alpine
- **Port:** 5000
- **Features:**
  - Health checks
  - Auto-restart
  - Environment configuration

#### 2. **MongoDB Container**
- **Image:** `mongo:7.0`
- **Port:** 27017
- **Features:**
  - Persistent volumes
  - Authentication enabled
  - Health monitoring

#### 3. **Docker Network**
- **Name:** `finterhub-network`
- **Type:** Bridge network
- **Purpose:** Inter-container communication

#### 4. **Persistent Volumes**
- `mongodb_data` - Database storage
- `mongodb_config` - MongoDB configuration

---

## 🔄 Request Flow

### Example: Creating an Expense

```
1. Client sends POST request to /api/expense/add-expense
   ↓
2. Express.js receives request
   ↓
3. Middleware stack processes request:
   - CORS validation
   - JSON parsing
   - Cookie parsing
   ↓
4. Auth middleware verifies JWT token
   ↓
5. Route handler forwards to Expense Controller
   ↓
6. Expense Controller:
   - Validates expense data
   - Calculates splits
   - Checks currency validity
   ↓
7. Service layer processes business logic
   ↓
8. Data saved to MongoDB (Expenses Collection)
   ↓
9. Response sent back to client
```

---

## 🔐 Security Features

1. **Authentication:**
   - JWT-based token system
   - Secure password hashing (bcrypt)
   - Token expiration and refresh

2. **Authorization:**
   - Route-level protection
   - Group membership validation
   - Owner/admin permissions

3. **Data Protection:**
   - Environment variable configuration
   - Secure cookie handling
   - CORS configuration

4. **Docker Security:**
   - Non-root user execution
   - Minimal Alpine base image
   - Network isolation

---

## 📈 Scalability Features

1. **Horizontal Scaling:**
   - Stateless API design
   - Docker container orchestration
   - Load balancer ready

2. **Database Optimization:**
   - Indexed queries
   - Efficient data models
   - Connection pooling

3. **Caching Strategy:**
   - JWT token caching
   - Currency rate caching
   - Query result caching

---

## 🧪 Testing Infrastructure

- **Unit Tests:** Controller and service testing
- **Integration Tests:** API endpoint testing
- **Test Framework:** Jest
- **Coverage:** Controllers, models, middleware
- **Test Database:** MongoDB Memory Server

---

## 📊 Monitoring & Health

### Health Check Endpoint
```json
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2026-01-15T09:18:28.127Z",
  "uptime": 136.58,
  "environment": "production"
}
```

### Monitoring Points:
- Container health status
- Database connectivity
- API response times
- Error rates

---

## 🚀 Deployment Workflow

### Development:
```bash
1. npm run dev (local development)
2. npm test (run tests)
3. docker-compose up (local Docker testing)
```

### Production:
```bash
1. docker build (build image)
2. docker tag (tag version)
3. docker push (push to Docker Hub)
4. docker-compose -f docker-compose.prod.yml up (deploy)
```

---

## 📦 Technology Stack

- **Runtime:** Node.js 20
- **Framework:** Express.js 5
- **Database:** MongoDB 7.0
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcrypt
- **Containerization:** Docker
- **Orchestration:** Docker Compose
- **Testing:** Jest, Supertest
- **Validation:** Custom middleware

---

## 🔗 API Base URL

- **Development:** `http://localhost:5000`
- **Production:** Configured via `FRONTEND_URL` environment variable

---

## 📝 Environment Configuration

Required environment variables:
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)
- `MONGO_URL` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `FRONTEND_URL` - Frontend URL for CORS

---

## 🎯 Key Features Summary

✅ Multi-currency expense tracking
✅ Group-based expense management
✅ Automated settlement calculation
✅ JWT authentication
✅ RESTful API design
✅ Docker containerization
✅ Comprehensive testing
✅ Health monitoring
✅ Scalable architecture
✅ Production-ready deployment

---

## 📚 Documentation Files

- `README.md` - Project overview
- `DOCKER_DEPLOYMENT.md` - Docker deployment guide
- `.agent/workflows/docker.md` - Docker commands reference
- API documentation - (Can be generated with Swagger/OpenAPI)

---

*This architecture ensures scalability, maintainability, and security for the FinterHub expense management platform.*
