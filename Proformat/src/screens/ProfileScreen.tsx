import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, Platform } from 'react-native';
import { Appbar, Button, Text, useTheme, Avatar, TextInput, ActivityIndicator } from 'react-native-paper';
import { signOut, User, updateProfile } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';

export default function ProfileScreen({ navigation }: any) {
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
      setDisplayName(currentUser.displayName || '');
      setPhotoURL(currentUser.photoURL || null);
    }
  }, []);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user, {
        displayName: displayName
      });
      
      setUser({ ...user, displayName } as User);
      Alert.alert("Succès", "Votre profil a été mis à jour !");
    } catch (error: any) {
      Alert.alert("Erreur", "Impossible de mettre à jour le profil : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Rediriger vers l'écran de connexion après la déconnexion
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error: any) {
      Alert.alert("Erreur de déconnexion", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
        <Appbar.BackAction color="white" onPress={() => navigation.goBack()} />
        <Appbar.Content title="Mon Profil" color="white" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerContainer}>
          <Avatar.Icon size={100} icon="account" style={{ backgroundColor: theme.colors.primary }} />
          
          <Text variant="headlineSmall" style={styles.emailText}>
            {user?.email || "Utilisateur inconnu"}
          </Text>
          <Text variant="bodyMedium" style={{ color: 'gray' }}>
            Compte Mélanine print
          </Text>
        </View>

        <TextInput
          label="Nom complet"
          value={displayName}
          onChangeText={setDisplayName}
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="account" />}
        />

        <Button 
          mode="contained" 
          icon="content-save"
          onPress={handleUpdateProfile} 
          style={styles.saveButton}
          contentStyle={{ paddingVertical: 8 }}
          loading={loading}
          disabled={loading}
        >
          Enregistrer les modifications
        </Button>

        <Button 
          mode="contained" 
          icon="logout"
          onPress={handleSignOut} 
          style={styles.logoutButton}
          buttonColor="#D32F2F"
          contentStyle={{ paddingVertical: 8 }}
        >
          Se déconnecter
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 80,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  editPhotoText: {
    marginTop: 8,
    color: '#1E88E5',
    fontWeight: '600',
  },
  emailText: {
    marginTop: 8,
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    backgroundColor: 'white',
    marginBottom: 20,
  },
  saveButton: {
    width: '100%',
    borderRadius: 8,
    marginBottom: 40,
  },
  logoutButton: {
    width: '100%',
    borderRadius: 8,
  }
});
