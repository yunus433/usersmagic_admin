const mongoose = require('mongoose');

const User = require('../user/User');

const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
  amount: {
    type: Number,
    required: true
  },
  user_id: {
    type: String,
    required: true
  },
  payment_number: {
    type: String,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now()
  }
});

PaymentSchema.statics.findLatestPayments = function (callback) {
  // Find and return the earliest 100 payments, or an error if it exists

  const Payment = this;

  Payment
    .find({})
    .sort({ _id: 1 })
    .limit(100)
    .then(payments => callback(null, payments))
    .catch(err => callback('database_error'));
};

PaymentSchema.statics.approvePayment = function (id, callback) {
  // Approve the Payment with the given id. Increase User credit amount and delete the Payment
  // Return an error if it exists

  if (!id || !validator.isMongoId(id.toString()))
    return callback('bad_request');

  const Payment = this;

  Payment.findById(mongoose.Types.ObjectId(id.toString()), (err, payment) => {
    if (err || !payment) return callback('document_not_found');

    User.getUserById(payment.user_id, (err, user) => {
      if (err) return callback(err);

      User.updateUserById(payment.user_id, {
        $inc: {
          waiting_credit: -1 * payment.amount,
          overall_credit: payment.amount
        },
        $set: {
          invitor: null
        }
      }, {}, err => {
        if (err) return callback(err);
  
        Payment.findByIdAndDelete(mongoose.Types.ObjectId(data.id.toString()), err => {
          if (err) return callback('database_error');
  
          if (!user.invitor)
            return callback(null);

          User.updateUserById(user.invitor, {$inc: {
            credit: 2
          }}, err => {
            if (err) return callback(err);

            return callback(null);
          });
        });
      });
    });
  });
};

module.exports = mongoose.model('Payment', PaymentSchema);
