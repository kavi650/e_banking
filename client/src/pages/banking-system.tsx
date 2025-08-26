import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import WelcomeScreen from "@/components/banking/welcome-screen";
import UserLogin from "@/components/banking/user-login";
import AdminLogin from "@/components/banking/admin-login";
import CustomerDashboard from "@/components/banking/customer-dashboard";
import AdminPanel from "@/components/banking/admin-panel";
import QRScanner from "@/components/banking/qr-scanner";

type View = 'welcome' | 'userLogin' | 'adminLogin' | 'customerDashboard' | 'adminPanel';

export default function BankingSystem() {
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const { user, isLoading } = useAuth();

  // Auto-navigate based on auth state
  useEffect(() => {
    if (!isLoading) {
      if (user) {
        if (user.role === 'admin') {
          setCurrentView('adminPanel');
        } else {
          setCurrentView('customerDashboard');
        }
      } else {
        setCurrentView('welcome');
      }
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-bank-bg to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-bank-primary mb-4"></i>
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'welcome':
        return <WelcomeScreen onNavigate={setCurrentView} />;
      case 'userLogin':
        return <UserLogin onNavigate={setCurrentView} />;
      case 'adminLogin':
        return <AdminLogin onNavigate={setCurrentView} />;
      case 'customerDashboard':
        return <CustomerDashboard onNavigate={setCurrentView} onShowQRScanner={setShowQRScanner} />;
      case 'adminPanel':
        return <AdminPanel onNavigate={setCurrentView} />;
      default:
        return <WelcomeScreen onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-bank-bg to-blue-100 p-5 pb-28">
      <div className="banking-container">
        {renderCurrentView()}
      </div>
      
      {showQRScanner && (
        <QRScanner onClose={() => setShowQRScanner(false)} />
      )}
    </div>
  );
}
