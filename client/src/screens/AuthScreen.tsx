import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { LogIn, UserPlus, Ghost } from 'lucide-react-native';

interface AuthScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, displayName: string, password: string) => Promise<void>;
  onGuestPlay: () => Promise<void>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onRegister, onGuestPlay }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    sound.playSound('tap');
    setErrorMsg('');
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Kullanıcı adı ve şifre zorunludur');
      return;
    }
    setLoading(true);
    try {
      if (tab === 'login') {
        await onLogin(username.trim(), password.trim());
      } else {
        await onRegister(username.trim(), displayName.trim() || username.trim(), password.trim());
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Giriş yapılamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    sound.playSound('tap');
    setLoading(true);
    try {
      await onGuestPlay();
    } catch (err: any) {
      setErrorMsg(err.message || 'Misafir girişi başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'login' && styles.tabItemActive]}
            onPress={() => {
              sound.playSound('tap');
              setTab('login');
              setErrorMsg('');
            }}
          >
            <LogIn size={16} color={tab === 'login' ? '#FFF' : THEME.colors.textMuted} />
            <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Giriş Yap</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, tab === 'register' && styles.tabItemActive]}
            onPress={() => {
              sound.playSound('tap');
              setTab('register');
              setErrorMsg('');
            }}
          >
            <UserPlus size={16} color={tab === 'register' ? '#FFF' : THEME.colors.textMuted} />
            <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>Kayıt Ol</Text>
          </TouchableOpacity>
        </View>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Kullanıcı Adı</Text>
          <TextInput
            style={styles.input}
            placeholder="ör. trivia_ustasi"
            placeholderTextColor={THEME.colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        {tab === 'register' && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Görünen İsim</Text>
            <TextInput
              style={styles.input}
              placeholder="ör. Ali Veli"
              placeholderTextColor={THEME.colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Şifre</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={THEME.colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryButtonText}>{tab === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>VEYA</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.guestButton} onPress={handleGuest} disabled={loading}>
          <Ghost size={18} color={THEME.colors.textPrimary} />
          <Text style={styles.guestButtonText}>Misafir Olarak Hızlı Oyna</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    padding: THEME.spacing.lg,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.backgroundSecondary,
    borderRadius: THEME.radius.lg,
    padding: 4,
    marginBottom: THEME.spacing.lg,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
  },
  tabItemActive: {
    backgroundColor: THEME.colors.primary,
  },
  tabText: {
    color: THEME.colors.textMuted,
    fontWeight: '700',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#FFF',
  },
  errorText: {
    color: THEME.colors.wrong,
    fontSize: 13,
    marginBottom: THEME.spacing.md,
    textAlign: 'center',
    backgroundColor: THEME.colors.wrongBackground,
    padding: 8,
    borderRadius: THEME.radius.sm,
  },
  inputGroup: {
    marginBottom: THEME.spacing.md,
  },
  inputLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: THEME.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: THEME.colors.textPrimary,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: THEME.spacing.sm,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: THEME.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  dividerText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginHorizontal: 12,
    fontWeight: '700',
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.cardHover,
    borderRadius: THEME.radius.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  guestButtonText: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
