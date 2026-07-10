import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from './AuthContext';

// 10-digit phone number (adjust regex if you need to support country codes / other formats)
const PHONE_REGEX = /^\d{10}$/;

// At least 6 characters, containing at least one letter and one number
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const validate = (): string | null => {
    if (isRegister && !name.trim()) {
      return 'Please enter your full name.';
    }
    if (!phone.trim()) {
      return 'Please enter your phone number.';
    }
    if (!PHONE_REGEX.test(phone.trim())) {
      return 'Enter a valid 10-digit phone number.';
    }
    if (!password) {
      return 'Please enter your password.';
    }
    if (isRegister && !PASSWORD_REGEX.test(password)) {
      return 'Password must be at least 6 characters and include both letters and numbers.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Check your details', validationError);
      return;
    }

    setBusy(true);
    const result = isRegister
      ? await register(name.trim(), phone.trim(), password)
      : await login(phone.trim(), password);
    setBusy(false);

    if (!result.ok) Alert.alert('Error', result.error || 'Something went wrong');
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Sathi-SOS</Text>
      <Text style={s.subtitle}>{isRegister ? 'Create your account' : 'Sign in'}</Text>

      {isRegister && (
        <TextInput
          style={s.input}
          placeholder="Full Name"
          placeholderTextColor="#6b7280"
          value={name}
          onChangeText={setName}
        />
      )}

      <TextInput
        style={s.input}
        placeholder="Phone Number"
        placeholderTextColor="#6b7280"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={10}
      />

      <View style={s.passwordRow}>
        <TextInput
          style={s.passwordInput}
          placeholder="Password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={s.eyeBtn}
          onPress={() => setShowPassword(prev => !prev)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>

      {isRegister && (
        <Text style={s.hint}>
          Password must be 6+ characters with at least one letter and one number.
        </Text>
      )}

      <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={busy}>
        <Text style={s.btnText}>{busy ? 'Please wait...' : isRegister ? 'Register' : 'Login'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
        <Text style={s.switchText}>
          {isRegister ? 'Already have an account? Login' : 'New driver? Create account'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: '#111827', borderRadius: 12, padding: 14, color: '#fff',
    marginBottom: 12, borderWidth: 1, borderColor: '#1f2937',
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827',
    borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', marginBottom: 6,
  },
  passwordInput: { flex: 1, padding: 14, color: '#fff' },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  eyeText: { color: '#60a5fa', fontSize: 12, fontWeight: 'bold' },
  hint: { color: '#6b7280', fontSize: 11, marginBottom: 12, lineHeight: 16 },
  btn: { backgroundColor: '#dc2626', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  switchText: { color: '#60a5fa', textAlign: 'center', marginTop: 20 },
});