# FinterHub - Complete File Structure Design
## Multi-Currency Expense Engine - Production-Ready Architecture

---

## 📁 Project Root Structure

```
FinterHub/
├── .github/                          # GitHub specific files
│   ├── workflows/                    # CI/CD pipelines
│   │   ├── ci.yml                   # Continuous Integration
│   │   ├── cd.yml                   # Continuous Deployment
│   │   └── test.yml                 # Automated testing
│   ├── ISSUE_TEMPLATE/              # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md     # PR template
│
├── backend/                          # Backend application (Node.js + Express)
│   ├── config/                      # Configuration files
│   │   ├── db.js                    # Database connection
│   │   ├── redis.js                 # Redis configuration
│   │   ├── email.js                 # Email service config
│   │   ├── sms.js                   # SMS service config
│   │   ├── currency.js              # Currency API config
│   │   ├── logger.js                # Winston logger setup
│   │   └── constants.js             # App-wide constants
│   │
│   ├── controllers/                 # Business logic controllers
│   │   ├── auth.controller.js       # Authentication logic ✅
│   │   ├── expense.controller.js    # Expense management ✅
│   │   ├── group.controller.js      # Group operations ✅
│   │   ├── user.controller.js       # User profile management
│   │   ├── settlement.controller.js # Debt settlement logic
│   │   ├── currency.controller.js   # Currency conversion
│   │   ├── report.controller.js     # PDF report generation
│   │   └── notification.controller.js # Email/SMS notifications
│   │
│   ├── middleware/                  # Express middleware
│   │   ├── auth.js                  # JWT authentication ✅
│   │   ├── errorHandler.js          # Global error handler
│   │   ├── validator.js             # Zod schema validation
│   │   ├── rateLimiter.js           # Rate limiting (Redis)
│   │   ├── logger.js                # Request logging
│   │   ├── upload.js                # File upload (Multer)
│   │   └── cors.js                  # CORS configuration
│   │
│   ├── models/                      # MongoDB schemas
│   │   ├── user.model.js            # User schema ✅
│   │   ├── group.model.js           # Group schema ✅
│   │   ├── expense.model.js         # Expense schema ✅
│   │   ├── settlement.model.js      # Settlement records
│   │   ├── transaction.model.js     # Transaction history
│   │   ├── notification.model.js    # Notification queue
│   │   └── auditLog.model.js        # Audit trail
│   │
│   ├── routes/                      # API route definitions
│   │   ├── auth.route.js            # Auth endpoints ✅
│   │   ├── expense.route.js         # Expense endpoints ✅
│   │   ├── group.route.js           # Group endpoints ✅
│   │   ├── user.route.js            # User endpoints
│   │   ├── settlement.route.js      # Settlement endpoints
│   │   ├── currency.route.js        # Currency endpoints
│   │   ├── report.route.js          # Report endpoints
│   │   ├── notification.route.js    # Notification endpoints
│   │   └── index.js                 # Route aggregator
│   │
│   ├── services/                    # External service integrations
│   │   ├── currencyService.js       # Live exchange rate API
│   │   ├── emailService.js          # Email provider (SendGrid/SES)
│   │   ├── smsService.js            # SMS provider (Twilio)
│   │   ├── pdfService.js            # PDF generation (PDFKit)
│   │   ├── cacheService.js          # Redis caching layer
│   │   ├── storageService.js        # File storage (S3/local)
│   │   └── socketService.js         # Socket.io real-time events
│   │
│   ├── utils/                       # Utility functions
│   │   ├── currencyConverter.js     # Currency math logic
│   │   ├── debtSimplifier.js        # Debt optimization algorithm
│   │   ├── splitCalculator.js       # Equal/percentage/custom split
│   │   ├── validators.js            # Custom validation helpers
│   │   ├── responseFormatter.js     # Standardized API responses
│   │   ├── errorCodes.js            # Error code definitions
│   │   ├── dateHelper.js            # Date/timezone utilities
│   │   └── encryption.js            # Data encryption helpers
│   │
│   ├── validators/                  # Zod validation schemas
│   │   ├── auth.validator.js        # Auth request validation
│   │   ├── expense.validator.js     # Expense validation
│   │   ├── group.validator.js       # Group validation
│   │   ├── user.validator.js        # User validation
│   │   ├── settlement.validator.js  # Settlement validation
│   │   └── common.validator.js      # Shared validation rules
│   │
│   ├── tests/                       # Test suites
│   │   ├── unit/                    # Unit tests
│   │   │   ├── controllers/         # Controller tests
│   │   │   ├── models/              # Model tests
│   │   │   ├── services/            # Service tests
│   │   │   └── utils/               # Utility tests
│   │   ├── integration/             # Integration tests
│   │   │   ├── auth.test.js         # Auth flow tests
│   │   │   ├── expense.test.js      # Expense flow tests
│   │   │   ├── group.test.js        # Group flow tests
│   │   │   └── settlement.test.js   # Settlement flow tests
│   │   ├── e2e/                     # End-to-end tests
│   │   │   └── fullFlow.test.js     # Complete user journey
│   │   ├── fixtures/                # Test data
│   │   │   ├── users.js             # Mock users
│   │   │   ├── groups.js            # Mock groups
│   │   │   └── expenses.js          # Mock expenses
│   │   └── setup.js                 # Test environment setup
│   │
│   ├── jobs/                        # Background jobs
│   │   ├── currencyUpdate.job.js    # Daily exchange rate update
│   │   ├── reminderEmail.job.js     # Scheduled reminders
│   │   ├── reportGeneration.job.js  # Monthly PDF reports
│   │   └── dataCleanup.job.js       # Archive old data
│   │
│   ├── docs/                        # API documentation
│   │   ├── swagger.json             # OpenAPI specification
│   │   ├── postman_collection.json  # Postman collection
│   │   └── API_GUIDE.md             # API usage guide
│   │
│   ├── logs/                        # Application logs (gitignored)
│   │   ├── error.log                # Error logs
│   │   ├── combined.log             # All logs
│   │   └── access.log               # HTTP access logs
│   │
│   ├── uploads/                     # Uploaded files (gitignored)
│   │   ├── receipts/                # Expense receipts
│   │   └── avatars/                 # User profile pictures
│   │
│   ├── scripts/                     # Utility scripts
│   │   ├── seed.js                  # Database seeding
│   │   ├── migrate.js               # Data migration
│   │   ├── backup.js                # Database backup
│   │   └── cleanup.js               # Cleanup scripts
│   │
│   ├── .dockerignore                # Docker ignore file ✅
│   ├── .env                         # Environment variables ✅
│   ├── .env.example                 # Example env file
│   ├── .env.docker                  # Docker env variables ✅
│   ├── .gitignore                   # Git ignore file ✅
│   ├── Dockerfile                   # Docker configuration ✅
│   ├── package.json                 # NPM dependencies ✅
│   ├── package-lock.json            # Locked dependencies ✅
│   ├── server.js                    # Application entry point ✅
│   ├── app.js                       # Express app setup
│   └── README.md                    # Backend documentation
│
├── frontend/                        # Frontend application (Future)
│   ├── public/                      # Static assets
│   ├── src/                         # Source code
│   │   ├── components/              # React components
│   │   ├── pages/                   # Page components
│   │   ├── hooks/                   # Custom hooks
│   │   ├── context/                 # Context providers
│   │   ├── services/                # API services
│   │   ├── utils/                   # Utility functions
│   │   └── App.jsx                  # Main app component
│   ├── package.json                 # Frontend dependencies
│   └── vite.config.js               # Vite configuration
│
├── infrastructure/                  # Infrastructure as Code
│   ├── terraform/                   # Terraform configs
│   │   ├── main.tf                  # Main infrastructure
│   │   ├── variables.tf             # Variables
│   │   └── outputs.tf               # Outputs
│   ├── kubernetes/                  # K8s manifests
│   │   ├── deployment.yaml          # Deployment config
│   │   ├── service.yaml             # Service config
│   │   └── ingress.yaml             # Ingress rules
│   └── ansible/                     # Ansible playbooks
│       └── deploy.yml               # Deployment playbook
│
├── docs/                            # Project documentation
│   ├── ARCHITECTURE.md              # System architecture
│   ├── API_DOCUMENTATION.md         # API reference
│   ├── DEPLOYMENT_GUIDE.md          # Deployment instructions
│   ├── CONTRIBUTING.md              # Contribution guidelines
│   ├── SECURITY.md                  # Security policies
│   └── CHANGELOG.md                 # Version history
│
├── .gitignore                       # Root gitignore ✅
├── .editorconfig                    # Editor configuration
├── .prettierrc                      # Code formatting rules
├── .eslintrc.json                   # Linting rules
├── docker-compose.yml               # Docker Compose config ✅
├── task-definition.json             # AWS ECS task definition ✅
├── AWS_DEPLOYMENT_GUIDE.md          # AWS deployment guide ✅
├── README.md                        # Project overview ✅
├── LICENSE                          # License file
└── FILE_STRUCTURE_DESIGN.md         # This file
```

---

## 🎯 File Structure Principles

### 1. **Separation of Concerns**
- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic and external integrations
- **Models**: Data structure and database operations
- **Utils**: Pure functions and helpers
- **Middleware**: Request/response processing

### 2. **Scalability**
- Modular architecture for easy feature addition
- Clear boundaries between layers
- Reusable components across the application

### 3. **Maintainability**
- Consistent naming conventions
- Logical file grouping
- Comprehensive documentation

### 4. **Testability**
- Separate test directories for unit/integration/e2e
- Mock data fixtures
- Test utilities and helpers

---

## 📋 Implementation Priority

### ✅ **Phase 1: Core Backend (COMPLETED)**
- [x] Basic MVC structure
- [x] Authentication system
- [x] Group management
- [x] Expense tracking
- [x] Database models
- [x] Docker setup

### 🚧 **Phase 2: Advanced Features (IN PROGRESS)**
- [ ] Settlement controller
- [ ] Currency service integration
- [ ] PDF report generation
- [ ] Notification system
- [ ] Debt simplification algorithm
- [ ] Redis caching

### 📅 **Phase 3: Production Readiness**
- [ ] Comprehensive testing (80%+ coverage)
- [ ] API documentation (Swagger)
- [ ] Error handling & logging
- [ ] Rate limiting
- [ ] Security hardening
- [ ] Performance optimization

### 🔮 **Phase 4: DevOps & Deployment**
- [ ] CI/CD pipelines
- [ ] Kubernetes deployment
- [ ] Monitoring & alerting
- [ ] Backup & disaster recovery
- [ ] Load balancing
- [ ] Auto-scaling

### 🌟 **Phase 5: Frontend & Polish**
- [ ] React frontend
- [ ] Real-time updates (Socket.io)
- [ ] Mobile responsiveness
- [ ] Progressive Web App (PWA)
- [ ] Analytics dashboard

---

## 🔧 Key Files to Create Next

### **Immediate Priority (Week 1-2)**

1. **backend/services/currencyService.js**
   - Integrate live exchange rate API (Fixer.io, ExchangeRate-API)
   - Cache rates in Redis
   - Fallback to static rates

2. **backend/utils/debtSimplifier.js**
   - Implement minimum transfer algorithm
   - Graph-based debt optimization
   - Multi-currency balance calculation

3. **backend/controllers/settlement.controller.js**
   - Calculate who owes whom
   - Generate settlement plan
   - Record settlement transactions

4. **backend/services/pdfService.js**
   - Monthly expense reports
   - Settlement receipts
   - Group summary PDFs

5. **backend/middleware/errorHandler.js**
   - Centralized error handling
   - Structured error responses
   - Error logging

### **Secondary Priority (Week 3-4)**

6. **backend/services/emailService.js**
   - Email templates
   - SendGrid/AWS SES integration
   - Queue management

7. **backend/validators/** (all files)
   - Zod schema validation
   - Request sanitization
   - Type safety

8. **backend/middleware/rateLimiter.js**
   - Redis-based rate limiting
   - IP-based throttling
   - API key management

9. **backend/tests/integration/**
   - Complete API flow tests
   - Database integration tests
   - Service integration tests

10. **backend/docs/swagger.json**
    - OpenAPI 3.0 specification
    - Interactive API documentation
    - Example requests/responses

---

## 📊 Database Schema Design

### **Collections Overview**

```javascript
// users
{
  _id: ObjectId,
  email: String (unique),
  password: String (hashed),
  name: String,
  phone: String,
  avatar: String,
  defaultCurrency: String (INR/USD/EUR/CAD),
  timezone: String,
  createdAt: Date,
  updatedAt: Date
}

// groups
{
  _id: ObjectId,
  name: String,
  description: String,
  baseCurrency: String,
  members: [{
    userId: ObjectId (ref: User),
    role: String (admin/member),
    joinedAt: Date
  }],
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}

// expenses
{
  _id: ObjectId,
  groupId: ObjectId (ref: Group),
  description: String,
  amount: Number,
  currency: String,
  amountInBaseCurrency: Number,
  exchangeRate: Number,
  paidBy: ObjectId (ref: User),
  splitType: String (equal/percentage/custom),
  splits: [{
    userId: ObjectId (ref: User),
    amount: Number,
    percentage: Number,
    settled: Boolean
  }],
  category: String,
  date: Date,
  receipt: String (file path),
  createdAt: Date,
  updatedAt: Date
}

// settlements
{
  _id: ObjectId,
  groupId: ObjectId (ref: Group),
  fromUser: ObjectId (ref: User),
  toUser: ObjectId (ref: User),
  amount: Number,
  currency: String,
  status: String (pending/completed/cancelled),
  settledAt: Date,
  proof: String (file path),
  createdAt: Date,
  updatedAt: Date
}

// transactions
{
  _id: ObjectId,
  groupId: ObjectId (ref: Group),
  type: String (expense/settlement/adjustment),
  relatedId: ObjectId (ref: Expense/Settlement),
  description: String,
  amount: Number,
  currency: String,
  createdAt: Date
}

// notifications
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  type: String (email/sms/push),
  title: String,
  message: String,
  status: String (pending/sent/failed),
  sentAt: Date,
  createdAt: Date
}

// auditLogs
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  action: String,
  resource: String,
  resourceId: ObjectId,
  changes: Object,
  ipAddress: String,
  userAgent: String,
  createdAt: Date
}
```

---

## 🔐 Security Considerations

### **Authentication & Authorization**
- JWT with refresh tokens
- Role-based access control (RBAC)
- Password hashing (bcrypt)
- Session management

### **Data Protection**
- Input validation (Zod)
- SQL injection prevention (Mongoose)
- XSS protection
- CSRF tokens
- Rate limiting

### **API Security**
- HTTPS only
- CORS configuration
- API key authentication
- Request signing
- Audit logging

---

## 🚀 Performance Optimization

### **Caching Strategy**
- Redis for session storage
- Cache exchange rates (24h TTL)
- Cache user balances (5min TTL)
- Cache group summaries (15min TTL)

### **Database Optimization**
- Indexes on frequently queried fields
- Pagination for large datasets
- Aggregation pipelines
- Connection pooling

### **API Optimization**
- Response compression (gzip)
- Lazy loading
- Batch operations
- WebSocket for real-time updates

---

## 📈 Monitoring & Logging

### **Application Monitoring**
- Winston for structured logging
- Log levels (error, warn, info, debug)
- Log rotation
- Centralized log aggregation

### **Performance Monitoring**
- Response time tracking
- Database query performance
- Memory usage
- CPU utilization

### **Error Tracking**
- Sentry integration
- Error alerting
- Stack trace capture
- User context

---

## 🧪 Testing Strategy

### **Unit Tests** (70% coverage target)
- Controller logic
- Utility functions
- Service methods
- Model validations

### **Integration Tests** (20% coverage target)
- API endpoints
- Database operations
- External service mocks
- Authentication flows

### **E2E Tests** (10% coverage target)
- Complete user journeys
- Multi-step workflows
- Edge cases
- Error scenarios

---

## 📦 Deployment Architecture

### **Development Environment**
```
Local Machine
├── MongoDB (Docker)
├── Redis (Docker)
└── Node.js (localhost:5000)
```

### **Staging Environment**
```
AWS EC2 / DigitalOcean
├── MongoDB Atlas
├── Redis Cloud
├── Node.js (PM2)
└── Nginx (Reverse Proxy)
```

### **Production Environment**
```
AWS ECS / Kubernetes
├── MongoDB Atlas (Replica Set)
├── Redis Cluster
├── Node.js (Auto-scaling)
├── Load Balancer
├── CloudFront (CDN)
└── S3 (File Storage)
```

---

## 🎓 Best Practices Implemented

1. **Code Quality**
   - ESLint for code linting
   - Prettier for code formatting
   - Husky for pre-commit hooks
   - Conventional commits

2. **Documentation**
   - JSDoc comments
   - API documentation
   - README files
   - Architecture diagrams

3. **Version Control**
   - Git flow branching strategy
   - Semantic versioning
   - Changelog maintenance
   - Protected main branch

4. **Continuous Integration**
   - Automated testing
   - Code coverage reports
   - Build verification
   - Dependency scanning

---

## 🔄 Next Steps

1. **Create missing directories**
   ```bash
   mkdir -p backend/{services,utils,validators,jobs,docs,scripts}
   ```

2. **Install additional dependencies**
   ```bash
   npm install zod redis ioredis winston pdfkit nodemailer socket.io
   npm install -D eslint prettier husky
   ```

3. **Set up environment variables**
   - Add all required env vars to `.env.example`
   - Document each variable's purpose

4. **Implement core services**
   - Start with currencyService.js
   - Then debtSimplifier.js
   - Follow with settlement.controller.js

5. **Write comprehensive tests**
   - Aim for 80%+ code coverage
   - Focus on critical paths first

---

## 📞 Support & Contribution

For questions or contributions, please refer to:
- **CONTRIBUTING.md** - Contribution guidelines
- **CODE_OF_CONDUCT.md** - Community standards
- **SECURITY.md** - Security vulnerability reporting

---

**Last Updated**: January 10, 2026  
**Version**: 1.0.0  
**Maintainer**: Satyam Kumar Singh
