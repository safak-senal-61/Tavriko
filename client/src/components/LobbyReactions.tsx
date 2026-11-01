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

export interface FloatingReaction {
  id: string;
  emoji: string;
  xOffset: number;
}

// Sadeleştirilmiş, en popüler 6 reaksiyon (Kral emojisi kaldırıldı)
const REACTION_LIST = ['🔥', '👏', '😂', '❤️', '⚡', '🚀'];

interface LobbyReactionsProps {
  onReactionSent?: (emoji: string) => void;
}

export const LobbyReactions: React.FC<LobbyReactionsProps> = ({
  onReactionSent,
}) => {
  const [floatingList, setFloatingList] = useState<FloatingReaction[]>([]);

  const handlePressEmoji = (emoji: string) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');

    const id = `react_${Date.now()}_${Math.random()}`;
    const xOffset = (Math.random() - 0.5) * 140;

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
      {/* Uçuşan Reaksiyon Emojileri */}
      <View style={styles.floatingArea} pointerEvents="none">
        {floatingList.map((item) => (
          <FloatingEmojiItem
            key={item.id}
            item={item}
            onComplete={() => removeFloating(item.id)}
          />
        ))}
      </View>

      {/* Modern, Sade ve İnce Kapsül Reaksiyon Çubuğu */}
      <View style={styles.pillBar}>
        {REACTION_LIST.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={styles.emojiTouch}
            activeOpacity={0.65}
            onPress={() => handlePressEmoji(emoji)}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
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
      duration: 1200,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      onComplete();
    });
  }, []);

  const translateY = animValue.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, -25, -95],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.15, 0.75, 1],
    outputRange: [0, 1, 0.85, 0],
  });

  const scale = animValue.interpolate({
    inputRange: [0, 0.2, 0.6, 1],
    outputRange: [0.6, 1.35, 1.1, 0.85],
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
    bottom: 40,
    left: 0,
    right: 0,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  floatingItem: {
    position: 'absolute',
  },
  floatingEmojiText: {
    fontSize: 34,
  },
  pillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    width: '100%',
    maxWidth: 320,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  emojiTouch: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 22,
  },
});
