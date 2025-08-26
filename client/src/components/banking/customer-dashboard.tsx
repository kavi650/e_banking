import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bankingApi } from "@/lib/banking-api";
import { useAuth } from "@/hooks/use-auth";

interface CustomerDashboardProps {
  onNavigate: (view: 'welcome') => void;
  onShowQRScanner: (show: boolean) => void;
}

type CustomerView = 'operations' | 'profile' | 'history';
type OperationType = 'deposit' | 'withdraw' | 'transfer' | null;

export default function CustomerDashboard({ onNavigate, onShowQRScanner }: CustomerDashboardProps) {
  const [currentView, setCurrentView] = useState<CustomerView>('operations');
  const [activeOperation, setActiveOperation] = useState<OperationType>('deposit');
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [depositPin, setDepositPin] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawPin, setWithdrawPin] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [transferPin, setTransferPin] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferAccount, setTransferAccount] = useState("");

  // Fetch balance
  const { data: balance, isLoading: balanceLoading } = useQuery<{ balance: number; walletBalance: number }>({
    queryKey: ['/api/account/balance'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch transaction history
  const { data: transactions, isLoading: transactionsLoading } = useQuery<any[]>({
    queryKey: ['/api/transactions/history'],
  });

  // Mutations
  const depositMutation = useMutation({
    mutationFn: ({ amount, pin }: { amount: number; pin: string }) =>
      bankingApi.deposit(amount, pin),
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Deposit of ₹${data.amount} successful!`,
      });
      setDepositPin("");
      setDepositAmount("");
      queryClient.invalidateQueries({ queryKey: ['/api/account/balance'] });
    },
    onError: (error: any) => {
      toast({
        title: "Deposit Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: ({ amount, pin }: { amount: number; pin: string }) =>
      bankingApi.withdraw(amount, pin),
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Withdrawal of ₹${data.amount} to wallet successful!`,
      });
      setWithdrawPin("");
      setWithdrawAmount("");
      queryClient.invalidateQueries({ queryKey: ['/api/account/balance'] });
    },
    onError: (error: any) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: ({ amount, pin, toAccountNumber }: { amount: number; pin: string; toAccountNumber: string }) =>
      bankingApi.transfer(amount, pin, toAccountNumber),
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Transfer of ₹${data.amount} successful to ${data.recipient}!`,
      });
      setTransferPin("");
      setTransferAmount("");
      setTransferAccount("");
      queryClient.invalidateQueries({ queryKey: ['/api/account/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/history'] });
    },
    onError: (error: any) => {
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    },
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

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0 || !depositPin) {
      toast({
        title: "Error",
        description: "Please enter valid amount and PIN",
        variant: "destructive",
      });
      return;
    }
    depositMutation.mutate({ amount, pin: depositPin });
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || !withdrawPin) {
      toast({
        title: "Error",
        description: "Please enter valid amount and PIN",
        variant: "destructive",
      });
      return;
    }
    withdrawMutation.mutate({ amount, pin: withdrawPin });
  };

  const handleTransfer = () => {
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0 || !transferPin || !transferAccount) {
      toast({
        title: "Error",
        description: "Please fill all fields with valid information",
        variant: "destructive",
      });
      return;
    }
    transferMutation.mutate({ amount, pin: transferPin, toAccountNumber: transferAccount });
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

  const renderMainNavigation = () => (
    <div className="banking-section">
      <h3 className="text-center mb-4 text-bank-primary font-semibold text-xl">
        <i className="fas fa-th-large mr-3"></i>
        Main Menu
      </h3>
      <div className="main-customer-nav">
        <button
          onClick={() => setCurrentView('operations')}
          className={currentView === 'operations' ? 'active' : ''}
          data-testid="button-operations"
        >
          <i className="fas fa-cogs"></i>
          <span>Operations</span>
        </button>
        <button
          onClick={() => setCurrentView('profile')}
          className={currentView === 'profile' ? 'active' : ''}
          data-testid="button-profile"
        >
          <i className="fas fa-id-card"></i>
          <span>Profile</span>
        </button>
        <button
          onClick={() => setCurrentView('history')}
          className={currentView === 'history' ? 'active' : ''}
          data-testid="button-history"
        >
          <i className="fas fa-history"></i>
          <span>History</span>
        </button>
      </div>
    </div>
  );

  const renderProfileView = () => (
    <div className="banking-section">
      <div className="banking-section-title">
        <i className="fas fa-id-card"></i>
        <h3 className="text-xl font-semibold">Your Profile</h3>
      </div>
      <div className="space-y-2">
        <div className="profile-row">
          <strong>Name:</strong>
          <span data-testid="text-user-name">{user?.fullName}</span>
        </div>
        <div className="profile-row">
          <strong>Account Number:</strong>
          <span data-testid="text-account-number">{user?.accountNumber}</span>
        </div>
        <div className="profile-row">
          <strong>Mobile Number:</strong>
          <span data-testid="text-mobile">{user?.mobile}</span>
        </div>
        <div className="profile-row">
          <strong>Email:</strong>
          <span data-testid="text-email">{user?.email || 'N/A'}</span>
        </div>
        <div className="profile-row">
          <strong>Address:</strong>
          <span data-testid="text-address">{user?.address}</span>
        </div>
        <div className="profile-row">
          <strong>Date of Birth:</strong>
          <span data-testid="text-dob">{user?.dateOfBirth}</span>
        </div>
        <div className="profile-row">
          <strong>Aadhar Number:</strong>
          <span data-testid="text-aadhar">{user?.aadharNumber}</span>
        </div>
        <div className="profile-row">
          <strong>Account Balance:</strong>
          <span className="balance-amount" data-testid="text-account-balance">
            ₹{balanceLoading ? '...' : balance?.balance?.toFixed(2)}
          </span>
        </div>
        <div className="profile-row">
          <strong>Wallet Balance:</strong>
          <span className="balance-amount" data-testid="text-wallet-balance">
            ₹{balanceLoading ? '...' : balance?.walletBalance?.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );

  const renderOperationsView = () => (
    <div className="banking-section">
      <div className="banking-section-title">
        <i className="fas fa-cogs"></i>
        <h3 className="text-xl font-semibold">Account Operations</h3>
      </div>
      
      <div className="operations-nav">
        <button
          onClick={() => setActiveOperation('deposit')}
          className={activeOperation === 'deposit' ? 'active' : ''}
          data-testid="button-deposit-tab"
        >
          <i className="fas fa-money-bill-wave"></i>
          <span>Deposit</span>
        </button>
        <button
          onClick={() => setActiveOperation('withdraw')}
          className={activeOperation === 'withdraw' ? 'active' : ''}
          data-testid="button-withdraw-tab"
        >
          <i className="fas fa-hand-holding-usd"></i>
          <span>Withdraw to Wallet</span>
        </button>
        <button
          onClick={() => setActiveOperation('transfer')}
          className={activeOperation === 'transfer' ? 'active' : ''}
          data-testid="button-transfer-tab"
        >
          <i className="fas fa-exchange-alt"></i>
          <span>Transfer</span>
        </button>
      </div>

      {/* Operation Forms */}
      {activeOperation === 'deposit' && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="fas fa-money-bill-wave text-bank-primary"></i>
            Deposit Money
          </h4>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter PIN"
              value={depositPin}
              onChange={(e) => setDepositPin(e.target.value)}
              className="banking-input"
              data-testid="input-deposit-pin"
            />
            <Input
              type="number"
              placeholder="Amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="banking-input"
              data-testid="input-deposit-amount"
            />
            <Button
              onClick={handleDeposit}
              disabled={depositMutation.isPending}
              className="banking-button"
              data-testid="button-deposit"
            >
              <i className="fas fa-plus-circle mr-2"></i>
              {depositMutation.isPending ? 'Processing...' : 'Deposit'}
            </Button>
          </div>
        </div>
      )}

      {activeOperation === 'withdraw' && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="fas fa-hand-holding-usd text-bank-primary"></i>
            Withdraw Money (to Wallet)
          </h4>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter PIN"
              value={withdrawPin}
              onChange={(e) => setWithdrawPin(e.target.value)}
              className="banking-input"
              data-testid="input-withdraw-pin"
            />
            <Input
              type="number"
              placeholder="Amount"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="banking-input"
              data-testid="input-withdraw-amount"
            />
            <Button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending}
              className="banking-button"
              data-testid="button-withdraw"
            >
              <i className="fas fa-wallet mr-2"></i>
              {withdrawMutation.isPending ? 'Processing...' : 'Withdraw to Wallet'}
            </Button>
          </div>
        </div>
      )}

      {activeOperation === 'transfer' && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="fas fa-exchange-alt text-bank-primary"></i>
            Transfer Money
          </h4>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter PIN"
              value={transferPin}
              onChange={(e) => setTransferPin(e.target.value)}
              className="banking-input"
              data-testid="input-transfer-pin"
            />
            <Input
              type="text"
              placeholder="Destination Account Number"
              value={transferAccount}
              onChange={(e) => setTransferAccount(e.target.value)}
              className="banking-input"
              data-testid="input-transfer-account"
            />
            <Input
              type="number"
              placeholder="Amount"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="banking-input"
              data-testid="input-transfer-amount"
            />
            <Button
              onClick={handleTransfer}
              disabled={transferMutation.isPending}
              className="banking-button"
              data-testid="button-transfer"
            >
              <i className="fas fa-paper-plane mr-2"></i>
              {transferMutation.isPending ? 'Processing...' : 'Transfer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderHistoryView = () => (
    <div className="banking-section">
      <div className="banking-section-title">
        <i className="fas fa-history"></i>
        <h3 className="text-xl font-semibold">Transaction History</h3>
      </div>
      {transactionsLoading ? (
        <div className="text-center py-8">
          <i className="fas fa-spinner fa-spin text-2xl text-bank-primary"></i>
          <p className="mt-2 text-gray-600">Loading transactions...</p>
        </div>
      ) : transactions && transactions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="banking-table" data-testid="table-transactions">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction: any) => (
                <tr key={transaction.id} data-testid={`row-transaction-${transaction.id}`}>
                  <td>{formatDate(transaction.createdAt)}</td>
                  <td>{formatTransactionType(transaction.transactionType)}</td>
                  <td className="font-semibold">₹{parseFloat(transaction.amount).toFixed(2)}</td>
                  <td>{transaction.description || '-'}</td>
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
    <>
      {/* Header */}
      <div className="banking-header flex justify-between items-center">
        <h2 className="text-3xl font-bold m-0">
          <i className="fas fa-user-circle mr-3"></i>
          Customer Dashboard
        </h2>
        <button
          onClick={handleLogout}
          className="customer-logout-btn"
          data-testid="button-logout"
        >
          <i className="fas fa-sign-out-alt"></i>
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="banking-panel">
        {/* Welcome Message */}
        <p className="text-center text-xl mb-4">
          Welcome, <span className="font-semibold text-bank-primary" data-testid="text-welcome-name">{user?.fullName}</span>!
        </p>

        {/* Balance Display */}
        <div className="balance-display" data-testid="text-main-balance">
          ₹{balanceLoading ? '...' : balance?.balance?.toFixed(2) || '0.00'}
        </div>

        {/* Wallet Balance */}
        <div className="wallet-balance-display" data-testid="text-main-wallet-balance">
          Wallet Balance: ₹{balanceLoading ? '...' : balance?.walletBalance?.toFixed(2) || '0.00'}
        </div>

        {/* Main Navigation */}
        {renderMainNavigation()}

        {/* Content Views */}
        {currentView === 'profile' && renderProfileView()}
        {currentView === 'operations' && renderOperationsView()}
        {currentView === 'history' && renderHistoryView()}

        {/* Footer Navigation */}
        <div className="footer-nav" data-testid="footer-nav">
          <button
            onClick={() => setCurrentView('profile')}
            data-testid="footer-profile"
          >
            <i className="fas fa-user"></i>
            <br />Profile
          </button>

          <button
            className="scan-btn"
            onClick={() => onShowQRScanner(true)}
            aria-label="Scan and Pay"
            title="Scan and Pay"
            data-testid="footer-scan"
          >
            <i className="fas fa-qrcode"></i>
          </button>

          <button
            onClick={() => {
              setCurrentView('profile');
              setTimeout(() => {
                const walletElement = document.querySelector('[data-testid="text-wallet-balance"]');
                if (walletElement) {
                  walletElement.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
            }}
            data-testid="footer-wallet"
          >
            <i className="fas fa-wallet"></i>
            <br />Wallet
          </button>
        </div>
      </div>
    </>
  );
}
