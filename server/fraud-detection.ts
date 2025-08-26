import { storage } from "./storage";
import { Transaction, User } from "@shared/schema";

interface FraudPattern {
  type: string;
  description: string;
  riskScore: number;
}

export class FraudDetectionService {
  // Define fraud patterns and thresholds
  private static readonly UNUSUAL_AMOUNT_THRESHOLD = 10000; // Large transactions over $10,000
  private static readonly FREQUENT_TRANSACTIONS_THRESHOLD = 5; // More than 5 transactions in 1 hour
  private static readonly HIGH_VELOCITY_THRESHOLD = 3; // 3 transactions within 10 minutes

  /**
   * Analyze a transaction for potential fraud patterns
   */
  static async analyzeTransaction(transaction: Transaction, user: User): Promise<FraudPattern[]> {
    const patterns: FraudPattern[] = [];

    // 1. Check for unusual amount
    if (this.isUnusualAmount(transaction, user)) {
      patterns.push({
        type: "unusual_amount",
        description: `Transaction amount $${transaction.amount} is significantly higher than user's typical transactions`,
        riskScore: 75.0
      });
    }

    // 2. Check for frequent transactions
    const recentTransactions = await this.getRecentTransactions(user.id, 60); // Last hour
    if (recentTransactions.length >= this.FREQUENT_TRANSACTIONS_THRESHOLD) {
      patterns.push({
        type: "frequent_transactions",
        description: `User has made ${recentTransactions.length} transactions in the last hour`,
        riskScore: 60.0
      });
    }

    // 3. Check for high velocity transactions
    const velocityTransactions = await this.getRecentTransactions(user.id, 10); // Last 10 minutes
    if (velocityTransactions.length >= this.HIGH_VELOCITY_THRESHOLD) {
      patterns.push({
        type: "high_velocity",
        description: `User has made ${velocityTransactions.length} transactions in the last 10 minutes`,
        riskScore: 80.0
      });
    }

    // 4. Check for unusual time patterns (late night transactions)
    if (this.isUnusualTime(transaction)) {
      patterns.push({
        type: "time_pattern",
        description: "Transaction made during unusual hours (late night/early morning)",
        riskScore: 40.0
      });
    }

    // 5. Check for round number patterns (common in fraudulent transactions)
    if (this.isRoundAmount(transaction)) {
      patterns.push({
        type: "round_amount",
        description: "Transaction is for a round amount, which is common in fraudulent activities",
        riskScore: 30.0
      });
    }

    return patterns;
  }

  /**
   * Check if transaction amount is unusual for the user
   */
  private static isUnusualAmount(transaction: Transaction, user: User): boolean {
    const amount = parseFloat(transaction.amount);
    const userBalance = parseFloat(user.balance);
    
    // Flag if transaction is over threshold OR over 50% of user's balance
    return amount > this.UNUSUAL_AMOUNT_THRESHOLD || amount > (userBalance * 0.5);
  }

  /**
   * Get recent transactions for a user within specified minutes
   */
  private static async getRecentTransactions(userId: number, minutes: number): Promise<Transaction[]> {
    const allTransactions = await storage.getTransactionsByUserId(userId);
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    
    return allTransactions.filter(t => 
      new Date(t.createdAt) > cutoffTime && t.status === 'completed'
    );
  }

  /**
   * Check if transaction is made during unusual hours (11 PM - 6 AM)
   */
  private static isUnusualTime(transaction: Transaction): boolean {
    const hour = new Date(transaction.createdAt).getHours();
    return hour >= 23 || hour <= 6;
  }

  /**
   * Check if transaction amount is a round number (potentially suspicious)
   */
  private static isRoundAmount(transaction: Transaction): boolean {
    const amount = parseFloat(transaction.amount);
    return amount % 1000 === 0 && amount >= 1000; // Round thousands
  }

  /**
   * Calculate overall risk score from multiple patterns
   */
  static calculateRiskScore(patterns: FraudPattern[]): number {
    if (patterns.length === 0) return 0;
    
    // Calculate weighted average with higher weight for more patterns
    const totalScore = patterns.reduce((sum, pattern) => sum + pattern.riskScore, 0);
    const weightedScore = totalScore / patterns.length;
    
    // Add bonus for multiple patterns
    const patternBonus = Math.min(patterns.length * 10, 30);
    
    return Math.min(weightedScore + patternBonus, 100);
  }

  /**
   * Generate alert description from patterns
   */
  static generateAlertDescription(patterns: FraudPattern[]): string {
    if (patterns.length === 0) return "No fraud patterns detected";
    
    if (patterns.length === 1) {
      return patterns[0].description;
    }
    
    return `Multiple fraud indicators detected: ${patterns.map(p => p.type).join(", ")}`;
  }
}