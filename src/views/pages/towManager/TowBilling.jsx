// TowBilling.jsx
/*****************************************************************************************
 * TowBilling (Override Subtotal, Tax Exempt Checkbox)
 *
 * - The "Override Total" field now really overrides the Subtotal, not the final total.
 * - If override=0, we display the normal subNoGratuity and label "Subtotal".
 * - If override>0, we display typedOverride and label "Subtotal (Override)".
 * - Added a small "Exempt" checkbox next to the Tax field that toggles charges.taxExempt.
 * - If user tries to override below the real subNoGratuity, revert override to 0.
 * - The rest is unchanged from your last working code.
 *****************************************************************************************/

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TableFooter,
  IconButton,
  Button,
  MenuItem,
  Divider,
  Snackbar,
  Alert,
  useMediaQuery,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { collection, getDocs } from 'firebase/firestore';
import { db } from 'firebase.js';
import { IconTrash } from '@tabler/icons-react';

/* ----------------------------------------------------------------------------
   1) parseNumber => safe float parse
   ----------------------------------------------------------------------------*/
function parseNumber(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const stripped = val.replace(/[^\d.]/g, '');
    const parsed = parseFloat(stripped);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/* ----------------------------------------------------------------------------
   2) Summation helpers
   ----------------------------------------------------------------------------*/
function getNonGratuitySum(items) {
  return items.reduce((acc, it) => (it.isGratuity ? acc : acc + it.quantity * it.rate), 0);
}
function getAllItemsSum(items) {
  return items.reduce((acc, it) => acc + it.quantity * it.rate, 0);
}
function getTaxAmount(total, taxRate, taxExempt) {
  if (taxExempt) return 0;
  const r = parseNumber(taxRate);
  return parseFloat((total * (r / 100)).toFixed(2));
}

/* ----------------------------------------------------------------------------
   3) Recalculate override/gratuity:
      - Now we treat override as "Override Subtotal" not final.
      - If override=0 => no override => use subNoGratuity as Subtotal.
      - If override<subNoGratuity => revert to no override (0).
      - Else add "gratuity" item for the difference.
   ----------------------------------------------------------------------------*/
function recalcOverrideAndGratuity(charges, gratuityDesc) {
  const items = [...(charges.items || [])];
  let override = parseNumber(charges.grandTotal || 0); // Now we're calling this the "overridden subtotal"
  const actualSub = getNonGratuitySum(items); // the real subNoGratuity

  // Remove existing gratuity
  const gIndex = items.findIndex((x) => x.isGratuity);
  if (gIndex !== -1) items.splice(gIndex, 1);

  if (override > 0) {
    // If user tries to override below the actual sub, revert => no override
    if (override < actualSub) {
      override = 0;
      charges.grandTotal = 0;
    } else {
      // difference => gratuity
      const diff = override - actualSub;
      if (diff > 0) {
        items.push({
          id: 'gratuity',
          isGratuity: true,
          description: gratuityDesc || 'Gratuity',
          quantity: 1,
          rate: diff
        });
      }
      charges.grandTotal = override; // store the "override sub"
    }
  } else {
    // No override => set grandTotal=0
    charges.grandTotal = 0; 
  }

  charges.items = items;
  return charges;
}

export default function TowBilling({
  data = {},            // e.g. { charges: { grandTotal, items, taxRate, taxExempt } }
  onChange = () => {},  // callback to parent
  disabled = false
}) {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // The parent's "charges" is our single source of truth
  const charges = data.charges || {
    grandTotal: 0,  // interpret as "override sub" if >0
    items: [],
    taxRate: 8.875,
    taxExempt: false
  };

  // typedOverride => local text field for override sub
  const [typedOverride, setTypedOverride] = useState(
    charges.grandTotal > 0 ? String(charges.grandTotal) : ''
  );
  const [gratuityDescription, setGratuityDescription] = useState('Gratuity');

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  function showSnackbar(msg) {
    setSnackbarMsg(msg);
    setSnackbarOpen(true);
  }
  function handleCloseSnackbar() {
    setSnackbarOpen(false);
  }

  // If parent's grandTotal changes => update typedOverride
  useEffect(() => {
    if (parseNumber(charges.grandTotal) !== parseNumber(typedOverride)) {
      setTypedOverride(charges.grandTotal > 0 ? String(charges.grandTotal) : '');
    }
  }, [charges.grandTotal]);

  // Billables from Firestore
  const [allBillables, setAllBillables] = useState([]);
  const [selectedBillableId, setSelectedBillableId] = useState('');
  const [billableQty, setBillableQty] = useState('1');

  // For custom item
  const [customDesc, setCustomDesc] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customRate, setCustomRate] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'billables'));
        const arr = snap.docs.map((dc) => dc.data()) || [];
        setAllBillables(arr);
      } catch (err) {
        console.error('Error fetching billables:', err);
      }
    })();
  }, []);

  // Summaries
  const actualSub = getNonGratuitySum(charges.items); // the real subNoGratuity
  const usedSub = charges.grandTotal > 0 ? parseNumber(charges.grandTotal) : actualSub; 
  // usedSub => which sub are we using? If override>0 => typedOverride, else actualSub
  const taxAmt = getTaxAmount(usedSub, charges.taxRate, charges.taxExempt);
  const finalTotal = usedSub + taxAmt;

  // If override>0 => we label "Subtotal (Override)", else just "Subtotal"
  const subLabel = charges.grandTotal > 0 ? 'Subtotal (Override)' : 'Subtotal';
  const taxLabel = 'Tax Amount'; // user asked that if we override sub, we don't do "Tax Amount (Override)" anymore
  const finalLabel = 'Final Total';

  // update parent's data => recalc
  function updateParentCharges(newProps) {
    let updated = { ...charges, ...newProps };
    // recalc override & gratuity each time
    updated = recalcOverrideAndGratuity(updated, gratuityDescription);
    onChange({ charges: updated });
  }

  // quantity / rate / remove item / etc.
  function handleChangeQuantity(idx, val) {
    const qty = parseInt(val, 10);
    let newItems = [...charges.items];
    if (!qty || qty <= 0) {
      newItems = newItems.filter((_, i) => i !== idx);
    } else {
      newItems[idx] = { ...newItems[idx], quantity: qty };
    }
    updateParentCharges({ items: newItems });
  }
  function handleChangeRate(idx, val) {
    const r = parseNumber(val);
    let newItems = [...charges.items];
    newItems[idx] = { ...newItems[idx], rate: r };
    updateParentCharges({ items: newItems });
  }
  function handleRemoveLineItem(idx) {
    const newItems = charges.items.filter((_, i) => i !== idx);
    updateParentCharges({ items: newItems });
  }
  function handleGratuityDescChange(idx, newVal) {
    setGratuityDescription(newVal);
    let newItems = [...charges.items];
    newItems[idx] = { ...newItems[idx], description: newVal };
    updateParentCharges({ items: newItems });
  }

  // Add line item
  function handleAddLineItem() {
    if (!selectedBillableId) return;

    const newItems = [...charges.items];
    if (selectedBillableId === '__CUSTOM__') {
      const d = customDesc.trim();
      if (!d) return;
      const q = parseInt(customQty, 10);
      if (!q || q <= 0) return;
      const r = parseNumber(customRate);
      newItems.push({
        id: `custom-${Date.now()}`,
        description: d,
        rate: r,
        quantity: q,
        isGratuity: false,
        locked: false
      });
    } else {
      const b = allBillables.find((bb) => bb.id === selectedBillableId);
      if (!b) return;
      const q = parseInt(billableQty, 10);
      if (!q || q <= 0) return;
      newItems.push({
        id: b.id,
        description: b.name || b.id,
        rate: b.amount || 0,
        quantity: q,
        isGratuity: false,
        locked: b.locked || false
      });
    }

    updateParentCharges({ items: newItems });
    setSelectedBillableId('');
    setCustomDesc('');
    setCustomQty('1');
    setCustomRate('');
    setBillableQty('1');
  }
  function handleCancelCustom() {
    setSelectedBillableId('');
    setCustomDesc('');
    setCustomQty('1');
    setCustomRate('');
    setBillableQty('1');
  }

  // handle override => sub
  function handleSaveOverride() {
    if (!typedOverride) {
      updateParentCharges({ grandTotal: 0 });
      return;
    }
    const typedVal = parseNumber(typedOverride);
    if (typedVal < actualSub) {
      // revert
      setTypedOverride('');
      showSnackbar('Override reverted to 0 (below actual Subtotal).');
      updateParentCharges({ grandTotal: 0 });
    } else {
      updateParentCharges({ grandTotal: typedVal });
    }
  }
  function handleClearOverride() {
    setTypedOverride('');
    updateParentCharges({ grandTotal: 0 });
    showSnackbar('Override cleared.');
  }

  // handle taxExempt => small checkbox
  function handleToggleTaxExempt(e) {
    updateParentCharges({ taxExempt: e.target.checked });
  }

  // Render
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        maxWidth: 900,
        mx: 'auto',
        mt: 2,
        p: 2,
        backgroundColor: '#E3F2FD',
        position: 'relative'
      }}
    >
      {/* Snackbar */}
      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)}>
        <Alert onClose={() => setSnackbarOpen(false)} severity="info" sx={{ width: '100%' }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>

      {/* "Override Subtotal" box */}
      <Box
        sx={{
          maxWidth: 380,
          mx: 'auto',
          mb: 3,
          p: 2,
          borderRadius: 2,
          backgroundColor: '#fff',
          textAlign: 'center'
        }}
      >
        <Typography variant="body2" sx={{ mb: 1 }}>
          Override Subtotal
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            label="Override Subtotal"
            placeholder="0 if no override"
            value={typedOverride}
            onChange={(e) => setTypedOverride(e.target.value)}
            disabled={disabled}
            size="small"
            fullWidth
            inputProps={{ style: { textAlign: 'center' } }}
          />
          {!disabled && (
            <>
              <Button variant="contained" size="small" onClick={handleSaveOverride}>
                Save
              </Button>
              <Button variant="outlined" size="small" onClick={handleClearOverride}>
                Clear
              </Button>
            </>
          )}
        </Box>
      </Box>

      {isSmallScreen ? (
        <StackedLayout
          charges={charges}
          disabled={disabled}
          subLabel={subLabel}
          usedSub={usedSub}
          taxAmt={taxAmt}
          finalTotal={finalTotal}
          taxExempt={charges.taxExempt}
          onToggleTaxExempt={handleToggleTaxExempt}
          selectedBillableId={selectedBillableId}
          setSelectedBillableId={setSelectedBillableId}
          billableQty={billableQty}
          setBillableQty={setBillableQty}
          customDesc={customDesc}
          setCustomDesc={setCustomDesc}
          customQty={customQty}
          setCustomQty={setCustomQty}
          customRate={customRate}
          setCustomRate={setCustomRate}
          allBillables={allBillables}
          handleAddLineItem={handleAddLineItem}
          handleCancelCustom={handleCancelCustom}
          handleChangeQuantity={handleChangeQuantity}
          handleChangeRate={handleChangeRate}
          handleRemoveLineItem={handleRemoveLineItem}
          handleGratuityDescChange={handleGratuityDescChange}
        />
      ) : (
        <TableLayout
          charges={charges}
          disabled={disabled}
          subLabel={subLabel}
          usedSub={usedSub}
          taxAmt={taxAmt}
          finalTotal={finalTotal}
          taxExempt={charges.taxExempt}
          onToggleTaxExempt={handleToggleTaxExempt}
          selectedBillableId={selectedBillableId}
          setSelectedBillableId={setSelectedBillableId}
          billableQty={billableQty}
          setBillableQty={setBillableQty}
          customDesc={customDesc}
          setCustomDesc={setCustomDesc}
          customQty={customQty}
          setCustomQty={setCustomQty}
          customRate={customRate}
          setCustomRate={setCustomRate}
          allBillables={allBillables}
          handleAddLineItem={handleAddLineItem}
          handleCancelCustom={handleCancelCustom}
          handleChangeQuantity={handleChangeQuantity}
          handleChangeRate={handleChangeRate}
          handleRemoveLineItem={handleRemoveLineItem}
          handleGratuityDescChange={handleGratuityDescChange}
        />
      )}
    </Paper>
  );
}

/* ----------------------------------------------------------------------------
   TableLayout => For large screens
   ----------------------------------------------------------------------------*/
function TableLayout({
  charges,
  disabled,
  subLabel,
  usedSub,
  taxAmt,
  finalTotal,
  taxExempt,
  onToggleTaxExempt,
  selectedBillableId,
  setSelectedBillableId,
  billableQty,
  setBillableQty,
  customDesc,
  setCustomDesc,
  customQty,
  setCustomQty,
  customRate,
  setCustomRate,
  allBillables,
  handleAddLineItem,
  handleCancelCustom,
  handleChangeQuantity,
  handleChangeRate,
  handleRemoveLineItem,
  handleGratuityDescChange
}) {
  // Filter out any already-used billables
  const usedIds = (charges.items || []).map((it) => it.id);
  const filteredBillables = allBillables.filter((b) => !usedIds.includes(b.id));

  return (
    <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
      <Table
        size="small"
        sx={{
          '& .MuiTableCell-root': { py: 0.5 }
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Description</TableCell>
            <TableCell>Quantity</TableCell>
            <TableCell>Rate</TableCell>
            <TableCell>Line Total</TableCell>
            <TableCell align="center" sx={{ width: 60 }}>
              {/* An invisible icon for alignment */}
              <IconTrash style={{ opacity: 0 }} />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={5}>
              <Divider sx={{ borderColor: '#fff', borderBottomWidth: '2px' }} />
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {/* Existing lines */}
          {charges.items.map((it, idx) => {
            const lineTotal = it.quantity * it.rate;
            const isGratuity = !!it.isGratuity;
            const isLast = idx === charges.items.length - 1;

            if (isGratuity) {
              return (
                <React.Fragment key={`${it.id}-${idx}`}>
                  <TableRow>
                    <TableCell>
                      <TextField
                        size="small"
                        disabled={disabled}
                        value={it.description}
                        onChange={(e) => handleGratuityDescChange(idx, e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" disabled type="number" value={it.quantity} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" disabled type="number" value={it.rate} />
                    </TableCell>
                    <TableCell>${lineTotal.toFixed(2)}</TableCell>
                    <TableCell />
                  </TableRow>
                  {!isLast && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Divider sx={{ borderColor: '#fff', borderBottomWidth: '2px' }} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            } else {
              return (
                <React.Fragment key={`${it.id}-${idx}`}>
                  <TableRow>
                    <TableCell>
                      <TextField
                        size="small"
                        disabled={disabled || it.locked}
                        value={it.description}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        disabled={disabled}
                        type="number"
                        value={it.quantity}
                        onChange={(e) => handleChangeQuantity(idx, e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        disabled={disabled || it.locked}
                        type="number"
                        value={it.rate}
                        onChange={(e) => handleChangeRate(idx, e.target.value)}
                      />
                    </TableCell>
                    <TableCell>${lineTotal.toFixed(2)}</TableCell>
                    <TableCell align="center">
                      {!disabled && (
                        <IconButton
                          onClick={() => handleRemoveLineItem(idx)}
                          color="inherit"
                          size="small"
                        >
                          <IconTrash size={16} />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                  {!isLast && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Divider sx={{ borderColor: '#fff', borderBottomWidth: '2px' }} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            }
          })}
        </TableBody>

        {/* Add New Charge row */}
        {!disabled && (
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 1 }}>
                <Divider sx={{ borderColor: '#fff', borderBottomWidth: '2px', mb: 1 }} />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <TextField
                  select
                  label="Add New Charge"
                  value={selectedBillableId}
                  onChange={(e) => setSelectedBillableId(e.target.value)}
                  size="small"
                  fullWidth
                >
                  <MenuItem value="">(Select)</MenuItem>
                  <MenuItem value="__CUSTOM__">Custom</MenuItem>
                  {filteredBillables.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {b.name || b.id}
                    </MenuItem>
                  ))}
                </TextField>
                {selectedBillableId === '__CUSTOM__' && (
                  <Box sx={{ mt: 1 }}>
                    <TextField
                      label="Description"
                      size="small"
                      fullWidth
                      value={customDesc}
                      onChange={(e) => setCustomDesc(e.target.value)}
                    />
                  </Box>
                )}
              </TableCell>
              <TableCell>
                {selectedBillableId && (
                  selectedBillableId === '__CUSTOM__'
                    ? (
                      <TextField
                        label="Qty"
                        type="number"
                        size="small"
                        fullWidth
                        value={billableQty}
                        onChange={(e) => setBillableQty(e.target.value)}
                      />
                    )
                    : (
                      <TextField
                        label="Qty"
                        type="number"
                        size="small"
                        fullWidth
                        value={billableQty}
                        onChange={(e) => setBillableQty(e.target.value)}
                      />
                    )
                )}
              </TableCell>
              <TableCell>
                {selectedBillableId === '__CUSTOM__' && (
                  <TextField
                    label="Rate"
                    type="number"
                    size="small"
                    fullWidth
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value)}
                  />
                )}
              </TableCell>
              <TableCell align="center">
                {selectedBillableId && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" size="small" onClick={handleAddLineItem}>
                      Add
                    </Button>
                    {selectedBillableId === '__CUSTOM__' && (
                      <Button variant="text" size="small" onClick={handleCancelCustom}>
                        Cancel
                      </Button>
                    )}
                  </Box>
                )}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        )}

        {/* Summaries */}
        <TableBody>
          <TableRow>
            <TableCell colSpan={5} align="center" sx={{ py: 1 }}>
              <Divider sx={{ borderColor: '#fff', borderBottomWidth: '2px', mt: 2, mb: 2 }} />
            </TableCell>
          </TableRow>
        </TableBody>

        <TableFooter>
          {/* Subtotal (Override or not) */}
          <TableRow>
            <TableCell colSpan={5} align="center" sx={{ borderBottom: 'none', py: 0.5 }}>
              <Box sx={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  {subLabel}
                </Typography>
                <TextField
                  size="small"
                  disabled
                  value={usedSub.toFixed(2)}
                />
              </Box>
            </TableCell>
          </TableRow>

          {/* The tax row with an Exempt checkbox */}
          <TableRow>
            <TableCell colSpan={5} align="center" sx={{ py: 0 }}>
              <Divider sx={{ borderColor: '#fff', borderBottomWidth: '2px', mt: 1, mb: 1 }} />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={5} align="center" sx={{ borderBottom: 'none', py: 0.5 }}>
              <Box sx={{ display: 'inline-flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  Tax Amount
                </Typography>
                <TextField
                  size="small"
                  disabled
                  value={taxAmt.toFixed(2)}
                  sx={{ width: 80 }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={taxExempt}
                      onChange={onToggleTaxExempt}
                      disabled={disabled}
                    />
                  }
                  label={<Typography variant="body2">Exempt</Typography>}
                  sx={{ ml: 1 }}
                />
              </Box>
            </TableCell>
          </TableRow>

          {/* Final row */}
          <TableRow>
            <TableCell colSpan={5} align="center" sx={{ py: 0 }}>
              <Divider sx={{ borderColor: '#fff', borderBottomWidth: '2px', mt: 1, mb: 1 }} />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={5} align="center" sx={{ borderBottom: 'none', py: 0.5 }}>
              <Box sx={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  Final Total
                </Typography>
                <TextField
                  size="small"
                  disabled
                  value={finalTotal.toFixed(2)}
                  sx={{ width: 80 }}
                />
              </Box>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  );
}

/* ----------------------------------------------------------------------------
   StackedLayout => For small screens
   ----------------------------------------------------------------------------*/
function StackedLayout({
  charges,
  disabled,
  subLabel,
  usedSub,
  taxAmt,
  finalTotal,
  taxExempt,
  onToggleTaxExempt,
  selectedBillableId,
  setSelectedBillableId,
  billableQty,
  setBillableQty,
  customDesc,
  setCustomDesc,
  customQty,
  setCustomQty,
  customRate,
  setCustomRate,
  allBillables,
  handleAddLineItem,
  handleCancelCustom,
  handleChangeQuantity,
  handleChangeRate,
  handleRemoveLineItem,
  handleGratuityDescChange
}) {
  const usedIds = (charges.items || []).map((it) => it.id);
  const filteredBillables = allBillables.filter((b) => !usedIds.includes(b.id));

  return (
    <Box>
      {/* Existing items */}
      {(charges.items || []).map((it, idx) => {
        const lineTotal = it.quantity * it.rate;
        const isGratuity = !!it.isGratuity;

        return (
          <Box
            key={`${it.id}-${idx}`}
            sx={{ mb: 2, p: 1, borderRadius: 2, backgroundColor: '#fff' }}
          >
            {/* Description */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 600 }}>Description</Typography>
              {isGratuity ? (
                <TextField
                  size="small"
                  disabled={disabled}
                  value={it.description}
                  onChange={(e) => handleGratuityDescChange(idx, e.target.value)}
                />
              ) : (
                <TextField
                  size="small"
                  disabled={disabled || it.locked}
                  value={it.description}
                />
              )}
            </Box>

            {/* Quantity */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>Quantity</Typography>
              {isGratuity ? (
                <TextField size="small" disabled type="number" value={it.quantity} />
              ) : (
                <TextField
                  size="small"
                  disabled={disabled}
                  type="number"
                  value={it.quantity}
                  onChange={(e) => handleChangeQuantity(idx, e.target.value)}
                />
              )}
            </Box>

            {/* Rate */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>Rate</Typography>
              <TextField
                size="small"
                disabled={disabled || it.locked || isGratuity}
                type="number"
                value={it.rate}
                onChange={(e) => handleChangeRate(idx, e.target.value)}
              />
            </Box>

            {/* Line Total */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>Line Total</Typography>
              <Typography>${lineTotal.toFixed(2)}</Typography>
            </Box>

            {/* Remove button? */}
            {!disabled && !isGratuity && (
              <Box sx={{ textAlign: 'right', mt: 1 }}>
                <IconButton onClick={() => handleRemoveLineItem(idx)} color="inherit" size="small">
                  <IconTrash size={16} />
                </IconButton>
              </Box>
            )}
            {isGratuity && (
              <Box sx={{ textAlign: 'right', mt: 1 }}>
                <Typography variant="caption">Clear override if needed.</Typography>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Add new charge */}
      {!disabled && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Add New Charge
          </Typography>
          <TextField
            select
            label="Select an Item"
            value={selectedBillableId}
            onChange={(e) => setSelectedBillableId(e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 1 }}
          >
            <MenuItem value="">(Select)</MenuItem>
            <MenuItem value="__CUSTOM__">Custom</MenuItem>
            {filteredBillables.map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {b.name || b.id}
              </MenuItem>
            ))}
          </TextField>

          {selectedBillableId === '__CUSTOM__' && (
            <>
              <TextField
                label="Description"
                size="small"
                fullWidth
                sx={{ mb: 1 }}
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
              />
              <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                <TextField
                  label="Qty"
                  type="number"
                  size="small"
                  sx={{ flex: 1 }}
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                />
                <TextField
                  label="Rate"
                  type="number"
                  size="small"
                  sx={{ flex: 1 }}
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                />
              </Box>
            </>
          )}

          {selectedBillableId && selectedBillableId !== '__CUSTOM__' && (
            <TextField
              label="Qty"
              type="number"
              size="small"
              sx={{ mb: 1 }}
              value={billableQty}
              onChange={(e) => setBillableQty(e.target.value)}
            />
          )}

          {selectedBillableId && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="outlined" size="small" onClick={handleAddLineItem}>
                Add
              </Button>
              {selectedBillableId === '__CUSTOM__' && (
                <Button variant="text" size="small" onClick={handleCancelCustom}>
                  Cancel
                </Button>
              )}
            </Box>
          )}
        </Paper>
      )}

      {/* Summaries => Subtotal (Override?), Tax + Exempt checkbox, Final */}
      <Paper variant="outlined" sx={{ p: 1 }}>
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {subLabel}
            </Typography>
            <TextField
              size="small"
              disabled
              value={usedSub.toFixed(2)}
            />
          </Box>
          <Divider sx={{ borderColor: '#fff', borderBottomWidth: '2px', mb: 1 }} />

          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mr: 1 }}>
              Tax Amount
            </Typography>
            <TextField
              size="small"
              disabled
              value={taxAmt.toFixed(2)}
              sx={{ width: 80 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={taxExempt}
                  onChange={onToggleTaxExempt}
                  disabled={disabled}
                />
              }
              label={<Typography variant="body2">Exempt</Typography>}
              sx={{ ml: 1 }}
            />
          </Box>
          <Divider sx={{ borderColor: '#fff', borderBottomWidth: '2px', mb: 1 }} />

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              Final Total
            </Typography>
            <TextField
              size="small"
              disabled
              value={finalTotal.toFixed(2)}
            />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
