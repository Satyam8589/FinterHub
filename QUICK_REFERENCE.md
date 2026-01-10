# FinterHub - Quick Reference Guide
## Controller Functions Summary

---

## 📋 Quick Function Count

```
┌─────────────────────────────────────────────────────────────┐
│                   CONTROLLER SUMMARY                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  auth.controller.js          ✅  4 functions   (128 lines)  │
│  expense.controller.js       🚧  2 functions   (146 lines)  │
│  group.controller.js         ✅  5 functions   (213 lines)  │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  TOTAL:                         11 functions   (487 lines)  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Authentication Controller (4 functions)

| # | Function | Method | Endpoint | Purpose |
|---|----------|--------|----------|---------|
| 1 | `signup` | POST | `/api/auth/signup` | Register new user |
| 2 | `login` | POST | `/api/auth/login` | Authenticate user |
| 3 | `logout` | POST | `/api/auth/logout` | Clear auth cookie |
| 4 | `refreshToken` | POST | `/api/auth/refresh` | Get new access token |

---

## 💰 Expense Controller (2 functions + 1 incomplete)

| # | Function | Method | Endpoint | Purpose | Status |
|---|----------|--------|----------|---------|--------|
| 1 | `addExpenseInAnyCurrency` | POST | `/api/expense/add` | Create expense | ✅ |
| 2 | `deleteExpense` | DELETE | `/api/expense/:id` | Delete expense | ✅ |
| 3 | `splitTypeManagement` | - | - | Manage splits | ❌ Incomplete |

**Missing Functions** (Recommended):
- `getExpenseById` - Get single expense
- `updateExpense` - Update expense
- `getGroupExpenses` - List group expenses
- `getUserExpenses` - List user expenses
- `getExpensesByCategory` - Filter by category
- `getExpensesByDateRange` - Filter by date
- `calculateGroupBalance` - Calculate balances

---

## 👥 Group Controller (5 functions)

| # | Function | Method | Endpoint | Purpose |
|---|----------|--------|----------|---------|
| 1 | `createGroup` | POST | `/api/group/create` | Create new group |
| 2 | `inviteUserToGroup` | POST | `/api/group/:groupId/invite` | Add user to group |
| 3 | `getGroupMembers` | GET | `/api/group/:groupId/members` | List group members |
| 4 | `removeUserFromGroup` | DELETE | `/api/group/:groupId/remove` | Remove user from group |
| 5 | `listAllGroupsUserPresents` | GET | `/api/group/my-groups` | List user's groups |

---

## 📊 Function Details at a Glance

### Auth Controller Functions

#### 1. signup(req, res)
```javascript
// Request
{ name, email, password }

// Response
{ token, user: { id, name, email } }

// Validations
- All fields required
- Password min 6 chars
- Email must be unique
```

#### 2. login(req, res)
```javascript
// Request
{ email, password }

// Response
{ token, user: { id, name, email } }

// Validations
- All fields required
- Valid credentials
```

#### 3. logout(req, res)
```javascript
// Request: None

// Response
{ message: "Logout successful" }
```

#### 4. refreshToken(req, res)
```javascript
// Request: Cookie with refreshToken

// Response
{ token }

// Validations
- Valid refresh token
- User exists
```

---

### Expense Controller Functions

#### 1. addExpenseInAnyCurrency(req, res)
```javascript
// Request (Required)
{
  title: String,        // min 3 chars
  amount: Number,       // > 0
  currency: String,     // INR/USD/EUR/CAD/GBP
  category: String
}

// Request (Optional)
{
  description, date, paidBy, group,
  splitType, splitDetails, paymentMethod,
  tags, isRecurring, recurringFrequency,
  notes, attachments
}

// Response
{
  message: "Expense created successfully",
  expense: { id, title, amount, currency, ... }
}

// Validations
- Title min 3 chars
- Amount > 0
- Valid currency
- User is group member (if group expense)
- Split details required if splitType != "none"
```

#### 2. deleteExpense(req, res)
```javascript
// Request
URL: /api/expense/:id

// Response
{
  message: "Expense deleted successfully",
  deletedExpenseId: String
}

// Validations
- Valid ObjectId
- Expense exists
- User is the payer (authorization)
```

---

### Group Controller Functions

#### 1. createGroup(req, res)
```javascript
// Request
{
  name: String,         // min 3 chars, unique
  description: String   // min 10 chars
}

// Response
{
  message: "Group created successfully",
  group: { id, name, description, createdBy, members }
}

// Validations
- Name min 3 chars
- Description min 10 chars
- Name must be unique (case-insensitive)
```

#### 2. inviteUserToGroup(req, res)
```javascript
// Request
URL: /api/group/:groupId/invite
Body: { userId }

// Response
{
  message: "User invited to group successfully",
  group: { id, name, members }
}

// Validations
- Group exists
- User exists
- Requester is group creator
- User not already a member
```

#### 3. getGroupMembers(req, res)
```javascript
// Request
URL: /api/group/:groupId/members

// Response
{
  message: "Group members retrieved successfully",
  count: Number,
  members: [{ _id, name, email }]
}

// Validations
- Group exists
- Requester is group member
```

#### 4. removeUserFromGroup(req, res)
```javascript
// Request
URL: /api/group/:groupId/remove
Body: { userId }

// Response
{
  message: "User removed from group successfully",
  group: { id, name, members }
}

// Validations
- Group exists
- User exists
- Requester is group creator
- User is actually a member
```

#### 5. listAllGroupsUserPresents(req, res)
```javascript
// Request: None (uses authenticated user)

// Response
{
  message: "Groups retrieved successfully",
  count: Number,
  groups: [{
    id, name, description, createdBy,
    memberCount, isCreator, createdAt
  }]
}
```

---

## 🎯 Common Patterns

### Error Response Format
```javascript
{
  message: String  // Error description
}
```

### Success Response Format
```javascript
{
  message: String,  // Success message
  data: Object,     // Response data
  count: Number     // Optional: for lists
}
```

### Common HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST (resource created) |
| 400 | Bad Request | Validation errors, missing fields |
| 401 | Unauthorized | Invalid credentials |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Unexpected server error |

---

## 🔒 Authorization Rules

| Controller | Function | Who Can Access |
|------------|----------|----------------|
| Auth | All | Anyone (public) |
| Expense | addExpense | Authenticated users |
| Expense | deleteExpense | Expense creator only |
| Group | createGroup | Authenticated users |
| Group | inviteUser | Group creator only |
| Group | getMembers | Group members only |
| Group | removeUser | Group creator only |
| Group | listGroups | Authenticated users (own groups) |

---

## ⚡ Performance Optimizations

### Implemented
✅ Parallel database queries (Promise.all)  
✅ Lean queries (.lean())  
✅ Field selection (only necessary fields)  
✅ Indexed queries (_id, email, members)  
✅ Efficient array operations ($addToSet, $pull)

### Planned
⏳ Redis caching for frequently accessed data  
⏳ Database query result caching  
⏳ Pagination for large datasets  
⏳ Aggregation pipelines for complex queries

---

## 🔐 Security Features

### Implemented
✅ JWT authentication (access + refresh tokens)  
✅ Password hashing (bcrypt, 10 rounds)  
✅ HttpOnly cookies for refresh tokens  
✅ User ownership validation  
✅ Group membership validation  
✅ Creator privilege checks  
✅ Input validation (length, type, required)

### Planned
⏳ Zod schema validation  
⏳ Rate limiting  
⏳ CSRF protection  
⏳ XSS sanitization  
⏳ SQL injection prevention (already using Mongoose)  
⏳ Audit logging

---

## 📈 Next Steps

### Immediate (Week 1-2)
1. ✅ Complete `splitTypeManagement` function
2. ✅ Add missing expense controller functions
3. ✅ Create settlement controller
4. ✅ Create currency controller

### Short-term (Week 3-4)
5. ✅ Add Zod validation schemas
6. ✅ Implement error handler middleware
7. ✅ Add comprehensive testing
8. ✅ Create API documentation (Swagger)

### Medium-term (Month 2)
9. ✅ Add report controller (PDF generation)
10. ✅ Add notification controller
11. ✅ Add user profile controller
12. ✅ Implement Redis caching

---

## 📚 Related Documentation

- **[FILE_STRUCTURE_DESIGN.md](./FILE_STRUCTURE_DESIGN.md)** - Complete project structure
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture diagrams
- **[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)** - Development roadmap
- **[CONTROLLER_FUNCTIONS_REFERENCE.md](./CONTROLLER_FUNCTIONS_REFERENCE.md)** - Detailed function specs

---

**Last Updated**: January 10, 2026  
**Version**: 1.0.0  
**Maintainer**: Satyam Kumar Singh
