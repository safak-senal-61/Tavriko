import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { sound } from '../services/soundService';

interface SegmentedFilterProps {
  activeTab: 'general' | 'special';
  onChange: (tab: 'general' | 'special') => void;
  width?: number;
}

export const SegmentedFilter: React.FC<SegmentedFilterProps> = ({
  activeTab,
  onChange,
  width = 250,
}) => {
  const slideAnim = useRef(new Animated.Value(activeTab === 'general' ? 0 : 1)).current;
  const pillWidth = width / 2;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeTab === 'general' ? 0 : 1,
      useNativeDriver: Platform.OS !== 'web',
      friction: 7,
      tension: 60,
    }).start();
  }, [activeTab]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, pillWidth - 2],
  });

  const handleTabPress = (tab: 'general' | 'special') => {
    if (tab !== activeTab) {
      sound.playSound('tap');
      sound.triggerHaptic('light');
      onChange(tab);
    }
  };

  return (
    <View style={[styles.track, { width, height: 46 }]}>
      {/* Tavriko Cyber Gradient Pill Indicator */}
      <Animated.View
        style={[
          styles.pillIndicator,
          {
            width: pillWidth - 4,
            height: 40,
            transform: [{ translateX }],
          },
        ]}
      >
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="tavrikoPillGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#6B3CFF" />
              <Stop offset="1" stopColor="#5ADBB5" />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx="20"
            ry="20"
            fill="url(#tavrikoPillGrad)"
            stroke="#FFFFFF"
            strokeWidth="1.2"
            strokeOpacity={0.4}
          />
        </Svg>
      </Animated.View>

      {/* Butonlar */}
      <TouchableOpacity
        style={styles.tabButton}
        activeOpacity={0.8}
        onPress={() => handleTabPress('general')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'general' ? styles.tabTextActive : styles.tabTextInactive,
          ]}
        >
          Genel
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabButton}
        activeOpacity={0.8}
        onPress={() => handleTabPress('special')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'special' ? styles.tabTextActive : styles.tabTextInactive,
          ]}
        >
          Özel
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    backgroundColor: 'rgba(18, 7, 44, 0.92)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  pillIndicator: {
    position: 'absolute',
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#5ADBB5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        filter: 'drop-shadow(0px 4px 10px rgba(90, 219, 181, 0.35))',
      },
    }),
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  tabText: {
    fontSize: 15,
    fontFamily: 'Nunito_900Black',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tabTextInactive: {
    color: '#A79BC4',
  },
});
