import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { socketService } from '../services/socketService';
import { THEME } from '../theme/tokens';
import { CategoryId, DifficultyLevel, ClientQuestion, RoundResult, FinalMatchSummary, GameRoom } from '@trivia/shared';

// Screens
import { SplashScreen } from '../screens/SplashScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { CategoryExploreScreen } from '../screens/CategoryExploreScreen';
import { DifficultySelectScreen } from '../screens/DifficultySelectScreen';
import { MatchmakingRadarScreen } from '../screens/MatchmakingRadarScreen';
import { CustomRoomScreen } from '../screens/CustomRoomScreen';
import { LobbyScreen } from '../screens/LobbyScreen';
import { QuizArenaScreen } from '../screens/QuizArenaScreen';
import { AnswerFeedbackModal } from '../screens/AnswerFeedbackModal';
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

export type ScreenName =
  | 'splash'
  | 'auth'
  | 'profile_setup'
  | 'home'
  | 'categories'
  | 'difficulty'
  | 'matchmaking'
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
  | 'error';

const API_BASE = 'http://localhost:4000/api';

export const RootNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('splash');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('general_culture');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('medium');
  const [errorMessage, setErrorMessage] = useState<string>('');

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

  // Socket event subscription
  useEffect(() => {
    const socket = socketService.connect();

    const unsubSync = socketService.onStateSync((room: GameRoom) => {
      setActiveRoom(room);
      if (room.status === 'lobby' && currentScreen !== 'lobby') {
        setCurrentScreen('lobby');
      }
    });

    const unsubQuestion = socketService.onQuestionStart((question: ClientQuestion) => {
      setCurrentQuestion(question);
      setRoundResult(null);
      setCurrentScreen('quiz_arena');
    });

    const unsubRoundResult = socketService.onRoundResult((result: RoundResult) => {
      setRoundResult(result);
      setTimeout(() => {
        setCurrentScreen('intermission');
      }, 2500);
    });

    const unsubGameOver = socketService.onGameOver((summary: FinalMatchSummary) => {
      setFinalSummary(summary);
      setCurrentScreen('match_result');
    });

    const unsubMatchFound = socketService.onMatchFound((data) => {
      if (user) {
        socketService.joinRoom(data.roomCode, user.id, user.displayName, user.avatarUrl);
      }
    });

    return () => {
      unsubSync();
      unsubQuestion();
      unsubRoundResult();
      unsubGameOver();
      unsubMatchFound();
    };
  }, [user, currentScreen]);

  // Auth actions
  const handleGuestPlay = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Misafir Oyuncu' }),
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user, data.token);
        setCurrentScreen('profile_setup');
      }
    } catch {
      // Offline / fallback demo guest user
      const fallbackUser = {
        id: 'guest_local_' + Math.random().toString(36).substring(2, 7),
        username: 'misafir_oyuncu',
        displayName: 'Misafir Oyuncu',
        level: 1,
        xp: 0,
        coins: 200,
        rankTitle: 'Acemi Kaşif',
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
      setCurrentScreen('profile_setup');
    }
  };

  const handleLogin = async (username: string, pass: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Giriş yapılamadı');
    setUser(data.user, data.token);
    setCurrentScreen('home');
  };

  const handleRegister = async (username: string, displayName: string, pass: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kayıt başarısız');
    setUser(data.user, data.token);
    setCurrentScreen('profile_setup');
  };

  const handleSaveProfile = (name: string, avatarSeed: string) => {
    if (user) {
      setUser({
        ...user,
        displayName: name,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`,
      });
    }
    setCurrentScreen('home');
  };

  // Matchmaking & Room Actions
  const handleStartQuickMatch = () => {
    if (!user) return;
    socketService.findMatch(user.id, user.displayName, user.avatarUrl, 'quick_match', selectedCategory);
    setCurrentScreen('matchmaking');
  };

  const handleCancelMatchmaking = () => {
    if (user) socketService.cancelMatch(user.id);
    setCurrentScreen('home');
  };

  const handleCreateCustomRoom = () => {
    if (!user) return;
    const socket = socketService.getSocket();
    const mockCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    socketService.joinRoom(mockCode, user.id, user.displayName, user.avatarUrl);
    setCurrentScreen('lobby');
  };

  const handleJoinCustomRoom = (code: string) => {
    if (!user) return;
    socketService.joinRoom(code, user.id, user.displayName, user.avatarUrl);
    setCurrentScreen('lobby');
  };

  const handleToggleReady = () => {
    if (activeRoom && user) {
      socketService.toggleReady(activeRoom.code, user.id);
    }
  };

  const handleStartGame = () => {
    if (activeRoom && user) {
      socketService.startGame(activeRoom.code, user.id);
    }
  };

  const handleSubmitAnswer = (optionId: string) => {
    selectOption(optionId);
    if (activeRoom && user) {
      socketService.submitAnswer(activeRoom.code, user.id, optionId);
    }
  };

  // Single player / Practice action
  const handleStartPractice = (category: CategoryId, difficulty: DifficultyLevel) => {
    setSelectedCategory(category);
    setSelectedDifficulty(difficulty);
    // Scaffolds a single player arena question
    const practiceQuestion: ClientQuestion = {
      id: 'practice_q1',
      categoryId: category,
      difficulty,
      text: 'Türkiye\'nin başkenti neresidir?',
      options: [
        { id: 'opt_a', text: 'İstanbul' },
        { id: 'opt_b', text: 'Ankara' },
        { id: 'opt_c', text: 'İzmir' },
        { id: 'opt_d', text: 'Bursa' },
      ],
      roundNumber: 1,
      totalRounds: 5,
      timeLimitSec: 15,
    };
    setCurrentQuestion(practiceQuestion);
    setCurrentScreen('quiz_arena');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      <View style={styles.container}>
        {currentScreen === 'splash' && (
          <SplashScreen onFinish={() => setCurrentScreen(user ? 'home' : 'auth')} />
        )}

        {currentScreen === 'auth' && (
          <AuthScreen
            onLogin={handleLogin}
            onRegister={handleRegister}
            onGuestPlay={handleGuestPlay}
          />
        )}

        {currentScreen === 'profile_setup' && (
          <ProfileSetupScreen
            initialDisplayName={user?.displayName || 'Oyuncu'}
            onSave={handleSaveProfile}
          />
        )}

        {currentScreen === 'home' && user && (
          <HomeScreen
            user={user}
            onQuickMatch={handleStartQuickMatch}
            onCustomRoom={() => setCurrentScreen('custom_room')}
            onExploreCategories={() => setCurrentScreen('categories')}
            onDailyChallenge={() => setCurrentScreen('daily_challenge')}
            onPractice={() => setCurrentScreen('practice')}
            onLeaderboard={() => setCurrentScreen('leaderboard')}
            onFriends={() => setCurrentScreen('friends')}
            onProfile={() => setCurrentScreen('profile')}
            onNotifications={() => setCurrentScreen('notifications')}
            onSettings={() => setCurrentScreen('settings')}
          />
        )}

        {currentScreen === 'categories' && (
          <CategoryExploreScreen
            onBack={() => setCurrentScreen('home')}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setCurrentScreen('difficulty');
            }}
          />
        )}

        {currentScreen === 'difficulty' && (
          <DifficultySelectScreen
            categoryId={selectedCategory}
            onBack={() => setCurrentScreen('categories')}
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
            onCancel={handleCancelMatchmaking}
          />
        )}

        {currentScreen === 'custom_room' && (
          <CustomRoomScreen
            onBack={() => setCurrentScreen('home')}
            onCreateRoom={handleCreateCustomRoom}
            onJoinRoom={handleJoinCustomRoom}
          />
        )}

        {currentScreen === 'lobby' && activeRoom && user && (
          <LobbyScreen
            room={activeRoom}
            currentUserId={user.id}
            onBack={() => {
              resetGame();
              setCurrentScreen('home');
            }}
            onToggleReady={handleToggleReady}
            onStartGame={handleStartGame}
          />
        )}

        {currentScreen === 'quiz_arena' && currentQuestion && user && (
          <>
            <QuizArenaScreen
              question={currentQuestion}
              selectedOptionId={selectedOptionId}
              isLocked={isAnswerLocked}
              streak={user.stats.bestStreak || 0}
              currentScore={user.rankPoints || 0}
              onSelectOption={handleSubmitAnswer}
            />
            {lastRoundResult && (
              <AnswerFeedbackModal
                visible={!!lastRoundResult}
                isCorrect={lastRoundResult.playerAnswers[user.id]?.isCorrect ?? true}
                correctAnswerText={lastRoundResult.correctOptionId}
                explanation={lastRoundResult.explanation}
                pointsEarned={lastRoundResult.playerAnswers[user.id]?.pointsEarned ?? 1000}
                speedBonus={lastRoundResult.playerAnswers[user.id]?.speedBonus ?? 250}
                streak={lastRoundResult.playerAnswers[user.id]?.streak ?? 1}
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
          />
        )}

        {currentScreen === 'match_result' && finalSummary && user && (
          <MatchResultPodiumScreen
            summary={finalSummary}
            currentUserId={user.id}
            onPlayAgain={() => {
              resetGame();
              handleStartQuickMatch();
            }}
            onHome={() => {
              resetGame();
              setCurrentScreen('home');
            }}
          />
        )}

        {currentScreen === 'friends' && (
          <FriendsScreen
            onBack={() => setCurrentScreen('home')}
            onInviteToMatch={(fId) => {
              handleCreateCustomRoom();
            }}
          />
        )}

        {currentScreen === 'profile' && user && (
          <ProfileScreen
            user={user}
            onBack={() => setCurrentScreen('home')}
            onEditProfile={() => setCurrentScreen('profile_setup')}
          />
        )}

        {currentScreen === 'leaderboard' && (
          <LeaderboardScreen onBack={() => setCurrentScreen('home')} />
        )}

        {currentScreen === 'daily_challenge' && (
          <DailyChallengeScreen
            onBack={() => setCurrentScreen('home')}
            onStartDaily={() => handleStartPractice('mixed', 'medium')}
          />
        )}

        {currentScreen === 'practice' && (
          <SinglePlayerPracticeScreen
            onBack={() => setCurrentScreen('home')}
            onStartPractice={handleStartPractice}
          />
        )}

        {currentScreen === 'notifications' && (
          <NotificationsScreen onBack={() => setCurrentScreen('home')} />
        )}

        {currentScreen === 'settings' && (
          <SettingsScreen
            onBack={() => setCurrentScreen('home')}
            onLogout={() => {
              setUser(null, null);
              resetGame();
              setCurrentScreen('auth');
            }}
          />
        )}

        {currentScreen === 'reconnect' && (
          <ReconnectScreen
            onRetry={() => {
              socketService.connect();
              setCurrentScreen('home');
            }}
            onExitToHome={() => {
              resetGame();
              setCurrentScreen('home');
            }}
          />
        )}

        {currentScreen === 'error' && (
          <ErrorStateScreen
            message={errorMessage}
            onRetry={() => setCurrentScreen('home')}
            onHome={() => setCurrentScreen('home')}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
});
