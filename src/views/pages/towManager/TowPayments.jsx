"use strict";

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
  FormControlLabel,
  Tabs,
  Tab,
  Chip
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CodeIcon from "@mui/icons-material/Code";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import useAuth from "hooks/useAuth";

/** Tabler Icons */
import {
  IconTrash,
  IconCash,
  IconCreditCard,
  IconReceipt,
  IconReceiptRefund,
  IconRefresh
} from "@tabler/icons-react";

/**
 * 1) Basic environment setup for Square & calls
 */
const apiUrl = import.meta.env.VITE_APP_API_URL || "https://api-fyif6r6qma-uc.a.run.app";
const appId = import.meta.env.VITE_APP_SQUARE_APP_ID;
const locationId = import.meta.env.VITE_APP_SQUARE_LOCATION_ID;
const SQUARE_JS_URL = "https://sandbox.web.squarecdn.com/v1/square.js";

/** 2) Utility Functions */
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
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount);
}
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
  const parts = fullAddr.split(",").map((s) => s.trim());
  let address_line_1 = parts[0] || "";
  let locality = parts[1] || "";
  let administrative_district_level_1 = "";
  let postal_code = "";
  let country = "US";

  if (parts[2]) {
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

/** Credit Card UI box */
function CreditCardBox({ brand, last4, expMonth, expYear }) {
  const masked = `**** **** **** ${last4 || "XXXX"}`;
  const m = expMonth ? String(expMonth).padStart(2, "0") : "00";
  const y = expYear ? String(expYear).slice(-2) : "00";

  return (
    <Box
      sx={{
        background: "#b3cde0",
        color: "#fff",
        borderRadius: 2,
        px: 3,
        py: 1,
        minHeight: 180,
        minWidth: 300,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: "bold", textTransform: "uppercase", mb: 1 }}>
        {brand || "CARD"}
      </Typography>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: "bold" }}>
        {masked}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: "bold" }}>
        EXP: {m}/{y}
      </Typography>
    </Box>
  );
}

/** parseSquarePaymentJson => glean brand, last4, etc. */
function parseSquarePaymentJson(fullJson = "", isRefund = false) {
  let parsed;
  try {
    parsed = JSON.parse(fullJson);
  } catch {
    parsed = {};
  }
  const receiptNumber = parsed.receiptNumber || "";
  const receiptUrl = parsed.receiptUrl || "";
  const riskLevel = parsed.riskLevel || parsed.risk_evaluation?.risk_level || "";

  if (isRefund) {
    // Refund
    const r = parsed || {};
    const status = r.status || "";
    const c = r.cardDetails || {};
    const co = c.card || {};
    return {
      brand: (co.cardBrand || "").toUpperCase(),
      last4: co.last4 || "",
      expMonth: co.expMonth || "",
      expYear: co.expYear || "",
      entryMethod: c.entryMethod || "",
      cvvStatus: c.cvvStatus || "",
      avsStatus: c.avsStatus || "",
      risk: "",
      paymentId: r.payment_id || "",
      status,
      receiptNumber,
      receiptUrl
    };
  } else {
    // Payment
    const p = parsed || {};
    const status = p.status || "";
    const cd = p.cardDetails || {};
    const cardObj = cd.card || {};
    return {
      brand: (cardObj.cardBrand || "").toUpperCase(),
      last4: cardObj.last4 || "",
      expMonth: cardObj.expMonth || "",
      expYear: cardObj.expYear || "",
      entryMethod: cd.entryMethod || "",
      cvvStatus: cd.cvvStatus || "",
      avsStatus: cd.avsStatus || "",
      risk: riskLevel,
      paymentId: p.id || "",
      status,
      receiptNumber,
      receiptUrl
    };
  }
}

/** getValidChargesSum => total "completed" or "cash" payments */
function getValidChargesSum(payments) {
  let sum = 0;
  for (const p of payments) {
    if (p.method === "refund") continue;
    let sqStatus = p.squareStatus || "";
    if (p.method.toLowerCase() === "cash") {
      sqStatus = "COMPLETED";
    }
    if (sqStatus === "COMPLETED") {
      sum += parseNumber(p.amount);
    }
  }
  return sum;
}

/** getValidRefundsSum => total of refunds with squareStatus in {PENDING, COMPLETED} */
function getValidRefundsSum(payments) {
  let sum = 0;
  for (const p of payments) {
    if (p.method.toLowerCase() !== "refund") continue;
    const sqStatus = p.squareStatus || "";
    if (sqStatus === "PENDING" || sqStatus === "COMPLETED") {
      sum += Math.abs(p.amount);
    }
  }
  return sum;
}

function getCardDetailsFromPayment(paymentJson) {
  const paymentData = parseSquarePaymentJson(paymentJson, false);
  return {
    cardBrand: paymentData.brand,
    last4: paymentData.last4,
    expMonth: paymentData.expMonth,
    expYear: paymentData.expYear,
    entryMethod: paymentData.entryMethod,
    cvvStatus: paymentData.cvvStatus,
    avsStatus: paymentData.avsStatus,
    risk: paymentData.risk
  };
}

/** PaymentForm => only shown if (balance>0), with "cash" as the default method */
function PaymentForm({
  data,
  onChange,
  disabled,
  showErrorModal,
  showSuccessModal,
  receiptNumber,
  collectedByDisplayName
}) {
  const { user } = useAuth();
  const { payments = [], customerInformation = {}, charges = {} } = data;

  const sub = sumLineItems(charges.items);
  const taxAmt = getTaxAmount(sub, charges.taxRate, charges.taxExempt);
  const totalInvoiced = sub + taxAmt;

  // 1) Default method = "cash"
  const [method, setMethod] = useState("cash");

  const [cashAmount, setCashAmount] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [note, setNote] = useState("");

  // We'll hold onto the Square "card" object once attached
  const [card, setCard] = useState(null);

  // 2) Billing Info
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [useInfoOnFile, setUseInfoOnFile] = useState(true);

  const parsed = parseFullAddress(customerInformation.address || "");
  const [billingForm, setBillingForm] = useState({
    first_name: customerInformation.firstName || "",
    last_name: customerInformation.lastName || "",
    phone: customerInformation.phone || "",
    email: customerInformation.email || "",
    address_line_1: parsed.address_line_1,
    address_line_2: "",
    locality: parsed.locality,
    administrative_district_level_1: parsed.administrative_district_level_1,
    postal_code: parsed.postal_code,
    country: parsed.country
  });

  useEffect(() => {
    // Initialize "cash" or "credit" amounts
    const validCharges = getValidChargesSum(payments);
    const validRefunds = getValidRefundsSum(payments);
    const currentBalance = totalInvoiced - (validCharges - validRefunds);

    if (method.toLowerCase() === "cash") {
      setCashAmount(currentBalance.toFixed(2));
    } else if (method.toLowerCase() === "credit") {
      setChargeAmount(currentBalance.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  // 3) Only load the Square script if user picks "Credit"
  useEffect(() => {
    if (method.toLowerCase() === "credit") {
      loadSquareScript();
    } else {
      setCard(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

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
      script.onload = initSquareCard;
      document.head.appendChild(script);
    }
  }
  async function initSquareCard() {
    if (!document.getElementById("card-container")) return;
    if (!window.Square) {
      showErrorModal("Square JS not loaded yet.");
      return;
    }
    if (!appId || !locationId) {
      showErrorModal("Missing Square AppId or LocationId in env.");
      return;
    }
    try {
      const payments = window.Square.payments(appId, locationId);
      const cardElement = await payments.card();
      await cardElement.attach("#card-container");
      setCard(cardElement);
    } catch (err) {
      showErrorModal(`initSquareCard error: ${err.message}`);
    }
  }

  // 4) Square "Credit" Payment
  async function doSquareCreditPayment() {
    if (!card) {
      showErrorModal("Square card is not ready. Wait or reload.");
      return;
    }
    const amt = parseNumber(chargeAmount);
    if (amt <= 0) {
      showErrorModal("Charge amount must be > 0");
      return;
    }
    let tokenizeRes;
    try {
      tokenizeRes = await card.tokenize();
    } catch (err) {
      showErrorModal(`Tokenize error: ${err?.message || err}`);
      return;
    }
    if (tokenizeRes.status !== "OK") {
      showErrorModal(`Tokenize failed: ${tokenizeRes.status}`);
      return;
    }

    // Validate phone => if user unchecks "useInfoOnFile"
    const usPhone = formatUSPhone(
      useInfoOnFile ? customerInformation.phone : billingForm.phone
    );
    if (
      (useInfoOnFile ? customerInformation.phone : billingForm.phone) &&
      !usPhone
    ) {
      showErrorModal(
        "Invalid US phone format. Must be 10 or 11 digits starting with '1'."
      );
      return;
    }

    const reqObj = {
      nonce: tokenizeRes.token,
      amountCents: Math.round(amt * 100),
      referenceId: receiptNumber || "NoReceiptNumber",
      team_member_id: "someTeamId"
    };
    reqObj.buyer_email_address = useInfoOnFile
      ? customerInformation.email
      : billingForm.email;
    if (usPhone) {
      reqObj.buyer_phone_number = usPhone;
    }
    reqObj.billing_address = buildBillingAddress();

    const requestStr = JSON.stringify(reqObj, null, 2);

    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${apiUrl}/square/createPayment`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: requestStr
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        showErrorModal(`createPayment failed: ${json.error || resp.statusText}`);
        return;
      }
      const paymentObjStr = JSON.stringify(json.payment, null, 2);
      addNewPayment(amt, "credit", paymentObjStr, requestStr);
      setBillingModalOpen(false);
      showSuccessModal("Payment processed successfully!");
    } catch (err) {
      showErrorModal(`Payment request error: ${err?.message || err}`);
    }
  }

  function addNewPayment(amountVal, payMethod, squareJsonStr, requestStr) {
    const maxNum = payments.reduce((m, p) => Math.max(m, p.paymentNumber || 0), 0);
    const nextNum = maxNum + 1;

    const parsed = parseSquarePaymentJson(squareJsonStr, false);
    const newPayment = {
      id: uuidv4(),
      paymentNumber: nextNum,
      amount: amountVal,
      method: payMethod,
      timestamp: new Date().toISOString(),
      collectedByName: collectedByDisplayName || "",
      note: note.trim(),
      squareJson: squareJsonStr || "",
      squareRequest: requestStr || "",
      squarePaymentId: parsed.paymentId || "",
      squareStatus: parsed.status || "",
      squareRisk: parsed.risk || ""
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

  function formatUSPhone(rawPhone) {
    if (!rawPhone) return "";
    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return "";
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
  async function getAuthHeaders() {
    if (!user?.firebaseUser) return {};
    const t = await user.firebaseUser.getIdToken(true);
    return { Authorization: `Bearer ${t}` };
  }

  // Render
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        mb: 2,
        backgroundColor: "#E3F2FD",
        borderRadius: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <Typography variant="h6" sx={{ mb: 1, textAlign: "center" }}>
        Record a Payment
      </Typography>

      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel>Payment Method</InputLabel>
        <Select
          value={method}
          label="Payment Method"
          onChange={(e) => setMethod(e.target.value)}
          disabled={disabled}
          sx={{ "& .MuiSelect-select": { textAlign: "center" } }}
        >
          <MenuItem value="cash">Cash</MenuItem>
          <MenuItem value="credit">Credit</MenuItem>
        </Select>
      </FormControl>

      {method.toLowerCase() === "cash" && (
        <TextField
          label="Amount Received"
          value={cashAmount}
          onChange={(e) => setCashAmount(e.target.value)}
          size="small"
          fullWidth
          sx={{ mb: 1 }}
          disabled={disabled}
          inputProps={{ style: { textAlign: "center" } }}
        />
      )}

      {method.toLowerCase() === "credit" && (
        <>
          <TextField
            label="Charge Amount"
            value={chargeAmount}
            onChange={(e) => setChargeAmount(e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 1 }}
            disabled={disabled}
            inputProps={{ style: { textAlign: "center" } }}
          />
          <Box
            id="card-container"
            sx={{
              mb: 1,
              minHeight: 60
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
        sx={{ mb: 1 }}
        disabled={disabled}
        inputProps={{ style: { textAlign: "center" } }}
      />

      <Button
        variant="contained"
        disabled={disabled}
        fullWidth
        onClick={async () => {
          if (method.toLowerCase() === "cash") {
            const parsedVal = parseNumber(cashAmount);
            if (parsedVal <= 0) {
              showErrorModal("Invalid cash amount (> 0).");
              return;
            }
            const maxNum = payments.reduce(
              (m, p) => Math.max(m, p.paymentNumber || 0),
              0
            );
            const nextNum = maxNum + 1;
            const newPayment = {
              id: uuidv4(),
              paymentNumber: nextNum,
              amount: parsedVal,
              method: "cash",
              timestamp: new Date().toISOString(),
              collectedByName: collectedByDisplayName || "",
              note: note.trim(),
              squareJson: "",
              squareRequest: "",
              squarePaymentId: "",
              squareStatus: "COMPLETED"
            };
            onChange({
              ...data,
              payments: [...payments, newPayment],
              autoSaveNow: true
            });
            setNote("");
            setCashAmount("");
            showSuccessModal("Cash payment recorded!");
          } else {
            // credit
            if (!billingModalOpen) {
              setBillingModalOpen(true);
              return;
            }
            await doSquareCreditPayment();
          }
        }}
      >
        {method.toLowerCase() === "cash" ? "Record Cash Payment" : "Charge Card"}
      </Button>

      {/* Billing Info Modal => if method=credit */}
      <Dialog
        open={billingModalOpen && method.toLowerCase() === "credit"}
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
                onChange={(e) => setBillingForm((p) => ({ ...p, first_name: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Last Name"
                size="small"
                value={billingForm.last_name}
                onChange={(e) => setBillingForm((p) => ({ ...p, last_name: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Phone"
                size="small"
                value={billingForm.phone}
                onChange={(e) => setBillingForm((p) => ({ ...p, phone: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Email"
                size="small"
                value={billingForm.email}
                onChange={(e) => setBillingForm((p) => ({ ...p, email: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Address Line 1"
                size="small"
                value={billingForm.address_line_1}
                onChange={(e) => setBillingForm((p) => ({ ...p, address_line_1: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Address Line 2"
                size="small"
                value={billingForm.address_line_2}
                onChange={(e) => setBillingForm((p) => ({ ...p, address_line_2: e.target.value }))}
                fullWidth
              />
              <TextField
                label="City/Locality"
                size="small"
                value={billingForm.locality}
                onChange={(e) => setBillingForm((p) => ({ ...p, locality: e.target.value }))}
                fullWidth
              />
              <TextField
                label="State"
                size="small"
                value={billingForm.administrative_district_level_1}
                onChange={(e) =>
                  setBillingForm((p) => ({
                    ...p,
                    administrative_district_level_1: e.target.value
                  }))
                }
                fullWidth
              />
              <TextField
                label="Postal Code"
                size="small"
                value={billingForm.postal_code}
                onChange={(e) => setBillingForm((p) => ({ ...p, postal_code: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Country (2-letter code)"
                size="small"
                value={billingForm.country}
                onChange={(e) => setBillingForm((p) => ({ ...p, country: e.target.value }))}
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
    </Paper>
  );
}

/** The main default export => Payment listing + PaymentForm. */
export default function TowPayments({
  data = {},
  onChange = () => {},
  disabled = false
}) {
  const {
    receiptNumber = "",
    charges = { items: [], taxRate: 0, taxExempt: false },
    payments = [],
    customerInformation = {}
  } = data;

  const { user } = useAuth();
  const [collectedByDisplayName, setCollectedByDisplayName] = useState("SystemUser");

  useEffect(() => {
    if (!user?.firebaseUser) return;
    user.firebaseUser
      .getIdTokenResult(true)
      .then((tokRes) => {
        const c = tokRes.claims || {};
        const f = c.firstName || "";
        const l = c.lastName || "";
        const combined = [f, l].filter(Boolean).join(" ").trim() || "SystemUser";
        setCollectedByDisplayName(combined);
      })
      .catch((err) => {
        console.warn("Error loading user claims:", err);
      });
  }, [user?.firebaseUser]);

  // Summaries
  const sub = sumLineItems(charges.items);
  const taxAmt = getTaxAmount(sub, charges.taxRate, charges.taxExempt);
  const totalInvoiced = sub + taxAmt;
  const totalCharges = getValidChargesSum(payments);
  const totalRefunds = getValidRefundsSum(payments);
  const balance = totalInvoiced - (totalCharges - totalRefunds);
  const isPaidInFull = balance <= 0;

  // success + error modals
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorModalMsg, setErrorModalMsg] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalMsg, setSuccessModalMsg] = useState("");

  function showErrorModal(msg) {
    setErrorModalMsg(msg);
    setErrorModalOpen(true);
  }
  function closeErrorModal() {
    setErrorModalMsg("");
    setErrorModalOpen(false);
  }
  function showSuccessModal(msg) {
    setSuccessModalMsg(msg);
    setSuccessModalOpen(true);
  }
  function closeSuccessModal() {
    setSuccessModalMsg("");
    setSuccessModalOpen(false);
  }

  // JSON Modal => TABS for response & request
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [requestJson, setRequestJson] = useState("");
  const [responseJson, setResponseJson] = useState("");
  const [jsonTab, setJsonTab] = useState(0);

  function openJsonModal(reqStr, respStr) {
    setRequestJson(reqStr || "");
    setResponseJson(respStr || "");
    setJsonTab(0);
    setJsonModalOpen(true);
  }
  function closeJsonModal() {
    setJsonModalOpen(false);
    setRequestJson("");
    setResponseJson("");
  }
  function handleJsonTabChange(e, newVal) {
    setJsonTab(newVal);
  }
  async function copyJsonToClipboard() {
    const textToCopy = jsonTab === 0 ? responseJson : requestJson;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (err) {
      console.error("clipboard copy error:", err);
    }
  }

  // Payment deletion
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  function handleDeleteClick(pmt) {
    setPaymentToDelete(pmt);
    setDeleteDialogOpen(true);
  }
  function confirmDeletePayment() {
    if (!paymentToDelete) return;
    const filtered = payments.filter((p) => p.id !== paymentToDelete.id);
    onChange({ ...data, payments: filtered, autoSaveNow: true });
    setDeleteDialogOpen(false);
    setPaymentToDelete(null);
  }

  // Refund logic
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundPayment, setRefundPayment] = useState(null);
  const [refundAmount, setRefundAmount] = useState("");

  function handleOpenRefundDialog(pmt) {
    if (pmt.method.toLowerCase() === "refund") {
      showErrorModal("This is already a refund record.");
      return;
    }
    const existingRefunds = payments.filter((r) => r.refundForPaymentId === pmt.id);
    const alreadyRefunded = existingRefunds.reduce((acc, r) => acc + Math.abs(r.amount), 0);
    const maxAvailable = pmt.amount - alreadyRefunded;
    if (maxAvailable <= 0) {
      showErrorModal("No remaining amount is refundable for this payment.");
      return;
    }
    setRefundPayment(pmt);
    setRefundAmount(String(maxAvailable.toFixed(2)));
    setRefundDialogOpen(true);
  }
  function handleCloseRefundDialog() {
    setRefundDialogOpen(false);
    setRefundPayment(null);
    setRefundAmount("");
  }

  async function handleConfirmRefund() {
    if (!refundPayment) return;
    const amt = parseNumber(refundAmount);
    if (amt <= 0) {
      showErrorModal("Refund amount must be > 0.");
      return;
    }
    const existingRefunds = payments.filter((r) => r.refundForPaymentId === refundPayment.id);
    const alreadyRefunded = existingRefunds.reduce((acc, r) => acc + Math.abs(r.amount), 0);
    const maxAvailable = refundPayment.amount - alreadyRefunded;
    if (amt > maxAvailable) {
      showErrorModal("Cannot refund more than what's left of the original payment.");
      return;
    }

    // If original method was cash => simple negative payment
    if (refundPayment.method.toLowerCase() === "cash") {
      const newRefund = {
        id: uuidv4(),
        paymentNumber: payments.reduce((m, p) => Math.max(m, p.paymentNumber || 0), 0) + 1,
        amount: -amt,
        method: "refund",
        timestamp: new Date().toISOString(),
        collectedByName: collectedByDisplayName || "",
        note: `Refund for Payment #${refundPayment.paymentNumber}`,
        squareRequest: "",
        squareJson: "",
        refundForPaymentId: refundPayment.id,
        squareRefundId: "",
        squareStatus: "COMPLETED"
      };
      onChange({
        ...data,
        payments: [...payments, newRefund],
        autoSaveNow: true
      });
      handleCloseRefundDialog();
      showSuccessModal("Cash refund recorded successfully!");
      return;
    }

    // Otherwise, attempt Square refund
    if (!refundPayment.squarePaymentId) {
      showErrorModal("This payment is not linked to Square, cannot refund.");
      return;
    }

    const reqObj = {
      idempotency_key: uuidv4(),
      payment_id: refundPayment.squarePaymentId,
      amount_cents: Math.round(amt * 100),
      reason: "Refund from TowPayments UI"
    };
    const requestStr = JSON.stringify(reqObj, null, 2);

    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${apiUrl}/square/refundPayment`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: requestStr
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        const errMsg = json.error || resp.statusText || "Refund request failed";
        showErrorModal(errMsg);
        return;
      }
      // Merge original card details
      const origPay = payments.find((z) => z.id === refundPayment.id);
      const originalCardDetails = getCardDetailsFromPayment(origPay?.squareJson || "");
      const mergedRefundJson = {
        ...json.refund,
        cardDetails: {
          card: {
            cardBrand: originalCardDetails.cardBrand,
            last4: originalCardDetails.last4,
            expMonth: originalCardDetails.expMonth,
            expYear: originalCardDetails.expYear
          },
          entryMethod: originalCardDetails.entryMethod,
          cvvStatus: originalCardDetails.cvvStatus,
          avsStatus: originalCardDetails.avsStatus
        }
      };
      const parseObj = parseSquarePaymentJson(JSON.stringify(mergedRefundJson), true);

      const refundRecord = {
        id: uuidv4(),
        paymentNumber: payments.reduce((m, p) => Math.max(m, p.paymentNumber || 0), 0) + 1,
        amount: -amt,
        method: "refund",
        timestamp: new Date().toISOString(),
        collectedByName: collectedByDisplayName || "",
        note: `Refund for Payment #${refundPayment.paymentNumber}`,
        squareRequest: requestStr,
        squareJson: JSON.stringify(mergedRefundJson, null, 2),
        refundForPaymentId: refundPayment.id,
        squareRefundId: mergedRefundJson.id || "",
        squareStatus: parseObj.status
      };

      onChange({
        ...data,
        payments: [...payments, refundRecord],
        autoSaveNow: true
      });
      handleCloseRefundDialog();
      showSuccessModal("Refund processed successfully!");
    } catch (err) {
      showErrorModal(`Refund request error: ${err?.message || err}`);
    }
  }
  async function getAuthHeaders() {
    if (!user?.firebaseUser) return {};
    const t = await user.firebaseUser.getIdToken(true);
    return { Authorization: `Bearer ${t}` };
  }

  // 5) Manually refresh a single payment from Square
  async function handleRefreshPayment(pmt) {
    try {
      const headers = await getAuthHeaders();
      let updated = null;
      const isRefund = pmt.method.toLowerCase() === "refund" && pmt.squareRefundId;
      if (isRefund) {
        // getRefund
        const resp = await fetch(`${apiUrl}/square/getRefund?refundId=${pmt.squareRefundId}`, {
          headers
        });
        if (!resp.ok) {
          showErrorModal(`Failed to refresh refund: ${resp.status}`);
          return;
        }
        const js = await resp.json();
        if (!js.refund) {
          showErrorModal("No refund object returned");
          return;
        }
        const origPay = payments.find((z) => z.id === pmt.refundForPaymentId);
        const originalCardDetails = getCardDetailsFromPayment(origPay?.squareJson || "");
        updated = {
          ...js.refund,
          cardDetails: {
            card: {
              cardBrand: originalCardDetails.cardBrand,
              last4: originalCardDetails.last4,
              expMonth: originalCardDetails.expMonth,
              expYear: originalCardDetails.expYear
            },
            entryMethod: originalCardDetails.entryMethod,
            cvvStatus: originalCardDetails.cvvStatus,
            avsStatus: originalCardDetails.avsStatus
          }
        };
        const parseObj = parseSquarePaymentJson(JSON.stringify(updated), true);
        pmt.squareJson = JSON.stringify(updated, null, 2);
        pmt.squareStatus = parseObj.status || "";
      } else if (pmt.squarePaymentId && pmt.method.toLowerCase() !== "refund") {
        // getPayment
        const resp = await fetch(`${apiUrl}/square/getPayment?paymentId=${pmt.squarePaymentId}`, {
          headers
        });
        if (!resp.ok) {
          showErrorModal(`Failed to refresh payment: ${resp.status}`);
          return;
        }
        const js = await resp.json();
        if (!js.payment) {
          showErrorModal("No payment object returned");
          return;
        }
        updated = js.payment;
        const parsePay = parseSquarePaymentJson(JSON.stringify(updated), false);
        pmt.squareJson = JSON.stringify(updated, null, 2);
        pmt.squareStatus = parsePay.status || "";
        pmt.squareRisk = parsePay.risk || "";
      } else {
        showErrorModal("No Square references found for this payment.");
        return;
      }

      // Merge updated pmt back
      const newPayments = payments.map((x) => (x.id === pmt.id ? { ...pmt } : x));
      onChange({ ...data, payments: newPayments, autoSaveNow: true });
      showSuccessModal("Status refreshed successfully!");
    } catch (err) {
      showErrorModal(`Refresh error: ${err?.message || err}`);
    }
  }

  // Sort payments newest first
  const sortedPayments = [...payments].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              mb: 2,
              backgroundColor: "#E3F2FD",
              borderRadius: 2
            }}
          >
            <Typography variant="h6" sx={{ textAlign: "center", mb: 2 }}>
              Payment Summary
            </Typography>
            <TextField
              label="Invoiced Amount"
              value={formatCurrency(totalInvoiced)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              inputProps={{ style: { textAlign: "center" } }}
              InputProps={{
                readOnly: true,
                style: { textAlign: "center", fontWeight: "bold" }
              }}
            />
            <TextField
              label="Total Charges"
              value={formatCurrency(totalCharges)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              inputProps={{ style: { textAlign: "center" } }}
              InputProps={{
                readOnly: true,
                style: { textAlign: "center", fontWeight: "bold" }
              }}
            />
            <TextField
              label="Total Refunds"
              value={formatCurrency(totalRefunds)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              inputProps={{ style: { textAlign: "center" } }}
              InputProps={{
                readOnly: true,
                style: { textAlign: "center", fontWeight: "bold" }
              }}
            />
            <TextField
              label="Balance Due"
              value={formatCurrency(Math.max(balance, 0))}
              fullWidth
              size="small"
              inputProps={{ style: { textAlign: "center" } }}
              InputProps={{
                readOnly: true,
                style: {
                  textAlign: "center",
                  fontWeight: "bold",
                  color: balance <= 0 ? "green" : "red",
                  backgroundColor: balance <= 0 ? "#a0f0a0" : "transparent"
                }
              }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          {isPaidInFull ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%"
              }}
            >
              <Chip
                label="Paid In Full"
                sx={{
                  fontSize: "1.4rem",
                  px: 3,
                  py: 2,
                  backgroundColor: "#e0ffe0",
                  color: "green"
                }}
              />
            </Box>
          ) : (
            <PaymentForm
              data={data}
              onChange={onChange}
              disabled={disabled}
              showErrorModal={showErrorModal}
              showSuccessModal={showSuccessModal}
              receiptNumber={receiptNumber}
              collectedByDisplayName={collectedByDisplayName}
            />
          )}
        </Grid>
      </Grid>

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
            <Grid item xs={2}>
              <Typography align="center" fontWeight="bold">
                Collected By
              </Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography align="center" fontWeight="bold">
                Square Status
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
            const methodLabel =
              pmt.method.charAt(0).toUpperCase() + pmt.method.slice(1).toLowerCase();
            const isRefund = methodLabel.toLowerCase() === "refund";
            const dt = dayjs(pmt.timestamp).format("MMM D, YYYY h:mm A");
            const displayAmount = formatCurrency(pmt.amount);
            let methodIcon = null;
            if (methodLabel.toLowerCase() === "cash") {
              methodIcon = <IconCash size={16} style={{ marginRight: 4 }} />;
            } else if (methodLabel.toLowerCase() === "credit") {
              methodIcon = <IconCreditCard size={16} style={{ marginRight: 4 }} />;
            } else if (isRefund) {
              methodIcon = <IconReceiptRefund size={16} style={{ marginRight: 4 }} />;
            }
            let recordBg = isRefund ? "rgba(255,0,0,0.1)" : "rgba(0,255,0,0.1)";
            const sq = parseSquarePaymentJson(pmt.squareJson || "", isRefund);
            const canRefundThis = !disabled && !isRefund && pmt.amount > 0;
            const canRefresh =
              !disabled &&
              ((pmt.method.toLowerCase() === "refund" && pmt.squareRefundId) ||
                (pmt.method.toLowerCase() !== "refund" && pmt.squarePaymentId));

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
                    <Typography
                      align="center"
                      sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {methodIcon}
                      {methodLabel}
                    </Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography align="center">{displayAmount}</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography align="center">{pmt.collectedByName || ""}</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography align="center">{pmt.squareStatus || "-"}</Typography>
                  </Grid>
                  <Grid item xs={1}>
                    <Box sx={{ display: "flex", justifyContent: "center", gap: 1 }}>
                      {!disabled && (
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(pmt)}
                          title="Delete Payment"
                        >
                          <IconTrash size={16} />
                        </IconButton>
                      )}
                      {canRefundThis && (
                        <IconButton
                          size="small"
                          onClick={() => handleOpenRefundDialog(pmt)}
                          title="Refund Payment"
                        >
                          <IconReceiptRefund size={16} />
                        </IconButton>
                      )}
                      {canRefresh && (
                        <IconButton
                          size="small"
                          onClick={() => handleRefreshPayment(pmt)}
                          title="Refresh Status from Square"
                        >
                          <IconRefresh size={16} />
                        </IconButton>
                      )}
                    </Box>
                  </Grid>
                </Grid>

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

                {(pmt.squarePaymentId || pmt.squareRefundId) && (
                  <Accordion disableGutters sx={{ mt: 1 }}>
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        backgroundColor: "#f5f5f5",
                        borderBottom: "1px solid #ccc",
                        textAlign: "center"
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: "bold", width: "100%", textAlign: "center" }}
                      >
                        View Details
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ backgroundColor: "#fafafa" }}>
                      <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<CodeIcon fontSize="inherit" />}
                          onClick={() => openJsonModal(pmt.squareRequest || "", pmt.squareJson || "")}
                        >
                          View Raw JSON
                        </Button>
                      </Box>

                      <Grid container spacing={2} alignItems="flex-start">
                        <Grid
                          item
                          xs={12}
                          md={6}
                          sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            flexDirection: "column",
                            minHeight: 180
                          }}
                        >
                          {sq.brand || sq.last4 ? (
                            <CreditCardBox
                              brand={sq.brand}
                              last4={sq.last4}
                              expMonth={sq.expMonth}
                              expYear={sq.expYear}
                            />
                          ) : (
                            <Typography>No card details.</Typography>
                          )}
                        </Grid>

                        <Grid
                          item
                          xs={12}
                          md={6}
                          sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            flexDirection: "column",
                            minHeight: 180
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ wordBreak: "break-word", mb: 1, textAlign: "center" }}
                          >
                            <strong>ID:</strong>{" "}
                            {isRefund ? pmt.squareRefundId : pmt.squarePaymentId}
                          </Typography>

                          {!isRefund && sq.entryMethod && (
                            <Typography variant="body2" sx={{ mb: 1, textAlign: "center" }}>
                              <strong>Entry:</strong> {sq.entryMethod}
                            </Typography>
                          )}
                          {!isRefund && sq.cvvStatus && sq.cvvStatus !== "NOT_CHECKED" && (
                            <Typography variant="body2" sx={{ mb: 1, textAlign: "center" }}>
                              <strong>CVV:</strong> {sq.cvvStatus}
                            </Typography>
                          )}
                          {!isRefund && sq.avsStatus && sq.avsStatus !== "NOT_CHECKED" && (
                            <Typography variant="body2" sx={{ mb: 1, textAlign: "center" }}>
                              <strong>AVS:</strong> {sq.avsStatus}
                            </Typography>
                          )}
                          {!isRefund && sq.risk && (
                            <Typography variant="body2" sx={{ mb: 1, textAlign: "center" }}>
                              <strong>Risk:</strong> {sq.risk}
                            </Typography>
                          )}
                          {!isRefund && sq.receiptNumber && sq.receiptUrl && (
                            <Typography
                              variant="body2"
                              sx={{
                                mb: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                              }}
                            >
                              <strong style={{ marginRight: 4 }}>Receipt #:</strong>
                              {sq.receiptNumber}
                              <IconButton
                                component="a"
                                href={sq.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="small"
                                sx={{ ml: 1 }}
                              >
                                <IconReceipt size={16} />
                              </IconButton>
                            </Typography>
                          )}
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
          <Typography variant="body2">
            Are you sure you want to remove this payment from the record?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeletePayment}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onClose={handleCloseRefundDialog}>
        <DialogTitle>Refund Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Enter the refund amount. Pending or completed refunds reduce the balance due.
            (Rejected or failed refunds do not.)
          </Typography>
          <TextField
            label="Refund Amount"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            inputProps={{ style: { textAlign: "center" } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRefundDialog}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleConfirmRefund}>
            Confirm Refund
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
        <DialogTitle>Success</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{successModalMsg}</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={closeSuccessModal}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Raw JSON => Tabs for Response vs. Request */}
      <Dialog open={jsonModalOpen} onClose={closeJsonModal} maxWidth="md" fullWidth>
        <DialogTitle>Raw JSON</DialogTitle>
        <Tabs value={jsonTab} onChange={handleJsonTabChange} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tab label="Response" />
          <Tab label="Request" />
        </Tabs>
        <DialogContent dividers>
          {jsonTab === 0 && (
            <Typography
              variant="body2"
              sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}
            >
              {responseJson || "No response JSON recorded"}
            </Typography>
          )}
          {jsonTab === 1 && (
            <Typography
              variant="body2"
              sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}
            >
              {requestJson || "No request JSON recorded"}
            </Typography>
          )}
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
    </Box>
  );
}
