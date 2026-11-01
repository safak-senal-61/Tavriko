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
  width = 240,
}) => {
  const slideAnim = useRef(new Animated.Value(activeTab === 'general' ? 0 : 1)).current;
  const pillWidth = width / 2;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeTab === 'general' ? 0 : 1,
      useNativeDriver: Platform.OS !== 'web',
      friction: 8,
      tension: 65,
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
    <View style={[styles.track, { width, height: 44 }]}>
      {/* Kayan Degrade Hap (Animated Pill) */}
      <Animated.View
        style={[
          styles.pillIndicator,
          {
            width: pillWidth - 4,
            height: 38,
            transform: [{ translateX }],
          },
        ]}
      >
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="pillGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#0099FF" />
              <Stop offset="1" stopColor="#6C28E0" />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx="19"
            ry="19"
            fill="url(#pillGrad)"
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#4A1D96',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  pillIndicator: {
    position: 'absolute',
    borderRadius: 19,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0099FF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 5,
      },
      android: {
        elevation: 4,
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
    fontSize: 16,
    fontFamily: 'Nunito_800ExtraBold',
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: '#241050',
  },
});
