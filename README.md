# FinterHub

<div align="center">

![FinterHub Logo](https://img.shields.io/badge/FinterHub-Smart%20Financial%20Management-purple?style=for-the-badge)

**A Multi-Currency Expense Management Platform for International Communities**

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-green?logo=mongodb)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Features](#features) • [Tech Stack](#tech-stack) • [Getting Started](#getting-started) • [API Documentation](#api-documentation) • [Contributing](#contributing)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Docker Deployment](#docker-deployment)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

**FinterHub** is a comprehensive expense management platform designed specifically for international students, foreign interns, and multicultural communities who share expenses across different currencies. The platform provides intelligent expense tracking, automatic currency conversion, and optimized debt settlement algorithms to simplify financial management in diverse groups.

### Why FinterHub?

Managing shared expenses becomes complex when participants use different currencies. FinterHub eliminates this complexity by:

- **Automatic Currency Conversion**: Real-time conversion to a base currency
- **Smart Debt Simplification**: Minimizes the number of transactions needed for settlement
- **Flexible Split Options**: Equal, percentage-based, or custom splits
- **Comprehensive Reporting**: Detailed expense tracking and settlement reports
- **Secure & Scalable**: Built with enterprise-grade security and scalability in mind

---

## 🚀 Problem Statement

### The Challenge

When people from multiple countries live or work together, expense management becomes complicated:

```
🇪🇺 Person A pays rent in EUR
🇨🇦 Person B pays groceries in CAD  
🇮🇳 Person C pays utilities in INR
🇺🇸 Person D pays transportation in USD
```

**Traditional Problems:**
- Manual currency conversion is error-prone
- Unclear who owes whom and how much
- Multiple unnecessary transactions
- Timezone and exchange rate confusion
- Lack of transparent audit trails

### Our Solution

FinterHub automates the entire process:
1. **Record** expenses in any supported currency
2. **Convert** automatically to base currency
3. **Calculate** accurate balances for all members
4. **Simplify** debts using graph algorithms
5. **Settle** with minimum transfers
6. **Report** with detailed PDF summaries

---

## ✨ Features

### Core Functionality

- **Multi-Currency Support**
  - Add expenses in INR, EUR, CAD, USD, and more
  - Automatic conversion to group's base currency
  - Historical exchange rate tracking

- **Flexible Expense Splitting**
  - Equal split among all members
  - Percentage-based distribution
  - Custom amount allocation
  - Exclude specific members

- **Smart Debt Management**
  - Automatic balance calculation
  - Debt simplification algorithm
  - Minimum transfer optimization
  - Settlement history tracking

- **Group Management**
  - Create and manage expense groups
  - Invite members via email
  - Role-based permissions
  - Group activity logs

### Advanced Features

- **Authentication & Security**
  - JWT-based authentication
  - Secure password hashing with bcrypt
  - Role-based access control
  - API rate limiting

- **Reporting & Analytics**
  - Monthly settlement reports
  - Expense categorization
  - Group spending analytics
  - Export to PDF

- **Real-time Updates**
  - Socket.io integration (optional)
  - Live balance updates
  - Instant notifications

- **Developer-Friendly**
  - RESTful API design
  - Comprehensive API documentation
  - Docker containerization
  - Extensive test coverage

---

## 🛠️ Tech Stack

### Backend

| Technology | Purpose | Version |
|-----------|---------|---------|
| **Node.js** | Runtime Environment | 20.x |
| **Express.js** | Web Framework | 4.x |
| **MongoDB** | Database | 7.x |
| **Mongoose** | ODM | Latest |
| **Redis** | Caching & Sessions | 7.x |

### Authentication & Security

| Technology | Purpose |
|-----------|---------|
| **JWT** | Token-based Authentication |
| **bcrypt** | Password Hashing |
| **express-rate-limit** | API Rate Limiting |
| **helmet** | Security Headers |
| **cors** | Cross-Origin Resource Sharing |

### Testing & Quality

| Technology | Purpose |
|-----------|---------|
| **Jest** | Testing Framework |
| **Supertest** | HTTP Testing |
| **ESLint** | Code Linting |

### DevOps

| Technology | Purpose |
|-----------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container Orchestration |
| **PM2** | Process Management |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                         │
│              (Client App / Mobile App / API)             │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   API Gateway Layer                      │
│         (Express.js + Middleware + Rate Limiting)        │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Auth       │   │   Expense    │   │   Group      │
│  Controller  │   │  Controller  │   │  Controller  │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Business Logic Layer                   │
│        (Currency Conversion + Debt Simplification)       │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   MongoDB    │   │    Redis     │   │  File System │
│   Database   │   │    Cache     │   │   (Logs)     │
└──────────────┘   └──────────────┘   └──────────────┘
```

### Design Patterns

- **MVC Architecture**: Separation of concerns
- **Repository Pattern**: Data access abstraction
- **Middleware Pattern**: Request/response processing
- **Factory Pattern**: Object creation
- **Singleton Pattern**: Database connections

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20.x or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v7.x or higher) - [Download](https://www.mongodb.com/try/download/community)
- **Redis** (v7.x or higher) - [Download](https://redis.io/download)
- **Git** - [Download](https://git-scm.com/)
- **Docker** (optional) - [Download](https://www.docker.com/)


## 📁 Project Structure

```
FinterHub/
├── backend/
│   ├── config/
│   │   └── db.js                    # Database configuration
│   ├── controllers/
│   │   ├── auth.controller.js       # Authentication logic
│   │   ├── group.controller.js      # Group management
│   │   ├── expense.controller.js    # Expense handling
│   │   └── settlement.controller.js # Settlement calculations
│   ├── middleware/
│   │   ├── auth.js                  # JWT authentication
│   │   ├── errorHandler.js          # Error handling
│   │   └── validator.js             # Request validation
│   ├── models/
│   │   ├── user.model.js            # User schema
│   │   ├── group.model.js           # Group schema
│   │   ├── expense.model.js         # Expense schema
│   │   └── settlement.model.js      # Settlement schema
│   ├── routes/
│   │   ├── auth.route.js            # Auth routes
│   │   ├── group.route.js           # Group routes
│   │   ├── expense.route.js         # Expense routes
│   │   └── settlement.route.js      # Settlement routes
│   ├── tests/
│   │   └── *.test.js                # Test files
│   ├── utils/
│   │   ├── currency.js              # Currency utilities
│   │   ├── debtSimplification.js   # Debt algorithm
│   │   └── logger.js                # Logging utility
│   ├── .env                         # Environment variables
│   ├── .env.docker                  # Docker environment
│   ├── Dockerfile                   # Docker configuration
│   ├── package.json                 # Dependencies
│   └── server.js                    # Entry point
├── docker-compose.yml               # Docker Compose config
├── .gitignore                       # Git ignore rules
├── LICENSE                          # MIT License
└── README.md                        # This file
```

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### How to Contribute

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/FinterHub.git
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make Your Changes**
   - Write clean, documented code
   - Follow existing code style
   - Add tests for new features

4. **Commit Your Changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

5. **Push to Your Fork**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Open a Pull Request**
   - Describe your changes
   - Reference any related issues
   - Wait for review

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Adding tests
- `refactor:` Code refactoring
- `style:` Code style changes
- `chore:` Maintenance tasks

### Code Style

- Use ESLint for JavaScript
- Follow Airbnb style guide
- Write meaningful variable names
- Add comments for complex logic
- Keep functions small and focused

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by Splitwise and Tricount
- Built for international students and interns
- Special thanks to all contributors

---

## 📞 Contact & Support

- **Email**: support@finterhub.com
- **GitHub Issues**: [Report a bug](https://github.com/yourusername/FinterHub/issues)
- **Documentation**: [Full API Docs](https://docs.finterhub.com)

---

## 🗺️ Roadmap

### Current Version (v1.0)
- ✅ Multi-currency expense tracking
- ✅ Group management
- ✅ Debt simplification
- ✅ JWT authentication
- ✅ Docker support

### Upcoming Features (v1.1)
- 🔄 Real-time exchange rate API integration
- 🔄 Email/SMS notifications
- 🔄 PDF report generation
- 🔄 Advanced analytics dashboard

### Future Plans (v2.0)
- 📅 Recurring expenses
- 📅 Budget limits and alerts
- 📅 Escrow payment integration
- 📅 Multi-language support

---

<div align="center">

**Made with ❤️ for the global community**

⭐ Star this repo if you find it helpful!

[Report Bug](https://github.com/yourusername/FinterHub/issues) • [Request Feature](https://github.com/yourusername/FinterHub/issues) • [Documentation](https://docs.finterhub.com)

</div>
