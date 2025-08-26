import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bankingApi } from "@/lib/banking-api";

interface QRScannerProps {
  onClose: () => void;
}

export default function QRScanner({ onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [qrCodeInput, setQrCodeInput] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // QR Generate mutation
  const generateQRMutation = useMutation({
    mutationFn: ({ amount, merchantName }: { amount?: number; merchantName?: string }) =>
      bankingApi.generateQR(amount, merchantName),
    onSuccess: (data) => {
      toast({
        title: "QR Code Generated",
        description: `QR Code: ${data.qrCode}`,
      });
      setQrCodeInput(data.qrCode);
    },
    onError: (error: any) => {
      toast({
        title: "QR Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // QR Scan/Pay mutation
  const scanQRMutation = useMutation({
    mutationFn: ({ qrCode, amount }: { qrCode: string; amount?: number }) =>
      bankingApi.scanQR(qrCode, amount),
    onSuccess: (data) => {
      toast({
        title: "Payment Successful",
        description: `Paid ₹${data.amount} to ${data.merchant}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/account/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/history'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start camera for QR scanning
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please enter QR code manually.",
        variant: "destructive",
      });
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleGenerateQR = () => {
    const amount = paymentAmount ? parseFloat(paymentAmount) : undefined;
    generateQRMutation.mutate({ 
      amount, 
      merchantName: "Demo Merchant" 
    });
  };

  const handlePayWithQR = () => {
    if (!qrCodeInput) {
      toast({
        title: "Error",
        description: "Please enter or scan a QR code",
        variant: "destructive",
      });
      return;
    }

    const amount = paymentAmount ? parseFloat(paymentAmount) : undefined;
    scanQRMutation.mutate({ qrCode: qrCodeInput, amount });
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="qr-scanner-modal" data-testid="qr-scanner-modal">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-bank-primary mb-2">
            <i className="fas fa-qrcode mr-2"></i>
            QR Scanner & Payment
          </h3>
          <p className="text-gray-600">Generate or scan QR codes for payments</p>
        </div>

        {/* Camera Section */}
        <div className="mb-6">
          <h4 className="font-semibold mb-3">Scan QR Code</h4>
          {isScanning ? (
            <div className="text-center">
              <video 
                ref={videoRef}
                className="qr-scanner-video w-full rounded-lg mb-4"
                autoPlay 
                playsInline
                data-testid="qr-video"
              />
              <Button 
                onClick={stopCamera}
                variant="outline"
                data-testid="button-stop-camera"
              >
                Stop Camera
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Position QR code in the camera view (Manual input available below)
              </p>
            </div>
          ) : (
            <Button 
              onClick={startCamera}
              className="w-full mb-4"
              data-testid="button-start-camera"
            >
              <i className="fas fa-camera mr-2"></i>
              Start Camera
            </Button>
          )}
        </div>

        {/* Manual QR Input */}
        <div className="mb-6">
          <h4 className="font-semibold mb-3">Or Enter QR Code Manually</h4>
          <Input
            type="text"
            placeholder="Enter QR Code"
            value={qrCodeInput}
            onChange={(e) => setQrCodeInput(e.target.value)}
            className="mb-3"
            data-testid="input-qr-code"
          />
        </div>

        {/* Payment Amount */}
        <div className="mb-6">
          <h4 className="font-semibold mb-3">Payment Amount (Optional)</h4>
          <Input
            type="number"
            placeholder="Enter amount"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            data-testid="input-payment-amount"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleGenerateQR}
            disabled={generateQRMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700"
            data-testid="button-generate-qr"
          >
            {generateQRMutation.isPending ? (
              <i className="fas fa-spinner fa-spin mr-2"></i>
            ) : (
              <i className="fas fa-plus-circle mr-2"></i>
            )}
            Generate QR Code
          </Button>

          <Button
            onClick={handlePayWithQR}
            disabled={scanQRMutation.isPending || !qrCodeInput}
            className="w-full"
            data-testid="button-pay-qr"
          >
            {scanQRMutation.isPending ? (
              <i className="fas fa-spinner fa-spin mr-2"></i>
            ) : (
              <i className="fas fa-credit-card mr-2"></i>
            )}
            Pay with QR Code
          </Button>

          <Button
            onClick={handleClose}
            variant="outline"
            className="w-full"
            data-testid="button-close-qr"
          >
            <i className="fas fa-times mr-2"></i>
            Close
          </Button>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
          <h5 className="font-semibold mb-1">Instructions:</h5>
          <ul className="list-disc list-inside space-y-1">
            <li>Generate QR to receive payments</li>
            <li>Scan or enter QR code to make payments</li>
            <li>Amount is optional - can be set by QR generator</li>
            <li>Payments are deducted from wallet balance</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
