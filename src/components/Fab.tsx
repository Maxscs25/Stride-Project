import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Platform, Pressable } from 'react-native';

import { useTheme } from '@/theme';

export function Fab() {
  const { colors } = useTheme();
  return (
    <Link href="/log" asChild>
      <Pressable
        style={{
          position: 'absolute',
          right: 20,
          bottom: Platform.OS === 'web' ? 84 : 96,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}>
        <Ionicons name="add" size={30} color={colors.onAccent} />
      </Pressable>
    </Link>
  );
}
