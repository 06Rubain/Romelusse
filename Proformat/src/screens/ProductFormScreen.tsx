import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Appbar, TextInput, Button, useTheme } from 'react-native-paper';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';

export default function ProductFormScreen({ navigation, route }) {
  const theme = useTheme();
  const productToEdit = route.params?.product;

  const [name, setName] = useState(productToEdit ? productToEdit.name : '');
  const [description, setDescription] = useState(productToEdit ? productToEdit.description : '');
  const [price, setPrice] = useState(productToEdit ? productToEdit.price : '');

  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !price) {
      Alert.alert("Erreur", "Veuillez remplir le nom et le prix.");
      return;
    }
    setLoading(true);
    try {
      if (productToEdit) {
        // Mode Édition
        const productRef = doc(db, 'products', productToEdit.id);
        await updateDoc(productRef, {
          name,
          description,
          price
        });
      } else {
        // Mode Création
        await addDoc(collection(db, 'products'), {
          name,
          description,
          price,
          createdAt: new Date()
        });
      }
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Erreur", error.message);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
        <Appbar.BackAction color="white" onPress={() => navigation.goBack()} />
        <Appbar.Content title={productToEdit ? "Modifier le produit" : "Ajouter un produit"} color="white" />
      </Appbar.Header>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TextInput
          label="Nom du produit/service"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={styles.input}
        />
        <TextInput
          label="Prix"
          value={price}
          onChangeText={setPrice}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
        />
        
        <Button 
          mode="contained" 
          onPress={handleSave} 
          style={styles.button}
          contentStyle={{ paddingVertical: 8 }}
          loading={loading}
          disabled={loading}
        >
          Enregistrer
        </Button>
      </KeyboardAvoidingView>
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
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    elevation: 2,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  button: {
    marginTop: 10,
    borderRadius: 8,
  }
});
