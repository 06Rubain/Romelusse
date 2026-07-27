import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const theme = useTheme();

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigation.replace('Dashboard');
    } catch (error: any) {
      Alert.alert("Erreur de connexion", error.message);
    }
  };

  const handleSignUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigation.replace('Dashboard');
    } catch (error: any) {
      Alert.alert("Erreur d'inscription", error.message);
    }
  };

  const handleGoogleLogin = async () => {
    if (Platform.OS === 'web') {
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        navigation.replace('Dashboard');
      } catch (error: any) {
        Alert.alert("Erreur Google", error.message);
      }
    } else {
      Alert.alert(
        "Configuration requise", 
        "La connexion Google sur Mobile nécessite des clés OAuth Google Cloud spécifiques. Pour l'instant, cela fonctionne sur le Web !"
      );
    }
  };

  return (
    <LinearGradient 
      colors={['#2B2861', '#00A8B5']} 
      style={styles.gradientBackground}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animatable.View animation="fadeInUp" duration={1000} style={styles.formContainer}>
          <View style={styles.header}>
            <Image 
              source={require('../../assets/ELEMENT FACTURE MP-01.png')} 
              style={styles.logo} 
            />
            <Text variant="titleMedium" style={{ color: 'gray', marginTop: 12 }}>Gérez vos factures avec élégance</Text>
          </View>

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />
        
        <Button 
          mode="contained" 
          onPress={handleLogin} 
          style={styles.button}
          contentStyle={{ paddingVertical: 8 }}
          labelStyle={{ fontSize: 18 }}
        >
          Se connecter
        </Button>
        <Button 
          mode="outlined" 
          onPress={handleSignUp} 
          style={styles.button}
          contentStyle={{ paddingVertical: 8 }}
          labelStyle={{ fontSize: 18 }}
        >
          Créer un compte
        </Button>
          <Button 
            mode="text" 
            icon="google"
            onPress={handleGoogleLogin} 
            style={styles.googleButton}
            labelStyle={{ fontSize: 16 }}
          >
            Continuer avec Google
          </Button>
        </Animatable.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 280,
    height: 80,
    resizeMode: 'contain',
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  button: {
    marginTop: 20,
    borderRadius: 8,
  },
  googleButton: {
    marginTop: 15,
  }
});
