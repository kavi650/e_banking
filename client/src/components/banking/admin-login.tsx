import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { bankingApi } from "@/lib/banking-api";

interface AdminLoginProps {
  onNavigate: (view: 'welcome' | 'adminPanel') => void;
}

export default function AdminLogin({ onNavigate }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async () => {
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await bankingApi.adminLogin(email, password);
      toast({
        title: "Success",
        description: "Admin login successful!",
      });
      onNavigate('adminPanel');
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid admin credentials",
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
        <i className="fas fa-lock mr-3"></i>
        Admin Login
      </h2>
      
      <div className="banking-panel">
        <div className="max-w-md mx-auto">
          <div className="mb-4">
            <Input
              type="email"
              placeholder="Admin Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              className="banking-input"
              data-testid="input-admin-email"
            />
          </div>
          
          <div className="mb-6">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              className="banking-input"
              data-testid="input-admin-password"
            />
          </div>
          
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="banking-button flex items-center justify-center gap-3 mb-4"
            data-testid="button-admin-login"
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
            data-testid="button-back-admin"
          >
            <i className="fas fa-arrow-left"></i>
            Back to Home
          </Button>
        </div>
      </div>
    </>
  );
}
