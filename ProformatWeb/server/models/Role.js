const mongoose = require('mongoose');

// Permissions attribuables aux rôles d'une entreprise
const PERMISSIONS = [
  'invoices.create', 'invoices.cancel', 'payments.create', 'payments.delete',
  'clients.manage', 'clients.delete', 'products.manage', 'stock.manage',
  'expenses.manage', 'reports.view', 'activities.view',
  'users.manage', 'roles.manage', 'settings.manage',
];

const DEFAULT_ROLES = [
  { name: 'Administrateur', description: 'Accès complet à l\'entreprise', permissions: PERMISSIONS, isSystem: true },
  {
    name: 'Gestionnaire',
    description: 'Ventes, catalogue, stock, dépenses et rapports',
    permissions: PERMISSIONS.filter((p) => !['users.manage', 'roles.manage', 'settings.manage'].includes(p)),
  },
  { name: 'Employé', description: 'Facturation, encaissements et clients', permissions: ['invoices.create', 'payments.create', 'clients.manage'] },
];

const roleSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  permissions: { type: [{ type: String, enum: PERMISSIONS }], default: [] },
  // Le rôle Administrateur de chaque entreprise ne peut être ni modifié ni supprimé
  isSystem: { type: Boolean, default: false },
}, { timestamps: true });

roleSchema.index({ company: 1, name: 1 }, { unique: true });

const Role = mongoose.model('Role', roleSchema);

const createDefaultRoles = async (companyId) => Promise.all(
  DEFAULT_ROLES.map((r) => Role.findOneAndUpdate(
    { company: companyId, name: r.name },
    { $setOnInsert: { ...r, company: companyId } },
    { upsert: true, returnDocument: 'after' },
  )),
);

module.exports = Role;
module.exports.PERMISSIONS = PERMISSIONS;
module.exports.createDefaultRoles = createDefaultRoles;
