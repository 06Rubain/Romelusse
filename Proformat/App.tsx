import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider, MD3LightTheme as DefaultTheme } from 'react-native-paper';
import AppNavigator from './src/navigation/AppNavigator';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2B2861', // Bleu Indigo du logo "Imprimerie"
    secondary: '#00A8B5', // Cyan/Teal du dégradé
    background: '#f5f5f5',
  },
};

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <AppNavigator />
      <StatusBar style="auto" />
    </PaperProvider>
  );
}
