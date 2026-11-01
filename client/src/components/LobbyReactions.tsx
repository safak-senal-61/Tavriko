import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { sound } from '../services/soundService';
import { THEME } from '../theme/tokens';

export interface FloatingReaction {
  id: string;
  emoji: string;
  xOffset: number;
}

const REACTION_LIST = ['🔥', '👑', '👏', '😂', '❤️', '⚡', '🎯', '🚀'];

interface LobbyReactionsProps {
  onReactionSent?: (emoji: string) => void;
}

export const LobbyReactions: React.FC<LobbyReactionsProps> = ({
  onReactionSent,
}) => {
  const [floatingList, setFloatingList] = useState<FloatingReaction[]>([]);

  const handlePressEmoji = (emoji: string) => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');

    const id = `react_${Date.now()}_${Math.random()}`;
    const xOffset = (Math.random() - 0.5) * 120;

    setFloatingList((prev) => [...prev, { id, emoji, xOffset }]);

    if (onReactionSent) {
      onReactionSent(emoji);
    }
  };

  const removeFloating = (id: string) => {
    setFloatingList((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <View style={styles.container}>
      {/* Uçuşan Reaksiyon Emojileri (Floating Particles) */}
      <View style={styles.floatingArea} pointerEvents="none">
        {floatingList.map((item) => (
          <FloatingEmojiItem
            key={item.id}
            item={item}
            onComplete={() => removeFloating(item.id)}
          />
        ))}
      </View>

      {/* Reaksiyon Seçim Çubuğu */}
      <View style={styles.barWrapper}>
        <Text style={styles.barTitle}>LOBİ REAKSİYONLARI</Text>
        <View style={styles.reactionsRow}>
          {REACTION_LIST.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionBtn}
              activeOpacity={0.7}
              onPress={() => handlePressEmoji(emoji)}
            >
              <Text style={styles.reactionEmojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

interface FloatingEmojiItemProps {
  item: FloatingReaction;
  onComplete: () => void;
}

const FloatingEmojiItem: React.FC<FloatingEmojiItemProps> = ({
  item,
  onComplete,
}) => {
  const animValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animValue, {
      toValue: 1,
      duration: 1300,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      onComplete();
    });
  }, []);

  const translateY = animValue.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, -30, -110],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 1, 0.8, 0],
  });

  const scale = animValue.interpolate({
    inputRange: [0, 0.2, 0.6, 1],
    outputRange: [0.5, 1.4, 1.1, 0.8],
  });

  return (
    <Animated.View
      style={[
        styles.floatingItem,
        {
          transform: [
            { translateX: item.xOffset },
            { translateY },
            { scale },
          ],
          opacity,
        },
      ]}
    >
      <Text style={styles.floatingEmojiText}>{item.emoji}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 10,
    position: 'relative',
  },
  floatingArea: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  floatingItem: {
    position: 'absolute',
  },
  floatingEmojiText: {
    fontSize: 36,
  },
  barWrapper: {
    backgroundColor: 'rgba(10, 4, 30, 0.75)',
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(154, 107, 255, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    alignItems: 'center',
  },
  barTitle: {
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '900',
    color: '#D9CDF5',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  reactionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmojiText: {
    fontSize: 18,
  },
});
