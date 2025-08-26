import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  decimal,
  integer,
  boolean,
  text,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table - core user accounts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  accountNumber: varchar("account_number", { length: 20 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique(),
  mobile: varchar("mobile", { length: 15 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  pin: varchar("pin", { length: 255 }).notNull(), // hashed PIN for transactions
  fullName: varchar("full_name", { length: 100 }).notNull(),
  address: text("address"),
  dateOfBirth: varchar("date_of_birth", { length: 10 }),
  aadharNumber: varchar("aadhar_number", { length: 12 }),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  walletBalance: decimal("wallet_balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  role: varchar("role", { length: 20 }).default("customer").notNull(), // customer or admin
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Transactions table - all banking transactions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => users.id),
  toUserId: integer("to_user_id").references(() => users.id),
  fromAccountNumber: varchar("from_account_number", { length: 20 }),
  toAccountNumber: varchar("to_account_number", { length: 20 }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // deposit, withdrawal-to-wallet, transfer, wallet-payment
  description: text("description"),
  status: varchar("status", { length: 20 }).default("completed").notNull(), // pending, completed, failed
  referenceNumber: varchar("reference_number", { length: 50 }).unique().notNull(),
  metadata: jsonb("metadata"), // for storing additional transaction data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User sessions for login tracking
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: varchar("token", { length: 255 }).unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// QR Payment codes
export const qrPayments = pgTable("qr_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  qrCode: text("qr_code").unique().notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  merchantName: varchar("merchant_name", { length: 100 }),
  isUsed: boolean("is_used").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chatbot conversations
export const chatbotConversations = pgTable("chatbot_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  query: text("query").notNull(),
  response: text("response").notNull(),
  queryType: varchar("query_type", { length: 50 }).notNull(), // balance, transactions, help, general
  isResolved: boolean("is_resolved").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Fraud detection alerts
export const fraudAlerts = pgTable("fraud_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  transactionId: integer("transaction_id").references(() => transactions.id),
  alertType: varchar("alert_type", { length: 50 }).notNull(), // unusual_amount, frequent_transactions, time_pattern, location_anomaly
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }).notNull(), // 0.00 to 100.00
  description: text("description").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, reviewed, false_positive, confirmed_fraud
  reviewedBy: integer("reviewed_by").references(() => users.id), // admin who reviewed
  reviewedAt: timestamp("reviewed_at"),
  metadata: jsonb("metadata"), // additional fraud detection data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sentTransactions: many(transactions, { relationName: "sentTransactions" }),
  receivedTransactions: many(transactions, { relationName: "receivedTransactions" }),
  sessions: many(userSessions),
  qrPayments: many(qrPayments),
  chatbotConversations: many(chatbotConversations),
  fraudAlerts: many(fraudAlerts),
  reviewedFraudAlerts: many(fraudAlerts, { relationName: "reviewedAlerts" }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  fromUser: one(users, {
    fields: [transactions.fromUserId],
    references: [users.id],
    relationName: "sentTransactions",
  }),
  toUser: one(users, {
    fields: [transactions.toUserId],
    references: [users.id],
    relationName: "receivedTransactions",
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const qrPaymentsRelations = relations(qrPayments, ({ one }) => ({
  user: one(users, {
    fields: [qrPayments.userId],
    references: [users.id],
  }),
}));

export const chatbotConversationsRelations = relations(chatbotConversations, ({ one }) => ({
  user: one(users, {
    fields: [chatbotConversations.userId],
    references: [users.id],
  }),
}));

export const fraudAlertsRelations = relations(fraudAlerts, ({ one }) => ({
  user: one(users, {
    fields: [fraudAlerts.userId],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [fraudAlerts.transactionId],
    references: [transactions.id],
  }),
  reviewer: one(users, {
    fields: [fraudAlerts.reviewedBy],
    references: [users.id],
    relationName: "reviewedAlerts",
  }),
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginUserSchema = z.object({
  mobile: z.string().min(10).max(15),
  pin: z.string().min(4).max(6),
});

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const transactionSchema = z.object({
  amount: z.number().positive(),
  pin: z.string().min(4).max(6),
  toAccountNumber: z.string().optional(),
  transactionType: z.enum(["deposit", "withdrawal-to-wallet", "transfer", "wallet-payment"]),
  description: z.string().optional(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertQrPaymentSchema = createInsertSchema(qrPayments).omit({
  id: true,
  createdAt: true,
});

export const chatbotQuerySchema = z.object({
  query: z.string().min(1),
});

export const insertChatbotConversationSchema = createInsertSchema(chatbotConversations).omit({
  id: true,
  createdAt: true,
});

export const insertFraudAlertSchema = createInsertSchema(fraudAlerts).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type AdminLogin = z.infer<typeof adminLoginSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type TransactionRequest = z.infer<typeof transactionSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type QrPayment = typeof qrPayments.$inferSelect;
export type InsertQrPayment = z.infer<typeof insertQrPaymentSchema>;
export type ChatbotConversation = typeof chatbotConversations.$inferSelect;
export type InsertChatbotConversation = z.infer<typeof insertChatbotConversationSchema>;
export type ChatbotQuery = z.infer<typeof chatbotQuerySchema>;
export type FraudAlert = typeof fraudAlerts.$inferSelect;
export type InsertFraudAlert = z.infer<typeof insertFraudAlertSchema>;
