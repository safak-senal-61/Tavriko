import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getRandomValues } from 'expo-crypto';
import {
  View,
  StyleSheet,
  StatusBar,
  Platform,
  AppState,
  Animated,
  ScrollView,
  useWindowDimensions,
  Text,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { useGameStore, clearAllAccountStorage } from '../store/gameStore';
import { authHeaders } from '../utils/apiAuth';
import { shuffleOptionsForPlayer } from '../utils/optionShuffle';
import { seenScopeKey, getSeenQuestionIds, markQuestionsSeen } from '../utils/seenQuestions';
import { getOfflinePracticeAnswer, requestPracticeAnswer } from '../utils/practiceAnswers';
import { socketService } from '../services/socketService';
import { sound } from '../services/soundService';
import { identifyPlayer, trackEvent, markMatchmakingStart, trackMatchFound } from '../services/analytics';
import { duelFunnelPreference, recordDuelSelection } from '../services/duelFunnel';
import { THEME } from '../theme/tokens';
import {
  CategoryId,
  DifficultyLevel,
  ClientQuestion,
  RoundResult,
  FinalMatchSummary,
  GameRoom,
  UserProfile,
  DailyChallengeConfig,
  CustomRoomSettings,
  MatchQuestionReviewItem,
  ALL_CATEGORIES,
  uniqueQuestions,
} from '@trivia/shared';
// Screens
import { SplashScreen } from '../screens/SplashScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { CategoryExploreScreen } from '../screens/CategoryExploreScreen';
import { DifficultySelectScreen } from '../screens/DifficultySelectScreen';
import { MatchmakingRadarScreen } from '../screens/MatchmakingRadarScreen';
import { DuelVersusScreen } from '../screens/DuelVersusScreen';
import { CustomRoomScreen } from '../screens/CustomRoomScreen';
import { LobbyScreen } from '../screens/LobbyScreen';
import { QuizArenaScreen, RoundFeedback } from '../screens/QuizArenaScreen';
import { AnswerFeedbackModal } from '../screens/AnswerFeedbackModal';
import { GameAlertModal } from '../components/GameAlertModal';
import { PracticeSummaryModal, PracticeStats } from '../screens/PracticeSummaryModal';
import { DailyChallengeResultModal } from '../screens/DailyChallengeResultModal';
import { IntermissionLeaderboardScreen } from '../screens/IntermissionLeaderboardScreen';
import { MatchResultPodiumScreen } from '../screens/MatchResultPodiumScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { DailyChallengeScreen } from '../screens/DailyChallengeScreen';
import { SinglePlayerPracticeScreen } from '../screens/SinglePlayerPracticeScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ReconnectScreen } from '../screens/ReconnectScreen';
import { ErrorStateScreen } from '../screens/ErrorStateScreen';
import { SeasonScreen } from '../screens/SeasonScreen';
import { ShopScreen } from '../screens/ShopScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { ProLeagueScreen } from '../screens/ProLeagueScreen';
import { compressAvatarImageAsync } from '../utils/avatarImage';
import { applyStoredPreferencesOnBoot, syncPreferencesFromAccount, loadStoredPreferences } from '../store/appPrefs';
import { useNotificationStore } from '../store/notificationStore';
import {
  subscribeNotificationNavigation,
  consumePendingNotificationRoute,
  type NotificationRoute,
} from '../services/notificationRouter';
import { NotificationToast } from '../components/NotificationUI';
import { captureReferralLink, clearPendingReferral, getPendingReferral } from '../utils/referralLink';
import { captureProfileLink, clearPendingProfileCode, getPendingProfileCode } from '../utils/profileLink';
import { captureRoomLink, clearPendingRoomCode } from '../utils/roomLink';
import { ProfileInspectModal, PublicProfileCard } from '../components/ProfileInspectModal';
import { DeveloperScreen } from '../screens/DeveloperScreen';
import { ConnectionStatusOverlay } from '../components/ConnectionStatusOverlay';
import { AnalyticsConsentBanner } from '../components/AnalyticsConsentBanner';
import type { AnalyticsConsentValue } from '../services/analyticsConsent';
import { useNetStatus, OFFLINE_GAME_GRACE_MS } from '../store/netStatus';
import { netMonitor } from '../services/netMonitor';
import { getWebLayout } from './webLayout';
export type ScreenName =
  | 'splash'
  | 'auth'
  | 'profile_setup'
  | 'home'
  | 'categories'
  | 'difficulty'
  | 'matchmaking'
  | 'duel_versus'
  | 'custom_room'
  | 'lobby'
  | 'quiz_arena'
  | 'intermission'
  | 'match_result'
  | 'friends'
  | 'profile'
  | 'profile_edit'
  | 'friend_profile'
  | 'leaderboard'
  | 'daily_challenge'
  | 'practice'
  | 'notifications'
  | 'settings'
  | 'reconnect'
  | 'error'
  | 'season'
  | 'shop'
  | 'events'
  | 'inventory'
  | 'pro_league'
  | 'developer';
import { CLOUD_BASE_URL, DEFAULT_API_BASE, getApiBaseUrl } from '../config';
import { LegalConsentGate } from '../components/LegalDocuments';
import {
  consumeGoogleLegalAck,
  isLegalUpdate,
  needsLegalConsent,
  rememberLocalConsent,
  submitLegalConsent,
} from '../utils/legalConsent';

const API_BASE = DEFAULT_API_BASE;
// 1v1 düello her zaman tüm kategorilerden karışık ve 15 soruluk oynanır. Keşfet'te en son
// seçilen kategori (selectedCategory) düelloya taşınmamalı.
const DUEL_CATEGORY: CategoryId = 'mixed';
const DUEL_DIFFICULTY = 'mixed';
const DUEL_TOTAL_ROUNDS = 15;
// İnternet kopunca oyuncunun oyunda tutulduğu koruma süresi (OFFLINE_GAME_GRACE_MS,
// store/netStatus'tan) ve bu sürenin geçerli olduğu oyun ekranları.
const GAME_SESSION_SCREENS: ScreenName[] = [
  'quiz_arena',
  'lobby',
  'intermission',
  'duel_versus',
  'matchmaking',
];
export const RootNavigator: React.FC<{ onAnalyticsDecide?: (value: AnalyticsConsentValue) => void }> = ({ onAnalyticsDecide }) => {
  const [pendingReferral, setPendingReferral] = useState(() => captureReferralLink());
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isNativeTablet = !isWeb && windowWidth > 540;

  const isWebOAuthReturn =
    isWeb &&
    typeof window !== 'undefined' &&
    (window.location.hash.includes('access_token') ||
      window.location.search.includes('access_token') ||
      window.location.search.includes('code='));

  const isWebDeveloperReturn =
    isWeb &&
    typeof window !== 'undefined' &&
    (window.location.search.includes('screen=developer') ||
      window.location.hash.includes('developer') ||
      window.location.pathname.includes('/developer'));

  const initialAuthUser = useGameStore.getState().user;
  const initialScreen: ScreenName = isWebOAuthReturn
    ? 'auth'
    : isWebDeveloperReturn
    ? 'developer'
    : initialAuthUser
    ? (initialAuthUser.isGuest ? 'categories' : pendingReferral ? 'friends' : 'home')
    : 'splash';

  const [currentScreen, setCurrentScreen] = useState<ScreenName>(initialScreen);
  const webLayout = getWebLayout(windowWidth, windowHeight, currentScreen, isWeb);
  /* KVKK: arkadaşın tam profili (salt okunur) — ayarlar/hesap bölümleri gizli */
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  // İnternet bağlantısı durumu (netMonitor besler; overlay + oyun koruma süresi)
  const netOnline = useNetStatus((s) => s.online);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('general_culture');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('medium');
  const [errorMessage, setErrorMessage] = useState<string>('');
  /** Alt kategoride soru yok uyarısı: window.alert yerine marka dilinde modal */
  const [gameAlert, setGameAlert] = useState<{ message: string; title?: string } | null>(null);
  // Guest redirect banner
  const [authRedirectNotice, setAuthRedirectNotice] = useState<string | null>(null);
  // Screen transition animation
  const screenFade = useRef(new Animated.Value(1)).current;
  const navigateTo = (nextScreen: ScreenName) => {
    if (nextScreen === currentScreenRef.current) {
      return;
    }
    if (nextScreen === 'notifications') {
      const inbox = useNotificationStore.getState();
      inbox.dismissToast();
      inbox.markAllSeen();
    }
    // Prevent screen darkening/blinking during questions or same-mode transitions
    if (nextScreen === 'quiz_arena' && currentScreenRef.current === 'quiz_arena') {
      return;
    }
    screenFade.setValue(Platform.OS === 'web' ? 0.96 : 0.88);
    setCurrentScreen(nextScreen);
    Animated.timing(screenFade, {
      toValue: 1,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  // Practice & Single-Player Mode State
  const [practiceQuestions, setPracticeQuestions] = useState<ClientQuestion[]>([]);
  const [practiceIndex, setPracticeIndex] = useState<number>(0);
  const [practiceStats, setPracticeStats] = useState<PracticeStats>({
    totalQuestions: 5,
    correctAnswers: 0,
    wrongAnswers: 0,
    emptyAnswers: 0,
    totalScore: 0,
  });
  const practiceStatsRef = useRef<PracticeStats>({
    totalQuestions: 5,
    correctAnswers: 0,
    wrongAnswers: 0,
    emptyAnswers: 0,
    totalScore: 0,
  });
  const [practiceStreak, setPracticeStreak] = useState<number>(0);
  const [practiceFeedback, setPracticeFeedback] = useState<RoundFeedback | null>(null);
  const [multiplayerFeedback, setMultiplayerFeedback] = useState<RoundFeedback | null>(null);
  const [isPracticeSummaryVisible, setIsPracticeSummaryVisible] = useState<boolean>(false);
  // Sunucunun hesaba gerçekten yazdığı maç ödülleri (ekranda aynen gösterilir)
  const [practiceRewards, setPracticeRewards] = useState<{ xp: number; coins: number; boosted: boolean; lp?: number } | null>(null);
  const [matchRewards, setMatchRewards] = useState<{ xp: number; coins: number; boosted: boolean; lp?: number } | null>(null);
  const [activeDailyConfig, setActiveDailyConfig] = useState<DailyChallengeConfig | null>(null);
  const [dailyResultModal, setDailyResultModal] = useState<{
    visible: boolean;
    success: boolean;
    correct: number;
    total: number;
    required: number;
    rewards?: any;
  } | null>(null);
  const isEvaluatingRef = useRef<boolean>(false);
  const practiceSessionIdRef = useRef('');
  // 1v1 Live Duel State
  const [duelOpponent, setDuelOpponent] = useState<{
    id: string;
    displayName: string;
    avatarUrl?: string;
    isBot?: boolean;
  } | null>(null);
  const [answeredOpponentIds, setAnsweredOpponentIds] = useState<Set<string>>(new Set());
  const [matchQuestionsReview, setMatchQuestionsReview] = useState<MatchQuestionReviewItem[]>([]);
  const matchQuestionsReviewRef = useRef<MatchQuestionReviewItem[]>([]);
  matchQuestionsReviewRef.current = matchQuestionsReview;
  const {
    user,
    token,
    setUser,
    activeRoom,
    setActiveRoom,
    currentQuestion,
    setCurrentQuestion,
    selectedOptionId,
    selectOption,
    isAnswerLocked,
    lastRoundResult,
    setRoundResult,
    finalSummary,
    setFinalSummary,
    resetGame,
  } = useGameStore();
  const isGuest = user?.isGuest === true;

  // PostHog: kullanıcı kimliği netleştiğinde analitik tarafında tanımla
  useEffect(() => {
    if (user?.id) {
      identifyPlayer(user.id, {
        displayName: user.displayName,
        username: user.username,
        isGuest: !!user.isGuest,
      });
    }
  }, [user?.id]);

  // Merge a fresh server-side user profile into the current store (keeps token)
  const syncWithFreshUser = useCallback(
    (fresh: UserProfile) => {
      if (!fresh) return;
      const current = useGameStore.getState().user;
      let preservedAvatar = fresh.avatarUrl;
      const currentHasCustomPhoto =
        current?.avatarUrl &&
        (current.avatarUrl.startsWith('data:') ||
          current.avatarUrl.startsWith('http') ||
          current.avatarUrl.startsWith('blob:') ||
          current.avatarUrl.startsWith('file:'));
      if (
        currentHasCustomPhoto &&
        (!fresh.avatarUrl || fresh.avatarUrl === 'av1' || fresh.avatarUrl === 'av_1' || fresh.avatarUrl === 'custom')
      ) {
        preservedAvatar = current.avatarUrl;
      }
      // Bazı profil uçları settings alanını kısmi döndürür; yasal onay kaydı kaybolmasın.
      const currentConsent = (current?.settings as any)?.legalConsent;
      const freshSettings = fresh.settings
        ? { ...fresh.settings, ...(currentConsent && !(fresh.settings as any).legalConsent ? { legalConsent: currentConsent } : {}) }
        : current?.settings;
      setUser({ ...(current || {}), ...fresh, settings: freshSettings, avatarUrl: preservedAvatar } as UserProfile);
    },
    [setUser]
  );

  // ===== Yasal metin onayı (Google ile ilk giriş, metin güncellemeleri) =====
  const [legalSubmitting, setLegalSubmitting] = useState(false);
  const [legalGateError, setLegalGateError] = useState<string | null>(null);
  const [autoLegalInFlight, setAutoLegalInFlight] = useState(false);
  const autoGoogleConsentTriedRef = useRef<string | null>(null);
  const realSessionToken = token && token !== 'mock_token' ? token : null;
  useEffect(() => {
    if (!user?.id || user.isGuest || !realSessionToken) return;
    const controller = new AbortController();
    void duelFunnelPreference(getApiBaseUrl(), user.id, realSessionToken, undefined, controller.signal).catch(() => {});
    return () => controller.abort();
  }, [user?.id, user?.isGuest, realSessionToken]);
  const showLegalGate =
    Boolean(realSessionToken) && currentScreen !== 'auth' && currentScreen !== 'splash' && needsLegalConsent(user, isGuest);

  const acceptLegal = useCallback(
    async (method: 'google' | 'in_app') => {
      const current = useGameStore.getState();
      if (!current.user || !current.token) return;
      setLegalSubmitting(true);
      setLegalGateError(null);
      try {
        const updated = await submitLegalConsent(API_BASE, current.token, method);
        rememberLocalConsent(current.user.id);
        if (updated) syncWithFreshUser(updated);
        else setUser({ ...current.user } as UserProfile);
      } catch (err: any) {
        setLegalGateError(err?.message || 'Onay kaydedilemedi. Lütfen tekrar dene.');
      } finally {
        setLegalSubmitting(false);
      }
    },
    [syncWithFreshUser, setUser]
  );

  // Google butonunun altındaki bildirimle giriş yapıldıysa onayı otomatik kaydet.
  useEffect(() => {
    if (!showLegalGate || !user?.id || autoGoogleConsentTriedRef.current === user.id) return;
    autoGoogleConsentTriedRef.current = user.id;
    if (consumeGoogleLegalAck()) {
      setAutoLegalInFlight(true);
      void acceptLegal('google').finally(() => setAutoLegalInFlight(false));
    }
  }, [showLegalGate, user?.id, acceptLegal]);

  const refreshUserProfile = useCallback(async () => {
    const current = useGameStore.getState();
    if (!current.user || current.user.isGuest) return;
    const owner = current.user.id;
    try {
      const response = await fetch(`${API_BASE}/social/profile/${encodeURIComponent(owner)}`, {
        headers: current.token ? { Authorization: `Bearer ${current.token}` } : {},
      });
      const fresh = response.ok ? await response.json() : null;
      if (fresh?.id === owner && useGameStore.getState().user?.id === owner) syncWithFreshUser(fresh);
    } catch {}
  }, [syncWithFreshUser]);

  // One inbox for every screen: HTTP reconnect snapshots and socket arrivals
  // share the same IDs, read receipts and exact badge count.
  useEffect(() => {
    const owner = user && !isGuest ? user.id : null;
    const inbox = useNotificationStore.getState();
    inbox.activate(owner, user?.notifications);
    if (!owner) return;
    const refresh = () => {
      if (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden) {
        void useNotificationStore.getState().refresh(API_BASE);
      }
    };
    refresh();
    const unsubPresence = socketService.on('presence:connected', refresh);
    const interval = setInterval(refresh, 60000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('focus', refresh);
    return () => {
      clearInterval(interval);
      unsubPresence();
      subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('focus', refresh);
    };
  }, [user?.id, isGuest]);

  const currentQuestionRef = useRef<ClientQuestion | null>(currentQuestion);
  currentQuestionRef.current = currentQuestion;

  const isGameActiveRef = useRef<boolean>(false);
  const gameTimersRef = useRef<Set<any>>(new Set());

  const scheduleGameTimeout = useCallback((cb: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      gameTimersRef.current.delete(timer);
      cb();
    }, delayMs);
    gameTimersRef.current.add(timer);
    return timer;
  }, []);

  const clearAllGameTimers = useCallback(() => {
    gameTimersRef.current.forEach((t) => clearTimeout(t));
    gameTimersRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      clearAllGameTimers();
    };
  }, [clearAllGameTimers]);

  const activeRoomRef = useRef<GameRoom | null>(activeRoom);
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  const [isSinglePlayerActive, setIsSinglePlayerActive] = useState<boolean>(false);
  const isSinglePlayerActiveRef = useRef<boolean>(false);
  useEffect(() => {
    isSinglePlayerActiveRef.current = isSinglePlayerActive;
  }, [isSinglePlayerActive]);

  const currentScreenRef = useRef<ScreenName>(currentScreen);
  currentScreenRef.current = currentScreen;

  useEffect(() => {
    const capture = (url?: string | null) => {
      const value = captureReferralLink(url);
      if (value) {
        setPendingReferral(value);
        const account = useGameStore.getState().user;
        if (account && !account.isGuest) navigateTo('friends');
      }
      // Paylaşılan profil bağlantısını yakala
      const profileCode = captureProfileLink(url);
      if (profileCode) setSharedProfileCode(profileCode);
      // Paylaşılan özel oda bağlantısını (?oda=KOD) yakala
      const roomCode = captureRoomLink(url);
      if (roomCode) setSharedRoomCode(roomCode);
    };
    void Linking.getInitialURL().then(capture).catch(() => {});
    const sub = Linking.addEventListener('url', event => capture(event.url));
    return () => sub.remove();
  }, []);

  // --- Paylaşılan profil bağlantısı (?profil=KOD) ---
  const [sharedProfileCode, setSharedProfileCode] = useState<string | null>(() => captureProfileLink());
  // --- Paylaşılan özel oda bağlantısı (?oda=KOD) ---
  const [sharedRoomCode, setSharedRoomCode] = useState<string | null>(() => captureRoomLink());
  const sharedRoomHandledRef = useRef<string | null>(null);
  const [sharedProfile, setSharedProfile] = useState<PublicProfileCard | null>(null);
  const [sharedProfileLoading, setSharedProfileLoading] = useState(false);
  const sharedProfileHandledRef = useRef<string | null>(null);
  useEffect(() => {
    const code = sharedProfileCode || getPendingProfileCode();
    if (!code || !user || isGuest || sharedProfileHandledRef.current === code) return;
    sharedProfileHandledRef.current = code;
    setSharedProfileLoading(true);
    fetch(`${API_BASE}/social/users/by-code/${encodeURIComponent(code)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((p) => {
        if (p && p.id) setSharedProfile(p);
        clearPendingProfileCode();
      })
      .catch(() => {})
      .finally(() => setSharedProfileLoading(false));
  }, [sharedProfileCode, user, isGuest]);
  // Keep system status bar completely hidden in fullscreen mode without triggering re-layouts on screen changes
  useEffect(() => {
    StatusBar.setHidden(true, 'none');
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        StatusBar.setHidden(true, 'none');
      }
    });
    return () => sub.remove();
  }, []);

  // Yetkili sunucu senkronizasyonu: Uygulama açılışında bir kez PostgreSQL'den güncel profili çeker
  const hasInitialProfileFetchedRef = useRef(false);
  useEffect(() => {
    if (!hasInitialProfileFetchedRef.current && user && !isGuest && user.id) {
      hasInitialProfileFetchedRef.current = true;
      fetch(`${API_BASE}/social/profile/${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((freshUser) => {
          if (freshUser && freshUser.id === user.id) {
            // Eğer sunucudan varsayılan av1 dönerse ama yerelde kullanıcının seçtiği özel bir avatar varsa, yerel avatarı koru ve sunucuya bildir
            if (
              user.avatarUrl &&
              user.avatarUrl !== 'av1' &&
              user.avatarUrl !== 'av_1' &&
              (!freshUser.avatarUrl || freshUser.avatarUrl === 'av1' || freshUser.avatarUrl === 'av_1')
            ) {
              freshUser.avatarUrl = user.avatarUrl;
              // Sunucu veritabanını da bu avatar ile hemen kalıcı güncelle
              fetch(`${API_BASE}/auth/profile`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  userId: user.id,
                  avatarUrl: user.avatarUrl,
                }),
              }).catch(() => {});
            }
            setUser(freshUser);
          }
        })
        .catch(() => {});
    }
  }, []);
  // Apply stored user preferences (sound, music, haptics) once at app boot
  useEffect(() => {
    applyStoredPreferencesOnBoot();
  }, []);
  // Hesaba giriş yapılınca (yeni cihaz dahil) hesaptaki tercihleri uygula
  useEffect(() => {
    if (user?.id && user.settings) syncPreferencesFromAccount(user.settings as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  // Helper to gate non-Keşfet features when in Guest Mode
  const requireAuth = (action: () => void, featureName: string) => {
    if (isGuest || !user) {
      sound.playSound('wrong');
      sound.triggerHaptic('warning');
      setAuthRedirectNotice(
        `"${featureName}" menüsü için giriş yapmalısın! Misafir modunda sadece Keşfet kategorilerinde oynanabilir.`
      );
      navigateTo('auth');
      return;
    }
    action();
  };
  // Socket event subscription for multiplayer (only active when logged in)
  useEffect(() => {
    if (!user) {
      socketService.disconnect();
      return;
    }

    socketService.setAuthToken(token);
    const connectPresence = () => socketService.connectPresence(user.id, user.displayName, user.avatarUrl);
    const presenceAppState = AppState.addEventListener('change', state => {
      if (state === 'active') connectPresence();
    });

    const sendBackendHeartbeat = () => {
      if (!user?.id) return;
      fetch(`${API_BASE}/social/presence/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          inRoom: Boolean(activeRoomRef.current?.code),
          roomCode: activeRoomRef.current?.code || null,
        }),
      }).catch(() => {});
    };
    sendBackendHeartbeat();

    const unsubSync = socketService.onStateSync((room: GameRoom) => {
      if (isSinglePlayerActiveRef.current) return;
      if (!isGameActiveRef.current && !activeRoomRef.current) return;
      // If user was in room but removed from room.players, user was kicked!
      if (user && activeRoomRef.current && !room.players[user.id] && currentScreenRef.current === 'lobby') {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        handleExitCurrentGame();
        return;
      }
      setActiveRoom(room);
      activeRoomRef.current = room;
      if (user && !isGuest && room.mode !== 'duel' && room.mode !== 'quick_match') {
        const playerCount = Object.values(room.players || {}).filter((p) => !p.isBot && p.isConnected !== false).length;
        const hostPlayer = room.players?.[room.hostId] || Object.values(room.players || {})[0];
        fetch(`${API_BASE}/social/rooms/active`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            userId: user.id,
            roomCode: room.code,
            hostName: hostPlayer?.displayName || user.displayName,
            category: room.category,
            players: playerCount,
            maxPlayers: room.maxPlayers,
            totalRounds: room.totalRounds,
            questionTimeSec: room.questionTimeSec,
            status: room.status === 'lobby' ? 'lobby' : 'playing',
          }),
        }).catch(() => {});
      }
      if (
        room.status === 'lobby' &&
        currentScreenRef.current !== 'lobby' &&
        currentScreenRef.current !== 'duel_versus'
      ) {
        navigateTo('lobby');
      }
    });
    const unsubQuestion = socketService.onQuestionStart((question: ClientQuestion) => {
      if (isSinglePlayerActiveRef.current) return;
      if (!isGameActiveRef.current && !activeRoomRef.current) return;
      const state = useGameStore.getState();
      const isSameRound = state.currentQuestion?.id === question.id &&
        state.currentQuestion.roundNumber === question.roundNumber;
      // Her oyuncunun şıkları kendi ekranında farklı sırada görünür. Cevaplar
      // şık ID'si ile gönderilip ID ile değerlendirildiği için bu güvenlidir;
      // tohum oyuncu+soru olduğundan yeniden bağlanınca sıra değişmez.
      setCurrentQuestion({
        ...question,
        options: shuffleOptionsForPlayer(
          question.options,
          user?.id || 'guest',
          `${question.id}-${question.roundNumber}`
        ),
      }, isSameRound);
      if (isSameRound) return; // Reconnect: sync the timer, but keep the selected answer.
      setRoundResult(null);
      setMultiplayerFeedback(null);
      const me = user && activeRoomRef.current?.players[user.id];
      selectOption(me?.hasAnsweredCurrentRound && activeRoomRef.current?.currentRound === question.roundNumber
        ? me.lastSelectedOptionId ?? null : null);
      setAnsweredOpponentIds(new Set());
      if (currentScreenRef.current !== 'quiz_arena') {
        navigateTo('quiz_arena');
      }
    });
    const unsubRoundResult = socketService.onRoundResult((result: RoundResult) => {
      if (isSinglePlayerActiveRef.current) return;
      if (!isGameActiveRef.current && !activeRoomRef.current) return;
      setRoundResult(result);
      const myAns = user ? result.playerAnswers[user.id] : null;

      const rawPts = myAns?.pointsEarned ?? 0;
      const normPts = rawPts > 300 ? Math.round(rawPts / 10) : Math.max(0, Math.round(rawPts));
      const rawSpd = myAns?.speedBonus ?? 0;
      const normSpd = rawSpd > 100 ? Math.round(rawSpd / 10) : Math.max(0, Math.round(rawSpd));

      // Anlık doğru/yanlış ve bilgi açıklamasını QuizArenaScreen'e anında ver
      const multiFeedback: RoundFeedback = {
        isCorrect: myAns?.isCorrect ?? false,
        isTimeout: !myAns?.selectedOptionId,
        correctOptionId: result.correctOptionId,
        explanation: result.explanation || '',
        pointsAwarded: normPts,
        speedBonus: normSpd,
        streak: myAns?.streak ?? 0,
      };
      setMultiplayerFeedback(multiFeedback);

      // Maç sonu için yapılan doğru/yanlış/boş soru detaylarını kaydet
      if (user && currentQuestionRef.current) {
        const userOpt = currentQuestionRef.current.options?.find((o) => o.id === myAns?.selectedOptionId);
        const correctOpt = currentQuestionRef.current.options?.find((o) => o.id === result.correctOptionId);

        const reviewItem: MatchQuestionReviewItem = {
          roundNumber: result.roundNumber,
          questionText: currentQuestionRef.current.text,
          userAnswerText: userOpt ? userOpt.text : undefined,
          correctAnswerText: correctOpt ? correctOpt.text : result.correctOptionId || '',
          isCorrect: myAns?.isCorrect ?? false,
          isTimeout: !myAns?.selectedOptionId,
          pointsEarned: normPts,
          explanation: result.explanation,
        };
        setMatchQuestionsReview((prev) => {
          const withoutDup = prev.filter((item) => item.roundNumber !== result.roundNumber);
          return [...withoutDup, reviewItem];
        });
      }

      if (myAns?.isCorrect) {
        sound.playSound('correct');
        sound.triggerHaptic('success');
      } else {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
      }
    });
    const unsubGameOver = socketService.onGameOver((summary: FinalMatchSummary) => {
      if (!isGameActiveRef.current && !activeRoomRef.current) return;
      isGameActiveRef.current = false;
      const enrichedSummary: FinalMatchSummary = {
        ...summary,
        questionReviews: matchQuestionsReviewRef.current,
      };
      setFinalSummary(enrichedSummary);
      // PostHog: maç tamamlandı — tamamlama oranı ve sonuç dağılımı
      const myRanking = summary.rankings.find((r) => r.playerId === user?.id);
      trackEvent('match_completed', {
        mode: summary.mode,
        result: myRanking ? (summary.podium.first?.playerId === user?.id ? 'win' : 'loss') : 'abandoned',
        question_count: summary.totalRounds,
        my_score: myRanking?.score ?? 0,
      });
      navigateTo('match_result');
      if (user && !isGuest) {
        setMatchRewards(null);
        // Galibiyet, dereceli maç ve LP/XP sunucuda hesaplanır; istemci yalnızca oda kodunu
        // söyler ve sunucunun yazdığı ödülü okur. Sunucu özeti işleyene kadar kısa aralıklarla sorar.
        const fetchServerRewards = (attempt: number) => {
          fetch(`${API_BASE}/auth/stats`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(useGameStore.getState().token ? { Authorization: `Bearer ${useGameStore.getState().token}` } : {}),
            },
            body: JSON.stringify({ mode: 'multiplayer', roomCode: summary.roomCode }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data?.pending) {
                if (attempt < 8) setTimeout(() => fetchServerRewards(attempt + 1), 1500);
                return;
              }
              if (data?.user) {
                setUser(data.user);
              }
              if (data?.rewards && !(data.rewards.alreadyRecorded && !data.rewards.xp && !data.rewards.lp)) {
                setMatchRewards({
                  xp: data.rewards.xp,
                  coins: data.rewards.coins,
                  boosted: !!data.rewards.boosted,
                  lp: typeof data.rewards.lp === 'number' ? data.rewards.lp : undefined,
                });
              }
            })
            .catch(() => {
              if (attempt < 3) setTimeout(() => fetchServerRewards(attempt + 1), 2000);
            });
        };
        fetchServerRewards(0);
      }
    });
    const unsubMatchFound = socketService.onMatchFound(
      (data: { roomCode: string; opponent?: any }) => {
        // Kullanıcı eşleşmeyi zaten iptal ettiyse / oyundan çıktıysa
        // geç gelen eşleşme bildirimini yok say (çıkıştan sonra tekrar oyuna atma)
        if (!isGameActiveRef.current) {
          socketService.cancelMatch(user?.id || '');
          return;
        }
        if (user) {
          isGameActiveRef.current = true;
          setMatchQuestionsReview([]);
          setDuelOpponent(data.opponent || null);
          setAnsweredOpponentIds(new Set());
          const opp = data.opponent;
          const initialPlayers: Record<string, any> = {
            [user.id]: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl || 'av1',
              score: 0,
              currentStreak: 0,
              isReady: true,
              isHost: true,
              isConnected: true,
              hasAnsweredCurrentRound: false,
              totalResponseTimeMs: 0,
              correctAnswersCount: 0,
            },
          };
          const initialScores: Record<string, number> = { [user.id]: 0 };
          if (opp && opp.id) {
            initialPlayers[opp.id] = {
              id: opp.id,
              username: opp.username || opp.displayName || 'Rakip',
              displayName: opp.displayName || 'Rakip',
              avatarUrl: opp.avatarUrl || 'av2',
              score: 0,
              currentStreak: 0,
              isReady: true,
              isHost: false,
              isConnected: true,
              hasAnsweredCurrentRound: false,
              totalResponseTimeMs: 0,
              correctAnswersCount: 0,
              isBot: !!opp.isBot,
            };
            initialScores[opp.id] = 0;
          }
          const duelRoom: GameRoom = {
            code: data.roomCode,
            mode: 'duel',
            hostId: user.id,
            status: 'countdown',
            category: DUEL_CATEGORY,
            difficulty: selectedDifficulty,
            maxPlayers: 2,
            currentRound: 0,
            totalRounds: DUEL_TOTAL_ROUNDS,
            questionTimeSec: 15,
            penaltyForWrong: false,
            players: initialPlayers,
            scores: initialScores,
          };
          setActiveRoom(duelRoom);
          activeRoomRef.current = duelRoom;
          // PostHog: eşleşme süresi + maç başladı event'i
          trackMatchFound(opp?.isBot ? 'bot' : 'human');
          trackEvent('match_started', {
            mode: 'duel',
            category: DUEL_CATEGORY,
            source: 'quick_match',
            matchedWith: opp?.isBot ? 'bot' : 'human',
          });
          socketService.joinRoom(
            data.roomCode,
            user.id,
            user.displayName,
            user.avatarUrl
          );
          navigateTo('duel_versus');
        }
      }
    );
    const unsubPlayerAnswered = socketService.onPlayerAnswered(
      (data: { playerId: string }) => {
        if (!isGameActiveRef.current && !activeRoomRef.current) return;
        if (data.playerId !== user?.id) {
          setAnsweredOpponentIds(prev => prev.has(data.playerId) ? prev : new Set(prev).add(data.playerId));
          sound.playSound('timer_tick');
        }
      }
    );

    const unsubNotif = socketService.on('notification:new', (notif: any) => {
      const inbox = useNotificationStore.getState();
      // Gönderen, kendi gönderdiği isteğin bildirimini asla görmemeli
      if (notif?.senderId && notif.senderId === user?.id) return;
      if (inbox.userId !== user.id || !inbox.receive(notif)) return;
      sound.playSound('reward');
      sound.triggerHaptic('success');
      if (currentScreenRef.current === 'notifications') inbox.dismissToast();
      void refreshUserProfile();
    });
    const unsubNotifUpdate = socketService.on('notification:update', (data: { id: string; handled: 'accepted' | 'declined' }) => {
      if (data?.id && (data.handled === 'accepted' || data.handled === 'declined')) {
        useNotificationStore.getState().patch(data.id, { handled: data.handled });
      }
    });

    const unsubFriendsSync = socketService.on('friends:update', () => {
      refreshUserProfile();
    });

    const heartbeatInterval = setInterval(() => {
      sendBackendHeartbeat();
    }, 20000);
    connectPresence();

    return () => {
      unsubSync();
      unsubQuestion();
      unsubRoundResult();
      unsubGameOver();
      unsubMatchFound();
      unsubPlayerAnswered();
      unsubNotif();
      unsubNotifUpdate();
      unsubFriendsSync();
      presenceAppState.remove();
      clearInterval(heartbeatInterval);
    };
  }, [user?.id, user?.displayName, user?.avatarUrl, token, isGuest, scheduleGameTimeout]);
  // -------------------------------------------------------------
  // Auth & Profile Actions
  // -------------------------------------------------------------
  const handleGuestPlay = async () => {
    setAuthRedirectNotice(null);
    if (useGameStore.getState().user?.isGuest) {
      navigateTo('categories');
      return;
    }
    const fallbackUser: UserProfile = {
      id: 'guest_local_' + Math.random().toString(36).substring(2, 7),
      username: 'misafir_oyuncu',
      displayName: 'Misafir Oyuncu',
      avatarUrl: 'av0',
      isGuest: true,
      level: 1,
      xp: 0,
      coins: 200,
      rankTitle: 'Misafir Kaşif',
      rankPoints: 1000,
      stats: {
        totalMatches: 0,
        wins: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        bestStreak: 0,
        avgResponseTimeMs: 0,
      },
      categoryMastery: {},
    };
    // Persist the choice before the network request so a quick reload resumes Keşfet.
    setUser(fallbackUser, 'mock_token');
    navigateTo('categories');
    try {
      const res = await fetch(`${API_BASE}/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: fallbackUser.displayName }),
      });
      if (!res.ok) return;
      const data = await res.json();
      // Do not overwrite a real account that signed in while the guest request was pending.
      if (data.user && data.token && useGameStore.getState().user?.id === fallbackUser.id) {
        setUser({
          ...data.user,
          displayName: fallbackUser.displayName,
          avatarUrl: fallbackUser.avatarUrl,
          isGuest: true,
        }, data.token);
      }
    } catch {
      // The local guest can continue when the guest endpoint is unavailable.
    }
  };
  const handleAuthSuccess = (loggedInUser: UserProfile, token: string) => {
    setAuthRedirectNotice(null);
    setUser(loggedInUser, token);
    const referral = getPendingReferral();
    setPendingReferral(referral);
    navigateTo(referral ? 'friends' : 'home');
  };
  const handleSaveProfile = async (name: string, rawAvatarSeedOrUri: string) => {
    if (user) {
      // Compress picked profile photos so DB rows, REST payloads and realtime
      // messages stay tiny (the WS URL itself only ever gets a sanitized seed)
      const avatarSeedOrUri = await compressAvatarImageAsync(rawAvatarSeedOrUri);
      const updatedLocal = {
        ...user,
        displayName: name,
        avatarUrl: avatarSeedOrUri,
      };
      setUser(updatedLocal);
      try {
        const res = await fetch(`${API_BASE}/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            userId: user.id,
            displayName: name,
            avatarUrl: avatarSeedOrUri,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) setUser({ ...data.user, avatarUrl: avatarSeedOrUri });
        }
      } catch (err) {
        console.warn('Profile update error:', err);
      }
    }
    navigateTo(isGuest ? 'categories' : 'home');
  };
  const handleUpdateAvatarDirect = async (rawAvatarUri: string) => {
    const newAvatarUri = await compressAvatarImageAsync(rawAvatarUri);
    if (user) {
      setUser({
        ...user,
        avatarUrl: newAvatarUri,
      });
      try {
        const res = await fetch(`${API_BASE}/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            userId: user.id,
            avatarUrl: newAvatarUri,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) setUser(data.user);
        }
      } catch (err) {
        console.warn('Direct avatar update error:', err);
      }
    }
  };
  // -------------------------------------------------------------
  // Matchmaking & Room Actions
  // -------------------------------------------------------------
  const handleExitCurrentGame = useCallback(() => {
    isGameActiveRef.current = false;
    setIsSinglePlayerActive(false);
    isSinglePlayerActiveRef.current = false;
    clearAllGameTimers();

    if (activeRoomRef.current && user) {
      socketService.leaveRoom(activeRoomRef.current.code, user.id);
    }
    if (user) {
      socketService.cancelMatch(user.id);
    }
    activeRoomRef.current = null;
    setActiveRoom(null);

    if (user && !isGuest) {
      fetch(`${API_BASE}/social/rooms/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId: user.id, roomCode: null }),
      }).catch(() => {});
    }

    setDuelOpponent(null);
    setAnsweredOpponentIds(new Set());
    setMultiplayerFeedback(null);
    setPracticeQuestions([]);
    setPracticeIndex(0);
    setPracticeStreak(0);
    setPracticeFeedback(null);
    setActiveDailyConfig(null);
    setDailyResultModal(null);
    setIsPracticeSummaryVisible(false);
    isEvaluatingRef.current = false;
    practiceSessionIdRef.current = '';

    const clearedStats: PracticeStats = {
      totalQuestions: 5,
      correctAnswers: 0,
      wrongAnswers: 0,
      emptyAnswers: 0,
      totalScore: 0,
    };
    practiceStatsRef.current = clearedStats;
    setPracticeStats(clearedStats);

    resetGame();

    navigateTo(isGuest ? 'categories' : 'home');
  }, [user, isGuest, clearAllGameTimers, resetGame]);

  // -------------------------------------------------------------
  // İnternet kopması: uygulama genelinde bildirim + oyun koruma süresi
  // -------------------------------------------------------------
  // İnternet koptuğunda oyuncu hemen düşürülmez: oyun ekranlarında
  // OFFLINE_GAME_GRACE_MS boyunca oyunda kalır (üstteki şık kapsül geri sayar).
  // Süre dolarsa ve bağlantı hâlâ yoksa oyundan çıkarılır ve Yeniden Bağlan
  // ekranına yönlendirilir. Bağlantı dönerse süre iptal edilir ve socket
  // otomatik olarak aynı oturuma geri bağlanır.
  useEffect(() => {
    netMonitor.start();
  }, []);

  useEffect(() => {
    const netStore = useNetStatus.getState();
    if (netOnline) {
      netStore.setGraceEndsAt(null);
      socketService.ensureConnected();
      return;
    }
    if (!GAME_SESSION_SCREENS.includes(currentScreen)) {
      netStore.setGraceEndsAt(null);
      return;
    }
    netStore.setGraceEndsAt(Date.now() + OFFLINE_GAME_GRACE_MS);
    const kickTimer = setTimeout(() => {
      if (useNetStatus.getState().online) return;
      // Bu sürede oyuncu oyundan manuel ayrıldıysa düşürme
      if (!GAME_SESSION_SCREENS.includes(currentScreenRef.current)) {
        useNetStatus.getState().setGraceEndsAt(null);
        return;
      }
      sound.triggerHaptic('warning');
      handleExitCurrentGame();
      navigateTo('reconnect');
    }, OFFLINE_GAME_GRACE_MS + 250);
    return () => clearTimeout(kickTimer);
  }, [netOnline, currentScreen, handleExitCurrentGame]);


  const handleStartQuickMatch = () => {
    requireAuth(() => {
      if (!user) return;
      if (realSessionToken) recordDuelSelection(getApiBaseUrl(), user.id, realSessionToken);
      isGameActiveRef.current = true;
      setDuelOpponent(null);
      setAnsweredOpponentIds(new Set());
      markMatchmakingStart();
      socketService.findMatch(
        user.id,
        user.displayName,
        user.avatarUrl,
        'duel',
        DUEL_CATEGORY,
        DUEL_DIFFICULTY
      );
      navigateTo('matchmaking');
    }, 'Hızlı Eşleşme (1v1 Düello)');
  };
  const handleCancelMatchmaking = () => {
    handleExitCurrentGame();
  };
  const handleCreateCustomRoom = (settings?: CustomRoomSettings, forcedCode?: string) => {
    requireAuth(() => {
      if (!user) return;
      isGameActiveRef.current = true;
      const roomCode = (forcedCode || Math.random().toString(36).substring(2, 8)).toUpperCase();
      const initialRoom: GameRoom = {
        code: roomCode,
        mode: 'friends_private',
        hostId: user.id,
        status: 'lobby',
        category: settings?.mixedCategories ? 'mixed' : (settings?.categories?.[0] || 'general_culture'),
        subCategory: settings?.subCategory,
        difficulty: settings?.difficulty && settings.difficulty !== 'mixed' ? settings.difficulty : 'medium',
        maxPlayers: settings?.maxPlayers || 4,
        currentRound: 0,
        totalRounds: settings?.totalRounds || 7,
        questionTimeSec: settings?.questionTimeSec || 20,
        penaltyForWrong: settings?.penaltyForWrong ?? true,
        players: {
          [user.id]: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl || 'av1',
            score: 0,
            currentStreak: 0,
            isReady: true,
            isHost: true,
            isConnected: true,
            hasAnsweredCurrentRound: false,
            totalResponseTimeMs: 0,
            correctAnswersCount: 0,
          },
        },
        scores: { [user.id]: 0 },
      };
      setActiveRoom(initialRoom);
      activeRoomRef.current = initialRoom;
      socketService.createRoom(roomCode, user.id, user.displayName, user.avatarUrl, settings);

      if (!isGuest) {
        fetch(`${API_BASE}/social/rooms/active`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            userId: user.id,
            roomCode,
            hostName: user.displayName,
            category: initialRoom.category,
            players: 1,
            maxPlayers: initialRoom.maxPlayers,
            totalRounds: initialRoom.totalRounds,
            questionTimeSec: initialRoom.questionTimeSec,
            status: 'lobby',
            privacy: settings?.privacy || 'public',
          }),
        }).catch(() => {});
      }

      navigateTo('lobby');
    }, 'Özel Oda');
  };
  const handleJoinCustomRoom = (code: string, password?: string) => {
    requireAuth(() => {
      if (!user) return;
      isGameActiveRef.current = true;
      const cleanCode = code.trim().toUpperCase();
      if (!activeRoom || activeRoom.code !== cleanCode) {
        const placeholderRoom: GameRoom = {
          code: cleanCode,
          mode: 'friends_private',
          hostId: 'host_pending',
          status: 'lobby',
          category: 'general_culture',
          difficulty: 'medium',
          maxPlayers: 4,
          currentRound: 0,
          totalRounds: 7,
          questionTimeSec: 20,
          penaltyForWrong: true,
          players: {
            [user.id]: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl || 'av1',
              score: 0,
              currentStreak: 0,
              isReady: false,
              isHost: false,
              isConnected: true,
              hasAnsweredCurrentRound: false,
              totalResponseTimeMs: 0,
              correctAnswersCount: 0,
            },
          },
          scores: { [user.id]: 0 },
        };
        setActiveRoom(placeholderRoom);
        activeRoomRef.current = placeholderRoom;
      }
      socketService.joinRoom(cleanCode, user.id, user.displayName, user.avatarUrl, password);

      if (!isGuest) {
        fetch(`${API_BASE}/social/rooms/active`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ userId: user.id, roomCode: cleanCode }),
        }).catch(() => {});
      }

      navigateTo('lobby');
    }, 'Özel Odaya Katılma');
  };

  // --- Push bildirimi yönlendirmesi (dokunuş / eylem butonu) ---
  // Bildirime veya "Sende Ekle" / "Düelloya Katıl" butonuna dokununca
  // ilgili sayfaya gidilir; düello davetinde doğrudan odaya katılım yapılır.
  // Cold start (uygulama bildirimle açıldı) rotası, kullanıcı hazır olduğunda işlenir.
  useEffect(() => {
    const applyNotificationRoute = (route: NotificationRoute) => {
      if (route.clearInboxBadge) {
        const inbox = useNotificationStore.getState();
        inbox.dismissToast();
        inbox.markAllSeen();
      }
      if (route.roomCode && user && !user.isGuest) {
        handleJoinCustomRoom(route.roomCode);
        return;
      }
      navigateTo(route.screen);
    };
    if (user) {
      const pending = consumePendingNotificationRoute();
      if (pending) applyNotificationRoute(pending);
    }
    return subscribeNotificationNavigation(applyNotificationRoute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.isGuest]);

  // --- Paylaşılan oda bağlantısından otomatik katılım (?oda=KOD) ---
  useEffect(() => {
    if (!sharedRoomCode || !user || isGuest) return;
    if (sharedRoomHandledRef.current === sharedRoomCode) return;
    if (activeRoomRef.current) return; // zaten bir odada
    sharedRoomHandledRef.current = sharedRoomCode;
    const code = sharedRoomCode;
    setSharedRoomCode(null);
    clearPendingRoomCode();
    handleJoinCustomRoom(code);
  }, [sharedRoomCode, user, isGuest]);
  const handleToggleReady = () => {
    if (activeRoom && user) {
      socketService.toggleReady(activeRoom.code, user.id);
    }
  };
  const handleStartGame = () => {
    setMatchQuestionsReview([]);
    if (activeRoom && user) {
      socketService.startGame(activeRoom.code, user.id);
    }
  };
  // -------------------------------------------------------------
  // Single Player / Guest Category Gameplay Engine
  // -------------------------------------------------------------
  const handleStartDailyChallenge = (config: DailyChallengeConfig) => {
    setActiveDailyConfig(config);
    handleStartPracticeInternal('mixed', 'medium', config.totalQuestions, true);
  };
  const handleStartPractice = (
    category: CategoryId,
    difficulty: DifficultyLevel,
    subCategory?: string,
    questionCount: number = 5
  ) => {
    setActiveDailyConfig(null);
    setSelectedSubCategory(subCategory ?? null);
    handleStartPracticeInternal(
      category,
      difficulty,
      questionCount,
      false,
      subCategory
    );
  };
  const handleStartPracticeInternal = async (
    category: CategoryId,
    difficulty: DifficultyLevel,
    questionCount: number = 5,
    isDaily: boolean = false,
    subCategory?: string
  ) => {
    if (activeRoomRef.current && user) {
      try {
        socketService.leaveRoom(activeRoomRef.current.code, user.id);
      } catch {}
    }
    isGameActiveRef.current = true;
    setIsSinglePlayerActive(true);
    isSinglePlayerActiveRef.current = true;
    activeRoomRef.current = null;
    setActiveRoom(null);
    setDuelOpponent(null);
    setAnsweredOpponentIds(new Set());
    setMultiplayerFeedback(null);
    if (!isDaily) setActiveDailyConfig(null);
    setSelectedCategory(category);
    setSelectedDifficulty(difficulty);
    setPracticeFeedback(null);
    setIsPracticeSummaryVisible(false);
    isEvaluatingRef.current = false;
    setPracticeStreak(0);
    const initStats: PracticeStats = {
      totalQuestions: questionCount,
      correctAnswers: 0,
      wrongAnswers: 0,
      emptyAnswers: 0,
      totalScore: 0,
    };
    practiceStatsRef.current = initStats;
    setPracticeStats(initStats);
    const sessionBytes = getRandomValues(new Uint8Array(16));
    const sessionId = 'sess_' + Array.from(sessionBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    practiceSessionIdRef.current = sessionId;
    const isCurrentSession = () => practiceSessionIdRef.current === sessionId && isSinglePlayerActiveRef.current;
    try {
      // Anti-tekrar: bu kapsamda (kategori/alt kategori) daha önce çözülen
      // sorular sunucuya seenIds olarak gönderilir; havuz tükenirse sunucu
      // bilinçli olarak tekrar döndürür. URL boyutu için en fazla 250 ID.
      const scopeKey = seenScopeKey(category, subCategory);
      const seenIds = (await getSeenQuestionIds(scopeKey)).slice(-250);
      const res = await fetch(
        `${API_BASE}/questions/practice?category=${category}${subCategory ? `&subcategory=${encodeURIComponent(subCategory)}` : ''}&difficulty=${difficulty}&count=${questionCount}&sessionId=${sessionId}${seenIds.length ? `&seenIds=${encodeURIComponent(seenIds.join(','))}` : ''}`
      );
      if (res.ok) {
        const data = await res.json();
        if (!isCurrentSession()) return;
        if (subCategory && data.code === 'SUBCATEGORY_EMPTY') {
          // Alt kategoride soru yoksa başka alt kategoriden soru göstermek yerine bilgilendir.
          isGameActiveRef.current = false;
          setIsSinglePlayerActive(false);
          isSinglePlayerActiveRef.current = false;
          setGameAlert({
            title: 'Soru Bulunamadı',
            message: `"${subCategory}" alt kategorisinde henüz yayınlanmış soru yok. Lütfen başka bir alt kategori seç.`,
          });
          return;
        }
        const selected = Array.isArray(data.questions) ? uniqueQuestions<ClientQuestion>(data.questions, questionCount) : [];
        if (selected.length > 0) {
          const questions = selected.map((q, index) => ({ ...q, roundNumber: index + 1, totalRounds: selected.length }));
          void markQuestionsSeen(scopeKey, questions.map((q) => q.id));
          setPracticeQuestions(questions);
          setPracticeIndex(0);
          practiceStatsRef.current = { ...initStats, totalQuestions: questions.length };
          setPracticeStats(practiceStatsRef.current);
          setCurrentQuestion(questions[0]);
          selectOption(null);
          navigateTo('quiz_arena');
          return;
        }
      }
    } catch {
      // Offline fallback below
    }
    if (!isCurrentSession()) return;
    if (subCategory || isDaily) {
      isGameActiveRef.current = false;
      isSinglePlayerActiveRef.current = false;
      setIsSinglePlayerActive(false);
      setGameAlert({ title: 'Sorular Yüklenemedi', message: 'Bağlantını kontrol edip tekrar dene.' });
      return;
    }
    // High quality offline fallback questions
    const fallbackQuestions: ClientQuestion[] = [
      {
        id: 'fallback_q1',
        categoryId: category,
        difficulty,
        text: "Türkiye'nin başkenti neresidir?",
        options: [
          { id: 'opt_a', text: 'İstanbul' },
          { id: 'opt_b', text: 'Ankara' },
          { id: 'opt_c', text: 'İzmir' },
          { id: 'opt_d', text: 'Bursa' },
        ],
        roundNumber: 1,
        totalRounds: 5,
        timeLimitSec: 15,
      },
      {
        id: 'fallback_q2',
        categoryId: category,
        difficulty,
        text: 'Güneş sistemindeki en büyük gezegen hangisidir?',
        options: [
          { id: 'opt_a', text: 'Mars' },
          { id: 'opt_b', text: 'Venüs' },
          { id: 'opt_c', text: 'Jüpiter' },
          { id: 'opt_d', text: 'Satürn' },
        ],
        roundNumber: 2,
        totalRounds: 5,
        timeLimitSec: 15,
      },
      {
        id: 'fallback_q3',
        categoryId: category,
        difficulty,
        text: 'Hangisi bir programlama dili değildir?',
        options: [
          { id: 'opt_a', text: 'Python' },
          { id: 'opt_b', text: 'HTML' },
          { id: 'opt_c', text: 'TypeScript' },
          { id: 'opt_d', text: 'Rust' },
        ],
        roundNumber: 3,
        totalRounds: 5,
        timeLimitSec: 15,
      },
      {
        id: 'fallback_q4',
        categoryId: category,
        difficulty,
        text: 'Pi sayısı yaklaşık olarak kaça eşittir?',
        options: [
          { id: 'opt_a', text: '3.14' },
          { id: 'opt_b', text: '2.71' },
          { id: 'opt_c', text: '1.61' },
          { id: 'opt_d', text: '3.41' },
        ],
        roundNumber: 4,
        totalRounds: 5,
        timeLimitSec: 15,
      },
      {
        id: 'fallback_q5',
        categoryId: category,
        difficulty,
        text: "İstiklal Marşı'mızın şairi kimdir?",
        options: [
          { id: 'opt_a', text: 'Mehmet Akif Ersoy' },
          { id: 'opt_b', text: 'Nazım Hikmet' },
          { id: 'opt_c', text: 'Yahya Kemal Beyatlı' },
          { id: 'opt_d', text: 'Necip Fazıl Kısakürek' },
        ],
        roundNumber: 5,
        totalRounds: 5,
        timeLimitSec: 15,
      },
    ];
    const count = Math.min(questionCount, fallbackQuestions.length);
    const questions = fallbackQuestions.slice(0, count).map((q) => ({ ...q, totalRounds: count }));
    setPracticeQuestions(questions);
    setPracticeIndex(0);
    practiceStatsRef.current = { ...initStats, totalQuestions: questions.length };
    setPracticeStats(practiceStatsRef.current);
    setCurrentQuestion(questions[0]);
    selectOption(null);
    navigateTo('quiz_arena');
  };
  // "Otomatik sonraki soru" tercihi: açıksa 1.5 sn sonra geçer, kapalıysa
  // oyuncu "Sonraki Soru" düğmesine basana kadar geri bildirim ekranda kalır.
  const schedulePracticeAdvance = () => {
    if (loadStoredPreferences().autoNextQuestion === false) return;
    const sessionId = practiceSessionIdRef.current;
    scheduleGameTimeout(() => {
      if (practiceSessionIdRef.current !== sessionId || !isSinglePlayerActiveRef.current) return;
      advanceToNextPracticeQuestion(practiceIndex + 1, practiceQuestions);
    }, 1500);
  };
  const advanceToNextPracticeQuestion = (
    nextIdx: number,
    questionsList: ClientQuestion[]
  ) => {
    if (!isGameActiveRef.current) return;
    if (!questionsList || questionsList.length === 0) return;
    if (nextIdx < questionsList.length) {
      setPracticeIndex(nextIdx);
      setPracticeFeedback(null);
      isEvaluatingRef.current = false;
      selectOption(null);
      setCurrentQuestion(questionsList[nextIdx]);
    } else {
      isEvaluatingRef.current = false;
      isGameActiveRef.current = false;
      // Daily Challenge completion flow
      if (activeDailyConfig && user && !isGuest) {
        const correctAns = practiceStatsRef.current.correctAnswers;
        const totalAns = activeDailyConfig.totalQuestions;
        const isTargetMet = correctAns >= activeDailyConfig.requiredCorrect;
        if (isTargetMet) {
          const currentStreak = user.dailyStreak || 1;
          const todayStr = new Date().toISOString().slice(0, 10);
          const optimisticUser = {
            ...user,
            dailyStreak: currentStreak,
            dailyChallenge: {
              lastCompletedDate: todayStr,
              completedToday: true,
              streakDay: currentStreak,
            },
            xp: (user.xp || 0) + (activeDailyConfig.rewardXp || 50),
            coins: (user.coins || 0) + (activeDailyConfig.rewardCoins || 40),
            gems: (user.gems || 0) + (activeDailyConfig.rewardGems || 5),
          };
          setUser(optimisticUser);

          fetch(`${API_BASE}/social/daily-challenge/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
              userId: user.id,
              correctAnswers: correctAns,
              totalQuestions: totalAns,
            }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data?.user) {
                setUser(data.user);
              }
              sound.playSound('victory');
              sound.triggerHaptic('success');
              setDailyResultModal({
                visible: true,
                success: true,
                correct: correctAns,
                total: totalAns,
                required: activeDailyConfig.requiredCorrect,
                rewards: data.rewards,
              });
            })
            .catch(() => {
              sound.playSound('victory');
              sound.triggerHaptic('success');
              setDailyResultModal({
                visible: true,
                success: true,
                correct: correctAns,
                total: totalAns,
                required: activeDailyConfig.requiredCorrect,
                rewards: {
                  xp: activeDailyConfig.rewardXp,
                  coins: activeDailyConfig.rewardCoins,
                  gems: activeDailyConfig.rewardGems,
                  newStreak: currentStreak,
                },
              });
            });
        } else {
          sound.playSound('wrong');
          sound.triggerHaptic('error');
          setDailyResultModal({
            visible: true,
            success: false,
            correct: correctAns,
            total: totalAns,
            required: activeDailyConfig.requiredCorrect,
          });
        }
        return;
      }
      setPracticeRewards(null);
      setIsPracticeSummaryVisible(true);
      if (user && !isGuest) {
        const totalAns = Math.max(1, questionsList.length);
        const correctAns = practiceStatsRef.current.correctAnswers;
        const won = correctAns >= Math.ceil(totalAns / 2);
        fetch(`${API_BASE}/auth/stats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(useGameStore.getState().token ? { Authorization: `Bearer ${useGameStore.getState().token}` } : {}),
          },
          body: JSON.stringify({
            userId: user.id,
            won,
            correctAnswers: correctAns,
            totalAnswers: totalAns,
            mode: 'solo',
            difficulty: selectedDifficulty,
            bestStreak: practiceStreak,
            category: selectedCategory || 'general_culture',
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data?.user) {
              setUser(data.user);
            }
            if (data?.rewards) {
              setPracticeRewards({ xp: data.rewards.xp, coins: data.rewards.coins, boosted: !!data.rewards.boosted });
            }
          })
          .catch(() => {});
      }
    }
  };
  const evaluatePracticeAnswer = async (optionId: string | null, timeRemainingMs: number) => {
    if (isEvaluatingRef.current || isAnswerLocked || !currentQuestion) return;
    isEvaluatingRef.current = true;
    selectOption(optionId);
    const sessionId = practiceSessionIdRef.current;
    const offlineAnswer = getOfflinePracticeAnswer(currentQuestion.id);
    const result = offlineAnswer ? null : await requestPracticeAnswer(`${API_BASE}/questions/submit`, {
      questionId: currentQuestion.id,
      selectedOptionId: optionId,
      timeRemainingMs,
      totalTimeMs: currentQuestion.timeLimitSec * 1000,
      currentStreak: practiceStreak,
      sessionId,
      playerId: user?.id || 'guest_local',
    });
    if (sessionId !== practiceSessionIdRef.current || !isSinglePlayerActiveRef.current) return;

    const isTimeout = optionId === null || result?.isTimeout === true;
    const unavailable = !isTimeout && !result && !offlineAnswer;
    const isCorrect = !isTimeout && (result?.isCorrect ?? optionId === offlineAnswer);
    const rawPts = result?.pointsAwarded ?? (isCorrect ? 120 : 0);
    const rawSpd = result?.speedBonus ?? (isCorrect ? 20 : 0);
    const feedback: RoundFeedback = {
      isCorrect,
      isTimeout,
      unavailable,
      correctOptionId: result?.correctOptionId ?? offlineAnswer ?? '',
      explanation: unavailable ? 'Bağlantı nedeniyle bu soru puanlanmadı.' : result?.explanation || '',
      pointsAwarded: isCorrect ? (rawPts > 300 ? Math.round(rawPts / 10) : Math.max(0, Math.round(rawPts))) : 0,
      speedBonus: isCorrect ? (rawSpd > 100 ? Math.round(rawSpd / 10) : Math.max(0, Math.round(rawSpd))) : 0,
      streak: isCorrect ? result?.streak ?? practiceStreak + 1 : 0,
    };
    if (!unavailable) {
      sound.playSound(isCorrect ? (feedback.streak >= 2 ? 'streak' : 'correct') : 'wrong');
      sound.triggerHaptic(isCorrect ? 'success' : 'error');
    }
    setPracticeFeedback(feedback);
    setPracticeStreak(feedback.streak);
    const updatedStats: PracticeStats = {
      ...practiceStatsRef.current,
      correctAnswers: practiceStatsRef.current.correctAnswers + (isCorrect ? 1 : 0),
      wrongAnswers: practiceStatsRef.current.wrongAnswers + (!isCorrect && !isTimeout && !unavailable ? 1 : 0),
      emptyAnswers: practiceStatsRef.current.emptyAnswers + (isTimeout || unavailable ? 1 : 0),
      totalScore: practiceStatsRef.current.totalScore + feedback.pointsAwarded,
    };
    practiceStatsRef.current = updatedStats;
    setPracticeStats(updatedStats);
    schedulePracticeAdvance();
  };
  const handleSubmitAnswer = (optionId: string, timeRemainingMs: number) => {
    if (activeRoom && user && currentQuestion) {
      selectOption(optionId);
      socketService.submitAnswer(activeRoom.code, user.id, optionId, currentQuestion.roundNumber);
      return;
    }
    void evaluatePracticeAnswer(optionId, timeRemainingMs);
  };
  const handleTimeExpired = () => {
    if (!activeRoom) void evaluatePracticeAnswer(null, 0);
  };
  return (
    <View style={[
      styles.outerWrapper,
      isNativeTablet && styles.tabletOuter,
      webLayout.roomy && [styles.webOuter, { paddingHorizontal: webLayout.frameGutter }],
    ]}>
      <StatusBar hidden={true} animated={false} />

      <View style={[
        styles.appFrame,
        isNativeTablet && styles.nativeTabletFrame,
        webLayout.roomy && [styles.webFrame, { maxWidth: webLayout.frameMaxWidth }],
      ]}>
        <Animated.View
          testID={isWeb ? 'player-web-content' : undefined}
          style={[
            styles.container,
            !isWeb && styles.nativeContainer,
            webLayout.contentMaxWidth ? { maxWidth: webLayout.contentMaxWidth } : null,
            { opacity: screenFade },
          ]}
        >
        {currentScreen === 'splash' && (
          <SplashScreen
            onFinish={() => {
              if (user) {
                navigateTo(isGuest ? 'categories' : 'home');
              } else {
                navigateTo('auth');
              }
            }}
          />
        )}
        {currentScreen === 'auth' && (
          <AuthScreen
            wideLayout={webLayout.split}
            onSuccess={handleAuthSuccess}
            onGuestContinue={handleGuestPlay}
            apiBaseUrl={API_BASE}
            redirectNotice={authRedirectNotice || (pendingReferral ? 'Davet bağlantın kaydedildi. Girişten sonra arkadaşının profilini göreceksin; onayın olmadan arkadaş eklenmez.' : null)}
          />
        )}
        {currentScreen === 'profile_setup' && (
          <ProfileSetupScreen
            initialDisplayName={user?.displayName || 'DenizPro'}
            initialAvatarUrl={user?.avatarUrl}
            onSave={handleSaveProfile}
            onBack={() => navigateTo('profile')}
          />
        )}
        {currentScreen === 'home' && user && (
          <HomeScreen
            wideLayout={webLayout.split}
            user={user}
            isGuest={isGuest}
            onQuickMatch={handleStartQuickMatch}
            onCustomRoom={() =>
              requireAuth(() => navigateTo('custom_room'), 'Özel Oda')
            }
            onExploreCategories={() => navigateTo('categories')}
            onDailyChallenge={() =>
              requireAuth(() => navigateTo('daily_challenge'), 'Günlük Görev')
            }
            onPractice={() => navigateTo('categories')}
            onLeaderboard={() =>
              requireAuth(() => navigateTo('leaderboard'), 'Liderlik Tablosu')
            }
            onFriends={() =>
              requireAuth(() => navigateTo('friends'), 'Arkadaşlar')
            }
            onProfile={() =>
              requireAuth(() => navigateTo('profile'), 'Profil')
            }
            onNotifications={() =>
              requireAuth(() => navigateTo('notifications'), 'Bildirimler')
            }
            onSettings={() =>
              requireAuth(() => navigateTo('settings'), 'Ayarlar')
            }
            onSeason={() =>
              requireAuth(() => navigateTo('season'), 'Sezon 1 Pass')
            }
            onShop={() => requireAuth(() => navigateTo('shop'), 'Mağaza')}
            onEvents={() =>
              requireAuth(() => navigateTo('events'), 'Etkinlikler')
            }
            onInventory={() =>
              requireAuth(() => navigateTo('inventory'), 'Envanter')
            }
            onProLeague={() =>
              requireAuth(() => navigateTo('pro_league'), 'Pro Lig')
            }
            onLoginPrompt={() => {
              setAuthRedirectNotice('Tüm oyun modlarını açmak için giriş yapın!');
              navigateTo('auth');
            }}
          />
        )}
        {currentScreen === 'categories' && (
          <CategoryExploreScreen
            wideLayout={webLayout.split}
            avatarSeed={user?.avatarUrl || user?.displayName}
            coins={user?.coins}
            gems={user?.gems}
            isGuest={isGuest}
            apiBaseUrl={API_BASE}
            onLoginPrompt={() => {
              setAuthRedirectNotice('Giriş yaparak tüm oyun modlarını ve profilini aç!');
              navigateTo('auth');
            }}
            onBack={() =>
              requireAuth(() => navigateTo('home'), 'Ana Menü & Düello Modları')
            }
            onSelectCategory={(cat, sub) => {
              setSelectedCategory(cat);
              setSelectedSubCategory(sub ?? null);
              navigateTo('difficulty');
            }}
            onNotifications={() =>
              requireAuth(() => navigateTo('notifications'), 'Bildirimler')
            }
            onNavigateTab={(tab) => {
              if (tab === 'explore') return;
              if (tab === 'play') {
                requireAuth(() => navigateTo('home'), 'Oyna & Düello Menüsü');
              } else if (tab === 'leaders') {
                requireAuth(() => navigateTo('leaderboard'), 'Liderler');
              } else if (tab === 'friends') {
                requireAuth(() => navigateTo('friends'), 'Arkadaşlar');
              } else if (tab === 'profile') {
                requireAuth(() => navigateTo('profile'), 'Profil');
              }
            }}
          />
        )}
        {currentScreen === 'difficulty' && (
          <DifficultySelectScreen
            categoryId={selectedCategory}
            subCategory={selectedSubCategory ?? undefined}
            avatarSeed={user?.avatarUrl || user?.displayName}
            coins={user?.coins}
            gems={user?.gems}
            isGuest={isGuest}
            onLoginPrompt={() => {
              setAuthRedirectNotice('Giriş yaparak tüm oyun modlarını ve profilini aç!');
              navigateTo('auth');
            }}
            onBack={() => navigateTo('categories')}
            onSelectDifficulty={(diff, questionCount) => {
              setSelectedDifficulty(diff);
              handleStartPractice(
                selectedCategory,
                diff,
                selectedSubCategory ?? undefined,
                questionCount
              );
            }}
          />
        )}
        {currentScreen === 'matchmaking' && (
          <MatchmakingRadarScreen
            category={DUEL_CATEGORY}
            difficulty={selectedDifficulty}
            userName={user?.displayName || 'Sen'}
            avatarSeed={user?.avatarUrl || user?.displayName}
            onCancel={handleCancelMatchmaking}
          />
        )}
        {currentScreen === 'duel_versus' && (
          <DuelVersusScreen
            myProfile={{
              displayName: user?.displayName || 'Sen',
              avatarUrl: user?.avatarUrl,
              rankTitle: user?.rankTitle || 'Acemi Kaşif',
            }}
            opponentProfile={{
              displayName: duelOpponent?.displayName || (duelOpponent?.isBot ? 'BİLGİSAYAR' : 'Rakip Oyuncu'),
              avatarUrl: duelOpponent?.avatarUrl,
              rankTitle: duelOpponent?.isBot ? 'Yapay Zeka' : 'Düellocu',
              isBot: duelOpponent?.isBot,
            }}
            categoryName={ALL_CATEGORIES.find(category => category.id === DUEL_CATEGORY)?.name || 'Karışık Kategoriler'}
            onCancel={handleCancelMatchmaking}
          />
        )}
        {currentScreen === 'custom_room' && (
          <CustomRoomScreen
            onBack={() => navigateTo('home')}
            onCreateRoom={handleCreateCustomRoom}
            onJoinRoom={handleJoinCustomRoom}
            avatarSeed={user?.avatarUrl || user?.displayName}
            coins={user?.coins}
            gems={user?.gems}
            apiBaseUrl={API_BASE}
          />
        )}
        {currentScreen === 'lobby' && activeRoom && user && (
          <LobbyScreen
            key={`${user.id}:${activeRoom.code}`}
            room={activeRoom}
            currentUserId={user.id}
            user={user}
            onBack={handleExitCurrentGame}
            onToggleReady={handleToggleReady}
            onStartGame={handleStartGame}
            onKickPlayer={(targetPlayerId) => {
              socketService.kickPlayer(activeRoom.code, user.id, targetPlayerId);
            }}
          />
        )}
        {currentScreen === 'quiz_arena' && currentQuestion && (
          <>
            <QuizArenaScreen
              question={{
                ...currentQuestion,
                totalRounds: Math.max(
                  currentQuestion.totalRounds || 0,
                  activeRoom?.totalRounds || 0,
                  currentQuestion.roundNumber || 1
                ),
              }}
              selectedOptionId={selectedOptionId}
              isLocked={isEvaluatingRef.current || isAnswerLocked ||
                !!(user && activeRoom?.currentRound === currentQuestion.roundNumber &&
                  activeRoom.players[user.id]?.hasAnsweredCurrentRound)}
              isMultiplayer={!!activeRoom}
              streak={
                activeRoom && user
                  ? activeRoom.players[user.id]?.currentStreak || 0
                  : practiceStreak
              }
              currentScore={
                activeRoom && user
                  ? activeRoom.scores[user.id] || 0
                  : practiceStats.totalScore
              }
              feedback={activeRoom ? multiplayerFeedback : practiceFeedback}
              onSelectOption={handleSubmitAnswer}
              onTimeExpired={handleTimeExpired}
              onExit={handleExitCurrentGame}
              onNext={
                !activeRoom && practiceFeedback && loadStoredPreferences().autoNextQuestion === false
                  ? () => advanceToNextPracticeQuestion(practiceIndex + 1, practiceQuestions)
                  : undefined
              }
              isDuelMode={
                !!activeRoom &&
                (activeRoom.mode === 'duel' ||
                  activeRoom.mode === 'quick_match')
              }
              myDisplayName={user?.displayName || 'Sen'}
              myAvatarUrl={user?.avatarUrl || user?.displayName}
              dailyChallengeInfo={
                activeDailyConfig
                  ? {
                      requiredCorrect: activeDailyConfig.requiredCorrect,
                      totalQuestions: activeDailyConfig.totalQuestions,
                      currentCorrect: practiceStats.correctAnswers,
                    }
                  : null
              }
              opponent={
                duelOpponent
                  ? {
                      ...duelOpponent,
                      score: activeRoom?.scores[duelOpponent.id] || 0,
                      hasAnswered:
                        answeredOpponentIds.has(duelOpponent.id) ||
                        activeRoom?.players[duelOpponent.id]
                          ?.hasAnsweredCurrentRound,
                    }
                  : null
              }
              racers={(() => {
                if (isSinglePlayerActive) return [];
                if (activeRoom && user) {
                  const roomPlayers = Object.values(activeRoom.players || {});
                  const mapped = roomPlayers.map((p) => {
                    const isMe = p.id === user.id;
                    return {
                      id: p.id,
                      displayName: p.displayName,
                      avatarUrl: isMe ? user.avatarUrl || p.avatarUrl : p.avatarUrl,
                      score: activeRoom.scores[p.id] ?? p.score ?? 0,
                      correctAnswers: p.correctAnswersCount ?? 0,
                      isMe,
                      isHost: p.isHost,
                      hasAnswered: isMe
                        ? p.hasAnsweredCurrentRound || selectedOptionId !== null
                        : p.hasAnsweredCurrentRound || answeredOpponentIds.has(p.id),
                      lastAnswer: lastRoundResult?.playerAnswers?.[p.id],
                    };
                  });
                  if (duelOpponent && !mapped.some((r) => r.id === duelOpponent.id)) {
                    mapped.push({
                      id: duelOpponent.id,
                      displayName: duelOpponent.displayName,
                      avatarUrl: duelOpponent.avatarUrl,
                      score: activeRoom.scores[duelOpponent.id] ?? (duelOpponent as any).score ?? 0,
                      correctAnswers: activeRoom.players[duelOpponent.id]?.correctAnswersCount ?? 0,
                      isMe: false,
                      isHost: false,
                      hasAnswered: answeredOpponentIds.has(duelOpponent.id),
                      lastAnswer: lastRoundResult?.playerAnswers?.[duelOpponent.id],
                    });
                  }
                  if (!mapped.some((r) => r.isMe)) {
                    mapped.unshift({
                      id: user.id,
                      displayName: user.displayName || 'Sen',
                      avatarUrl: user.avatarUrl,
                      score: activeRoom.scores[user.id] ?? 0,
                      correctAnswers: activeRoom.players[user.id]?.correctAnswersCount ?? 0,
                      isMe: true,
                      isHost: activeRoom.hostId === user.id,
                      hasAnswered: selectedOptionId !== null,
                      lastAnswer: lastRoundResult?.playerAnswers?.[user.id],
                    });
                  }
                  return mapped;
                }
                // Tek kişilik oyunda (Keşfet / Günlük Görev) yarış barı kesinlikle gösterilmez
                return [];
              })()}
            />
            {/* Practice / Guest End of Game Summary Modal */}
            <PracticeSummaryModal
              visible={isPracticeSummaryVisible}
              stats={practiceStats}
              isGuest={isGuest}
              difficulty={selectedDifficulty}
              rewards={practiceRewards}
              userXp={user?.xp}
              onPlayAgain={() => {
                setIsPracticeSummaryVisible(false);
                handleStartPractice(selectedCategory, selectedDifficulty);
              }}
              onHome={() => {
                setIsPracticeSummaryVisible(false);
                navigateTo(isGuest ? 'categories' : 'home');
              }}
            />
            {/* Daily Challenge Dedicated Result Modal */}
            {dailyResultModal && (
              <DailyChallengeResultModal
                visible={dailyResultModal.visible}
                success={dailyResultModal.success}
                correctAnswers={dailyResultModal.correct}
                totalQuestions={dailyResultModal.total}
                requiredCorrect={dailyResultModal.required}
                streak={user?.dailyStreak ?? 1}
                rewards={dailyResultModal.rewards}
                onContinue={() => {
                  setDailyResultModal(null);
                  setActiveDailyConfig(null);
                  navigateTo('daily_challenge');
                }}
                onRetry={() => {
                  setDailyResultModal(null);
                  if (activeDailyConfig) {
                    handleStartDailyChallenge(activeDailyConfig);
                  } else {
                    handleStartPractice(selectedCategory, selectedDifficulty);
                  }
                }}
              />
            )}
          </>
        )}
        {currentScreen === 'intermission' && lastRoundResult && user && (
          <IntermissionLeaderboardScreen
            currentRound={lastRoundResult.roundNumber}
            totalRounds={currentQuestion?.totalRounds || 10}
            leaderboard={lastRoundResult.leaderboard}
            currentUserId={user.id}
            onExit={handleExitCurrentGame}
          />
        )}
        {currentScreen === 'match_result' && finalSummary && user && (
          <MatchResultPodiumScreen
            summary={finalSummary}
            currentUserId={user.id}
            questionReviews={finalSummary.questionReviews || matchQuestionsReview}
            userXp={user.xp}
            rewards={matchRewards}
            onPlayAgain={() => {
              resetGame();
              handleStartQuickMatch();
            }}
            onHome={() => {
              handleExitCurrentGame();
              resetGame();
              navigateTo('home');
            }}
          />
        )}
        {currentScreen === 'friends' && (
          <FriendsScreen
            token={token}
            pendingReferral={pendingReferral}
            onClearReferral={() => { clearPendingReferral(); setPendingReferral(null); }}
            onReferralConnected={() => { void refreshUserProfile(); }}
            user={user || undefined}
            isGuest={isGuest}
            apiBaseUrl={API_BASE}
            onBack={() => navigateTo('home')}
            onSignIn={() => {
              setUser(null, null);
              setAuthRedirectNotice('Arkadaş eklemek için hesabına giriş yap.');
              navigateTo('auth');
            }}
            onInviteToMatch={(friendId, friendName, roomCode) => {
              if (roomCode) {
                handleCreateCustomRoom(undefined, roomCode);
              } else {
                handleCreateCustomRoom();
              }
            }}
            onJoinFriendRoom={(roomCode) => {
              handleJoinCustomRoom(roomCode);
            }}
            onNotifications={() => navigateTo('notifications')}
            onNavigateTab={(tab) => {
              if (tab === 'play') navigateTo('home');
              else if (tab === 'explore') navigateTo('categories');
              else if (tab === 'leaders') navigateTo('leaderboard');
              else if (tab === 'profile') navigateTo('profile');
            }}
            onOpenFullProfile={(profile) => {
              setViewingProfile(profile);
              navigateTo('friend_profile');
            }}
          />
        )}
        {currentScreen === 'friend_profile' && viewingProfile && (
          <ProfileScreen
            user={viewingProfile}
            token={null}
            apiBaseUrl={API_BASE}
            onBack={() => {
              setViewingProfile(null);
              navigateTo('friends');
            }}
            onEditProfile={() => {}}
            viewOnly
          />
        )}
        {currentScreen === 'profile' && user && (
          <ProfileScreen
            user={user}
            token={token}
            apiBaseUrl={API_BASE}
            onUpdateUser={syncWithFreshUser}
            onBack={() => navigateTo('home')}
            onEditProfile={() => navigateTo('profile_setup')}
            onEditPersonalInfo={() => navigateTo('profile_edit')}
            onUpdateAvatar={handleUpdateAvatarDirect}
            onSettings={() => navigateTo('settings')}
            onNavigateTab={(tab) => {
              if (tab === 'play') navigateTo('home');
              else if (tab === 'explore') navigateTo('categories');
              else if (tab === 'leaders') navigateTo('leaderboard');
              else if (tab === 'friends') navigateTo('friends');
            }}
          />
        )}
        {currentScreen === 'profile_edit' && user && (
          <ProfileEditScreen
            user={user}
            token={token}
            apiBaseUrl={API_BASE}
            onBack={() => navigateTo('profile')}
            onSaved={syncWithFreshUser}
          />
        )}
        {currentScreen === 'leaderboard' && (
          <LeaderboardScreen
            wideLayout={webLayout.leaderboardColumns}
            user={user || undefined}
            apiBaseUrl={API_BASE}
            onBack={() => navigateTo('home')}
            onNotifications={() => navigateTo('notifications')}
            onNavigateTab={(tab) => {
              if (tab === 'play') navigateTo('home');
              else if (tab === 'explore') navigateTo('categories');
              else if (tab === 'friends') navigateTo('friends');
              else if (tab === 'profile') navigateTo('profile');
            }}
          />
        )}
        {currentScreen === 'daily_challenge' && (
          <DailyChallengeScreen
            user={user || undefined}
            onBack={() => navigateTo('home')}
            onStartDaily={handleStartDailyChallenge}
          />
        )}
        {currentScreen === 'practice' && (
          <SinglePlayerPracticeScreen
            onBack={() => navigateTo(isGuest ? 'categories' : 'home')}
            onStartPractice={handleStartPractice}
          />
        )}
        {currentScreen === 'notifications' && (
          <NotificationsScreen
            user={user || undefined}
            apiBaseUrl={API_BASE}
            onBack={() => navigateTo('home')}
            onAcceptDuel={(roomCode) => {
              if (roomCode) {
                handleJoinCustomRoom(roomCode);
              } else {
                handleStartQuickMatch();
              }
            }}
            onRefreshUser={() => { void refreshUserProfile(); }}
          />
        )}
        {currentScreen === 'settings' && (
          <SettingsScreen
            user={user}
            token={token}
            onUpdateUser={syncWithFreshUser}
            apiBaseUrl={API_BASE}
            onBack={() => navigateTo('home')}
            onDeveloper={() => navigateTo('developer')}
            onLogout={() => {
              setAuthRedirectNotice(null);
              setUser(null, null);
              resetGame();
              navigateTo('auth');
            }}
            onSyncWallet={async () => {
              if (user && !isGuest) {
                try {
                  const res = await fetch(`${API_BASE}/auth/sync-wallet`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(useGameStore.getState().token ? { Authorization: `Bearer ${useGameStore.getState().token}` } : {}),
                    },
                    body: JSON.stringify({
                      userId: user.id,
                      coins: user.coins,
                      gems: user.gems,
                      xp: user.xp,
                      level: user.level,
                    }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    if (data?.user) {
                      syncWithFreshUser(data.user);
                    }
                  }
                } catch (e) {
                  console.error('Wallet sync error:', e);
                }
              }
            }}
            onDeleteAccount={async () => {
              if (user) {
                try {
                  const res = await fetch(`${API_BASE}/auth/delete-account`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(useGameStore.getState().token ? { Authorization: `Bearer ${useGameStore.getState().token}` } : {}),
                    },
                    body: JSON.stringify({ userId: user.id }),
                  });
                  const data = await res.json().catch(() => null);
                  if (!res.ok || !data?.success) {
                    // Silme başarısızsa veriler korunur ve kullanıcı bilgilendirilir
                    Alert.alert(
                      'Hesap Silinemedi',
                      data?.message || 'Hesabınız silinirken bir hata oluştu. Lütfen tekrar deneyin.'
                    );
                    return;
                  }
                } catch (err) {
                  console.error('Delete account failed:', err);
                  Alert.alert('Hesap Silinemedi', 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
                  return;
                }
              }
              clearAllAccountStorage();
              setAuthRedirectNotice(null);
              setUser(null, null);
              resetGame();
              navigateTo('auth');
            }}
          />
        )}
        {currentScreen === 'developer' && (
          <DeveloperScreen
            user={user || undefined}
            apiBaseUrl={API_BASE}
            onUpdateUser={(updated) => setUser(updated)}
            onNavigate={(screen) => navigateTo(screen)}
            onBack={() => navigateTo('settings')}
          />
        )}
        {currentScreen === 'season' && (
          <SeasonScreen
            user={user || undefined}
            apiBaseUrl={API_BASE}
            onUpdateUser={(u) => setUser(u)}
            onRefreshUser={() => { void refreshUserProfile(); }}
            onBack={() => navigateTo('home')}
            onProfile={() => navigateTo('profile')}
          />
        )}
        {currentScreen === 'shop' && (
          <ShopScreen
            user={user || undefined}
            apiBaseUrl={API_BASE}
            onUpdateUser={(u) => setUser(u)}
            onBack={() => navigateTo('home')}
            onNotifications={() => navigateTo('notifications')}
            onProfile={() => navigateTo('profile')}
            onNavigateSecondary={(tab) => {
              if (tab === 'play') navigateTo('home');
              else if (tab === 'leagues') navigateTo('pro_league');
              else if (tab === 'events') navigateTo('events');
              else if (tab === 'inventory') navigateTo('inventory');
            }}
          />
        )}
        {currentScreen === 'events' && (
          <EventsScreen
            user={user || undefined}
            onBack={() => navigateTo('home')}
            onNotifications={() => navigateTo('notifications')}
            onProfile={() => navigateTo('profile')}
            onStartEvent={handleStartQuickMatch}
            onNavigateSecondary={(tab) => {
              if (tab === 'play') navigateTo('home');
              else if (tab === 'shop') navigateTo('shop');
              else if (tab === 'leagues') navigateTo('pro_league');
              else if (tab === 'inventory') navigateTo('inventory');
            }}
          />
        )}
        {currentScreen === 'inventory' && (
          <InventoryScreen
            user={user || undefined}
            apiBaseUrl={API_BASE}
            onUpdateUser={(u) => setUser(u)}
            onBack={() => navigateTo('home')}
            onNotifications={() => navigateTo('notifications')}
            onProfile={() => navigateTo('profile')}
            onNavigateSecondary={(tab) => {
              if (tab === 'play') navigateTo('home');
              else if (tab === 'shop') navigateTo('shop');
              else if (tab === 'leagues') navigateTo('pro_league');
              else if (tab === 'events') navigateTo('events');
            }}
          />
        )}
        {currentScreen === 'pro_league' && (
          <ProLeagueScreen
            user={user || undefined}
            apiBaseUrl={API_BASE}
            onBack={() => navigateTo('home')}
            onNotifications={() => navigateTo('notifications')}
            onProfile={() => navigateTo('profile')}
            onNavigateSecondary={(tab) => {
              if (tab === 'play') navigateTo('home');
              else if (tab === 'shop') navigateTo('shop');
              else if (tab === 'events') navigateTo('events');
              else if (tab === 'inventory') navigateTo('inventory');
            }}
          />
        )}
        {currentScreen === 'reconnect' && (
          <ReconnectScreen
            onRetry={() => {
              socketService.connect();
              navigateTo('home');
            }}
            onExitToHome={() => {
              resetGame();
              navigateTo('home');
            }}
          />
        )}
        {currentScreen === 'error' && (
          <ErrorStateScreen
            message={errorMessage}
            onRetry={() => navigateTo('home')}
            onHome={() => navigateTo('home')}
          />
        )}
        </Animated.View>
        {currentScreen !== 'notifications' && user && !isGuest && (
          <NotificationToast onOpen={() => navigateTo('notifications')} />
        )}

        {/* İnternet durumu kapsülü: her ekranda görünür, akışı engellemez */}
        <ConnectionStatusOverlay suppress={currentScreen === 'reconnect'} />
      </View>

      {/* Modern oyun uyarı modalı (alt kategoride soru yok vb.)
          — kök seviyede render edilir: quiz_arena koşuluna takılmadan
          her ekranda görünebilir. */}
      <GameAlertModal
        visible={gameAlert !== null}
        title={gameAlert?.title}
        message={gameAlert?.message || ''}
        variant="error"
        onConfirm={() => setGameAlert(null)}
      />

      {/* Paylaşılan profil bağlantısından gelen profil modalı */}
      {(sharedProfile || sharedProfileLoading) && (
        <ProfileInspectModal
          visible
          profile={sharedProfile}
          loading={sharedProfileLoading}
          currentUserId={user?.id || null}
          onClose={() => { setSharedProfile(null); setSharedProfileCode(null); }}
          onChallenge={() => {
            setSharedProfile(null);
            setSharedProfileCode(null);
            navigateTo('friends');
          }}
          onAddFriend={(p) => {
            setSharedProfile(null);
            setSharedProfileCode(null);
            navigateTo('friends');
          }}
        />
      )}

      {webLayout.showUtility && (
        <ScrollView style={styles.desktopSidebar} contentContainerStyle={styles.desktopSidebarContent}>
          <View style={styles.desktopCard}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 26, marginBottom: 4 }}>📱</Text>
              <Text style={styles.desktopCardTitle}>Cebinde Devam Et</Text>
              <Text style={styles.desktopCardDesc}>
                Telefon kameranı açıp QR kodu tara, kurulumsuz anında mobilde oyna!
              </Text>
            </View>

            <View style={styles.desktopQrWrapper}>
              <Image
                source={{ uri: `${CLOUD_BASE_URL}/qr` }}
                style={{ width: 128, height: 128, borderRadius: 8 }}
                resizeMode="contain"
                accessibilityLabel="Tavriko mobil bağlantısının QR kodu"
              />
            </View>

            <Text style={styles.desktopQrUrlText}>tavriko-app.vercel.app</Text>

            <TouchableOpacity
              style={styles.portalShortcutBtn}
              accessibilityRole="button"
              onPress={() => {
                navigateTo('developer');
              }}
            >
              <Text style={styles.portalShortcutText}>🛡️ Geliştirici Sandbox Paneli</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.portalShortcutBtn, { marginTop: 6, backgroundColor: 'rgba(255, 196, 61, 0.1)', borderColor: 'rgba(255, 196, 61, 0.3)' }]}
              accessibilityRole="button"
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.open('/developer', '_blank', 'noopener,noreferrer');
                }
              }}
            >
              <Text style={[styles.portalShortcutText, { color: '#FFC43D' }]}>🌐 Web Operasyon Portalı</Text>
            </TouchableOpacity>

            <View style={styles.desktopTipBox}>
              <Text style={styles.desktopTipTitle}>💡 Web İpucu</Text>
              <Text style={styles.desktopTipText}>
                Klavyeniz ve farenizle sorulara anında cevap verebilir, tüm lig ve ödülleri büyük ekranda takip edebilirsiniz.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
      {webLayout.reserveUtility && !webLayout.showUtility && <View style={styles.desktopSidebarSpacer} />}
      <LegalConsentGate
        visible={showLegalGate && !autoLegalInFlight}
        isUpdate={isLegalUpdate(user)}
        submitting={legalSubmitting}
        errorMsg={legalGateError}
        onAccept={() => { void acceptLegal('in_app'); }}
        onLogout={() => {
          setLegalGateError(null);
          setAuthRedirectNotice(null);
          setUser(null, null);
          resetGame();
          navigateTo('auth');
        }}
      />
      {/* Web'de açılış görselini kapatmadan, ilk etkileşimli ekranda sor. */}
      {(!isWeb || currentScreen !== 'splash') && <AnalyticsConsentBanner onDecide={onAnalyticsDecide} />}
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    width: '100%',
    height: '100%',
  },
  tabletOuter: {
    backgroundColor: '#090414',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  webOuter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    backgroundColor: '#100822',
  },
  appFrame: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: THEME.colors.background,
  },
  nativeTabletFrame: {
    maxWidth: 520,
    width: 520,
    height: '100%',
    maxHeight: '100%',
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: '0 0 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(108, 92, 231, 0.35)',
    overflow: 'hidden',
  },
  webFrame: {
    flexBasis: 0,
    minWidth: 0,
    minHeight: 0,
    alignSelf: 'stretch',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.24)',
  },
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    width: '100%',
    alignSelf: 'center',
    minHeight: 0,
  },
  nativeContainer: {
    maxWidth: 520,
  },
  desktopSidebar: {
    flexGrow: 0,
    flexShrink: 0,
    width: 248,
    maxHeight: '100%',
    alignSelf: 'center',
    minHeight: 0,
  },
  desktopSidebarSpacer: { flexShrink: 0, width: 248 },
  desktopSidebarContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  desktopCard: {
    backgroundColor: 'rgba(22, 10, 52, 0.72)',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
  },
  desktopCardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: THEME.fonts.extraBold,
  },
  desktopCardDesc: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  desktopQrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 16,
    alignSelf: 'center',
    marginVertical: 12,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
  desktopQrUrlText: {
    color: '#A78BFA',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginBottom: 12,
  },
  portalShortcutBtn: {
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    borderWidth: 1.5,
    borderColor: '#FFC43D',
    borderRadius: 14,
    minHeight: 44,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  portalShortcutText: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
  desktopTipBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  desktopTipTitle: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 2,
  },
  desktopTipText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontFamily: THEME.fonts.body,
    lineHeight: 15,
  },
});
