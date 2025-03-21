"use strict";

/*************************************************************************************************
 * TowPayments
 *
 * Changes:
 *  1) If the balance is $0 (or less), we hide the "Record a Payment" box entirely. The "Payment
 *     Summary" then takes the full width (12 columns on medium screens) and auto-height.
 *  2) The CreditCardBox background is changed to a "light shade of blue" instead of the dark gradient.
 *************************************************************************************************/

import React, { useState, useEffect } from "react";
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
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormControlLabel
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { IconTrash } from "@tabler/icons-react";
import CodeIcon from "@mui/icons-material/Code";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import useAuth from "hooks/useAuth";

const apiUrl = import.meta.env.VITE_APP_API_URL || "https://api-fyif6r6qma-uc.a.run.app";
const appId = import.meta.env.VITE_APP_SQUARE_APP_ID;
const locationId = import.meta.env.VITE_APP_SQUARE_LOCATION_ID;
const SQUARE_JS_URL = "https://sandbox.web.squarecdn.com/v1/square.js";

/** ============== Summation & Helpers ============== */
function parseNumber(val) {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const stripped = val.replace(/[^\d.]/g, "");
    const parsed = parseFloat(stripped);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function sumLineItems(items = []) {
  return items.reduce(
    (acc, it) => acc + parseNumber(it.quantity) * parseNumber(it.rate),
    0
  );
}

function getTaxAmount(total, taxRate, taxExempt) {
  if (taxExempt) return 0;
  const r = parseNumber(taxRate);
  return parseFloat((total * (r / 100)).toFixed(2));
}

function getTotalPayments(payments = []) {
  return payments.reduce((acc, p) => acc + p.amount, 0);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function displayMethod(method = "") {
  return method
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * parseFullAddress => from a single line => address_line_1, city(locality), state, zip, country
 */
function parseFullAddress(fullAddr) {
  if (!fullAddr) {
    return {
      address_line_1: "",
      locality: "",
      administrative_district_level_1: "",
      postal_code: "",
      country: "US"
    };
  }
  const parts = fullAddr.split(",").map((p) => p.trim());
  let address_line_1 = parts[0] || "";
  let locality = parts[1] || "";
  let administrative_district_level_1 = "";
  let postal_code = "";
  let country = "US";

  if (parts[2]) {
    // e.g. "New York 11229"
    const match = parts[2].match(/^(.+)\s+(\d{5}(?:-\d{4})?)$/);
    if (match) {
      administrative_district_level_1 = match[1];
      postal_code = match[2];
    } else {
      administrative_district_level_1 = parts[2];
    }
  }
  if (parts[3]) {
    if (/united states/i.test(parts[3])) {
      country = "US";
    } else {
      country = parts[3].substring(0, 2).toUpperCase();
    }
  }

  return {
    address_line_1,
    locality,
    administrative_district_level_1,
    postal_code,
    country
  };
}

/** 
 * A stylized credit card box with a light shade of blue as requested,
 * horizontally and vertically centered text in white.
 */
function CreditCardBox({ brand, last4, expMonth, expYear }) {
  const maskedNumber = `**** **** **** ${last4 || "XXXX"}`;
  const m = expMonth ? String(expMonth).padStart(2, "0") : "00";
  const y = expYear ? String(expYear).slice(-2) : "00";

  return (
    <Box
      sx={{
        background: "linear-gradient(135deg, #A0D8F1 0%, #D2EEFD 100%)", // "light shade of blue"
        color: "#fff",
        borderRadius: 2,
        p: 3,
        minHeight: 220,
        minWidth: 320,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: "bold", textTransform: "uppercase", mb: 2 }}>
        {brand || "CARD"}
      </Typography>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
        {maskedNumber}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: "bold" }}>
        EXP: {m}/{y}
      </Typography>
    </Box>
  );
}

/** parseSquarePaymentJson => brand, last4, etc. from a stored squareJson field. */
function parseSquarePaymentJson(fullJson = "") {
  let parsed = {};
  try {
    parsed = JSON.parse(fullJson);
  } catch {
    // not valid JSON => minimal
  }

  const status = parsed.status?.toUpperCase() || "";
  const cd = parsed.cardDetails || {};
  const cardObj = cd.card || {};
  const brand = (cardObj.cardBrand || "").toUpperCase();
  const last4 = cardObj.last4 || "";
  const expMonth = cardObj.expMonth || "";
  const expYear = cardObj.expYear || "";
  const entryMethod = cd.entryMethod || "";
  const cvvStatus = cd.cvvStatus || "";
  const avsStatus = cd.avsStatus || "";
  const risk = parsed.riskEvaluation?.riskLevel?.toUpperCase() || "";

  return {
    status,
    brand,
    last4,
    expMonth,
    expYear,
    entryMethod,
    cvvStatus,
    avsStatus,
    risk,
    fullJson,
    receiptNumber: parsed.receiptNumber || "",
    receiptUrl: parsed.receiptUrl || "",
    paymentId: parsed.id || ""
  };
}

export default function TowPayments({
  data = {},
  onChange = () => {},
  disabled = false
}) {
  /**
   * data = {
   *   receiptNumber,
   *   charges: { items:[], taxRate, taxExempt },
   *   payments: [], // each: { note, squareJson, amount, method, collectedByName, etc. }
   *   customerInformation: { firstName, lastName, phone, email, address },
   *   ...
   */
  const {
    receiptNumber = "",
    charges = { items: [], taxRate: 0, taxExempt: false },
    payments = [],
    customerInformation = {}
  } = data;

  // Summations
  const subtotal = sumLineItems(charges.items);
  const taxAmt = getTaxAmount(subtotal, charges.taxRate, charges.taxExempt);
  const totalCharges = subtotal + taxAmt;
  const totalPaid = getTotalPayments(payments);
  const balance = Math.max(0, totalCharges - totalPaid);
  const balanceColor = balance > 0 ? "red" : "green";

  // Auth => get user claims
  const authCtx = useAuth();
  const firebaseUid = authCtx?.user?.firebaseUser?.uid || "UnknownUID";
  const [collectedByDisplayName, setCollectedByDisplayName] = useState("SystemUser");
  useEffect(() => {
    (async () => {
      if (authCtx?.user?.firebaseUser) {
        try {
          const tokenRes = await authCtx.user.firebaseUser.getIdTokenResult(true);
          const c = tokenRes.claims || {};
          const f = c.firstName || "";
          const l = c.lastName || "";
          const combined = [f, l].filter(Boolean).join(" ").trim() || "SystemUser";
          setCollectedByDisplayName(combined);
        } catch (e) {
          console.warn("Claims fetch error:", e);
        }
      }
    })();
  }, [authCtx?.user?.firebaseUser]);

  // Payment form states
  const [method, setMethod] = useState("credit"); // default credit
  const [cashAmount, setCashAmount] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [note, setNote] = useState("");

  // Square card
  const [card, setCard] = useState(null);

  // Billing modal
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [useInfoOnFile, setUseInfoOnFile] = useState(true);

  const parsedAddr = parseFullAddress(customerInformation.address || "");
  const [billingForm, setBillingForm] = useState({
    first_name: customerInformation.firstName || "",
    last_name: customerInformation.lastName || "",
    phone: customerInformation.phone || "",
    email: customerInformation.email || "",
    address_line_1: parsedAddr.address_line_1,
    address_line_2: "",
    locality: parsedAddr.locality,
    administrative_district_level_1: parsedAddr.administrative_district_level_1,
    postal_code: parsedAddr.postal_code,
    country: parsedAddr.country
  });

  // Payment deletion
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  // Success + Error
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalMsg, setSuccessModalMsg] = useState("");
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorModalMsg, setErrorModalMsg] = useState("");

  // JSON modal
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [jsonModalContent, setJsonModalContent] = useState("");

  function showErrorModal(m) {
    setErrorModalMsg(m);
    setErrorModalOpen(true);
  }
  function closeErrorModal() {
    setErrorModalMsg("");
    setErrorModalOpen(false);
  }
  function showSuccessModal(m) {
    setSuccessModalMsg(m);
    setSuccessModalOpen(true);
  }
  function closeSuccessModal() {
    setSuccessModalMsg("");
    setSuccessModalOpen(false);
  }

  function openJsonModal(str) {
    setJsonModalContent(str || "");
    setJsonModalOpen(true);
  }
  function closeJsonModal() {
    setJsonModalOpen(false);
    setJsonModalContent("");
  }
  async function copyJsonToClipboard() {
    if (!jsonModalContent) return;
    try {
      await navigator.clipboard.writeText(jsonModalContent);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  }

  // If method=credit => load Square
  useEffect(() => {
    if (method === "credit") {
      loadSquareScript();
    } else {
      setCard(null);
    }
  }, [method]);

  // if user picks "cash" => auto-pop
  useEffect(() => {
    if (method === "cash") {
      setCashAmount(balance.toFixed(2));
    }
  }, [method, balance]);

  // if user picks "credit" => auto-pop
  useEffect(() => {
    if (method === "credit") {
      setChargeAmount(balance.toFixed(2));
    }
  }, [method, balance]);

  async function loadSquareScript() {
    if (window.Square) {
      initSquareCard();
      return;
    }
    if (!document.getElementById("square-web-payments-script")) {
      const script = document.createElement("script");
      script.id = "square-web-payments-script";
      script.src = SQUARE_JS_URL;
      script.async = true;
      script.onload = () => {
        initSquareCard();
      };
      document.head.appendChild(script);
    }
  }

  async function initSquareCard() {
    if (!window.Square) {
      showErrorModal("Square script not ready. Wait or reload.");
      return;
    }
    if (!appId || !locationId) {
      showErrorModal("Square App/Location ID missing in environment.");
      return;
    }
    try {
      const payments = window.Square.payments(appId, locationId);
      const cardElement = await payments.card();
      await cardElement.attach("#card-container");
      setCard(cardElement);
    } catch (err) {
      showErrorModal("initSquareCard error: " + err.message);
    }
  }

  async function getAuthHeaders() {
    const fbUser = authCtx?.user?.firebaseUser;
    if (!fbUser) return {};
    const token = await fbUser.getIdToken(true);
    return { Authorization: `Bearer ${token}` };
  }

  function getBuyerEmailAndPhone() {
    if (useInfoOnFile) {
      return {
        email: customerInformation.email || "",
        phone: customerInformation.phone || ""
      };
    }
    return {
      email: billingForm.email,
      phone: billingForm.phone
    };
  }

  function buildBillingAddress() {
    if (useInfoOnFile) {
      const pa = parseFullAddress(customerInformation.address || "");
      return {
        address_line_1: pa.address_line_1,
        address_line_2: "",
        locality: pa.locality,
        administrative_district_level_1: pa.administrative_district_level_1,
        postal_code: pa.postal_code,
        country: pa.country,
        first_name: customerInformation.firstName || "",
        last_name: customerInformation.lastName || ""
      };
    }
    return {
      address_line_1: billingForm.address_line_1,
      address_line_2: billingForm.address_line_2,
      locality: billingForm.locality,
      administrative_district_level_1: billingForm.administrative_district_level_1,
      postal_code: billingForm.postal_code,
      country: billingForm.country,
      first_name: billingForm.first_name,
      last_name: billingForm.last_name
    };
  }

  /** doSquareCreditPayment => called after user hits "Continue" in billing modal. */
  async function doSquareCreditPayment() {
    if (!card) {
      showErrorModal("Square card not ready.");
      return;
    }
    const amt = parseNumber(chargeAmount);
    if (amt <= 0) {
      showErrorModal("Charge amount must be > 0");
      return;
    }
    const tokenizeResult = await card.tokenize();
    if (tokenizeResult.status !== "OK") {
      showErrorModal(`Tokenize failed: ${tokenizeResult.status}`);
      return;
    }

    const { email, phone } = getBuyerEmailAndPhone();
    const billingAddr = buildBillingAddress();

    const headers = await getAuthHeaders();
    const resp = await fetch(`${apiUrl}/square/createPayment`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        nonce: tokenizeResult.token,
        amountCents: Math.round(amt * 100),
        referenceId: receiptNumber || "NoReceiptNumber",
        team_member_id: firebaseUid,
        buyer_email_address: email,
        buyer_phone_number: phone,
        billing_address: billingAddr
      })
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      showErrorModal(`createPayment failed: ${json.error || resp.statusText}`);
      return;
    }

    // We'll store the user note in .note, Square JSON in .squareJson
    const fullSqJson = JSON.stringify(json.payment, null, 2);
    addNewPayment(amt, "credit", fullSqJson);

    setBillingModalOpen(false);
    showSuccessModal("Payment processed successfully!");
  }

  /** addNewPayment => store user note + squareJson separately. */
  function addNewPayment(amountVal, payMethod, squareJsonStr = "") {
    const maxNum = payments.reduce((m, p) => Math.max(m, p.paymentNumber || 0), 0);
    const nextNum = maxNum + 1;

    const newPayment = {
      id: uuidv4(),
      paymentNumber: nextNum,
      amount: amountVal,
      method: payMethod,
      timestamp: new Date().toISOString(),
      collectedByName: collectedByDisplayName || "SystemUser",
      note: note.trim() || "",
      squareJson: squareJsonStr // advanced Square data
    };

    onChange({
      ...data,
      payments: [...payments, newPayment],
      autoSaveNow: true
    });

    setNote("");
    setCashAmount("");
    setChargeAmount("");
  }

  async function handleRecordPayment() {
    if (disabled) return;

    if (method === "cash") {
      const cVal = parseNumber(cashAmount);
      if (cVal <= 0) {
        showErrorModal("Please enter a valid cash amount.");
        return;
      }
      addNewPayment(cVal, "cash", "");
      return;
    }

    // method=credit
    if (!billingModalOpen) {
      setBillingModalOpen(true);
      return;
    }
    await doSquareCreditPayment();
  }

  function handleDeleteClick(pmt) {
    setPaymentToDelete(pmt);
    setDeleteDialogOpen(true);
  }
  function confirmDeletePayment() {
    if (!paymentToDelete) return;
    const updated = payments.filter((p) => p.id !== paymentToDelete.id);
    onChange({ ...data, payments: updated, autoSaveNow: true });
    setPaymentToDelete(null);
    setDeleteDialogOpen(false);
  }

  // Payment history newest->oldest
  const sortedPayments = [...payments].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Now we can conditionally hide "Record a Payment" if balance = 0.
  const showPaymentForm = balance > 0.01; // If there's any balance > 0, show it. If exactly $0 => hide.

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        {/* If balance=0 => Payment Summary goes 12 columns. Otherwise, 6 columns each. */}
        <Grid item xs={12} md={showPaymentForm ? 6 : 12}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              mb: 2,
              backgroundColor: "#E3F2FD",
              borderRadius: 2,
              // If we are alone (12 columns), let's auto-height. 
              // If we are 6 columns, full height in that context.
              height: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 2
            }}
          >
            <Typography variant="h6" sx={{ textAlign: "left", mb: 1 }}>
              Payment Summary
            </Typography>

            <TextField
              label="Total Charges"
              value={formatCurrency(totalCharges)}
              fullWidth
              size="small"
              InputProps={{
                readOnly: true,
                style: { textAlign: "center", fontWeight: "bold", color: "black" }
              }}
            />
            <TextField
              label="Total Payments"
              value={formatCurrency(totalPaid)}
              fullWidth
              size="small"
              InputProps={{
                readOnly: true,
                style: { textAlign: "center", fontWeight: "bold", color: "black" }
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
                  textAlign: "center",
                  fontWeight: "bold",
                  color: balanceColor
                }
              }}
            />
          </Paper>
        </Grid>

        {/* Only show Payment Form if there's a positive balance */}
        {showPaymentForm && (
          <Grid item xs={12} md={6}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                mb: 2,
                backgroundColor: "#E3F2FD",
                borderRadius: 2,
                height: "100%",
                display: "flex",
                flexDirection: "column"
              }}
            >
              <Typography variant="h6" sx={{ mb: 2, textAlign: "center" }}>
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

              {method === "cash" && (
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

              {method === "credit" && (
                <>
                  <TextField
                    label="Charge Amount"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    size="small"
                    fullWidth
                    sx={{ mb: 2 }}
                    disabled={disabled}
                  />
                  <Box
                    id="card-container"
                    sx={{
                      mb: 2,
                      minHeight: 60,
                      border: "1px solid #ccc",
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
                {method === "cash" ? "Record Cash Payment" : "Charge Card"}
              </Button>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Payment History */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 1, textAlign: "center" }}>
          Payment History
        </Typography>

        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            p: 1,
            mb: 2,
            backgroundColor: "#E3F2FD"
          }}
        >
          <Grid container alignItems="center">
            <Grid item xs={1}>
              <Typography align="center" fontWeight="bold">
                ID
              </Typography>
            </Grid>
            <Grid item xs={2}>
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
            <Grid item xs={2}>
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
              backgroundColor: "#E3F2FD",
              borderRadius: 2
            }}
          >
            <Typography variant="body2" color="textSecondary" align="center">
              No payments recorded.
            </Typography>
          </Paper>
        ) : (
          sortedPayments.map((pmt) => {
            let recordBg = "#fff";
            if (pmt.amount > 0) recordBg = "rgba(0,255,0,0.1)";
            if (pmt.amount < 0) recordBg = "rgba(255,0,0,0.1)";

            const dt = dayjs(pmt.timestamp).format("MMM D, YYYY h:mm A");
            const displayAmount = formatCurrency(pmt.amount);
            const canDelete = !disabled;

            // parse advanced data from pmt.squareJson
            const sq = parseSquarePaymentJson(pmt.squareJson || "");

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
                    <Typography sx={{ fontWeight: "bold", textAlign: "center" }}>
                      {pmt.paymentNumber}
                    </Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography align="center">{dt}</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography align="center">{displayMethod(pmt.method)}</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography align="center">{displayAmount}</Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography align="center">
                      {pmt.collectedByName || "SystemUser"}
                    </Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Box sx={{ display: "flex", justifyContent: "center", gap: 1 }}>
                      {canDelete && (
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(pmt)}
                          title="Delete Payment"
                        >
                          <IconTrash size={16} />
                        </IconButton>
                      )}
                    </Box>
                  </Grid>
                </Grid>

                {/* If user typed a note => display above advanced details */}
                {pmt.note && (
                  <Box sx={{ mt: 1 }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        backgroundColor: "#f9f9f9",
                        border: "1px solid #ccc"
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {pmt.note}
                      </Typography>
                    </Paper>
                  </Box>
                )}

                {/* If parseSquarePaymentJson => advanced details => credit card 50%, details 50% */}
                {sq.paymentId && (
                  <Accordion disableGutters sx={{ mt: 1 }}>
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        backgroundColor: "#f5f5f5",
                        borderBottom: "1px solid #ccc"
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                        View Payment Details
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ backgroundColor: "#fafafa" }}>
                      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => {
                            setJsonModalContent(sq.fullJson || "");
                            setJsonModalOpen(true);
                          }}
                          title="View Raw JSON"
                        >
                          <CodeIcon fontSize="inherit" />
                        </IconButton>
                      </Box>

                      <Grid
                        container
                        spacing={2}
                        sx={{ width: "100%" }}
                        alignItems="center"
                        justifyContent="center"
                      >
                        {/* Left => credit card box => 50% */}
                        <Grid
                          item
                          xs={12}
                          md={6}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 220
                          }}
                        >
                          <CreditCardBox
                            brand={sq.brand}
                            last4={sq.last4}
                            expMonth={sq.expMonth}
                            expYear={sq.expYear}
                          />
                        </Grid>

                        {/* Right => line-by-line, also 50% => vertical center + left text */}
                        <Grid
                          item
                          xs={12}
                          md={6}
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            textAlign: "left"
                          }}
                        >
                          <Typography variant="body1" sx={{ mb: 1 }}>
                            <strong>SquarePaymentID:</strong> {sq.paymentId}
                          </Typography>
                          <Typography variant="body1" sx={{ mb: 1 }}>
                            <strong>Status:</strong> {sq.status || "N/A"}
                          </Typography>
                          {sq.receiptNumber && (
                            <Typography variant="body1" sx={{ mb: 1 }}>
                              <strong>Receipt #:</strong> {sq.receiptNumber}
                            </Typography>
                          )}
                          <Typography variant="body1" sx={{ mb: 1 }}>
                            <strong>Entry:</strong> {sq.entryMethod || "N/A"}
                          </Typography>
                          <Typography variant="body1" sx={{ mb: 1 }}>
                            <strong>CVV:</strong> {sq.cvvStatus || "UNKNOWN"}
                          </Typography>
                          <Typography variant="body1" sx={{ mb: 1 }}>
                            <strong>AVS:</strong> {sq.avsStatus || "UNKNOWN"}
                          </Typography>
                          <Typography variant="body1">
                            <strong>Risk:</strong> {sq.risk || "N/A"}
                          </Typography>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
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
          <Typography variant="body2">Are you sure you want to remove this payment?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeletePayment}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={errorModalOpen} onClose={closeErrorModal}>
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{errorModalMsg}</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="error" onClick={closeErrorModal}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={successModalOpen} onClose={closeSuccessModal}>
        <DialogTitle>Payment Successful</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{successModalMsg}</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={closeSuccessModal}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Raw JSON Modal */}
      <Dialog open={jsonModalOpen} onClose={closeJsonModal} maxWidth="md" fullWidth>
        <DialogTitle>Raw JSON Response</DialogTitle>
        <DialogContent dividers>
          <Typography
            variant="body2"
            sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}
          >
            {jsonModalContent}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={copyJsonToClipboard}>
            Copy
          </Button>
          <Button variant="contained" onClick={closeJsonModal}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Billing Info Modal */}
      <Dialog
        open={billingModalOpen && method === "credit"}
        onClose={() => setBillingModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Billing Information</DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={
              <Checkbox
                checked={useInfoOnFile}
                onChange={(e) => setUseInfoOnFile(e.target.checked)}
              />
            }
            label="Use the information on file (from Tow Manager)?"
          />
          {!useInfoOnFile && (
            <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="First Name"
                size="small"
                value={billingForm.first_name}
                onChange={(e) =>
                  setBillingForm((prev) => ({ ...prev, first_name: e.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Last Name"
                size="small"
                value={billingForm.last_name}
                onChange={(e) =>
                  setBillingForm((prev) => ({ ...prev, last_name: e.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Phone"
                size="small"
                value={billingForm.phone}
                onChange={(e) =>
                  setBillingForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Email"
                size="small"
                value={billingForm.email}
                onChange={(e) =>
                  setBillingForm((prev) => ({ ...prev, email: e.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Address Line 1"
                size="small"
                value={billingForm.address_line_1}
                onChange={(e) =>
                  setBillingForm((prev) => ({ ...prev, address_line_1: e.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Address Line 2"
                size="small"
                value={billingForm.address_line_2}
                onChange={(e) =>
                  setBillingForm((prev) => ({ ...prev, address_line_2: e.target.value }))
                }
                fullWidth
              />
              <TextField
                label="City/Locality"
                size="small"
                value={billingForm.locality}
                onChange={(e) =>
                  setBillingForm((prev) => ({ ...prev, locality: e.target.value }))
                }
                fullWidth
              />
              <TextField
                label="State"
                size="small"
                value={billingForm.administrative_district_level_1}
                onChange={(e) =>
                  setBillingForm((prev) => ({
                    ...prev,
                    administrative_district_level_1: e.target.value
                  }))
                }
                fullWidth
              />
              <TextField
                label="Postal Code"
                size="small"
                value={billingForm.postal_code}
                onChange={(e) =>
                  setBillingForm((prev) => ({ ...prev, postal_code: e.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Country (2-letter code)"
                size="small"
                value={billingForm.country}
                onChange={(e) =>
                  setBillingForm((prev) => ({ ...prev, country: e.target.value }))
                }
                fullWidth
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBillingModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={doSquareCreditPayment}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
