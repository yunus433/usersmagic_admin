const async = require('async');
const mongoose = require('mongoose');
const validator = require('validator');

const Country = require('../country/Country');

const hashPassword = require('./functions/hashPassword');
const getAdmin = require('./functions/getAdmin');
const verifyPassword = require('./functions/verifyPassword');

const Schema = mongoose.Schema;

const AdminSchema = new Schema({
  username: {
    // Username of the admin, unique. Format: name.surname. ex: yunus.gurlek. No turkish characters
    type: String,
    required: true,
    unique: true
  },
  password: {
    // Password of the admin, saved hashed
    type: String,
    required: true,
    minlength: 6,
    maxlength: 1000
  },
  name: {
    // Name of the admin
    type: String,
    required: true
  },
  roles: {
    // Array of roles of the admin, required at least one element during creation
    // Allowed values: [organisation_manager, financial_manager, regional_manager, product_head, sales_team, product_developer, product_designer]
    type: Array,
    required: true,
    minlength: 1
  },
  is_global: {
    // The field showing if the admin is responsible of every country that is created and will be created
    type: Boolean,
    default: false
  },
  countries: {
    // Array of countries the admin is responsible of, alpha2_code of the Country is given
    type: Array,
    default: []
  }
});

// Before saving the admin to database, hash its password
AdminSchema.pre('save', hashPassword);

AdminSchema.statics.createAdmin = function (data, callback) {
  // Create a new Admin document with the given data and return its id, or return an error if it exists

  const allowedRoles = [
    'organisation_manager', 'financial_manager', 'regional_manager', 'product_head', 'sales_team', 'product_developer', 'product_designer'
  ];

  if (!data || typeof data != 'object' || !data.username || !data.password || !data.name || !data.roles)
    return callback('bad_request');

  if (typeof data.password != 'string' || data.password.length < 6)
    return callback('password_length');

  if (data.roles.find(role => !allowedRoles.includes(role)))
    return callback('bad_request');

  if (!data.is_global && !countries.length)
    return callback('bad_request');

  async.timesSeries(
    data.countries.length,
    (time, next) => {
      Country.getCountryWithAlpha2Code(data.countries[time], (err, country) => next(err, country.alpha2_code));
    },
    (err, countries) => {
      if (err)
        return callback('bad_request');

      const Admin = this;

      const newAdminData = {
        username: data.username,
        password: data.password,
        roles: data.roles,
        name: data.name,
        is_global: data.is_global ? true : false,
        countries
      };

      const newAdmin = new Admin(newAdminData);

      newAdmin.save((err, admin) => {
        if (err) return callback('database_error');

        return callback(null, admin._id.toString());
      });
    }
  );
};

AdminSchema.statics.getAdminsByFilters = function (data, callback) {
  // Return all Admin documents in proper format if they match given filters sorted by ascending username, or an error if it exists
  // Defined filters: username, name, roles, countries, is_global

  const filters = {};

  if (data.username && typeof data.username == 'string')
    filters.username = { $text: { $search: data.username } };

  if (data.name && typeof data.name == 'string')
    filters.name = { $text: { $search: filters.name } };

  if (data.roles && Array.isArray(data.roles))
    filters.roles = { $in: data.roles };

  if (data.countries && Array.isArray(data.countries))
    filters.countries = { $in: data.countries };

  if (data.is_global)
    filters.is_global = true;

  const Admin = this;

  Admin
    .find(filters)
    .sort({ username: 1 })
    .then(admins => {
      async.timesSeries(
        admins.length,
        (time, next) => getAdmin(admins[time], (err, admin) => next(err, admin)),
        (err, admins) => callback(err, admins)
      );
    })
    .catch(err => callback('database_error'));
};

AdminSchema.statics.getAdminById = function (id, callback) {
  // Find and return the document with the given id or an error if it exists

  if (!id || !validator.isMongoId(id.toString()))
    return callback('bad_request');

  const Admin = this;

  Admin.findById(mongoose.Types.ObjectId(id.toString), (err, admin) => {
    getAdmin(admin, (err, admin) => callback(err, admin));
  });
};

AdminSchema.statics.deleteAdmin = function (id, callback) {
  // Find and delete the document with the given id, return an error if it exists

  if (!id || !validator.isMongoId(id.toString()))
    return callback('bad_request');

  const Admin = this;

  Admin.findByIdAndDelete(
    mongoose.Types.ObjectId(id.toString()),
    err => callback(err)
  );
};

module.exports = mongoose.model('Admin', AdminSchema);