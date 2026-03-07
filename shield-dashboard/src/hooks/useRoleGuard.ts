import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

export function useRoleGuard(allowedRoles: string[]) {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      navigate('/unauthorized');
    }
  }, [user, allowedRoles, navigate]);

  return user;
}
