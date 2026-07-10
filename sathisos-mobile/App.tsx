import { AuthProvider, useAuth } from './AuthContext';
import LoginScreen from './LoginScreen';
import SosScreen from './SosScreen';

function Gate() {
  const { token, loading } = useAuth();
  if (loading) return null;
  return token ? <SosScreen /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}