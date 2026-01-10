# FinterHub Controller Functions Reference
## Complete List of All Controller Functions

---

## 📊 Summary Overview

| Controller | Total Functions | Status | Lines of Code |
|------------|----------------|--------|---------------|
| **auth.controller.js** | 4 | ✅ Complete | 128 |
| **expense.controller.js** | 2 | 🚧 Partial | 146 |
| **group.controller.js** | 5 | ✅ Complete | 213 |
| **TOTAL** | **11** | **~60% Complete** | **487** |

---

## 🔐 1. Authentication Controller (`auth.controller.js`)

**File Path**: `backend/controllers/auth.controller.js`  
**Total Functions**: 4  
**Status**: ✅ Complete  
**Lines of Code**: 128

### Functions:

#### 1.1 `signup(req, res)`
- **Lines**: 11-57
- **Purpose**: Register a new user account
- **HTTP Method**: POST
- **Endpoint**: `/api/auth/signup`
- **Request Body**:
  ```javascript
  {
    name: String,      // Required, min 1 char
    email: String,     // Required, unique
    password: String   // Required, min 6 chars
  }
  ```
- **Response**:
  ```javascript
  {
    token: String,           // JWT access token (1h)
    user: {
      id: ObjectId,
      name: String,
      email: String
    }
  }
  ```
- **Features**:
  - Validates all required fields
  - Checks password length (min 6 characters)
  - Prevents duplicate email registration
  - Hashes password with bcrypt (10 rounds in production, 1 in test)
  - Generates JWT access token (1h expiry)
  - Generates JWT refresh token (7d expiry)
  - Sets httpOnly cookie for refresh token
- **Error Codes**:
  - `400`: Missing fields, password too short, user already exists
  - `500`: Server error

---

#### 1.2 `login(req, res)`
- **Lines**: 59-98
- **Purpose**: Authenticate existing user
- **HTTP Method**: POST
- **Endpoint**: `/api/auth/login`
- **Request Body**:
  ```javascript
  {
    email: String,     // Required
    password: String   // Required
  }
  ```
- **Response**:
  ```javascript
  {
    token: String,           // JWT access token (1h)
    user: {
      id: ObjectId,
      name: String,
      email: String
    }
  }
  ```
- **Features**:
  - Validates email and password presence
  - Verifies user exists in database
  - Compares password hash with bcrypt
  - Generates new access and refresh tokens
  - Sets secure httpOnly cookie
- **Error Codes**:
  - `400`: Missing fields
  - `401`: Invalid credentials (user not found or wrong password)
  - `500`: Server error

---

#### 1.3 `logout(req, res)`
- **Lines**: 100-107
- **Purpose**: Log out user and clear authentication cookie
- **HTTP Method**: POST
- **Endpoint**: `/api/auth/logout`
- **Request Body**: None
- **Response**:
  ```javascript
  {
    message: "Logout successful"
  }
  ```
- **Features**:
  - Clears the "token" cookie
  - Simple logout mechanism
- **Error Codes**:
  - `500`: Server error

---

#### 1.4 `refreshToken(req, res)`
- **Lines**: 109-128
- **Purpose**: Generate new access token using refresh token
- **HTTP Method**: POST
- **Endpoint**: `/api/auth/refresh`
- **Request**: Refresh token from httpOnly cookie
- **Response**:
  ```javascript
  {
    token: String  // New JWT access token (1h)
  }
  ```
- **Features**:
  - Reads refresh token from cookies
  - Verifies refresh token validity
  - Checks if user still exists
  - Generates new access token
- **Error Codes**:
  - `400`: Refresh token not found, user not found, token generation failed
  - `500`: Server error

---

## 💰 2. Expense Controller (`expense.controller.js`)

**File Path**: `backend/controllers/expense.controller.js`  
**Total Functions**: 2 (+ 1 incomplete)  
**Status**: 🚧 Partial (needs more functions)  
**Lines of Code**: 146

### Functions:

#### 2.1 `addExpenseInAnyCurrency(req, res)`
- **Lines**: 8-116
- **Purpose**: Create a new expense in any supported currency
- **HTTP Method**: POST
- **Endpoint**: `/api/expense/add`
- **Request Body**:
  ```javascript
  {
    // Required fields
    title: String,              // Min 3 chars
    amount: Number,             // Must be > 0
    currency: String,           // INR/USD/EUR/CAD/GBP
    category: String,           // e.g., "Food", "Travel"
    
    // Optional fields
    description: String,
    date: Date,                 // Defaults to now
    paidBy: ObjectId,           // Defaults to current user
    group: ObjectId,            // Group ID if group expense
    splitType: String,          // "none", "equal", "percentage", "custom"
    splitDetails: Array,        // Split configuration
    paymentMethod: String,      // Defaults to "Cash"
    tags: Array,                // Tags for categorization
    isRecurring: Boolean,       // Defaults to false
    recurringFrequency: String, // "daily", "weekly", "monthly"
    notes: String,
    attachments: Array          // File URLs
  }
  ```
- **Response**:
  ```javascript
  {
    message: "Expense created successfully",
    expense: {
      id: ObjectId,
      title: String,
      description: String,
      amount: Number,
      currency: String,
      category: String,
      date: Date,
      paidBy: ObjectId,
      group: ObjectId,
      splitType: String,
      paymentMethod: String
    }
  }
  ```
- **Features**:
  - Validates required fields (title, amount, currency, category)
  - Validates title length (min 3 characters)
  - Validates amount is positive
  - Validates split details when split type is not "none"
  - **Parallel database queries** for group and user validation (optimized)
  - Verifies user is group member if group expense
  - Verifies paidBy user exists if different from current user
  - Converts currency to uppercase
  - Supports comprehensive expense metadata
- **Error Codes**:
  - `400`: Missing required fields, invalid title/amount, invalid split details
  - `403`: User not a member of specified group
  - `404`: Group not found, paidBy user not found
  - `500`: Server error

---

#### 2.2 `deleteExpense(req, res)`
- **Lines**: 118-146
- **Purpose**: Delete an expense (only by the user who created it)
- **HTTP Method**: DELETE
- **Endpoint**: `/api/expense/:id`
- **URL Parameters**:
  - `id`: Expense ObjectId
- **Response**:
  ```javascript
  {
    message: "Expense deleted successfully",
    deletedExpenseId: String
  }
  ```
- **Features**:
  - Validates expense ID format (MongoDB ObjectId)
  - Checks if expense exists
  - **Authorization check**: Only the user who paid can delete
  - Uses lean queries for better performance
  - Returns deleted expense ID for frontend confirmation
- **Error Codes**:
  - `400`: Invalid expense ID format
  - `403`: User not authorized to delete (not the payer)
  - `404`: Expense not found
  - `500`: Server error

---

#### 2.3 `splitTypeManagement` ⚠️ **INCOMPLETE**
- **Lines**: 148 (declaration only)
- **Status**: ❌ Not implemented
- **Purpose**: Manage different split types (equal, percentage, custom)
- **TODO**: Needs implementation
- **Expected Functionality**:
  - Calculate equal splits
  - Calculate percentage-based splits
  - Handle custom split amounts
  - Validate split totals = 100%
  - Handle rounding errors

---

### 🔴 Missing Functions in Expense Controller:

The following functions should be added to make the expense controller complete:

1. **`getExpenseById(req, res)`** - Get single expense details
2. **`updateExpense(req, res)`** - Update expense information
3. **`getGroupExpenses(req, res)`** - Get all expenses for a group
4. **`getUserExpenses(req, res)`** - Get all expenses for a user
5. **`getExpensesByCategory(req, res)`** - Filter expenses by category
6. **`getExpensesByDateRange(req, res)`** - Filter expenses by date range
7. **`calculateGroupBalance(req, res)`** - Calculate who owes whom
8. **`splitTypeManagement(req, res)`** - Complete implementation

---

## 👥 3. Group Controller (`group.controller.js`)

**File Path**: `backend/controllers/group.controller.js`  
**Total Functions**: 5  
**Status**: ✅ Complete (core features)  
**Lines of Code**: 213

### Functions:

#### 3.1 `createGroup(req, res)`
- **Lines**: 7-50
- **Purpose**: Create a new expense group
- **HTTP Method**: POST
- **Endpoint**: `/api/group/create`
- **Request Body**:
  ```javascript
  {
    name: String,         // Required, min 3 chars, unique
    description: String   // Required, min 10 chars
  }
  ```
- **Response**:
  ```javascript
  {
    message: "Group created successfully",
    group: {
      id: ObjectId,
      name: String,
      description: String,
      createdBy: ObjectId,
      members: [ObjectId]  // Creator is first member
    }
  }
  ```
- **Features**:
  - Validates name and description presence
  - Validates name length (min 3 characters)
  - Validates description length (min 10 characters)
  - Checks for duplicate group names (case-insensitive)
  - Automatically adds creator as first member
  - Returns complete group information
- **Error Codes**:
  - `400`: Missing fields, name too short, description too short, group already exists
  - `500`: Server error

---

#### 3.2 `inviteUserToGroup(req, res)`
- **Lines**: 52-100
- **Purpose**: Add a user to an existing group
- **HTTP Method**: POST
- **Endpoint**: `/api/group/:groupId/invite`
- **URL Parameters**:
  - `groupId`: Group ObjectId
- **Request Body**:
  ```javascript
  {
    userId: ObjectId  // User to invite
  }
  ```
- **Response**:
  ```javascript
  {
    message: "User invited to group successfully",
    group: {
      id: ObjectId,
      name: String,
      members: [ObjectId]  // Updated member list
    }
  }
  ```
- **Features**:
  - **Parallel queries** for group and user validation (optimized)
  - **Authorization**: Only group creator can invite users
  - Validates group exists
  - Validates user exists
  - Prevents duplicate membership
  - Uses `$addToSet` to prevent duplicates at DB level
  - Returns updated member list
- **Error Codes**:
  - `400`: Missing userId, user already a member
  - `403`: Only group creator can invite users
  - `404`: Group not found, user not found
  - `500`: Server error

---

#### 3.3 `getGroupMembers(req, res)`
- **Lines**: 102-134
- **Purpose**: Retrieve all members of a group
- **HTTP Method**: GET
- **Endpoint**: `/api/group/:groupId/members`
- **URL Parameters**:
  - `groupId`: Group ObjectId
- **Response**:
  ```javascript
  {
    message: "Group members retrieved successfully",
    count: Number,
    members: [
      {
        _id: ObjectId,
        name: String,
        email: String
      }
    ]
  }
  ```
- **Features**:
  - Validates group exists
  - **Authorization**: Only group members can view member list
  - Uses lean queries for performance
  - Selects only necessary user fields (_id, name, email)
  - Returns member count
  - Handles empty member list
- **Error Codes**:
  - `403`: User not authorized (not a group member)
  - `404`: Group not found, no members found
  - `500`: Server error

---

#### 3.4 `removeUserFromGroup(req, res)`
- **Lines**: 136-185
- **Purpose**: Remove a user from a group
- **HTTP Method**: DELETE
- **Endpoint**: `/api/group/:groupId/remove`
- **URL Parameters**:
  - `groupId`: Group ObjectId
- **Request Body**:
  ```javascript
  {
    userId: ObjectId  // User to remove
  }
  ```
- **Response**:
  ```javascript
  {
    message: "User removed from group successfully",
    group: {
      id: ObjectId,
      name: String,
      members: [ObjectId]  // Updated member list
    }
  }
  ```
- **Features**:
  - **Parallel queries** for group and user validation
  - **Authorization**: Only group creator can remove users
  - Validates group exists
  - Validates user exists
  - Checks user is actually a member before removal
  - Uses `$pull` operator to remove from members array
  - Returns updated member list
- **Error Codes**:
  - `400`: Missing userId, user not a member
  - `403`: Only group creator can remove users
  - `404`: Group not found, user not found
  - `500`: Server error

---

#### 3.5 `listAllGroupsUserPresents(req, res)`
- **Lines**: 187-213
- **Purpose**: Get all groups that the current user is a member of
- **HTTP Method**: GET
- **Endpoint**: `/api/group/my-groups`
- **Response**:
  ```javascript
  {
    message: "Groups retrieved successfully",
    count: Number,
    groups: [
      {
        id: ObjectId,
        name: String,
        description: String,
        createdBy: ObjectId,
        memberCount: Number,
        isCreator: Boolean,    // True if current user is creator
        createdAt: Date
      }
    ]
  }
  ```
- **Features**:
  - Finds all groups where user is a member
  - Uses lean queries for performance
  - Selects relevant fields only
  - Calculates member count for each group
  - Indicates if user is the group creator
  - Returns groups sorted by creation date
  - Provides total group count
- **Error Codes**:
  - `500`: Server error

---

## 📊 Detailed Statistics

### Function Complexity Analysis

| Function | Lines | Complexity | Performance | Security |
|----------|-------|------------|-------------|----------|
| **signup** | 47 | Medium | Good | ✅ High |
| **login** | 40 | Medium | Good | ✅ High |
| **logout** | 8 | Low | Excellent | ✅ Medium |
| **refreshToken** | 20 | Medium | Good | ✅ High |
| **addExpenseInAnyCurrency** | 109 | High | ⚡ Optimized | ✅ High |
| **deleteExpense** | 29 | Medium | ⚡ Optimized | ✅ High |
| **createGroup** | 44 | Medium | Good | ✅ Medium |
| **inviteUserToGroup** | 49 | Medium | ⚡ Optimized | ✅ High |
| **getGroupMembers** | 33 | Medium | ⚡ Optimized | ✅ High |
| **removeUserFromGroup** | 50 | Medium | ⚡ Optimized | ✅ High |
| **listAllGroupsUserPresents** | 27 | Low | ⚡ Optimized | ✅ Medium |

### Performance Optimizations Applied

✅ **Parallel Database Queries**:
- `addExpenseInAnyCurrency`: Group and user validation in parallel
- `inviteUserToGroup`: Group and user lookup in parallel
- `removeUserFromGroup`: Group and user lookup in parallel

✅ **Lean Queries**:
- All read operations use `.lean()` for better performance
- Reduces memory overhead by returning plain JavaScript objects

✅ **Field Selection**:
- Only necessary fields are selected from database
- Reduces data transfer and processing time

✅ **Indexed Queries**:
- Queries use indexed fields (_id, email, members)
- Faster database lookups

---

## 🔐 Security Features

### Authentication & Authorization

| Feature | Implementation | Controllers |
|---------|----------------|-------------|
| **JWT Tokens** | Access (1h) + Refresh (7d) | auth.controller.js |
| **Password Hashing** | bcrypt (10 rounds) | auth.controller.js |
| **HttpOnly Cookies** | Secure refresh token storage | auth.controller.js |
| **User Ownership** | Only creator can delete expense | expense.controller.js |
| **Group Authorization** | Only members can view/modify | group.controller.js |
| **Creator Privileges** | Only creator can invite/remove | group.controller.js |

### Input Validation

| Validation Type | Examples | Status |
|----------------|----------|--------|
| **Required Fields** | All controllers | ✅ Implemented |
| **Length Validation** | Name (3+), Description (10+), Password (6+) | ✅ Implemented |
| **Type Validation** | Amount > 0, Valid ObjectId | ✅ Implemented |
| **Uniqueness** | Email, Group name | ✅ Implemented |
| **Array Validation** | Split details, Members | ✅ Implemented |
| **Schema Validation** | Zod/Joi integration | ⏳ Planned |

---

## 🚀 Recommended Next Steps

### 1. Complete Expense Controller
- [ ] Implement `splitTypeManagement` function
- [ ] Add `getExpenseById` function
- [ ] Add `updateExpense` function
- [ ] Add `getGroupExpenses` function
- [ ] Add `getUserExpenses` function
- [ ] Add filtering functions (category, date range)

### 2. Add New Controllers
- [ ] **settlement.controller.js** (4-5 functions)
  - `calculateGroupBalance`
  - `generateSettlementPlan`
  - `recordSettlement`
  - `getSettlementHistory`
  - `verifySettlement`

- [ ] **currency.controller.js** (3 functions)
  - `getExchangeRates`
  - `convertCurrency`
  - `getSupportedCurrencies`

- [ ] **report.controller.js** (4 functions)
  - `generateMonthlyReport`
  - `generateSettlementReceipt`
  - `generateBalanceSheet`
  - `emailReport`

- [ ] **user.controller.js** (5 functions)
  - `getUserProfile`
  - `updateUserProfile`
  - `changePassword`
  - `uploadAvatar`
  - `getUserStats`

- [ ] **notification.controller.js** (3 functions)
  - `sendNotification`
  - `getNotificationHistory`
  - `updateNotificationPreferences`

### 3. Add Middleware Validation
- [ ] Create Zod schemas for all request bodies
- [ ] Add validation middleware to routes
- [ ] Standardize error responses

### 4. Add Comprehensive Testing
- [ ] Unit tests for each function
- [ ] Integration tests for API flows
- [ ] Edge case testing
- [ ] Performance testing

---

## 📝 Function Naming Conventions

All controller functions follow these conventions:

1. **Verb-first naming**: `createGroup`, `getExpenses`, `deleteExpense`
2. **Descriptive names**: Clear purpose from function name
3. **Async/await**: All functions are async
4. **Error handling**: Try-catch blocks in all functions
5. **Consistent responses**: Standard JSON response format
6. **HTTP status codes**: Proper status codes for all scenarios

---

## 🎯 Code Quality Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Total Functions** | 11 | 30+ | 🟡 37% |
| **Test Coverage** | ~0% | 80% | 🔴 0% |
| **Documentation** | Medium | High | 🟡 60% |
| **Error Handling** | Good | Excellent | 🟢 90% |
| **Performance** | Good | Excellent | 🟢 85% |
| **Security** | Good | Excellent | 🟢 80% |

---

**Last Updated**: January 10, 2026  
**Total Controllers**: 3  
**Total Functions**: 11 (+ 1 incomplete)  
**Total Lines of Code**: 487  
**Maintainer**: Satyam Kumar Singh
