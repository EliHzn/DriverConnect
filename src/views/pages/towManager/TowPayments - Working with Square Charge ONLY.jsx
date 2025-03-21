// TowPayments.jsx
/*************************************************************************************************
 * TowPayments (Using getAuthHeaders like TowVehicleInfo)
 *
 * - We define an async getAuthHeaders() that fetches the user's ID token, returning
 *   { Authorization: `Bearer ${theToken}` }.
 * - Then in handleCreditPayment(), we include those headers in our fetch call to /square/charge.
 * - This matches the approach in the reference TowVehicleInfo.jsx.
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

// Read the backend API URL from env:
const apiUrl = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000';

// Helper: format currency
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

// Capitalize words; if ends with "(refund)", make that portion bold
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
  const {
    charges = { grandTotal: 0, items: [], taxRate: 0, taxExempt: false },
    payments = []
  } = data;

  // Summaries
  const totalCharges = charges.grandTotal || 0;
  const totalPaid = getTotalPayments(payments);
  const totalRefunds = getTotalRefunds(payments);
  const balance = totalCharges - totalPaid + totalRefunds;

  let balanceColor = 'black';
  if (balance > 0) balanceColor = 'red';
  else if (balance === 0) balanceColor = 'green';

  // Current user => "collectedByName"
  const { user } = useAuth();
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const collectorName = (firstName + ' ' + lastName).trim() || 'Unknown';

  // Payment form
  const [method, setMethod] = useState('credit');
  const [cashAmount, setCashAmount] = useState('');
  const [creditPlaceholder, setCreditPlaceholder] = useState('');
  const [note, setNote] = useState('');

  // For Square "card" instance
  const [card, setCard] = useState(null);

  // For delete/refund dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [paymentToRefund, setPaymentToRefund] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');

  // Clear amounts if user changes method
  useEffect(() => {
    setCashAmount('');
    setCreditPlaceholder('');
  }, [method]);

  // 1) Our getAuthHeaders => same style as TowVehicleInfo
  async function getAuthHeaders() {
    if (!user?.firebaseUser) return {};
    const idToken = await user.firebaseUser.getIdToken(true);
    return { Authorization: `Bearer ${idToken}` };
  }

  // If user picks "credit," dynamically load the Square script & init
  useEffect(() => {
    if (method !== 'credit') {
      setCard(null);
      return;
    }

    if (window.Square) {
      initSquareCard();
    } else {
      if (!document.getElementById('square-web-payments-script')) {
        const script = document.createElement('script');
        script.id = 'square-web-payments-script';
        script.src = 'https://sandbox.web.squarecdn.com/v1/square.js';
        script.async = true;
        script.onload = () => {
          console.log('Square script loaded => now init');
          initSquareCard();
        };
        document.head.appendChild(script);
      } else {
        console.log('Square script is loading or loaded => wait & init');
      }
    }
  }, [method]);

  async function initSquareCard() {
    if (!window.Square) {
      console.error('Square script not loaded or window.Square not available');
      return;
    }
    try {
      // Instead of hard-coding, read from .env
      const appId = import.meta.env.VITE_APP_SQUARE_APP_ID;
      const locationId = import.meta.env.VITE_APP_SQUARE_LOCATION_ID;

      if (!appId) {
        console.error('Square App ID is missing in environment variables.');
        return;
      }
      if (!locationId) {
        console.error('Square Location ID is missing in environment variables.');
        return;
      }

      const payments = window.Square.payments(appId, locationId);
      const cardElement = await payments.card();
      await cardElement.attach('#card-container');
      setCard(cardElement);
    } catch (err) {
      console.error('Error initializing Square card:', err);
    }
  }

  // Record Payment => either "cash" or "credit"
  const handleRecordPayment = () => {
    if (disabled) return;

    if (method === 'cash') {
      const parsedAmount = parseFloat(cashAmount.replace(/[^\d.]/g, '')) || 0;
      if (parsedAmount <= 0) {
        alert('Please enter a valid cash amount.');
        return;
      }
      addNewPayment(parsedAmount, 'cash');
    } else {
      // credit => tokenize + charge
      handleCreditPayment();
    }
  };

  async function handleCreditPayment() {
    if (!card) {
      alert('Square card not initialized yet. Please wait or reload.');
      return;
    }
    const parsedAmount = parseFloat(creditPlaceholder.replace(/[^\d.]/g, '')) || 0;
    if (parsedAmount <= 0) {
      alert('Please enter a valid credit amount.');
      return;
    }

    try {
      const result = await card.tokenize();
      if (result.status !== 'OK') {
        alert(`Tokenize failed: ${result.status}`);
        return;
      }
      const nonce = result.token;
      console.log('Got Square nonce:', nonce);

      const headers = await getAuthHeaders();

      const resp = await fetch(`${apiUrl}/square/charge`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nonce,
          amount: Math.round(parsedAmount * 100) // cents
        })
      });

      if (!resp.ok) {
        throw new Error(`Response status code was not ok: ${resp.status}`);
      }
      const data = await resp.json();

      if (data.success) {
        addNewPayment(parsedAmount, 'credit', `(SquarePaymentID:${data.payment.id})`);
      } else {
        alert(`Square charge failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Square payment error:', err);
      alert('Square payment error: ' + err.message);
    }
  }

  function addNewPayment(amountVal, payMethod, extraNote = '') {
    const maxNum = payments.reduce((max, p) => Math.max(max, p.paymentNumber || 0), 0);
    const nextNum = maxNum + 1;

    onChange({
      payments: [
        ...payments,
        {
          id: uuidv4(),
          paymentNumber: nextNum,
          amount: amountVal,
          method: payMethod,
          timestamp: new Date().toISOString(),
          collectedByName: collectorName,
          note: (note.trim() || '') + (extraNote ? ' ' + extraNote : '')
        }
      ]
    });

    // reset form
    setCashAmount('');
    setCreditPlaceholder('');
    setNote('');
  }

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
        {/* LEFT: Payment Summary => read-only fields */}
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
              <>
                <TextField
                  label="Credit Amount"
                  value={creditPlaceholder}
                  onChange={(e) => setCreditPlaceholder(e.target.value)}
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={disabled}
                />

                {/* Square card container => dynamically attached in initSquareCard() */}
                <Box
                  id="card-container"
                  sx={{
                    mb: 2,
                    minHeight: 60,
                    border: '1px solid #ccc',
                    borderRadius: 1,
                    p: 1
                  }}
                />
              </>
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
              {method === 'cash' ? 'Record Cash Payment' : 'Charge Card'}
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
                  <Grid item xs={1}>
                    <Typography sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                      {pmt.paymentNumber}
                    </Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography align="center">{dt}</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography align="center" component="div">
                      {displayMethod(pmt.method)}
                    </Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography align="center">{displayAmount}</Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography align="center">{pmt.collectedByName || ''}</Typography>
                  </Grid>
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
