import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, Minus } from 'lucide-react-native';
import { useReducedMotion } from './DiscoveryArtwork';

/** Same accessible, interruptible toggle on the profile and full settings page. */
export const PreferenceSwitch: React.FC<{
  value: boolean; onValueChange: (value: boolean) => void; label: string;
}> = ({ value, onValueChange, label }) => {
  const reduced = useReducedMotion();
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.spring(position, {
      toValue: value ? 1 : 0, damping: 20, stiffness: 250,
      mass: 0.8, useNativeDriver: Platform.OS !== 'web',
    });
    if (reduced) position.setValue(value ? 1 : 0);
    else animation.start();
    return () => animation.stop();
  }, [position, value, reduced]);
  return (
    <TouchableOpacity accessibilityRole="switch" accessibilityLabel={label}
      accessibilityState={{ checked: value }} aria-checked={value} activeOpacity={0.85}
      onPress={() => onValueChange(!value)} style={styles.target}>
      <Animated.View style={[styles.track, { backgroundColor: value ? '#85E6C6' : '#514467' }]}>
        <Animated.View style={[styles.thumb, {
          transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) }],
        }]}>
          {value ? <Check size={13} color="#17634D" strokeWidth={3} /> : <Minus size={13} color="#6F627F" />}
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};
const styles = StyleSheet.create({
  target: { width: 56, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  track: { width: 52, height: 30, borderRadius: 16, padding: 3 },
  thumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
