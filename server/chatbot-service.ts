import { storage } from "./storage";
import { User } from "@shared/schema";

export interface ChatbotResponse {
  response: string;
  queryType: string;
  isResolved: boolean;
  data?: any;
}

export class ChatbotService {
  /**
   * Process user query and generate appropriate response
   */
  static async processQuery(query: string, user: User): Promise<ChatbotResponse> {
    const normalizedQuery = query.toLowerCase().trim();

    // Balance related queries
    if (this.isBalanceQuery(normalizedQuery)) {
      return await this.handleBalanceQuery(user);
    }

    // Transaction history queries
    if (this.isTransactionQuery(normalizedQuery)) {
      return await this.handleTransactionQuery(normalizedQuery, user);
    }

    // Account information queries
    if (this.isAccountInfoQuery(normalizedQuery)) {
      return await this.handleAccountInfoQuery(user);
    }

    // Help and general queries
    if (this.isHelpQuery(normalizedQuery)) {
      return this.handleHelpQuery();
    }

    // Default response for unrecognized queries
    return this.handleGeneralQuery(normalizedQuery);
  }

  /**
   * Check if query is asking about balance
   */
  private static isBalanceQuery(query: string): boolean {
    const balanceKeywords = ['balance', 'money', 'amount', 'funds', 'wallet', 'account balance'];
    return balanceKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Check if query is asking about transactions
   */
  private static isTransactionQuery(query: string): boolean {
    const transactionKeywords = ['transaction', 'transfer', 'payment', 'history', 'last', 'recent', 'sent', 'received'];
    return transactionKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Check if query is asking about account information
   */
  private static isAccountInfoQuery(query: string): boolean {
    const accountKeywords = ['account', 'number', 'details', 'information', 'profile'];
    return accountKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Check if query is asking for help
   */
  private static isHelpQuery(query: string): boolean {
    const helpKeywords = ['help', 'support', 'how', 'what', 'can you', 'assist'];
    return helpKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Handle balance-related queries
   */
  private static async handleBalanceQuery(user: User): Promise<ChatbotResponse> {
    const balance = parseFloat(user.balance);
    const walletBalance = parseFloat(user.walletBalance);

    return {
      response: `Your current account balance is $${balance.toFixed(2)} and your wallet balance is $${walletBalance.toFixed(2)}.`,
      queryType: "balance",
      isResolved: true,
      data: { balance, walletBalance }
    };
  }

  /**
   * Handle transaction-related queries
   */
  private static async handleTransactionQuery(query: string, user: User): Promise<ChatbotResponse> {
    const transactions = await storage.getTransactionsByUserId(user.id);
    
    // Extract number of transactions requested (default to 5)
    let limit = 5;
    const numberMatch = query.match(/(\d+)/);
    if (numberMatch) {
      limit = Math.min(parseInt(numberMatch[1]), 20); // Max 20 transactions
    }

    const recentTransactions = transactions.slice(0, limit);

    if (recentTransactions.length === 0) {
      return {
        response: "You don't have any transactions yet.",
        queryType: "transactions",
        isResolved: true,
        data: { transactions: [] }
      };
    }

    let response = `Here are your last ${recentTransactions.length} transactions:\n\n`;
    
    recentTransactions.forEach((tx, index) => {
      const amount = parseFloat(tx.amount);
      const date = new Date(tx.createdAt).toLocaleDateString();
      const isDebit = tx.fromUserId === user.id;
      const type = isDebit ? 'Sent' : 'Received';
      
      response += `${index + 1}. ${type} $${amount.toFixed(2)} - ${tx.transactionType} (${date})\n`;
    });

    return {
      response: response.trim(),
      queryType: "transactions",
      isResolved: true,
      data: { transactions: recentTransactions }
    };
  }

  /**
   * Handle account information queries
   */
  private static async handleAccountInfoQuery(user: User): Promise<ChatbotResponse> {
    return {
      response: `Your account details:\n• Account Number: ${user.accountNumber}\n• Name: ${user.fullName}\n• Mobile: ${user.mobile}\n• Account Status: ${user.isActive ? 'Active' : 'Inactive'}`,
      queryType: "account_info",
      isResolved: true,
      data: {
        accountNumber: user.accountNumber,
        fullName: user.fullName,
        mobile: user.mobile,
        isActive: user.isActive
      }
    };
  }

  /**
   * Handle help queries
   */
  private static handleHelpQuery(): ChatbotResponse {
    return {
      response: `I can help you with the following:\n\n• Check your account balance\n• View transaction history\n• Get account information\n• Answer banking questions\n\nJust ask me questions like:\n- "What's my balance?"\n- "Show my last 5 transactions"\n- "What's my account number?"`,
      queryType: "help",
      isResolved: true
    };
  }

  /**
   * Handle general/unrecognized queries
   */
  private static handleGeneralQuery(query: string): ChatbotResponse {
    // Try to provide helpful suggestions based on keywords
    if (query.includes('transfer') || query.includes('send')) {
      return {
        response: "To transfer money, go to the Transfer section and enter the recipient's account number and amount. You'll need your PIN to confirm the transaction.",
        queryType: "general",
        isResolved: true
      };
    }

    if (query.includes('deposit')) {
      return {
        response: "To deposit money, use the Deposit section. Enter the amount and your PIN to add funds to your account.",
        queryType: "general",
        isResolved: true
      };
    }

    if (query.includes('withdraw')) {
      return {
        response: "To withdraw money to your wallet, use the Withdraw section. Enter the amount and your PIN to transfer funds from your account to your wallet.",
        queryType: "general",
        isResolved: true
      };
    }

    if (query.includes('qr') || query.includes('payment')) {
      return {
        response: "For QR payments, go to the QR section to generate a payment code or scan someone else's QR code for payments.",
        queryType: "general",
        isResolved: true
      };
    }

    return {
      response: "I'm sorry, I didn't understand your question. I can help you check your balance, view transaction history, or get account information. You can also ask for help to see what I can do.",
      queryType: "general",
      isResolved: false
    };
  }
}