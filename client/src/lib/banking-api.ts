import { apiRequest } from "./queryClient";

export interface LoginResponse {
  message: string;
  token: string;
  user: {
    id: number;
    accountNumber: string;
    email?: string;
    mobile: string;
    fullName: string;
    address?: string;
    dateOfBirth?: string;
    aadharNumber?: string;
    balance: string;
    walletBalance: string;
    isActive: boolean;
    role: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface BalanceResponse {
  balance: number;
  walletBalance: number;
}

export interface TransactionResponse {
  message: string;
  amount: number;
  newBalance?: number;
  newWalletBalance?: number;
  recipient?: string;
}

export interface Transaction {
  id: number;
  fromUserId?: number;
  toUserId?: number;
  fromAccountNumber?: string;
  toAccountNumber?: string;
  amount: string;
  transactionType: string;
  description?: string;
  status: string;
  referenceNumber: string;
  createdAt: string;
}

export interface QRGenerateResponse {
  qrCode: string;
  amount?: number;
  merchantName: string;
  expiresAt: string;
}

export interface QRPaymentResponse {
  message: string;
  amount: number;
  merchant?: string;
  newWalletBalance: number;
}

export interface AdminStats {
  totalUsers: number;
  totalBalance: number;
  totalWalletBalance: number;
  totalTransactions: number;
  todayTransactions: number;
}

class BankingAPI {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('bankingToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // Authentication methods
  async login(mobile: string, pin: string): Promise<LoginResponse> {
    const response = await apiRequest('POST', '/api/auth/login', {
      mobile,
      pin
    });

    const data = await this.handleResponse<LoginResponse>(response);
    
    // Store token in localStorage
    if (data.token) {
      localStorage.setItem('bankingToken', data.token);
    }
    
    return data;
  }

  async adminLogin(email: string, password: string): Promise<LoginResponse> {
    const response = await apiRequest('POST', '/api/auth/admin-login', {
      email,
      password
    });

    const data = await this.handleResponse<LoginResponse>(response);
    
    // Store token in localStorage
    if (data.token) {
      localStorage.setItem('bankingToken', data.token);
    }
    
    return data;
  }

  async logout(): Promise<{ message: string }> {
    try {
      const token = localStorage.getItem('bankingToken');
      if (token) {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        await this.handleResponse(response);
      }
    } catch (error) {
      // Even if logout request fails, we should clear local storage
      console.error('Logout request failed:', error);
    } finally {
      localStorage.removeItem('bankingToken');
    }
    
    return { message: 'Logged out successfully' };
  }

  async verifyAuth(): Promise<{ user: LoginResponse['user'] }> {
    const token = localStorage.getItem('bankingToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch('/api/auth/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return this.handleResponse<{ user: LoginResponse['user'] }>(response);
  }

  // Account methods
  async getProfile(): Promise<LoginResponse['user']> {
    const response = await fetch('/api/account/profile', {
      method: 'GET',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json'
      }
    });

    return this.handleResponse<LoginResponse['user']>(response);
  }

  async getBalance(): Promise<BalanceResponse> {
    const response = await fetch('/api/account/balance', {
      method: 'GET',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json'
      }
    });

    return this.handleResponse<BalanceResponse>(response);
  }

  // Transaction methods
  async deposit(amount: number, pin: string): Promise<TransactionResponse> {
    const response = await apiRequest('POST', '/api/transactions/deposit', {
      amount,
      pin
    });

    response.headers.set('Authorization', `Bearer ${localStorage.getItem('bankingToken')}`);

    return this.handleResponse<TransactionResponse>(response);
  }

  async withdraw(amount: number, pin: string): Promise<TransactionResponse> {
    const token = localStorage.getItem('bankingToken');
    const response = await fetch('/api/transactions/withdraw', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, pin })
    });

    return this.handleResponse<TransactionResponse>(response);
  }

  async transfer(amount: number, pin: string, toAccountNumber: string): Promise<TransactionResponse> {
    const token = localStorage.getItem('bankingToken');
    const response = await fetch('/api/transactions/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, pin, toAccountNumber })
    });

    return this.handleResponse<TransactionResponse>(response);
  }

  async getTransactionHistory(): Promise<Transaction[]> {
    const token = localStorage.getItem('bankingToken');
    const response = await fetch('/api/transactions/history', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return this.handleResponse<Transaction[]>(response);
  }

  // QR methods
  async generateQR(amount?: number, merchantName?: string): Promise<QRGenerateResponse> {
    const token = localStorage.getItem('bankingToken');
    const response = await fetch('/api/qr/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, merchantName })
    });

    return this.handleResponse<QRGenerateResponse>(response);
  }

  async scanQR(qrCode: string, amount?: number): Promise<QRPaymentResponse> {
    const token = localStorage.getItem('bankingToken');
    const response = await fetch('/api/qr/scan', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qrCode, amount })
    });

    return this.handleResponse<QRPaymentResponse>(response);
  }

  // Admin methods
  async getAdminStats(): Promise<AdminStats> {
    const token = localStorage.getItem('bankingToken');
    const response = await fetch('/api/admin/stats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return this.handleResponse<AdminStats>(response);
  }

  async getAdminUsers(): Promise<LoginResponse['user'][]> {
    const token = localStorage.getItem('bankingToken');
    const response = await fetch('/api/admin/users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return this.handleResponse<LoginResponse['user'][]>(response);
  }

  async getAdminTransactions(): Promise<Transaction[]> {
    const token = localStorage.getItem('bankingToken');
    const response = await fetch('/api/admin/transactions', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return this.handleResponse<Transaction[]>(response);
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!localStorage.getItem('bankingToken');
  }

  getStoredToken(): string | null {
    return localStorage.getItem('bankingToken');
  }

  clearAuth(): void {
    localStorage.removeItem('bankingToken');
  }
}

// Create and export singleton instance
export const bankingApi = new BankingAPI();

