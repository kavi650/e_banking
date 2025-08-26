import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  useEffect(() => {
    // Seed initial data on app start
    fetch('/api/seed-data', { method: 'POST' })
      .then(res => res.json())
      .then(data => console.log('Seed result:', data.message))
      .catch(err => console.log('Seed error (expected if data exists):', err.message));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-bank-bg to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center bg-gradient-to-r from-bank-primary to-bank-light text-white rounded-t-lg">
          <CardTitle className="text-3xl font-bold flex items-center justify-center gap-3">
            <i className="fas fa-university text-4xl"></i>
            Secure e-Banking System
          </CardTitle>
          <p className="text-lg opacity-90 mt-2">Your trusted partner in digital finance</p>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Welcome to Our Banking Portal</h2>
          <p className="text-gray-600 mb-8 text-lg">Experience secure and convenient banking with our modern digital platform</p>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                <i className="fas fa-shield-alt text-3xl text-blue-600 mb-3"></i>
                <h3 className="text-lg font-semibold text-blue-800 mb-2">Secure Banking</h3>
                <p className="text-sm text-blue-700">Advanced security measures to protect your finances</p>
              </div>
              <div className="p-6 bg-green-50 rounded-lg border-2 border-green-200">
                <i className="fas fa-mobile-alt text-3xl text-green-600 mb-3"></i>
                <h3 className="text-lg font-semibold text-green-800 mb-2">Mobile Friendly</h3>
                <p className="text-sm text-green-700">Access your account anywhere, anytime</p>
              </div>
            </div>
            
            <Link href="/banking">
              <Button 
                size="lg" 
                className="w-full text-lg py-6 bg-gradient-to-r from-bank-primary to-bank-light hover:from-bank-light hover:to-bank-primary transition-all duration-300 transform hover:-translate-y-0.5"
                data-testid="button-enter-banking"
              >
                <i className="fas fa-sign-in-alt mr-3"></i>
                Enter Banking System
              </Button>
            </Link>

            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-semibold text-yellow-800 mb-2">Demo Credentials:</h4>
              <div className="text-sm text-yellow-700 space-y-1">
                <p><strong>User:</strong> Mobile: 1234567890, PIN: 1234</p>
                <p><strong>Admin:</strong> admin@bank.com / admin123</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
