import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SessionProvider, useSession } from '@/ctx';

// Keep the native splash screen visible until the stored session is restored,
// then hand over to <AnimatedSplashOverlay />, which hides it with an animation.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SessionProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootNavigator />
      </ThemeProvider>
    </SessionProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useSession();

  return (
    <>
      {/* Only mount once auth state is known, so the splash covers any redirect. */}
      {!isLoading && <AnimatedSplashOverlay />}
      <Stack screenOptions={{ headerShown: false }}>
        {/* Authenticated app: tabs behind (app). Unauthenticated users are
            redirected to the first available screen below — login. */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>

        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
