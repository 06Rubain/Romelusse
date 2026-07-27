import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, Alert, FlatList, Image } from 'react-native';
import { Appbar, TextInput, Button, useTheme, Title, Divider, Portal, Dialog, List, IconButton, Text } from 'react-native-paper';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';

export default function InvoiceGeneratorScreen({ navigation }) {
  const theme = useTheme();
  const [clientName, setClientName] = useState('');
  const [type, setType] = useState('Proforma');
  const [loading, setLoading] = useState(false);
  
  const [catalog, setCatalog] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [isDialogVisible, setIsDialogVisible] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const prods = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCatalog(prods);
    };
    fetchCatalog();
  }, []);

  const addProductToInvoice = (product: any) => {
    setSelectedProducts([...selectedProducts, { ...product, quantity: 1 }]);
    setIsDialogVisible(false);
  };

  const removeProduct = (index: number) => {
    const newProducts = [...selectedProducts];
    newProducts.splice(index, 1);
    setSelectedProducts(newProducts);
  };

  const calculateTotal = () => {
    return selectedProducts.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0);
  };

  const generatePDF = async () => {
    if (!clientName) {
      Alert.alert("Erreur", "Veuillez entrer le nom du client.");
      return;
    }
    if (selectedProducts.length === 0) {
      Alert.alert("Erreur", "Veuillez ajouter au moins un produit.");
      return;
    }
    setLoading(true);
    
    const total = calculateTotal();
    
    const invoiceNumber = `070-57-${Math.floor(Math.random() * 10000)}`;
    const dateStr = new Date().toLocaleDateString('fr-FR');
    
    // Récupérer l'URL du logo
    const logoAsset = Image.resolveAssetSource(require('../../assets/ELEMENT FACTURE MP-06.png'));
    const logoUri = logoAsset ? logoAsset.uri : '';

    const itemsHtml = selectedProducts.map(item => `
      <tr>
        <td>${item.quantity}</td>
        <td class="td-left">${item.name}</td>
        <td>${item.price}</td>
        <td>${(parseFloat(item.price) || 0) * item.quantity}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', Arial, sans-serif; margin: 0; padding: 0; color: #000; }
            .header {
              background: linear-gradient(90deg, #00A8B5, #8E24AA, #E57373);
              border-bottom-left-radius: 30px; border-bottom-right-radius: 30px;
              padding: 20px 40px; color: white; display: flex; align-items: center;
              height: 120px;
            }
            .header img { width: 180px; object-fit: contain; }
            .header-divider { width: 2px; height: 80px; background: white; margin: 0 40px; }
            .header-right { flex: 1; }
            .invoice-number-box { display: flex; align-items: center; margin-bottom: 10px; width: fit-content; background: white; }
            .invoice-label { background: #c62828; color: white; padding: 8px 20px; font-weight: bold; font-size: 16px; }
            .invoice-value { color: black; padding: 8px 20px; font-weight: bold; font-size: 16px; }
            .client-info { font-size: 18px; }
            .content { padding: 40px; min-height: 500px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
            th { background: #00A8B5; color: white; padding: 12px; border-left: 2px solid white; border-right: 2px solid white; }
            td { padding: 12px; border-left: 1px solid #ddd; border-right: 1px solid #ddd; text-align: center; color: black; }
            .td-left { text-align: left; }
            .total-row td { font-weight: bold; border: 1px solid #ddd; color: black; }
            .total-general td { background: #00A8B5; color: white; font-weight: bold; border: none; }
            .footer { display: flex; justify-content: space-between; padding: 0 40px 20px 40px; font-size: 10px; line-height: 1.5; }
            .footer-left { width: 60%; }
            .footer-right { width: 35%; text-align: center; position: relative; }
            .paye-watermark { color: #ffcdd2; font-size: 60px; font-weight: bold; position: absolute; top: -40px; left: 20px; z-index: -1; opacity: 0.7; }
            .signature-area { margin-top: 40px; border-top: 1px solid #000; display: inline-block; padding-top: 5px; }
            .bottom-banner { height: 40px; background: linear-gradient(90deg, #00A8B5, #8E24AA, #E57373); border-top-left-radius: 30px; border-top-right-radius: 30px; margin: 0 20px; }
            .amount-words { font-size: 14px; font-style: italic; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUri}" alt="Logo" />
            <div class="header-divider"></div>
            <div class="header-right">
              <div class="invoice-number-box">
                <div class="invoice-label">${type.toUpperCase()} N°</div>
                <div class="invoice-value">: ${invoiceNumber}</div>
              </div>
                <div class="client-info">Client : <strong>${(clientName || '').toUpperCase()}</strong></div>
            </div>
          </div>
          
          <div class="content">
            <table>
              <thead>
                <tr>
                  <th style="width: 10%;">Qté</th>
                  <th style="width: 50%;">Désignation</th>
                  <th style="width: 20%;">P.U$</th>
                  <th style="width: 20%;">P.T$</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr class="total-row">
                  <td colspan="2" style="border: none;"></td>
                  <td>Total</td>
                  <td>${total}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="2" style="border: none;"></td>
                  <td>Remise</td>
                  <td>-</td>
                </tr>
                <tr class="total-general">
                  <td colspan="2" style="background: white;"></td>
                  <td>Total général</td>
                  <td>${total}</td>
                </tr>
              </tbody>
            </table>
            
            <div class="amount-words">
              Montant en toutes lettres<br/>
              <strong>Un montant de ${total} USD</strong>
            </div>
          </div>

          <div class="footer">
            <div class="footer-left">
              <strong>6, av. Macampagne, Q/Jolie-parc, Kinshasa/ Ngaliema.</strong><br/>
              E-mail: <strong>melanineprint@hotmail.com</strong><br/>
              Tel: <strong>+243 890 360 756 / 820 600 566</strong><br/><br/>
              Numéro d'impôt : <strong>A2546990E</strong><br/>
              Identification nationale : <strong>01-C1700-N79672H</strong><br/>
              RCCM : <strong>CD/KNG/RCCM/25-A-06400</strong><br/><br/>
              Coordonnées bancaire<br/>
              RAWBANK : <strong>05100-00004-01205505001-17 USD</strong><br/>
              Nom de compte bancaire : <strong>ETS MELANINE PRINT</strong>
            </div>
            <div class="footer-right">
              <div class="paye-watermark">PAYÉ</div>
              Fait à Kinshasa le ${dateStr}<br/>
              <br/><br/><br/>
              <strong>La direction</strong>
            </div>
          </div>
          <div class="bottom-banner"></div>
        </body>
      </html>
    `;

    try {
      // Sauvegarder dans Firestore
      await addDoc(collection(db, 'invoices'), {
        client: clientName,
        type: type,
        date: dateStr,
        total: total + ' USD',
        products: selectedProducts,
        number: invoiceNumber,
        status: 'En attente',
        createdAt: new Date()
      });

      // Générer le PDF
      if (Platform.OS === 'web') {
        // Sur le web, on déclenche directement l'impression du navigateur
        await Print.printAsync({ html });
      } else {
        // Sur mobile, on crée le fichier et on ouvre le menu de partage
        const { uri } = await Print.printToFileAsync({ html });
        await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
      
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Erreur", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
        <Appbar.BackAction color="white" onPress={() => navigation.goBack()} />
        <Appbar.Content title="Générer Facture" color="white" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Title style={{ marginBottom: 20 }}>Détails de la facture</Title>
        
        <TextInput
          label="Nom du Client / Fournisseur"
          value={clientName}
          onChangeText={setClientName}
          mode="outlined"
          style={styles.input}
        />

        <View style={styles.typeButtons}>
          <Button 
            mode={type === 'Proforma' ? 'contained' : 'outlined'} 
            onPress={() => setType('Proforma')}
            style={styles.flexButton}
          >
            Proforma
          </Button>
          <View style={{ width: 10 }} />
          <Button 
            mode={type === 'Achat' ? 'contained' : 'outlined'} 
            onPress={() => setType('Achat')}
            style={styles.flexButton}
          >
            Achat
          </Button>
        </View>

        <Divider style={{ marginVertical: 20 }} />
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Title>Produits de la facture</Title>
          <Button mode="contained-tonal" icon="plus" onPress={() => setIsDialogVisible(true)}>Ajouter</Button>
        </View>

        {selectedProducts.length === 0 ? (
          <Text style={{ textAlign: 'center', color: 'gray', marginVertical: 20 }}>Aucun produit ajouté</Text>
        ) : (
          selectedProducts.map((item, index) => (
            <View key={index} style={styles.simulatedProduct}>
              <View style={{ flex: 1 }}>
                <Title style={{ fontSize: 16 }}>{item.name}</Title>
                <Text style={{ color: 'gray' }}>Prix unitaire: {item.price} €</Text>
              </View>
              <IconButton icon="delete" iconColor="red" size={20} onPress={() => removeProduct(index)} />
            </View>
          ))
        )}

        {selectedProducts.length > 0 && (
          <Title style={{ textAlign: 'right', marginTop: 10, color: theme.colors.primary }}>
            Total: {calculateTotal()} €
          </Title>
        )}

        <Button 
          mode="contained" 
          icon="file-pdf-box"
          onPress={generatePDF} 
          style={styles.pdfButton}
          contentStyle={{ paddingVertical: 10 }}
          loading={loading}
          disabled={loading}
        >
          Générer et Partager PDF
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={isDialogVisible} onDismiss={() => setIsDialogVisible(false)}>
          <Dialog.Title>Sélectionner un produit</Dialog.Title>
          <Dialog.Content>
            {catalog.length === 0 ? (
              <Text>Aucun produit dans le catalogue. Veuillez d'abord en créer dans l'onglet Produits.</Text>
            ) : (
              <FlatList
                data={catalog}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <List.Item
                    title={item.name}
                    description={`${item.price} €`}
                    onPress={() => addProductToInvoice(item)}
                    left={props => <List.Icon {...props} icon="package-variant" />}
                  />
                )}
                style={{ maxHeight: 300 }}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsDialogVisible(false)}>Fermer</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  typeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  flexButton: {
    flex: 1,
  },
  simulatedProduct: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  pdfButton: {
    marginTop: 30,
    borderRadius: 8,
    backgroundColor: '#D32F2F', // Red for PDF
  }
});
