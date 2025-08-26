import {
  users,
  transactions,
  userSessions,
  qrPayments,
  chatbotConversations,
  fraudAlerts,
  type User,
  type InsertUser,
  type Transaction,
  type InsertTransaction,
  type UserSession,
  type QrPayment,
  type InsertQrPayment,
  type ChatbotConversation,
  type InsertChatbotConversation,
  type FraudAlert,
  type InsertFraudAlert,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  getUserByAccountNumber(accountNumber: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, balance: string): Promise<void>;
  updateUserWalletBalance(userId: number, walletBalance: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUserId(userId: number): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionById(id: number): Promise<Transaction | undefined>;
  
  // Session operations
  createSession(session: { userId: number; token: string; expiresAt: Date }): Promise<UserSession>;
  getSessionByToken(token: string): Promise<UserSession | undefined>;
  deleteSession(token: string): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
  
  // QR Payment operations
  createQrPayment(qrPayment: InsertQrPayment): Promise<QrPayment>;
  getQrPaymentByCode(qrCode: string): Promise<QrPayment | undefined>;
  markQrPaymentAsUsed(id: number): Promise<void>;
  cleanupExpiredQrPayments(): Promise<void>;
  
  // Chatbot operations
  createChatbotConversation(conversation: InsertChatbotConversation): Promise<ChatbotConversation>;
  getChatbotConversationsByUserId(userId: number): Promise<ChatbotConversation[]>;
  
  // Fraud detection operations
  createFraudAlert(alert: InsertFraudAlert): Promise<FraudAlert>;
  getFraudAlerts(): Promise<FraudAlert[]>;
  getFraudAlertsByUserId(userId: number): Promise<FraudAlert[]>;
  updateFraudAlertStatus(id: number, status: string, reviewedBy?: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mobile, mobile));
    return user;
  }

  async getUserByAccountNumber(accountNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.accountNumber, accountNumber));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        updatedAt: new Date(),
      })
      .returning();
    return user;
  }

  async updateUserBalance(userId: number, balance: string): Promise<void> {
    await db
      .update(users)
      .set({ balance, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateUserWalletBalance(userId: number, walletBalance: string): Promise<void> {
    await db
      .update(users)
      .set({ walletBalance, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "customer")).orderBy(desc(users.createdAt));
  }

  // Transaction operations
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    return transaction;
  }

  async getTransactionsByUserId(userId: number): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(
        sql`${transactions.fromUserId} = ${userId} OR ${transactions.toUserId} = ${userId}`
      )
      .orderBy(desc(transactions.createdAt));
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt));
  }

  async getTransactionById(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  // Session operations
  async createSession(session: { userId: number; token: string; expiresAt: Date }): Promise<UserSession> {
    const [userSession] = await db
      .insert(userSessions)
      .values(session)
      .returning();
    return userSession;
  }

  async getSessionByToken(token: string): Promise<UserSession | undefined> {
    const [session] = await db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.token, token),
        gte(userSessions.expiresAt, new Date())
      ));
    return session;
  }

  async deleteSession(token: string): Promise<void> {
    await db
      .delete(userSessions)
      .where(eq(userSessions.token, token));
  }

  async cleanupExpiredSessions(): Promise<void> {
    await db
      .delete(userSessions)
      .where(sql`${userSessions.expiresAt} < NOW()`);
  }

  // QR Payment operations
  async createQrPayment(qrPayment: InsertQrPayment): Promise<QrPayment> {
    const [payment] = await db
      .insert(qrPayments)
      .values(qrPayment)
      .returning();
    return payment;
  }

  async getQrPaymentByCode(qrCode: string): Promise<QrPayment | undefined> {
    const [payment] = await db
      .select()
      .from(qrPayments)
      .where(and(
        eq(qrPayments.qrCode, qrCode),
        eq(qrPayments.isUsed, false),
        gte(qrPayments.expiresAt, new Date())
      ));
    return payment;
  }

  async markQrPaymentAsUsed(id: number): Promise<void> {
    await db
      .update(qrPayments)
      .set({ isUsed: true })
      .where(eq(qrPayments.id, id));
  }

  async cleanupExpiredQrPayments(): Promise<void> {
    await db
      .delete(qrPayments)
      .where(sql`${qrPayments.expiresAt} < NOW()`);
  }

  // Chatbot operations
  async createChatbotConversation(conversation: InsertChatbotConversation): Promise<ChatbotConversation> {
    const [chatbotConversation] = await db
      .insert(chatbotConversations)
      .values(conversation)
      .returning();
    return chatbotConversation;
  }

  async getChatbotConversationsByUserId(userId: number): Promise<ChatbotConversation[]> {
    return await db
      .select()
      .from(chatbotConversations)
      .where(eq(chatbotConversations.userId, userId))
      .orderBy(desc(chatbotConversations.createdAt));
  }

  // Fraud detection operations
  async createFraudAlert(alert: InsertFraudAlert): Promise<FraudAlert> {
    const [fraudAlert] = await db
      .insert(fraudAlerts)
      .values(alert)
      .returning();
    return fraudAlert;
  }

  async getFraudAlerts(): Promise<FraudAlert[]> {
    return await db
      .select()
      .from(fraudAlerts)
      .orderBy(desc(fraudAlerts.createdAt));
  }

  async getFraudAlertsByUserId(userId: number): Promise<FraudAlert[]> {
    return await db
      .select()
      .from(fraudAlerts)
      .where(eq(fraudAlerts.userId, userId))
      .orderBy(desc(fraudAlerts.createdAt));
  }

  async updateFraudAlertStatus(id: number, status: string, reviewedBy?: number): Promise<void> {
    await db
      .update(fraudAlerts)
      .set({
        status,
        reviewedBy,
        reviewedAt: new Date(),
      })
      .where(eq(fraudAlerts.id, id));
  }
}

export const storage = new DatabaseStorage();
