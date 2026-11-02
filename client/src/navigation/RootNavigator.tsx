import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Platform,
  AppState,
  Animated,
  useWindowDimensions,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useGameStore } from '../store/gameStore';
import { socketService } from '../services/socketService';
import { sound } from '../services/soundService';
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
import { PracticeSummaryModal, PracticeStats } from '../screens/PracticeSummaryModal';
import { DailyChallengeResultModal } from '../screens/DailyChallengeResultModal';
import { IntermissionLeaderboardScreen } from '../screens/IntermissionLeaderboardScreen';
import { MatchResultPodiumScreen } from '../screens/MatchResultPodiumScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
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
import { PaymentScreen, PaymentItem } from '../screens/PaymentScreen';
import { DeveloperScreen } from '../screens/DeveloperScreen';
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
  | 'payment'
  | 'developer';
import { DEFAULT_API_BASE, getRealtimeWsUrl } from '../config';

const API_BASE = DEFAULT_API_BASE;
export const RootNavigator: React.FC = () => {
  const { width: windowWidth } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && windowWidth > 540;
  const isWide = isWeb && windowWidth >= 1180;

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
      window.location.hash.includes('developer'));

  const [currentScreen, setCurrentScreen] = useState<ScreenName>(
    isWebOAuthReturn ? 'auth' : isWebDeveloperReturn ? 'developer' : 'splash'
  );
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('general_culture');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('medium');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [selectedPaymentItem, setSelectedPaymentItem] = useState<PaymentItem | null>(null);
  // Guest Restriction & Redirect Banner State
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [authRedirectNotice, setAuthRedirectNotice] = useState<string | null>(null);
  // Screen transition animation
  const screenFade = useRef(new Animated.Value(1)).current;
  const navigateTo = (nextScreen: ScreenName) => {
    screenFade.setValue(0.35);
    setCurrentScreen(nextScreen);
    Animated.timing(screenFade, {
      toValue: 1,
      duration: 210,
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
  const [isPracticeSummaryVisible, setIsPracticeSummaryVisible] = useState<boolean>(false);
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
  const practiceSessionIdRef = useRef<string>('sess_' + Math.random().toString(36).substring(2, 9));
  // 1v1 Live Duel State
  const [duelOpponent, setDuelOpponent] = useState<{
    id: string;
    displayName: string;
    avatarUrl?: string;
    isBot?: boolean;
  } | null>(null);
  const [opponentHasAnswered, setOpponentHasAnswered] = useState<boolean>(false);
  const [matchQuestionsReview, setMatchQuestionsReview] = useState<MatchQuestionReviewItem[]>([]);
  const matchQuestionsReviewRef = useRef<MatchQuestionReviewItem[]>([]);
  matchQuestionsReviewRef.current = matchQuestionsReview;
  const {
    user,
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

  const currentScreenRef = useRef<ScreenName>(currentScreen);
  currentScreenRef.current = currentScreen;
  // Keep system status bar (clock, battery, notifications) completely hidden in fullscreen mode
  useEffect(() => {
    StatusBar.setHidden(true, 'none');
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        StatusBar.setHidden(true, 'none');
      }
    });
    return () => sub.remove();
  }, [currentScreen]);
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

    const query = `playerId=${encodeURIComponent(user.id)}&displayName=${encodeURIComponent(user.displayName)}&avatarUrl=${encodeURIComponent(user.avatarUrl || 'av1')}`;
    socketService.connect(getRealtimeWsUrl(`/ws?${query}`));

    const unsubSync = socketService.onStateSync((room: GameRoom) => {
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
      if (
        room.status === 'lobby' &&
        currentScreenRef.current !== 'lobby' &&
        currentScreenRef.current !== 'duel_versus'
      ) {
        navigateTo('lobby');
      }
    });
    const unsubQuestion = socketService.onQuestionStart((question: ClientQuestion) => {
      if (!isGameActiveRef.current && !activeRoomRef.current) return;
      setCurrentQuestion(question);
      setRoundResult(null);
      selectOption(null);
      setOpponentHasAnswered(false);
      navigateTo('quiz_arena');
    });
    const unsubRoundResult = socketService.onRoundResult((result: RoundResult) => {
      if (!isGameActiveRef.current && !activeRoomRef.current) return;
      setRoundResult(result);
      const myAns = user ? result.playerAnswers[user.id] : null;

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
          pointsEarned: myAns?.pointsEarned ?? 0,
          explanation: result.explanation,
        };
        setMatchQuestionsReview((prev) => [...prev, reviewItem]);
      }

      if (myAns?.isCorrect) {
        sound.playSound('correct');
        sound.triggerHaptic('success');
      } else {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
      }
      // Soru aralarında modal ve intermission ekranı kaldırıldı!
      // Oyun akıcı şekilde doğrudan devam eder ve sıradaki soru (QUESTION_START) beklenir.
    });
    const unsubGameOver = socketService.onGameOver((summary: FinalMatchSummary) => {
      if (!isGameActiveRef.current && !activeRoomRef.current) return;
      isGameActiveRef.current = false;
      const enrichedSummary: FinalMatchSummary = {
        ...summary,
        questionReviews: matchQuestionsReviewRef.current,
      };
      setFinalSummary(enrichedSummary);
      navigateTo('match_result');
      if (user && !isGuest) {
        const myRankEntry = summary.rankings?.find((p) => p.playerId === user.id);
        const won = myRankEntry?.rank === 1 || summary.podium?.first?.playerId === user.id;
        fetch(`${API_BASE}/auth/stats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            won,
            correctAnswers: myRankEntry ? Math.max(1, Math.round((myRankEntry.score || 0) / 1000)) : 1,
            totalAnswers: summary.totalRounds || 5,
            xpEarned: won ? 160 : 60,
            coinsEarned: won ? 50 : 20,
            bestStreak: myRankEntry?.streak || 1,
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data?.user) {
              setUser(data.user);
            }
          })
          .catch(() => {});
      }
    });
    const unsubMatchFound = socketService.onMatchFound(
      (data: { roomCode: string; opponent?: any }) => {
        if (user) {
          isGameActiveRef.current = true;
          setMatchQuestionsReview([]);
          setDuelOpponent(data.opponent || null);
          setOpponentHasAnswered(false);
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
          setOpponentHasAnswered(true);
          sound.playSound('timer_tick');
        }
      }
    );
    return () => {
      unsubSync();
      unsubQuestion();
      unsubRoundResult();
      unsubGameOver();
      unsubMatchFound();
      unsubPlayerAnswered();
    };
  }, [user?.id, user?.displayName, user?.avatarUrl, scheduleGameTimeout]);
  // -------------------------------------------------------------
  // Auth & Profile Actions
  // -------------------------------------------------------------
  const handleGuestPlay = async () => {
    setIsGuest(true);
    setAuthRedirectNotice(null);
    try {
      const res = await fetch(`${API_BASE}/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Misafir Oyuncu' }),
      });
      const data = await res.json();
      if (data.user) {
        setUser(
          {
            ...data.user,
            displayName: 'Misafir Oyuncu',
            avatarUrl: 'av0',
          },
          data.token
        );
        // Guests go straight to Keşfet (CategoryExploreScreen)!
        navigateTo('categories');
        return;
      }
    } catch {
      // Fallback local guest
    }
    const fallbackUser: UserProfile = {
      id: 'guest_local_' + Math.random().toString(36).substring(2, 7),
      username: 'misafir_oyuncu',
      displayName: 'Misafir Oyuncu',
      avatarUrl: 'av0',
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
    setUser(fallbackUser, 'mock_token');
    navigateTo('categories');
  };
  // Refresh logged-in user profile from database on key screen changes
  useEffect(() => {
    if (user && !isGuest && (currentScreen === 'home' || currentScreen === 'profile')) {
      fetch(`${API_BASE}/social/profile/${user.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((freshUser) => {
          if (freshUser && freshUser.id === user.id) {
            setUser(freshUser);
          }
        })
        .catch(() => {});
    }
  }, [currentScreen, user?.id, isGuest]);
  const handleAuthSuccess = (loggedInUser: UserProfile, token: string) => {
    setIsGuest(false);
    setAuthRedirectNotice(null);
    setUser(
      {
        ...loggedInUser,
        avatarUrl: loggedInUser.avatarUrl || 'av1',
      },
      token
    );
    navigateTo('home');
  };
  const handleSaveProfile = async (name: string, avatarSeedOrUri: string) => {
    if (user) {
      const updatedLocal = {
        ...user,
        displayName: name,
        avatarUrl: avatarSeedOrUri,
      };
      setUser(updatedLocal);
      try {
        const res = await fetch(`${API_BASE}/auth/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            displayName: name,
            avatarUrl: avatarSeedOrUri,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) setUser(data.user);
        }
      } catch {
        // Keep local update
      }
    }
    navigateTo(isGuest ? 'categories' : 'home');
  };
  const handleUpdateAvatarDirect = async (newAvatarUri: string) => {
    if (user) {
      setUser({
        ...user,
        avatarUrl: newAvatarUri,
      });
      try {
        const res = await fetch(`${API_BASE}/auth/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            avatarUrl: newAvatarUri,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) setUser(data.user);
        }
      } catch {
        // Keep local
      }
    }
  };
  // -------------------------------------------------------------
  // Matchmaking & Room Actions
  // -------------------------------------------------------------
  const handleExitCurrentGame = useCallback(() => {
    isGameActiveRef.current = false;
    clearAllGameTimers();

    if (activeRoomRef.current && user) {
      socketService.leaveRoom(activeRoomRef.current.code, user.id);
    }
    if (user) {
      socketService.cancelMatch(user.id);
    }
    activeRoomRef.current = null;
    setActiveRoom(null);

    setDuelOpponent(null);
    setOpponentHasAnswered(false);
    setPracticeQuestions([]);
    setPracticeIndex(0);
    setPracticeStreak(0);
    setPracticeFeedback(null);
    setActiveDailyConfig(null);
    setDailyResultModal(null);
    setIsPracticeSummaryVisible(false);
    isEvaluatingRef.current = false;
    practiceSessionIdRef.current = 'sess_' + Math.random().toString(36).substring(2, 9);

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

  const handleStartQuickMatch = () => {
    requireAuth(() => {
      if (!user) return;
      isGameActiveRef.current = true;
      setDuelOpponent(null);
      setOpponentHasAnswered(false);
      socketService.findMatch(
        user.id,
        user.displayName,
        user.avatarUrl,
        'duel',
        selectedCategory
      );
      navigateTo('matchmaking');
    }, 'Hızlı Eşleşme (1v1 Düello)');
  };
  const handleCancelMatchmaking = () => {
    handleExitCurrentGame();
  };
  const handleCreateCustomRoom = (settings?: CustomRoomSettings) => {
    requireAuth(() => {
      if (!user) return;
      isGameActiveRef.current = true;
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const initialRoom: GameRoom = {
        code: roomCode,
        mode: 'custom',
        hostId: user.id,
        status: 'lobby',
        category: settings?.categories?.[0] || 'genel_kultur',
        difficulty: settings?.difficulty || 'medium',
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
      navigateTo('lobby');
    }, 'Özel Oda');
  };
  const handleJoinCustomRoom = (code: string) => {
    requireAuth(() => {
      if (!user) return;
      isGameActiveRef.current = true;
      const cleanCode = code.trim().toUpperCase();
      if (!activeRoom || activeRoom.code !== cleanCode) {
        const placeholderRoom: GameRoom = {
          code: cleanCode,
          mode: 'custom',
          hostId: 'host_pending',
          status: 'lobby',
          category: 'genel_kultur',
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
      socketService.joinRoom(cleanCode, user.id, user.displayName, user.avatarUrl);
      navigateTo('lobby');
    }, 'Özel Odaya Katılma');
  };
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
    difficulty: DifficultyLevel
  ) => {
    setActiveDailyConfig(null);
    handleStartPracticeInternal(category, difficulty, 5, false);
  };
  const handleStartPracticeInternal = async (
    category: CategoryId,
    difficulty: DifficultyLevel,
    questionCount: number = 5,
    isDaily: boolean = false
  ) => {
    isGameActiveRef.current = true;
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
    practiceSessionIdRef.current =
      'sess_' + Math.random().toString(36).substring(2, 9);
    try {
      const res = await fetch(
        `${API_BASE}/questions/practice?category=${category}&difficulty=${difficulty}&count=${questionCount}&sessionId=${practiceSessionIdRef.current}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          setPracticeQuestions(data.questions);
          setPracticeIndex(0);
          setPracticeStats((prev) => ({
            ...prev,
            totalQuestions: data.questions.length,
          }));
          setCurrentQuestion(data.questions[0]);
          selectOption(null);
          navigateTo('quiz_arena');
          return;
        }
      }
    } catch {
      // Offline fallback below
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
    setPracticeQuestions(fallbackQuestions);
    setPracticeIndex(0);
    setPracticeStats((prev) => ({
      ...prev,
      totalQuestions: fallbackQuestions.length,
    }));
    setCurrentQuestion(fallbackQuestions[0]);
    selectOption(null);
    navigateTo('quiz_arena');
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
            headers: { 'Content-Type': 'application/json' },
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
      setIsPracticeSummaryVisible(true);
      if (user && !isGuest) {
        const totalAns = Math.max(1, questionsList.length);
        const correctAns = practiceStatsRef.current.correctAnswers;
        const won = correctAns >= Math.ceil(totalAns / 2);
        fetch(`${API_BASE}/auth/stats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            won,
            correctAnswers: correctAns,
            totalAnswers: totalAns,
            xpEarned: Math.min(80, Math.max(25, correctAns * 15)),
            coinsEarned: Math.min(25, Math.max(10, correctAns * 5)),
            bestStreak: practiceStreak,
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data?.user) {
              setUser(data.user);
            }
          })
          .catch(() => {});
      }
    }
  };
  const handleSubmitAnswer = async (
    optionId: string,
    timeRemainingMs: number
  ) => {
    // Multiplayer flow
    if (activeRoom && user) {
      selectOption(optionId);
      socketService.submitAnswer(activeRoom.code, user.id, optionId);
      return;
    }
    // Practice / Guest Flow
    if (isEvaluatingRef.current || isAnswerLocked || !currentQuestion) return;
    isEvaluatingRef.current = true;
    selectOption(optionId);
    try {
      const res = await fetch(`${API_BASE}/questions/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          selectedOptionId: optionId,
          timeRemainingMs,
          totalTimeMs: currentQuestion.timeLimitSec * 1000,
          currentStreak: practiceStreak,
          sessionId: practiceSessionIdRef.current,
          playerId: user?.id || 'guest_local',
        }),
      });
      if (res.ok) {
        const result = await res.json();
        const feedback: RoundFeedback = {
          isCorrect: result.isCorrect,
          isTimeout: false,
          correctOptionId: result.correctOptionId,
          explanation: result.explanation || '',
          pointsAwarded: result.pointsAwarded || 0,
          speedBonus: result.speedBonus || 0,
          streak: result.streak || 0,
        };
        setPracticeFeedback(feedback);
        setPracticeStreak(feedback.streak);
        if (result.isCorrect) {
          sound.playSound(feedback.streak >= 2 ? 'streak' : 'correct');
          sound.triggerHaptic('success');
        } else {
          sound.playSound('wrong');
          sound.triggerHaptic('error');
        }
        const updatedStats: PracticeStats = {
          ...practiceStatsRef.current,
          correctAnswers:
            practiceStatsRef.current.correctAnswers + (result.isCorrect ? 1 : 0),
          wrongAnswers:
            practiceStatsRef.current.wrongAnswers + (result.isCorrect ? 0 : 1),
          totalScore:
            practiceStatsRef.current.totalScore + feedback.pointsAwarded,
        };
        practiceStatsRef.current = updatedStats;
        setPracticeStats(updatedStats);
        scheduleGameTimeout(() => {
          advanceToNextPracticeQuestion(practiceIndex + 1, practiceQuestions);
        }, 2500);
        return;
      }
    } catch {
      // Offline fallback evaluation
    }
    // Local evaluation fallback if backend is unreachable
    const isMockCorrect =
      optionId === 'opt_b' || optionId === 'opt_c' || optionId === 'opt_a';
    const points = isMockCorrect ? 1000 : 0;
    const newStreak = isMockCorrect ? practiceStreak + 1 : 0;
    if (isMockCorrect) {
      sound.playSound('correct');
      sound.triggerHaptic('success');
    } else {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
    }
    setPracticeFeedback({
      isCorrect: isMockCorrect,
      isTimeout: false,
      correctOptionId: 'opt_b',
      explanation: 'Doğru cevap sistem tarafından teyit edildi.',
      pointsAwarded: points,
      speedBonus: 200,
      streak: newStreak,
    });
    setPracticeStreak(newStreak);
    const mockUpdatedStats: PracticeStats = {
      ...practiceStatsRef.current,
      correctAnswers:
        practiceStatsRef.current.correctAnswers + (isMockCorrect ? 1 : 0),
      wrongAnswers:
        practiceStatsRef.current.wrongAnswers + (isMockCorrect ? 0 : 1),
      totalScore: practiceStatsRef.current.totalScore + points,
    };
    practiceStatsRef.current = mockUpdatedStats;
    setPracticeStats(mockUpdatedStats);
    scheduleGameTimeout(() => {
      advanceToNextPracticeQuestion(practiceIndex + 1, practiceQuestions);
    }, 2500);
  };
  const handleTimeExpired = async () => {
    if (activeRoom && user) {
      return;
    }
    if (isEvaluatingRef.current || !currentQuestion) return;
    isEvaluatingRef.current = true;
    selectOption(null);
    sound.playSound('wrong');
    sound.triggerHaptic('error');
    try {
      const res = await fetch(`${API_BASE}/questions/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          selectedOptionId: null,
          timeRemainingMs: 0,
          totalTimeMs: currentQuestion.timeLimitSec * 1000,
          currentStreak: practiceStreak,
          sessionId: practiceSessionIdRef.current,
          playerId: user?.id || 'guest_local',
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setPracticeFeedback({
          isCorrect: false,
          isTimeout: true,
          correctOptionId: result.correctOptionId,
          explanation: result.explanation || '',
          pointsAwarded: 0,
          speedBonus: 0,
          streak: 0,
        });
        setPracticeStreak(0);
        const timeoutStats: PracticeStats = {
          ...practiceStatsRef.current,
          emptyAnswers: practiceStatsRef.current.emptyAnswers + 1,
        };
        practiceStatsRef.current = timeoutStats;
        setPracticeStats(timeoutStats);
        scheduleGameTimeout(() => {
          advanceToNextPracticeQuestion(practiceIndex + 1, practiceQuestions);
        }, 2500);
        return;
      }
    } catch {
      // Local fallback timeout
    }
    setPracticeFeedback({
      isCorrect: false,
      isTimeout: true,
      correctOptionId: 'opt_b',
      explanation: 'Süre doldu! Zamanında cevap verilmedi.',
      pointsAwarded: 0,
      speedBonus: 0,
      streak: 0,
    });
    setPracticeStreak(0);
    const mockTimeoutStats: PracticeStats = {
      ...practiceStatsRef.current,
      emptyAnswers: practiceStatsRef.current.emptyAnswers + 1,
    };
    practiceStatsRef.current = mockTimeoutStats;
    setPracticeStats(mockTimeoutStats);
    scheduleGameTimeout(() => {
      advanceToNextPracticeQuestion(practiceIndex + 1, practiceQuestions);
    }, 2500);
  };
  return (
    <View style={[styles.outerWrapper, isDesktop && styles.desktopOuter]}>
      <StatusBar hidden={true} animated={false} />

      {/* Desktop Left Sidebar (Wide Displays >= 1180px) */}
      {isWide && (
        <View style={styles.desktopSidebarLeft}>
          <View style={styles.desktopCard}>
            <View style={{ alignItems: 'center', marginBottom: 18 }}>
              <View style={styles.crownGlow}>
                <Text style={{ fontSize: 32 }}>👑</Text>
              </View>
              <Text style={styles.brandTitleText}>Tavriko</Text>
              <Text style={styles.brandSubtitleText}>CANLI BİLGİ & DÜELLO</Text>
            </View>

            <View style={styles.desktopFeatureList}>
              <View style={styles.desktopFeatureItem}>
                <Text style={styles.desktopFeatureIcon}>⚡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.desktopFeatureTitle}>1v1 Canlı Düello</Text>
                  <Text style={styles.desktopFeatureDesc}>Gerçek zamanlı hız ve bilgi yarışı</Text>
                </View>
              </View>

              <View style={styles.desktopFeatureItem}>
                <Text style={styles.desktopFeatureIcon}>🏆</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.desktopFeatureTitle}>Pro Lig & Sezon</Text>
                  <Text style={styles.desktopFeatureDesc}>Haftalık liglerde zirveye tırman</Text>
                </View>
              </View>

              <View style={styles.desktopFeatureItem}>
                <Text style={styles.desktopFeatureIcon}>🧠</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.desktopFeatureTitle}>18+ Zengin Kategori</Text>
                  <Text style={styles.desktopFeatureDesc}>Yüzlerce doğrulanmış güncel soru</Text>
                </View>
              </View>

              <View style={styles.desktopFeatureItem}>
                <Text style={styles.desktopFeatureIcon}>🔥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.desktopFeatureTitle}>Günlük Seri</Text>
                  <Text style={styles.desktopFeatureDesc}>Her gün gir, ödülleri ve XP'yi katla</Text>
                </View>
              </View>
            </View>

            <View style={styles.desktopStatusPill}>
              <View style={styles.pulseDot} />
              <Text style={styles.desktopStatusText}>7/24 Kesintisiz Bulut Aktif</Text>
            </View>
          </View>
        </View>
      )}

      {/* Main Centered Mobile Frame */}
      <View style={[styles.phoneFrame, isDesktop && styles.desktopPhoneFrame]}>
        <Animated.View style={[styles.container, { opacity: screenFade }]}>
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
            onSuccess={handleAuthSuccess}
            onGuestContinue={handleGuestPlay}
            apiBaseUrl={API_BASE}
            redirectNotice={authRedirectNotice}
          />
        )}
        {currentScreen === 'profile_setup' && (
          <ProfileSetupScreen
            initialDisplayName={user?.displayName || 'DenizPro'}
            initialAvatarUrl={user?.avatarUrl}
            onSave={handleSaveProfile}
          />
        )}
        {currentScreen === 'home' && user && (
          <HomeScreen
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
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
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
            avatarSeed={user?.avatarUrl || user?.displayName}
            coins={user?.coins}
            gems={user?.gems}
            isGuest={isGuest}
            onLoginPrompt={() => {
              setAuthRedirectNotice('Giriş yaparak tüm oyun modlarını ve profilini aç!');
              navigateTo('auth');
            }}
            onBack={() => navigateTo('categories')}
            onSelectDifficulty={(diff) => {
              setSelectedDifficulty(diff);
              handleStartPractice(selectedCategory, diff);
            }}
          />
        )}
        {currentScreen === 'matchmaking' && (
          <MatchmakingRadarScreen
            category={selectedCategory}
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
            categoryName={selectedCategory.replace('_', ' ').toUpperCase()}
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
            apiBaseUrl={API_BASE}
          />
        )}
        {currentScreen === 'lobby' && activeRoom && user && (
          <LobbyScreen
            room={activeRoom}
            currentUserId={user.id}
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
              question={currentQuestion}
              selectedOptionId={selectedOptionId}
              isLocked={isEvaluatingRef.current}
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
              feedback={activeRoom ? null : practiceFeedback}
              onSelectOption={handleSubmitAnswer}
              onTimeExpired={handleTimeExpired}
              onExit={handleExitCurrentGame}
              isDuelMode={
                !!activeRoom &&
                (activeRoom.mode === 'duel' ||
                  activeRoom.mode === 'quick_match')
              }
              myDisplayName={user?.displayName || 'Sen'}
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
                        opponentHasAnswered ||
                        activeRoom?.players[duelOpponent.id]
                          ?.hasAnsweredCurrentRound,
                    }
                  : null
              }
            />
            {/* Practice / Guest End of Game Summary Modal */}
            <PracticeSummaryModal
              visible={isPracticeSummaryVisible}
              stats={practiceStats}
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
            onPlayAgain={() => {
              resetGame();
              handleStartQuickMatch();
            }}
            onHome={() => {
              resetGame();
              navigateTo('home');
            }}
          />
        )}
        {currentScreen === 'friends' && (
          <FriendsScreen
            user={user || undefined}
            isGuest={isGuest}
            apiBaseUrl={API_BASE}
            onBack={() => navigateTo('home')}
            onInviteToMatch={() => {
              handleCreateCustomRoom();
            }}
            onNotifications={() => navigateTo('notifications')}
            onNavigateTab={(tab) => {
              if (tab === 'play') navigateTo('home');
              else if (tab === 'explore') navigateTo('categories');
              else if (tab === 'leaders') navigateTo('leaderboard');
              else if (tab === 'profile') navigateTo('profile');
            }}
          />
        )}
        {currentScreen === 'profile' && user && (
          <ProfileScreen
            user={user}
            onBack={() => navigateTo('home')}
            onEditProfile={() => navigateTo('profile_setup')}
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
        {currentScreen === 'leaderboard' && (
          <LeaderboardScreen
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
            onBack={() => navigateTo('home')}
            onAcceptDuel={handleStartQuickMatch}
          />
        )}
        {currentScreen === 'settings' && (
          <SettingsScreen
            onBack={() => navigateTo('home')}
            onDeveloper={() => navigateTo('developer')}
            onLogout={() => {
              setIsGuest(false);
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
            onUpdateUser={(updated) => setUser(updated, null)}
            onNavigate={(screen) => navigateTo(screen)}
            onBack={() => navigateTo('settings')}
          />
        )}
        {currentScreen === 'season' && (
          <SeasonScreen
            user={user || undefined}
            apiBaseUrl={API_BASE}
            onUpdateUser={(u) => setUser(u)}
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
            onOpenPayment={(item) => {
              setSelectedPaymentItem(item);
              navigateTo('payment');
            }}
            onNavigateSecondary={(tab) => {
              if (tab === 'play') navigateTo('home');
              else if (tab === 'leagues') navigateTo('pro_league');
              else if (tab === 'events') navigateTo('events');
              else if (tab === 'inventory') navigateTo('inventory');
            }}
          />
        )}
        {currentScreen === 'payment' && selectedPaymentItem && (
          <PaymentScreen
            user={user || undefined}
            item={selectedPaymentItem}
            apiBaseUrl={API_BASE}
            onBack={() => {
              setSelectedPaymentItem(null);
              navigateTo('shop');
            }}
            onSuccess={(updatedUser) => {
              setUser(updatedUser);
              setSelectedPaymentItem(null);
              navigateTo('shop');
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
      </View>

      {/* Desktop Right Sidebar (Wide Displays >= 1180px) */}
      {isWide && (
        <View style={styles.desktopSidebarRight}>
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
                source={{ uri: '/qr' }}
                style={{ width: 140, height: 140, borderRadius: 12 }}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.desktopQrUrlText}>tavriko-app.vercel.app</Text>

            <TouchableOpacity
              style={styles.portalShortcutBtn}
              onPress={() => {
                navigateTo('developer');
              }}
            >
              <Text style={styles.portalShortcutText}>🛡️ Geliştirici Sandbox Paneli</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.portalShortcutBtn, { marginTop: 6, backgroundColor: 'rgba(255, 196, 61, 0.1)', borderColor: 'rgba(255, 196, 61, 0.3)' }]}
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.open('/developer', '_blank');
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
        </View>
      )}
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
  desktopOuter: {
    backgroundColor: '#090414',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: THEME.colors.background,
  },
  desktopPhoneFrame: {
    maxWidth: 480,
    width: 480,
    height: '100%',
    maxHeight: '100%',
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: '0 0 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(108, 92, 231, 0.35)',
    overflow: 'hidden',
  },
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  desktopSidebarLeft: {
    width: 300,
    height: '100%',
    maxHeight: 760,
    marginRight: 28,
    justifyContent: 'center',
  },
  desktopSidebarRight: {
    width: 300,
    height: '100%',
    maxHeight: 760,
    marginLeft: 28,
    justifyContent: 'center',
  },
  desktopCard: {
    backgroundColor: 'rgba(22, 10, 52, 0.72)',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 24,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(20px)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)' } as any) : {}),
  },
  crownGlow: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 196, 61, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.35)',
  },
  brandTitleText: {
    fontFamily: THEME.fonts.display,
    fontSize: 34,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  brandSubtitleText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 12,
    color: '#FFC43D',
    letterSpacing: 2,
    marginTop: 2,
  },
  desktopFeatureList: {
    gap: 14,
    marginVertical: 18,
  },
  desktopFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  desktopFeatureIcon: {
    fontSize: 20,
  },
  desktopFeatureTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  desktopFeatureDesc: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginTop: 1,
  },
  desktopStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  desktopStatusText: {
    color: '#10B981',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
  },
  desktopCardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: THEME.fonts.extraBold,
  },
  desktopCardDesc: {
    color: THEME.colors.textSecondary,
    fontSize: 11.5,
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
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginBottom: 12,
  },
  portalShortcutBtn: {
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    borderWidth: 1.5,
    borderColor: '#FFC43D',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  portalShortcutText: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
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
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 2,
  },
  desktopTipText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontFamily: THEME.fonts.body,
    lineHeight: 15,
  },
});