import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { loginUserSchema, adminLoginSchema, transactionSchema, chatbotQuerySchema } from "@shared/schema";
import { z } from "zod";
import { ChatbotService } from "./chatbot-service";
import { FraudDetectionService } from "./fraud-detection";

// Middleware for authentication
const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const session = await storage.getSessionByToken(token);
  
  if (!session) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  const user = await storage.getUser(session.userId);
  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'User not found or inactive' });
  }

  req.user = user;
  req.session = session;
  next();
};

// Admin authentication
const authenticateAdmin = async (req: any, res: any, next: any) => {
  await authenticate(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  });
};

// Generate unique account number
const generateAccountNumber = (): string => {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
};

// Generate reference number for transactions
const generateReferenceNumber = (): string => {
  return 'TXN' + Date.now() + Math.floor(Math.random() * 1000);
};

export async function registerRoutes(app: Express): Promise<Server> {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Auth endpoints
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { mobile, pin } = loginUserSchema.parse(req.body);
      
      const user = await storage.getUserByMobile(mobile);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPin = await bcrypt.compare(pin, user.pin);
      if (!isValidPin) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Create session
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await storage.createSession({
        userId: user.id,
        token,
        expiresAt
      });

      const { passwordHash, pin: userPin, ...userResponse } = user;
      
      res.json({
        message: 'Login successful',
        token,
        user: userResponse
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/admin-login', async (req, res) => {
    try {
      const { email, password } = adminLoginSchema.parse(req.body);
      
      // Check for default admin credentials
      if (email === 'admin@bank.com' && password === 'admin123') {
        // Create or get admin user
        let adminUser = await storage.getUserByEmail(email);
        
        if (!adminUser) {
          const hashedPassword = await bcrypt.hash(password, 10);
          const hashedPin = await bcrypt.hash('0000', 10);
          
          adminUser = await storage.createUser({
            accountNumber: 'ADMIN001',
            email,
            mobile: '0000000000',
            passwordHash: hashedPassword,
            pin: hashedPin,
            fullName: 'System Administrator',
            role: 'admin',
            address: 'System',
            dateOfBirth: '1970-01-01',
            aadharNumber: '000000000000'
          });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        await storage.createSession({
          userId: adminUser.id,
          token,
          expiresAt
        });

        const { passwordHash, pin, ...userResponse } = adminUser;
        
        return res.json({
          message: 'Admin login successful',
          token,
          user: userResponse
        });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || user.role !== 'admin' || !user.isActive) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await storage.createSession({
        userId: user.id,
        token,
        expiresAt
      });

      const { passwordHash, pin, ...userResponse } = user;
      
      res.json({
        message: 'Admin login successful',
        token,
        user: userResponse
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', authenticate, async (req: any, res) => {
    try {
      await storage.deleteSession(req.session.token);
      res.json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/auth/verify', authenticate, (req: any, res) => {
    const { passwordHash, pin, ...userResponse } = req.user;
    res.json({ user: userResponse });
  });

  // Account endpoints
  app.get('/api/account/profile', authenticate, (req: any, res) => {
    const { passwordHash, pin, ...userResponse } = req.user;
    res.json(userResponse);
  });

  app.get('/api/account/balance', authenticate, (req: any, res) => {
    res.json({
      balance: parseFloat(req.user.balance),
      walletBalance: parseFloat(req.user.walletBalance)
    });
  });

  // Transaction endpoints
  app.post('/api/transactions/deposit', authenticate, async (req: any, res) => {
    try {
      const { amount, pin } = transactionSchema.parse({
        ...req.body,
        transactionType: 'deposit'
      });

      const isValidPin = await bcrypt.compare(pin, req.user.pin);
      if (!isValidPin) {
        return res.status(401).json({ message: 'Invalid PIN' });
      }

      const newBalance = (parseFloat(req.user.balance) + amount).toFixed(2);
      
      // Create transaction
      await storage.createTransaction({
        toUserId: req.user.id,
        toAccountNumber: req.user.accountNumber,
        amount: amount.toString(),
        transactionType: 'deposit',
        description: 'Cash deposit',
        status: 'completed',
        referenceNumber: generateReferenceNumber(),
      });

      // Update balance
      await storage.updateUserBalance(req.user.id, newBalance);

      res.json({
        message: 'Deposit successful',
        newBalance: parseFloat(newBalance),
        amount
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      console.error('Deposit error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/transactions/withdraw', authenticate, async (req: any, res) => {
    try {
      const { amount, pin } = transactionSchema.parse({
        ...req.body,
        transactionType: 'withdrawal-to-wallet'
      });

      const isValidPin = await bcrypt.compare(pin, req.user.pin);
      if (!isValidPin) {
        return res.status(401).json({ message: 'Invalid PIN' });
      }

      const currentBalance = parseFloat(req.user.balance);
      if (currentBalance < amount) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }

      const newBalance = (currentBalance - amount).toFixed(2);
      const newWalletBalance = (parseFloat(req.user.walletBalance) + amount).toFixed(2);
      
      // Create transaction
      await storage.createTransaction({
        fromUserId: req.user.id,
        fromAccountNumber: req.user.accountNumber,
        amount: amount.toString(),
        transactionType: 'withdrawal-to-wallet',
        description: 'Withdrawal to wallet',
        status: 'completed',
        referenceNumber: generateReferenceNumber(),
      });

      // Update balances
      await storage.updateUserBalance(req.user.id, newBalance);
      await storage.updateUserWalletBalance(req.user.id, newWalletBalance);

      res.json({
        message: 'Withdrawal to wallet successful',
        newBalance: parseFloat(newBalance),
        newWalletBalance: parseFloat(newWalletBalance),
        amount
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      console.error('Withdraw error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/transactions/transfer', authenticate, async (req: any, res) => {
    try {
      const { amount, pin, toAccountNumber } = transactionSchema.parse({
        ...req.body,
        transactionType: 'transfer'
      });

      if (!toAccountNumber) {
        return res.status(400).json({ message: 'Destination account number is required' });
      }

      const isValidPin = await bcrypt.compare(pin, req.user.pin);
      if (!isValidPin) {
        return res.status(401).json({ message: 'Invalid PIN' });
      }

      const toUser = await storage.getUserByAccountNumber(toAccountNumber);
      if (!toUser || !toUser.isActive) {
        return res.status(404).json({ message: 'Destination account not found' });
      }

      if (toUser.id === req.user.id) {
        return res.status(400).json({ message: 'Cannot transfer to same account' });
      }

      const currentBalance = parseFloat(req.user.balance);
      if (currentBalance < amount) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }

      const fromNewBalance = (currentBalance - amount).toFixed(2);
      const toNewBalance = (parseFloat(toUser.balance) + amount).toFixed(2);
      
      // Create transaction
      await storage.createTransaction({
        fromUserId: req.user.id,
        toUserId: toUser.id,
        fromAccountNumber: req.user.accountNumber,
        toAccountNumber: toUser.accountNumber,
        amount: amount.toString(),
        transactionType: 'transfer',
        description: `Transfer to ${toUser.fullName}`,
        status: 'completed',
        referenceNumber: generateReferenceNumber(),
      });

      // Update balances
      await storage.updateUserBalance(req.user.id, fromNewBalance);
      await storage.updateUserBalance(toUser.id, toNewBalance);

      res.json({
        message: 'Transfer successful',
        newBalance: parseFloat(fromNewBalance),
        amount,
        recipient: toUser.fullName
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      console.error('Transfer error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/transactions/history', authenticate, async (req: any, res) => {
    try {
      const transactions = await storage.getTransactionsByUserId(req.user.id);
      res.json(transactions);
    } catch (error) {
      console.error('Transaction history error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // QR endpoints
  app.post('/api/qr/generate', authenticate, async (req: any, res) => {
    try {
      const { amount, merchantName } = req.body;
      
      const qrCode = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      await storage.createQrPayment({
        userId: req.user.id,
        qrCode,
        amount: amount ? amount.toString() : null,
        merchantName: merchantName || 'QR Payment',
        expiresAt
      });

      res.json({
        qrCode,
        amount: amount || null,
        merchantName: merchantName || 'QR Payment',
        expiresAt
      });
    } catch (error) {
      console.error('QR generate error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/qr/scan', authenticate, async (req: any, res) => {
    try {
      const { qrCode, amount } = req.body;
      
      if (!qrCode) {
        return res.status(400).json({ message: 'QR code is required' });
      }

      const qrPayment = await storage.getQrPaymentByCode(qrCode);
      if (!qrPayment) {
        return res.status(404).json({ message: 'Invalid or expired QR code' });
      }

      const paymentAmount = amount || parseFloat(qrPayment.amount || '0');
      if (paymentAmount <= 0) {
        return res.status(400).json({ message: 'Invalid payment amount' });
      }

      const currentWalletBalance = parseFloat(req.user.walletBalance);
      if (currentWalletBalance < paymentAmount) {
        return res.status(400).json({ message: 'Insufficient wallet balance' });
      }

      const newWalletBalance = (currentWalletBalance - paymentAmount).toFixed(2);
      
      // Create transaction
      await storage.createTransaction({
        fromUserId: req.user.id,
        fromAccountNumber: req.user.accountNumber,
        toAccountNumber: qrPayment.merchantName || 'QR Merchant',
        amount: paymentAmount.toString(),
        transactionType: 'wallet-payment',
        description: `QR Payment to ${qrPayment.merchantName || 'Merchant'}`,
        status: 'completed',
        referenceNumber: generateReferenceNumber(),
      });

      // Update wallet balance
      await storage.updateUserWalletBalance(req.user.id, newWalletBalance);
      
      // Mark QR as used
      await storage.markQrPaymentAsUsed(qrPayment.id);

      res.json({
        message: 'Payment successful',
        amount: paymentAmount,
        merchant: qrPayment.merchantName,
        newWalletBalance: parseFloat(newWalletBalance)
      });
    } catch (error) {
      console.error('QR scan error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin endpoints
  app.get('/api/admin/users', authenticateAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersResponse = users.map(({ passwordHash, pin, ...user }) => user);
      res.json(usersResponse);
    } catch (error) {
      console.error('Admin users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/admin/transactions', authenticateAdmin, async (req: any, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      console.error('Admin transactions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/admin/stats', authenticateAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const transactions = await storage.getAllTransactions();
      
      const totalUsers = users.length;
      const totalBalance = users.reduce((sum, user) => sum + parseFloat(user.balance), 0);
      const totalWalletBalance = users.reduce((sum, user) => sum + parseFloat(user.walletBalance), 0);
      const totalTransactions = transactions.length;
      
      const todayTransactions = transactions.filter(t => {
        const today = new Date();
        const transactionDate = new Date(t.createdAt);
        return transactionDate.toDateString() === today.toDateString();
      }).length;

      res.json({
        totalUsers,
        totalBalance,
        totalWalletBalance,
        totalTransactions,
        todayTransactions
      });
    } catch (error) {
      console.error('Admin stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Chatbot endpoints
  app.post('/api/chatbot/query', authenticate, async (req, res) => {
    try {
      const { query } = chatbotQuerySchema.parse(req.body);
      const user = req.user;

      const response = await ChatbotService.processQuery(query, user);
      
      // Save conversation to database
      await storage.createChatbotConversation({
        userId: user.id,
        query,
        response: response.response,
        queryType: response.queryType,
        isResolved: response.isResolved
      });

      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      console.error('Chatbot query error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/chatbot/history', authenticate, async (req, res) => {
    try {
      const conversations = await storage.getChatbotConversationsByUserId(req.user.id);
      res.json(conversations);
    } catch (error) {
      console.error('Chatbot history error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Fraud detection endpoints
  app.get('/api/fraud/alerts', authenticateAdmin, async (req, res) => {
    try {
      const alerts = await storage.getFraudAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Fraud alerts error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/fraud/alerts/:id/status', authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!['reviewed', 'false_positive', 'confirmed_fraud'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      await storage.updateFraudAlertStatus(parseInt(id), status, req.user.id);
      res.json({ message: 'Fraud alert status updated successfully' });
    } catch (error) {
      console.error('Update fraud alert error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/fraud/user-alerts', authenticate, async (req, res) => {
    try {
      const alerts = await storage.getFraudAlertsByUserId(req.user.id);
      res.json(alerts);
    } catch (error) {
      console.error('User fraud alerts error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Seed initial data
  app.post('/api/seed-data', async (req, res) => {
    try {
      const existingUsers = await storage.getAllUsers();
      if (existingUsers.length > 0) {
        return res.json({ message: 'Data already seeded' });
      }

      const hashedPin1 = await bcrypt.hash('1234', 10);
      const hashedPin2 = await bcrypt.hash('5678', 10);
      const hashedPin3 = await bcrypt.hash('9876', 10);
      const hashedPassword = await bcrypt.hash('password123', 10);

      // Create sample users
      const users = [
        {
          accountNumber: '12345678',
          email: 'kavi@example.com',
          mobile: '1234567890',
          passwordHash: hashedPassword,
          pin: hashedPin1,
          fullName: 'Kavi',
          address: '123 Main Street, New York, NY 10001',
          dateOfBirth: '1990-01-15',
          aadharNumber: '123456789012',
          balance: '5000.00',
          walletBalance: '500.00'
        },
        {
          accountNumber: '87654321',
          email: 'arun@example.com',
          mobile: '9876543210',
          passwordHash: hashedPassword,
          pin: hashedPin2,
          fullName: 'Arun',
          address: '456 Oak Avenue, Los Angeles, CA 90210',
          dateOfBirth: '1985-03-22',
          aadharNumber: '987654321098',
          balance: '7500.00',
          walletBalance: '750.00'
        },
        {
          accountNumber: '45678912',
          email: 'gokul@example.com',
          mobile: '5551234567',
          passwordHash: hashedPassword,
          pin: hashedPin3,
          fullName: 'Gokul',
          address: '789 Pine Road, Chicago, IL 60601',
          dateOfBirth: '1992-07-08',
          aadharNumber: '456789123456',
          balance: '3200.00',
          walletBalance: '320.00'
        }
      ];

      for (const userData of users) {
        await storage.createUser(userData);
      }

      res.json({ message: 'Sample data seeded successfully' });
    } catch (error) {
      console.error('Seed data error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
