import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bankingApi } from "@/lib/banking-api";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<{ user: any }>({
    queryKey: ['/api/auth/verify'],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: () => bankingApi.logout(),
    onSuccess: () => {
      queryClient.clear();
      localStorage.removeItem('bankingToken');
    },
    onError: () => {
      // Even if logout fails, clear local data
      queryClient.clear();
      localStorage.removeItem('bankingToken');
    },
  });

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return {
    user: user?.user,
    isLoading,
    isAuthenticated: !!user?.user,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };
}
