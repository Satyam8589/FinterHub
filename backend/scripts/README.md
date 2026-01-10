# Database Scripts

This directory contains utility scripts for database operations.

## Available Scripts

### 1. Insert Single User (`insertUser.js`)

Insert a single user into the database with custom details.

**Usage:**
```bash
node scripts/insertUser.js <name> <email> <password>
```

**Example:**
```bash
node scripts/insertUser.js "John Doe" john@example.com password123
```

**Features:**
- ✅ Validates if user already exists
- ✅ Hashes password with bcrypt (10 rounds)
- ✅ Displays created user details
- ✅ Proper error handling

---

### 2. Insert Sample Users (`insertSampleUsers.js`)

Insert multiple predefined sample users for testing.

**Usage:**
```bash
node scripts/insertSampleUsers.js
```

**Sample Users:**
1. **John Doe** - john@example.com (password: password123)
2. **Jane Smith** - jane@example.com (password: password123)
3. **Bob Wilson** - bob@example.com (password: password123)

**Features:**
- ✅ Inserts 3 sample users
- ✅ Skips users that already exist
- ✅ All passwords are hashed
- ✅ Shows progress for each user

---

### 3. List All Users (`listUsers.js`)

Display all users currently in the database.

**Usage:**
```bash
node scripts/listUsers.js
```

**Output:**
- Shows total number of users
- Displays name, email, and ID for each user
- Passwords are excluded for security
- Clean, formatted table output

**Features:**
- ✅ Lists all users in database
- ✅ Excludes passwords from display
- ✅ Shows user count
- ✅ Formatted, readable output

---

## Prerequisites

Make sure you have:
- MongoDB connection configured in `.env` file
- `MONGO_URL` environment variable set
- All dependencies installed (`npm install`)

---

## Notes

- All passwords are hashed using bcrypt before storage
- Scripts will automatically close database connection after completion
- If a user with the same email exists, the script will skip/fail appropriately
- Scripts use the same User model as the main application

---

## Troubleshooting

**Error: "User with this email already exists"**
- The email is already in the database
- Use a different email or delete the existing user first

**Error: "Cannot connect to MongoDB"**
- Check your `.env` file has correct `MONGO_URL`
- Ensure MongoDB is running
- Verify network connectivity

---

**Created:** January 10, 2026  
**Maintainer:** Satyam Kumar Singh
