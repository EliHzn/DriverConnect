// TowPayments.jsx
/*************************************************************************************************
 * TowPayments
 *
 * - Payment Summary: read-only fields for total charges, payments, refunds, and balance due.
 * - Payment History: table listing payment records; can delete or refund a payment.
 * - "confirmRefundPayment" now uses "paymentToRefund" (the correct state variable) 
 *   instead of a missing "pmt".
 *************************************************************************************************/

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { IconTrash, IconReceiptRefund } from '@tabler/icons-react';

import useAuth from 'hooks/useAuth';

// Helper to format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// Sum of positive amounts => total payments
function getTotalPayments(payments) {
  return payments.reduce((acc, p) => (p.amount > 0 ? acc + p.amount : acc), 0);
}

// Sum of negative amounts => total refunds
function getTotalRefunds(payments) {
  return payments.reduce((acc, p) => (p.amount < 0 ? acc + Math.abs(p.amount) : acc), 0);
}

// Capitalize words, and if it ends with "(refund)", make that portion bold
function displayMethod(originalMethod = '') {
  const base = originalMethod
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  const lower = base.toLowerCase();
  const idx = lower.lastIndexOf('(refund)');
  if (idx !== -1) {
    const part = base.slice(0, idx).trim();
    return (
      <Box component="span">
        {part}{' '}
        <Box component="span" sx={{ fontWeight: 'bold' }}>
          (REFUND)
        </Box>
      </Box>
    );
  }
  return base;
}

export default function TowPayments({
  data = {},
  onChange = () => {},
  disabled = false
}) {
  // Pull out charges, payments from parent's data
  const {
    charges = { grandTotal: 0, items: [], taxRate: 0, taxExempt: false },
    payments = []
  } = data;

  // Summaries
  const totalCharges = charges.grandTotal || 0;    // total charges from grandTotal
  const totalPaid = getTotalPayments(payments);
  const totalRefunds = getTotalRefunds(payments);
  const balance = totalCharges - totalPaid + totalRefunds;

  // Decide color for Balance
  let balanceColor = 'black';
  if (balance > 0) {
    balanceColor = 'red';  // still owes money
  } else if (balance === 0) {
    balanceColor = 'green'; // paid in full
  }

  // Current user => for "collectedByName"
  const { user } = useAuth();
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const collectorName = (firstName + ' ' + lastName).trim() || 'Unknown';

  // Payment form states
  const [method, setMethod] = useState('credit');
  const [cashAmount, setCashAmount] = useState('');
  const [creditPlaceholder, setCreditPlaceholder] = useState('');
  const [note, setNote] = useState('');

  // Delete + Refund dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [paymentToRefund, setPaymentToRefund] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');

  // Clear amounts if payment method changes
  useEffect(() => {
    setCashAmount('');
    setCreditPlaceholder('');
  }, [method]);

  // Handle Record Payment
  const handleRecordPayment = () => {
    if (disabled) return;

    let parsedAmount = 0;
    if (method === 'cash') {
      parsedAmount = parseFloat(cashAmount.replace(/[^\d.]/g, '')) || 0;
      if (parsedAmount <= 0) {
        alert('Please enter a valid cash amount.');
        return;
      }
    } else {
      // credit
      parsedAmount = parseFloat(creditPlaceholder.replace(/[^\d.]/g, '')) || 0;
      if (parsedAmount <= 0) {
        alert('Please enter a valid credit amount.');
        return;
      }
    }

    // Next local ID => e.g. 1,2,3
    const maxNum = payments.reduce((max, p) => Math.max(max, p.paymentNumber || 0), 0);
    const nextNum = maxNum + 1;

    const newPayment = {
      id: uuidv4(),
      paymentNumber: nextNum,
      amount: parsedAmount,
      method,
      timestamp: new Date().toISOString(),
      collectedByName: collectorName,
      note: note.trim()
    };

    onChange({ payments: [...payments, newPayment] });

    // reset form
    setCashAmount('');
    setCreditPlaceholder('');
    setNote('');
  };

  // Delete Payment
  const handleDeleteClick = (pmt) => {
    setPaymentToDelete(pmt);
    setDeleteDialogOpen(true);
  };
  const confirmDeletePayment = () => {
    if (!paymentToDelete) return;
    const updated = payments.filter((p) => p.id !== paymentToDelete.id);
    onChange({ payments: updated });
    setPaymentToDelete(null);
    setDeleteDialogOpen(false);
  };

  // Refund Payment => negative
  const handleRefundClick = (pmt) => {
    if (pmt.amount <= 0) {
      alert('This payment is already a refund or zero.');
      return;
    }
    setPaymentToRefund(pmt);
    setRefundAmount(pmt.amount.toFixed(2));
    setRefundDialogOpen(true);
  };

  const confirmRefundPayment = () => {
    // Use paymentToRefund instead of pmt
    if (!paymentToRefund) return;

    const maxRefundable = paymentToRefund.amount;
    const req = parseFloat(refundAmount.replace(/[^\d.]/g, '')) || 0;
    if (req <= 0) {
      alert('Refund amount must be greater than 0.');
      return;
    }
    if (req > maxRefundable) {
      alert(`Cannot refund more than ${formatCurrency(maxRefundable)}.`);
      return;
    }

    // Next local ID => e.g. 1,2,3
    const maxNum = payments.reduce((max, p) => Math.max(max, p.paymentNumber || 0), 0);
    const nextNum = maxNum + 1;

    const negativePayment = {
      id: uuidv4(),
      paymentNumber: nextNum,
      amount: -req,
      method: `${paymentToRefund.method} (refund)`,
      timestamp: new Date().toISOString(),
      collectedByName: collectorName,
      note: `Refund for payment #${paymentToRefund.paymentNumber}`
    };

    onChange({ payments: [...payments, negativePayment] });
    setPaymentToRefund(null);
    setRefundDialogOpen(false);
    setRefundAmount('');
  };

  // Sort newest -> oldest
  const sortedPayments = [...payments].sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return bTime - aTime;
  });

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        {/* LEFT: Payment Summary => read-only text fields */}
        <Grid item xs={12} md={6}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              mb: 2,
              backgroundColor: '#E3F2FD',
              borderRadius: 2,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Typography variant="h6" sx={{ textAlign: 'left', mb: 1 }}>
              Payment Summary
            </Typography>

            <TextField
              label="Total Charges"
              value={formatCurrency(totalCharges)}
              fullWidth
              size="small"
              InputProps={{
                readOnly: true,
                style: {
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: 'black'
                }
              }}
            />
            <TextField
              label="Total Payments"
              value={formatCurrency(totalPaid)}
              fullWidth
              size="small"
              InputProps={{
                readOnly: true,
                style: {
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: 'black'
                }
              }}
            />
            <TextField
              label="Total Refunds"
              value={formatCurrency(totalRefunds)}
              fullWidth
              size="small"
              InputProps={{
                readOnly: true,
                style: {
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: 'black'
                }
              }}
            />
            <TextField
              label="Balance Due"
              value={formatCurrency(balance)}
              fullWidth
              size="small"
              InputProps={{
                readOnly: true,
                style: {
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: balanceColor
                }
              }}
            />
          </Paper>
        </Grid>

        {/* RIGHT: Payment Form */}
        <Grid item xs={12} md={6}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              mb: 2,
              backgroundColor: '#E3F2FD',
              borderRadius: 2,
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
              Record a Payment
            </Typography>

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={method}
                label="Payment Method"
                onChange={(e) => setMethod(e.target.value)}
                disabled={disabled}
              >
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="credit">Credit Card</MenuItem>
              </Select>
            </FormControl>

            {method === 'cash' && (
              <TextField
                label="Amount Received"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                size="small"
                fullWidth
                sx={{ mb: 2 }}
                disabled={disabled}
              />
            )}
            {method === 'credit' && (
              <TextField
                label="Credit Amount"
                value={creditPlaceholder}
                onChange={(e) => setCreditPlaceholder(e.target.value)}
                size="small"
                fullWidth
                sx={{ mb: 2 }}
                disabled={disabled}
              />
            )}

            <TextField
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              size="small"
              fullWidth
              sx={{ mb: 2 }}
              disabled={disabled}
            />

            <Button
              variant="contained"
              onClick={handleRecordPayment}
              disabled={disabled}
              fullWidth
            >
              Record Payment
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Payment History */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 1, textAlign: 'center' }}>
          Payment History
        </Typography>

        {/* Column Header Row */}
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            p: 1,
            mb: 2,
            backgroundColor: '#E3F2FD'
          }}
        >
          <Grid container alignItems="center">
            <Grid item xs={1}>
              <Typography align="center" fontWeight="bold">
                ID
              </Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography align="center" fontWeight="bold">
                Date/Time
              </Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography align="center" fontWeight="bold">
                Method
              </Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography align="center" fontWeight="bold">
                Amount
              </Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography align="center" fontWeight="bold">
                Collected By
              </Typography>
            </Grid>
            <Grid item xs={1}>
              <Typography align="center" fontWeight="bold">
                Actions
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {sortedPayments.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              backgroundColor: '#E3F2FD',
              borderRadius: 2
            }}
          >
            <Typography variant="body2" color="textSecondary" align="center">
              No payments recorded.
            </Typography>
          </Paper>
        ) : (
          sortedPayments.map((pmt) => {
            // color highlight
            let recordBg = '#fff';
            if (pmt.amount > 0) recordBg = 'rgba(0,255,0,0.1)';
            if (pmt.amount < 0) recordBg = 'rgba(255,0,0,0.1)';

            const dt = dayjs(pmt.timestamp).format('MMM D, YYYY h:mm A');
            const displayAmount = formatCurrency(pmt.amount);

            const canDelete = !disabled;
            const canRefund = !disabled && pmt.amount > 0;

            return (
              <Paper
                key={pmt.id}
                variant="outlined"
                sx={{
                  mb: 2,
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: recordBg
                }}
              >
                <Grid container alignItems="center" spacing={1}>
                  {/* ID (bold) */}
                  <Grid item xs={1}>
                    <Typography sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                      {pmt.paymentNumber}
                    </Typography>
                  </Grid>

                  {/* Date/Time */}
                  <Grid item xs={3}>
                    <Typography align="center">{dt}</Typography>
                  </Grid>

                  {/* Method */}
                  <Grid item xs={2}>
                    <Typography align="center" component="div">
                      {displayMethod(pmt.method)}
                    </Typography>
                  </Grid>

                  {/* Amount */}
                  <Grid item xs={2}>
                    <Typography align="center">{displayAmount}</Typography>
                  </Grid>

                  {/* Collected By */}
                  <Grid item xs={3}>
                    <Typography align="center">{pmt.collectedByName || ''}</Typography>
                  </Grid>

                  {/* Actions */}
                  <Grid item xs={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                      {canDelete && (
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(pmt)}
                          title="Delete Payment"
                        >
                          <IconTrash size={16} />
                        </IconButton>
                      )}
                      {canRefund && (
                        <IconButton
                          size="small"
                          onClick={() => handleRefundClick(pmt)}
                          title="Refund Payment"
                        >
                          <IconReceiptRefund size={16} />
                        </IconButton>
                      )}
                    </Box>
                  </Grid>
                </Grid>

                {/* If there's a note, display it below */}
                {pmt.note && (
                  <Box sx={{ textAlign: 'center', mt: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      {pmt.note}
                    </Typography>
                  </Box>
                )}
              </Paper>
            );
          })
        )}
      </Box>

      {/* Delete Payment Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete this payment?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeletePayment}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refund Payment Dialog */}
      <Dialog open={refundDialogOpen} onClose={() => setRefundDialogOpen(false)}>
        <DialogTitle>Refund Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Enter the amount to refund (cannot exceed the original payment).
          </Typography>
          <TextField
            label="Refund Amount"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            size="small"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefundDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="info" onClick={confirmRefundPayment}>
            Refund
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
