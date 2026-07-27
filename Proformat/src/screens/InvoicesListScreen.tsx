import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Platform, Alert, Image } from 'react-native';
import { Appbar, FAB, Card, Title, Paragraph, useTheme, Chip, ActivityIndicator, IconButton } from 'react-native-paper';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { db } from '../services/firebaseConfig';

export default function InvoicesListScreen({ navigation }) {
  const theme = useTheme();
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invoicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvoices(invoicesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'invoices', id));
    } catch (error) {
      Alert.alert("Erreur", "Impossible de supprimer la facture.");
    }
  };

  const handlePrint = async (item: any) => {
    try {
      const logoAsset = Image.resolveAssetSource(require('../../assets/ELEMENT FACTURE MP-06.png'));
      const logoUri = logoAsset ? logoAsset.uri : '';

      const itemsHtml = (item.products || []).map((prod: any) => `
        <tr>
          <td>${prod.quantity}</td>
          <td class="td-left">${prod.name}</td>
          <td>${prod.price}</td>
          <td>${(parseFloat(prod.price) || 0) * prod.quantity}</td>
        </tr>
      `).join('');

      const totalVal = parseFloat((item.total || '').replace(/[^0-9.]/g, '')) || 0;

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
                  <div class="invoice-label">${item.type ? item.type.toUpperCase() : 'FACTURE'} N°</div>
                  <div class="invoice-value">: ${item.number}</div>
                </div>
                <div class="client-info">Client : <strong>${(item.client || 'Client Inconnu').toUpperCase()}</strong></div>
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
                    <td>${totalVal}</td>
                  </tr>
                  <tr class="total-row">
                    <td colspan="2" style="border: none;"></td>
                    <td>Remise</td>
                    <td>-</td>
                  </tr>
                  <tr class="total-general">
                    <td colspan="2" style="background: white;"></td>
                    <td>Total général</td>
                    <td>${item.total}</td>
                  </tr>
                </tbody>
              </table>
              
              <div class="amount-words">
                Montant en toutes lettres<br/>
                <strong>Un montant de ${item.total}</strong>
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
                Fait à Kinshasa le ${item.date}<br/>
                <br/><br/><br/>
                <strong>La direction</strong>
              </div>
            </div>
            <div class="bottom-banner"></div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
    } catch (err) {
      console.log(err);
    }
  };

  const renderItem = ({ item }) => (
    <Card style={styles.card} onPress={() => handlePrint(item)}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.textContainer}>
          <Title>{item.number} - {item.client}</Title>
          <Paragraph>{item.date}</Paragraph>
          <Paragraph style={{ color: theme.colors.primary, fontWeight: 'bold', marginTop: 5 }}>
            {item.total}
          </Paragraph>
        </View>
        <View style={styles.badges}>
          <Chip style={{ marginBottom: 5 }} textStyle={{ fontSize: 10 }}>{item.type}</Chip>
          <IconButton icon="printer" size={20} iconColor={theme.colors.primary} onPress={() => handlePrint(item)} />
          <IconButton icon="delete" size={20} iconColor="red" onPress={() => handleDelete(item.id)} />
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
        <Appbar.BackAction color="white" onPress={() => navigation.goBack()} />
        <Appbar.Content title="Factures" color="white" />
      </Appbar.Header>

      {loading ? (
        <ActivityIndicator animating={true} color={theme.colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="white"
        onPress={() => navigation.navigate('InvoiceGenerator')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
  badges: {
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 30,
  },
});
