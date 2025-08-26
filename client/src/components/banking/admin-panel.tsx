import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface AdminPanelProps {
  onNavigate: (view: 'welcome') => void;
}

type AdminView = 'analytics' | 'users' | 'transactions';

export default function AdminPanel({ onNavigate }: AdminPanelProps) {
  const [currentView, setCurrentView] = useState<AdminView>('analytics');
  const { logout } = useAuth();

  // Fetch admin data
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalUsers: number;
    totalBalance: number;
    totalWalletBalance: number;
    totalTransactions: number;
    todayTransactions: number;
  }>({
    queryKey: ['/api/admin/stats'],
    refetchInterval: 10000,
  });

  const { data: users, isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/users'],
    refetchInterval: 10000,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/transactions'],
    refetchInterval: 10000,
  });

  const handleLogout = async () => {
    try {
      await logout();
      onNavigate('welcome');
    } catch (error) {
      console.error('Logout error:', error);
      onNavigate('welcome');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTransactionType = (type: string) => {
    switch (type) {
      case 'deposit': return 'Deposit';
      case 'withdrawal-to-wallet': return 'Withdraw to Wallet';
      case 'transfer': return 'Transfer';
      case 'wallet-payment': return 'Wallet Payment';
      default: return type;
    }
  };

  const renderNavigation = () => (
    <div className="flex flex-wrap gap-3 mb-6">
      <Button
        onClick={() => setCurrentView('analytics')}
        className={`flex-1 min-w-32 flex items-center justify-center gap-2 py-3 px-4 ${
          currentView === 'analytics' 
            ? 'bg-bank-light' 
            : 'bg-bank-primary hover:bg-bank-light'
        }`}
        data-testid="button-analytics"
      >
        <i className="fas fa-chart-line"></i>
        Analytics
      </Button>
      <Button
        onClick={() => setCurrentView('users')}
        className={`flex-1 min-w-32 flex items-center justify-center gap-2 py-3 px-4 ${
          currentView === 'users' 
            ? 'bg-bank-light' 
            : 'bg-bank-primary hover:bg-bank-light'
        }`}
        data-testid="button-users"
      >
        <i className="fas fa-users"></i>
        Users
      </Button>
      <Button
        onClick={() => setCurrentView('transactions')}
        className={`flex-1 min-w-32 flex items-center justify-center gap-2 py-3 px-4 ${
          currentView === 'transactions' 
            ? 'bg-bank-light' 
            : 'bg-bank-primary hover:bg-bank-light'
        }`}
        data-testid="button-transactions"
      >
        <i className="fas fa-exchange-alt"></i>
        Transactions
      </Button>
    </div>
  );

  const renderAnalytics = () => (
    <div>
      {statsLoading ? (
        <div className="text-center py-8">
          <i className="fas fa-spinner fa-spin text-2xl text-bank-primary"></i>
          <p className="mt-2 text-gray-600">Loading analytics...</p>
        </div>
      ) : (
        <>
          <div className="stats-container">
            <div className="stats-card">
              <div className="stats-icon">
                <i className="fas fa-users"></i>
              </div>
              <div className="stats-info">
                <h4 data-testid="text-total-users">{stats?.totalUsers || 0}</h4>
                <p>Total Users</p>
              </div>
            </div>

            <div className="stats-card">
              <div className="stats-icon">
                <i className="fas fa-rupee-sign"></i>
              </div>
              <div className="stats-info">
                <h4 data-testid="text-total-balance">₹{stats?.totalBalance?.toFixed(2) || '0.00'}</h4>
                <p>Total Balance</p>
              </div>
            </div>

            <div className="stats-card">
              <div className="stats-icon">
                <i className="fas fa-wallet"></i>
              </div>
              <div className="stats-info">
                <h4 data-testid="text-total-wallet">₹{stats?.totalWalletBalance?.toFixed(2) || '0.00'}</h4>
                <p>Total Wallet Balance</p>
              </div>
            </div>

            <div className="stats-card">
              <div className="stats-icon">
                <i className="fas fa-exchange-alt"></i>
              </div>
              <div className="stats-info">
                <h4 data-testid="text-total-transactions">{stats?.totalTransactions || 0}</h4>
                <p>Total Transactions</p>
              </div>
            </div>
          </div>

          <div className="banking-section">
            <div className="banking-section-title">
              <i className="fas fa-chart-bar"></i>
              <h4 className="text-xl font-semibold">Today's Activity</h4>
            </div>
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <i className="fas fa-calendar-day text-4xl text-bank-primary mb-4"></i>
              <p className="text-2xl font-bold text-bank-primary" data-testid="text-today-transactions">
                {stats?.todayTransactions || 0}
              </p>
              <p className="text-gray-600">Transactions Today</p>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="banking-section">
      <div className="banking-section-title">
        <i className="fas fa-users"></i>
        <h4 className="text-xl font-semibold">All Users</h4>
      </div>
      {usersLoading ? (
        <div className="text-center py-8">
          <i className="fas fa-spinner fa-spin text-2xl text-bank-primary"></i>
          <p className="mt-2 text-gray-600">Loading users...</p>
        </div>
      ) : users && users.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="banking-table" data-testid="table-users">
            <thead>
              <tr>
                <th>Name</th>
                <th>Account Number</th>
                <th>Mobile</th>
                <th>Balance</th>
                <th>Wallet Balance</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: any) => (
                <tr key={user.id} data-testid={`row-user-${user.id}`}>
                  <td>{user.fullName}</td>
                  <td>{user.accountNumber}</td>
                  <td>{user.mobile}</td>
                  <td className="font-semibold">₹{parseFloat(user.balance).toFixed(2)}</td>
                  <td className="font-semibold">₹{parseFloat(user.walletBalance).toFixed(2)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-600">
          <i className="fas fa-user-slash text-3xl mb-4"></i>
          <p>No users found</p>
        </div>
      )}
    </div>
  );

  const renderTransactions = () => (
    <div className="banking-section">
      <div className="banking-section-title">
        <i className="fas fa-exchange-alt"></i>
        <h4 className="text-xl font-semibold">All Transactions</h4>
      </div>
      {transactionsLoading ? (
        <div className="text-center py-8">
          <i className="fas fa-spinner fa-spin text-2xl text-bank-primary"></i>
          <p className="mt-2 text-gray-600">Loading transactions...</p>
        </div>
      ) : transactions && transactions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="banking-table" data-testid="table-admin-transactions">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>From Account</th>
                <th>To Account</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction: any) => (
                <tr key={transaction.id} data-testid={`row-admin-transaction-${transaction.id}`}>
                  <td>{formatDate(transaction.createdAt)}</td>
                  <td>{formatTransactionType(transaction.transactionType)}</td>
                  <td>{transaction.fromAccountNumber || '-'}</td>
                  <td>{transaction.toAccountNumber || '-'}</td>
                  <td className="font-semibold">₹{parseFloat(transaction.amount).toFixed(2)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      transaction.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : transaction.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="font-mono text-sm">{transaction.referenceNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-600">
          <i className="fas fa-inbox text-3xl mb-4"></i>
          <p>No transactions found</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-5">
      {/* Admin Header */}
      <div className="flex justify-center items-center mb-4 relative px-15">
        <h2 className="text-3xl font-bold text-bank-primary text-center flex-1">
          <i className="fas fa-shield-alt mr-3"></i>
          Admin Panel
        </h2>
        <button
          onClick={handleLogout}
          className="absolute right-0 bg-bank-danger text-white px-3 py-1.5 text-xs rounded cursor-pointer transition-colors hover:bg-red-700"
          data-testid="button-admin-logout"
        >
          <i className="fas fa-sign-out-alt mr-2"></i>
          Logout
        </button>
      </div>

      {/* Navigation */}
      {renderNavigation()}

      {/* Content */}
      {currentView === 'analytics' && renderAnalytics()}
      {currentView === 'users' && renderUsers()}
      {currentView === 'transactions' && renderTransactions()}
    </div>
  );
}
