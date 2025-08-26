# Overview

This is a secure e-banking system built as a full-stack web application. The system provides comprehensive banking functionality including user authentication, account management, transaction processing, and administrative oversight. It features a modern React frontend with shadcn/ui components, an Express.js backend API, and PostgreSQL database with Drizzle ORM for data persistence.

The application supports both customer and administrative user roles, with customers able to perform banking operations like deposits, withdrawals, transfers, and QR-based payments, while administrators can manage users and monitor all banking activities through a comprehensive dashboard.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library with Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom banking theme variables and responsive design
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation schemas

## Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **API Design**: RESTful API with JWT-based authentication and role-based access control
- **Database ORM**: Drizzle ORM for type-safe database operations and migrations
- **Authentication**: Session-based authentication with bcrypt password hashing and PIN security
- **Middleware**: Custom authentication and authorization middleware for protected routes

## Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless database
- **Schema Management**: Drizzle Kit for database migrations and schema management
- **Session Storage**: Database-backed session storage using connect-pg-simple
- **Data Models**: Comprehensive banking schema including users, transactions, QR payments, and audit trails

## Authentication and Authorization
- **User Authentication**: Multi-factor authentication using mobile number and PIN
- **Admin Authentication**: Email and password-based authentication for administrative access
- **Session Management**: JWT tokens with automatic session cleanup and expiration handling
- **Role-Based Access**: Customer and admin roles with appropriate permission boundaries
- **Security Features**: Password hashing, PIN encryption, and secure session handling

## External Dependencies
- **Database**: Neon PostgreSQL serverless database for scalable data storage
- **UI Framework**: Radix UI primitives for accessible component foundations
- **Icons**: Font Awesome for comprehensive icon coverage
- **Development Tools**: Replit-specific development plugins and error handling
- **Build System**: Vite with TypeScript compilation and hot module replacement
- **Validation**: Zod for runtime type validation and schema enforcement