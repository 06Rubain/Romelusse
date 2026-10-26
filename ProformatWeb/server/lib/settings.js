const Setting = require('../models/Setting');

const getSettings = async () => {
  const existing = await Setting.findById('company');
  if (existing) return existing;
  return Setting.findOneAndUpdate(
    { _id: 'company' },
    { $setOnInsert: { _id: 'company' } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
};

module.exports = { getSettings };
