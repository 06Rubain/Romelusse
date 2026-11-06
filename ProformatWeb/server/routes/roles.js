const express = require('express');
const Role = require('../models/Role');
const User = require('../models/User');
const { PERMISSIONS } = require('../models/Role');
const { HttpError } = require('../lib/helpers');
const { requirePermission } = require('../lib/auth');
const { logActivity } = require('../lib/activity');

const router = express.Router();

const sanitize = (body) => {
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'Le nom du rôle est obligatoire.');
  const permissions = Array.isArray(body.permissions) ? body.permissions.filter((p) => PERMISSIONS.includes(p)) : [];
  return { name, description: String(body.description || ''), permissions: [...new Set(permissions)] };
};

const findRole = async (req) => {
  const role = await Role.findOne({ _id: req.params.id, company: req.company._id });
  if (!role) throw new HttpError(404, 'Rôle introuvable.');
  return role;
};

router.get('/permissions', (req, res) => res.json(PERMISSIONS));

// Liste lisible par les gestionnaires d'utilisateurs (pour l'attribution des rôles)
router.get('/', requirePermission('roles.manage', 'users.manage'), async (req, res) => {
  const [roles, counts] = await Promise.all([
    Role.find({ company: req.company._id }).sort({ isSystem: -1, name: 1 }),
    User.aggregate([{ $match: { company: req.company._id } }, { $group: { _id: '$roleId', count: { $sum: 1 } } }]),
  ]);
  const byRole = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  res.json(roles.map((r) => ({ ...r.toJSON(), userCount: byRole[String(r._id)] || 0 })));
});

router.post('/', requirePermission('roles.manage'), async (req, res) => {
  const data = sanitize(req.body);
  if (await Role.exists({ company: req.company._id, name: data.name })) throw new HttpError(409, 'Un rôle porte déjà ce nom.');
  const role = await Role.create({ ...data, company: req.company._id });
  await logActivity(req.user, 'Rôles', `Création du rôle ${role.name}`);
  res.status(201).json(role);
});

router.put('/:id', requirePermission('roles.manage'), async (req, res) => {
  const role = await findRole(req);
  if (role.isSystem) throw new HttpError(400, 'Le rôle Administrateur ne peut pas être modifié.');
  const data = sanitize(req.body);
  if (data.name !== role.name && await Role.exists({ company: req.company._id, name: data.name })) {
    throw new HttpError(409, 'Un rôle porte déjà ce nom.');
  }
  role.set(data);
  await role.save();
  await logActivity(req.user, 'Rôles', `Modification du rôle ${role.name}`);
  res.json(role);
});

router.delete('/:id', requirePermission('roles.manage'), async (req, res) => {
  const role = await findRole(req);
  if (role.isSystem) throw new HttpError(400, 'Le rôle Administrateur ne peut pas être supprimé.');
  if (await User.exists({ roleId: role._id })) throw new HttpError(400, 'Des utilisateurs ont encore ce rôle : changez-leur de rôle avant de le supprimer.');
  await role.deleteOne();
  await logActivity(req.user, 'Rôles', `Suppression du rôle ${role.name}`);
  res.json({ success: true });
});

module.exports = router;
