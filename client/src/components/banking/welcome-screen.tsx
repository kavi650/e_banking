import { Button } from "@/components/ui/button";

interface WelcomeScreenProps {
  onNavigate: (view: 'userLogin' | 'adminLogin') => void;
}

export default function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  return (
    <>
      <div className="banking-header">
        <h1 className="text-4xl font-bold mb-2">
          <i className="fas fa-landmark mr-3"></i>
          Secure e-Banking System
        </h1>
        <p className="text-xl opacity-90">Your trusted partner in digital finance</p>
      </div>

      <div className="banking-panel text-center">
        <h2 className="text-3xl font-bold text-bank-primary mb-4">Welcome to Our Banking Portal</h2>
        <p className="text-lg text-gray-600 mb-8">Please select your login portal to continue</p>
        
        <div className="flex flex-col md:flex-row gap-4 justify-center max-w-md mx-auto">
          <Button
            onClick={() => onNavigate('userLogin')}
            className="banking-button flex items-center justify-center gap-3"
            data-testid="button-user-login"
          >
            <i className="fas fa-user text-xl"></i>
            User Login
          </Button>
          
          <Button
            onClick={() => onNavigate('adminLogin')}
            className="banking-button flex items-center justify-center gap-3"
            data-testid="button-admin-login"
          >
            <i className="fas fa-lock text-xl"></i>
            Admin Login
          </Button>
        </div>
      </div>
    </>
  );
}
