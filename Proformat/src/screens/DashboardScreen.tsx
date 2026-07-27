import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Title, Paragraph, useTheme, Appbar, FAB } from 'react-native-paper';

export default function DashboardScreen({ navigation }) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
        <Appbar.Content title="Tableau de bord" color="white" />
        <Appbar.Action icon="account-circle" color="white" onPress={() => navigation.navigate('Profile')} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text variant="bodyLarge" style={{ color: 'black', opacity: 0.9 }}>Bienvenue sur Mélanine print</Text>
        
        <View style={styles.statsContainer}>
          <Card style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
            <TouchableOpacity onPress={() => navigation.navigate('InvoicesList')}>
              <Card.Content>
                <Title style={{ color: '#1565C0' }}>Factures</Title>
                <Paragraph style={{ fontSize: 24, fontWeight: 'bold', color: '#1565C0' }}>12</Paragraph>
              </Card.Content>
            </TouchableOpacity>
          </Card>
          
          <Card style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
            <TouchableOpacity onPress={() => navigation.navigate('ProductsList')}>
              <Card.Content>
                <Title style={{ color: '#2E7D32' }}>Produits</Title>
                <Paragraph style={{ fontSize: 24, fontWeight: 'bold', color: '#2E7D32' }}>45</Paragraph>
              </Card.Content>
            </TouchableOpacity>
          </Card>
        </View>

        <Title style={styles.sectionTitle}>Activités récentes</Title>
        <Card style={styles.recentCard}>
          <Card.Content>
            <Paragraph>Facture Proforma #001 générée.</Paragraph>
          </Card.Content>
        </Card>
        <Card style={styles.recentCard}>
          <Card.Content>
            <Paragraph>Facture d'achat #042 ajoutée.</Paragraph>
          </Card.Content>
        </Card>
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="white"
        onPress={() => console.log('Add')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 80,
  },
  greeting: {
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 5,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 10,
    color: '#555',
  },
  recentCard: {
    marginBottom: 10,
    backgroundColor: 'white',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 30,
  },
});
