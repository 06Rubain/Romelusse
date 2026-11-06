const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');

// Applique un mouvement de stock et l'enregistre dans l'historique.
// delta > 0 : entrée, delta < 0 : sortie.
const moveStock = async ({ company, productId, delta, type, reason, reference, user }) => {
  const product = await Product.findOneAndUpdate(
    { _id: productId, company, trackStock: true },
    { $inc: { stockQuantity: delta } },
    { returnDocument: 'after' }
  );
  if (!product) return null;
  await StockMovement.create({
    company,
    product: product._id,
    productName: product.name,
    type: type || (delta >= 0 ? 'in' : 'out'),
    quantity: delta,
    stockAfter: product.stockQuantity,
    reason,
    reference,
    createdBy: user?.email || '',
  });
  return product;
};

// Sortie de stock pour toutes les lignes d'une facture (ou retour si sign = +1)
const applyInvoiceStock = async (invoice, user, sign = -1) => {
  const reason = sign < 0 ? 'Vente' : 'Annulation de facture';
  for (const line of invoice.products) {
    if (!line.productId || !line.quantity) continue;
    await moveStock({
      company: invoice.company,
      productId: line.productId,
      delta: sign * line.quantity,
      type: sign < 0 ? 'out' : 'in',
      reason,
      reference: invoice.number,
      user,
    });
  }
};

module.exports = { moveStock, applyInvoiceStock };
