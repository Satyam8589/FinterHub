# 🔧 CORS Configuration Guide

## Current Setup (No Frontend)

```javascript
app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // '*' allows all origins
    credentials: true
}));
```

---

## 📋 What This Means:

### **Right Now (Development):**
- ✅ Allows requests from **anywhere** (Postman, Thunder Client, etc.)
- ✅ Allows cookies to be sent/received
- ✅ Perfect for testing your API

---

## 🚀 When You Build a Frontend:

### **Option 1: Single Frontend URL**
```javascript
// In .env file:
FRONTEND_URL=http://localhost:3000

// In server.js (no change needed):
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
```

### **Option 2: Multiple Frontend URLs**
```javascript
app.use(cors({
    origin: [
        'http://localhost:3000',  // Local development
        'http://localhost:5173',  // Vite default
        'https://yourapp.com'     // Production
    ],
    credentials: true
}));
```

### **Option 3: Dynamic (Most Flexible)**
```javascript
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'https://yourapp.com'
        ];
        
        // Allow requests with no origin (like Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
```

---

## 🧪 Testing Your API (Without Frontend)

### **Using Postman/Thunder Client:**

1. **Signup Request:**
```
POST http://localhost:3000/api/auth/signup
Content-Type: application/json

{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
}
```

2. **Login Request:**
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
    "email": "test@example.com",
    "password": "password123"
}
```

3. **Refresh Token Request:**
```
POST http://localhost:3000/api/auth/refresh-token
Cookie: refreshToken=<token-from-login-response>
```

4. **Logout Request:**
```
POST http://localhost:3000/api/auth/logout
```

---

## ⚠️ Important Notes:

### **Current Setup (`origin: '*'`):**
- ✅ **Good for:** Development, testing with Postman
- ❌ **Bad for:** Production (security risk)
- 🔒 **Security:** Low (allows any website to call your API)

### **When to Change:**
- ✅ When you create a frontend
- ✅ Before deploying to production
- ✅ When you know your frontend URL

---

## 🔐 Production Checklist:

Before deploying to production:

- [ ] Replace `'*'` with actual frontend URL
- [ ] Set `FRONTEND_URL` in production environment
- [ ] Test CORS with your actual frontend
- [ ] Verify cookies work correctly

---

## 📝 Quick Reference:

| Scenario | CORS Origin | Use Case |
|----------|-------------|----------|
| **No frontend yet** | `'*'` | ✅ Current (testing) |
| **Local frontend** | `'http://localhost:3000'` | Development |
| **Production** | `'https://yourapp.com'` | Live app |
| **Multiple environments** | Array of URLs | Dev + Prod |

---

## 🎯 Summary:

**Current Setup:** `origin: '*'`  
**Reason:** No frontend yet, need to test with Postman  
**Action Needed:** Change to specific URL when you build frontend  
**Security:** OK for development, NOT for production  

---

**You're all set for testing! Just remember to update CORS when you build your frontend.** 👍
