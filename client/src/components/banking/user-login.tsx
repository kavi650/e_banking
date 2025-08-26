import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { bankingApi } from "@/lib/banking-api";

interface UserLoginProps {
  onNavigate: (view: 'welcome' | 'customerDashboard') => void;
}

export default function UserLogin({ onNavigate }: UserLoginProps) {
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async () => {
    if (!mobile || !pin) {
      toast({
        title: "Error",
        description: "Please enter both mobile number and PIN",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await bankingApi.login(mobile, pin);
      toast({
        title: "Success",
        description: "Login successful!",
      });
      onNavigate('customerDashboard');
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <>
      <h2 className="text-3xl font-bold text-center py-4 bg-gradient-to-r from-bank-primary to-bank-light text-white m-0">
        <i className="fas fa-user mr-3"></i>
        User Login
      </h2>
      
      <div className="banking-panel">
        <div className="max-w-md mx-auto">
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Mobile Number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              onKeyPress={handleKeyPress}
              className="banking-input"
              data-testid="input-mobile"
            />
          </div>
          
          <div className="mb-6">
            <Input
              type="password"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyPress={handleKeyPress}
              className="banking-input"
              data-testid="input-pin"
            />
          </div>
          
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="banking-button flex items-center justify-center gap-3 mb-4"
            data-testid="button-login"
          >
            {isLoading ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className="fas fa-sign-in-alt"></i>
            )}
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
          
          <Button
            onClick={() => onNavigate('welcome')}
            className="banking-button banking-button-secondary flex items-center justify-center gap-3"
            data-testid="button-back"
          >
            <i className="fas fa-arrow-left"></i>
            Back to Home
          </Button>
        </div>
      </div>
    </>
  );
}
