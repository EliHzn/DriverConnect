// C:\Users\eliha\firebase\webapp\src\views\pages\towManager\TowManager.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  getDoc,
  runTransaction,
  collection,
  serverTimestamp,
  setDoc,
  getDocs
} from 'firebase/firestore';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Autocomplete,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  InputAdornment,
  Container,
  useMediaQuery,
  LinearProgress,
  Menu,
  Paper
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import MainCard from 'ui-component/cards/MainCard';
import axios from 'axios';
import dayjs from 'dayjs';

import { db } from 'firebase.js'; // ensures no onSnapshot is used
import useAuth from 'hooks/useAuth';

// Child components
import TowVehicleInfo from './TowVehicleInfo';
import TowBilling from './TowBilling';
import TowPayments from './TowPayments';
import TowDocuments from './TowDocuments';

// Mapbox
import 'mapbox-gl/dist/mapbox-gl.css';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import { WebMercatorViewport } from '@math.gl/web-mercator';
import pickupIcon from '../../../assets/images/startmarker.png';
import dropoffIcon from '../../../assets/images/endmarker.png';

// Tabler icons
import {
  IconMap2,
  IconCar,
  IconFileDollar,
  IconCashRegister,
  IconFileText
} from '@tabler/icons-react';

const MAPBOX_TOKEN = import.meta.env.VITE_APP_MAPBOX_ACCESS_TOKEN || '';
const apiUrl = import.meta.env.VITE_APP_API_URL || '';

import { useGetMenuMaster } from 'api/menu';
const drawerWidthExpanded = 240;
const drawerWidthCollapsed = 72;

/* --------------------------------------------------------------------------
   1) Helpers & Utils
-------------------------------------------------------------------------- */

/** Remove createdAt, updatedAt for clean comparison */
function shallowCloneWithoutTimestamps(obj) {
  if (!obj) return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  delete clone.createdAt;
  delete clone.updatedAt;
  return clone;
}

/** Basic deep equality by JSON string compare */
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Quick lat,lng pattern check */
function isLatLng(str) {
  return /^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(str);
}

/** US phone formatting */
function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Safely get nested property, e.g. getIn(obj, 'foo.bar') */
function getIn(obj, path) {
  if (!obj) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Round coords to avoid micro-floating */
function roundCoord([lng, lat], decimals = 5) {
  const rLng = parseFloat(lng.toFixed(decimals));
  const rLat = parseFloat(lat.toFixed(decimals));
  return [rLng, rLat];
}

/**
 * AddressAutocomplete => only a freeSolo + mapbox search, no real-time subscriptions.
 */
function AddressAutocomplete({
  label,
  value = '',
  onValueChange,
  onSelectCoord,
  options = [],
  loading = false,
  disabled = false,
  iconSrc,
  centerText,
  sxWrapper
}) {
  return (
    <Box sx={{ width: '100%', ...sxWrapper }}>
      <Autocomplete
        size="small"
        freeSolo
        fullWidth
        value={value ? { label: value } : null}
        options={options}
        loading={loading}
        getOptionLabel={(opt) => opt.label || ''}
        filterOptions={(x) => x}
        isOptionEqualToValue={(option, val) => option.label === val.label}
        onInputChange={(evt, newVal) => {
          onValueChange(newVal);
        }}
        onChange={(evt, sel) => {
          if (!sel || !sel.label) {
            onValueChange('');
            return;
          }
          if (sel.isCommon) {
            onValueChange(sel.label);
            if (onSelectCoord && sel.lng !== undefined && sel.lat !== undefined) {
              onSelectCoord([sel.lng, sel.lat], sel.label);
            }
          } else if (sel.feature) {
            const addr = sel.feature.place_name || sel.label;
            onValueChange(addr);
            const coords = sel.feature.geometry?.coordinates;
            if (coords && onSelectCoord) {
              onSelectCoord(coords, addr);
            }
          } else {
            onValueChange(sel.label);
          }
        }}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            autoComplete="off"
            inputProps={{
              ...params.inputProps,
              style: centerText
                ? { textAlign: 'center', ...params.inputProps.style }
                : { ...params.inputProps.style }
            }}
            InputProps={{
              ...params.InputProps,
              startAdornment: iconSrc ? (
                <>
                  <InputAdornment position="start">
                    <Box
                      component="img"
                      src={iconSrc}
                      alt="icon"
                      sx={{ width: 20, height: 20 }}
                    />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ) : (
                params.InputProps.startAdornment
              ),
              endAdornment: (
                <>
                  {loading && <CircularProgress size={20} />}
                  {params.InputProps.endAdornment}
                </>
              )
            }}
          />
        )}
      />
    </Box>
  );
}

/* --------------------------------------------------------------------------
   2) Main TowManager Component
-------------------------------------------------------------------------- */
export default function TowManager() {
  // A) Basic Setup & Permissions
  const paramDocId = useParams().docId;
  const [docId, setDocId] = useState(paramDocId || 'new');
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const canCreate = user?.tables?.tows?.includes('Create');
  const canRead = user?.tables?.tows?.includes('Read');
  const canUpdate = user?.tables?.tows?.includes('Update');

  // Guard for permissions
  if (docId === 'new' && !canCreate) {
    return (
      <MainCard>
        <Box sx={{ m: 2 }}>
          <Typography variant="h4">No Permission</Typography>
          <Typography>You do not have permission to create a tow job.</Typography>
        </Box>
      </MainCard>
    );
  }
  if (docId !== 'new' && !canRead) {
    return (
      <MainCard>
        <Box sx={{ m: 2 }}>
          <Typography variant="h4">No Permission</Typography>
          <Typography>You do not have permission to read this tow job.</Typography>
        </Box>
      </MainCard>
    );
  }

  let isViewOnly = new URLSearchParams(location.search).get('view') === '1';
  if (!canUpdate && docId !== 'new') {
    isViewOnly = true;
  }

  // B) State
  const defaultCharges = {
    grandTotal: 0,
    items: docId === 'new'
      ? [{ description: 'Base Towing Fee', quantity: 1, rate: 125 }]
      : [],
    taxRate: 8.875,
    taxExempt: false
  };

  const [towData, setTowData] = useState({
    receiptNumber: '',
    dateTime: new Date().toISOString(),
    status: 'New',
    companyId: '',
    jobType: '',
    reason: '',
    accountId: '',
    createdByName: '',
    createdByUid: '',

    vehicleInfo: {
      vin: '',
      year: '',
      make: '',
      model: '',
      color: '',
      plateNumber: '',
      plateState: '',
      mileage: '',
      decoded: false,
      damagePoints: []
    },

    customerInformation: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      address: ''
    },

    pickupLocation: { address: '', coordinates: null },
    dropoffLocation: { address: '', coordinates: null },
    estimatedDistanceMiles: 0,

    squareCustomerId: '',
    payments: [],
    charges: defaultCharges,
    documents: []
  });

  const [originalData, setOriginalData] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  const [createdAtDate, setCreatedAtDate] = useState(null);
  const [updatedAtDate, setUpdatedAtDate] = useState(null);

  // combos
  const [companies, setCompanies] = useState([]);
  const [jobTypes, setJobTypes] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [combosLoaded, setCombosLoaded] = useState(false);

  // addresses
  const [commonAddrs, setCommonAddrs] = useState([]);
  const [mainAddrLoading, setMainAddrLoading] = useState(false);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [dropoffLoading, setDropoffLoading] = useState(false);
  const [mainAddrOptions, setMainAddrOptions] = useState([]);
  const [pickupOptions, setPickupOptions] = useState([]);
  const [dropoffOptions, setDropoffOptions] = useState([]);
  const [prevMainAddr, setPrevMainAddr] = useState('');
  const [prevPickupAddr, setPrevPickupAddr] = useState('');
  const [prevDropoffAddr, setPrevDropoffAddr] = useState('');

  // coords
  const [pickupCoord, setPickupCoord] = useState(null);
  const [dropoffCoord, setDropoffCoord] = useState(null);
  const [routeGeoJSON, setRouteGeoJSON] = useState(null);

  // statuses
  const [statusDocs, setStatusDocs] = useState([]);

  // modals
  const [modalMessage, setModalMessage] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [navigateDestination, setNavigateDestination] = useState('');

  // Map
  const [mapRef, setMapRef] = useState(null);

  // We'll define the sections to track "Previous" / "Next":
  const sections = ['map', 'vehicle', 'charges', 'payments', 'documents'];
  const [expandedAccordion, setExpandedAccordion] = useState(null);

  const docLoadedRef = useRef(false);
  const userHasInteracted = useRef(false);

  // theme / layout
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster?.isDashboardDrawerOpened ?? false;
  const sideWidth = isSmallScreen ? 0 : drawerOpen ? drawerWidthExpanded : drawerWidthCollapsed;
  const computedLeft = `${sideWidth}px`;
  const computedWidth = `calc(100% - ${sideWidth}px)`;

  // approximate user location
  const userLng = -73.935242;
  const userLat = 40.73061;

  // 1) Load combos => one-time
  useEffect(() => {
    (async () => {
      try {
        setCombosLoaded(false);
        const snapCompanies = await getDocs(collection(db, 'companies'));
        const arrComp = snapCompanies.docs.map((dc) => ({ id: dc.id, ...dc.data() }));

        const snapJobs = await getDocs(collection(db, 'jobCategories'));
        const arrJobs = snapJobs.docs.map((dc) => ({ id: dc.id, ...dc.data() }));

        const snapReasons = await getDocs(collection(db, 'towReasons'));
        const arrReasons = snapReasons.docs.map((dc) => {
          const data = dc.data() || {};
          return { id: dc.id, name: data.name || dc.id };
        });

        const snapAccounts = await getDocs(collection(db, 'accounts'));
        const arrAccounts = snapAccounts.docs.map((dc) => ({ id: dc.id, ...dc.data() }));

        setCompanies(arrComp);
        setJobTypes(arrJobs);
        setReasons(arrReasons);
        setAccounts(arrAccounts);
        setCombosLoaded(true);
      } catch (err) {
        console.error('Error loading combos:', err);
        setCombosLoaded(true);
      }
    })();
  }, []);

  // 2) statuses => also one-time
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'towstatus'));
        const arr = snap.docs.map((dc) => ({
          id: dc.id,
          ...dc.data(),
          order: Number(dc.data().order || 999)
        }));
        arr.sort((a, b) => a.order - b.order);
        setStatusDocs(arr);
      } catch (err) {
        console.error('Error loading towstatus:', err);
      }
    })();
  }, []);

  // 3) commonAddresses => one-time
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'commonAddresses'));
        const arr = snap.docs.map((dc) => {
          const data = dc.data() || {};
          return {
            id: dc.id,
            label: data.label || dc.id,
            lat: data.lat || 0,
            lng: data.lng || 0,
            isCommon: true
          };
        });
        setCommonAddrs(arr);
      } catch (err) {
        console.error('Error loading commonAddresses:', err);
      }
    })();
  }, []);

  // 4) doMapboxSearch => used in watchers
  const doMapboxSearch = useCallback(
    async (query, setLoadingFn, setOptsFn) => {
      let final = [...commonAddrs];
      if (!isLatLng(query) && query.length < 3) {
        setOptsFn(final);
        return;
      }
      try {
        setLoadingFn(true);
        const proximityParam = `&proximity=${userLng},${userLat}`;
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&country=us&limit=5${proximityParam}`;
        const resp = await axios.get(url);
        const feats = resp.data.features || [];
        const mapboxArr = feats.map((f) => ({
          label: f.place_name,
          feature: f
        }));
        final = [...final, ...mapboxArr];
      } catch (err) {
        console.error('Mapbox search error:', err);
      } finally {
        setLoadingFn(false);
        setOptsFn(final);
      }
    },
    [commonAddrs, userLng, userLat]
  );

  // watchers => only if doc loaded
  useEffect(() => {
    if (!docLoadedRef.current) return;
    const val = towData.customerInformation.address || '';
    if (val === prevMainAddr) return;
    setPrevMainAddr(val);
    doMapboxSearch(val, setMainAddrLoading, setMainAddrOptions);
  }, [towData.customerInformation.address, prevMainAddr, doMapboxSearch]);

  useEffect(() => {
    if (!docLoadedRef.current) return;
    const val = towData.pickupLocation.address || '';
    if (val === prevPickupAddr) return;
    setPrevPickupAddr(val);
    doMapboxSearch(val, setPickupLoading, setPickupOptions);
  }, [towData.pickupLocation.address, prevPickupAddr, doMapboxSearch]);

  useEffect(() => {
    if (!docLoadedRef.current) return;
    const val = towData.dropoffLocation.address || '';
    if (val === prevDropoffAddr) return;
    setPrevDropoffAddr(val);
    doMapboxSearch(val, setDropoffLoading, setDropoffOptions);
  }, [towData.dropoffLocation.address, prevDropoffAddr, doMapboxSearch]);

  // 5) Load doc => single getDoc
  const loadDoc = useCallback(async () => {
    if (!docId || docId === 'new') {
      setOriginalData(shallowCloneWithoutTimestamps(towData));
      setDirty(false);
      docLoadedRef.current = true;
      return;
    }
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'tows', docId));
      if (!snap.exists()) {
        console.warn('No doc found for tow:', docId);
        setOriginalData(shallowCloneWithoutTimestamps(towData));
        setDirty(false);
        setLoading(false);
        docLoadedRef.current = true;
        return;
      }
      const d = snap.data() || {};
      let dateStr = new Date().toISOString();
      if (d.dateTime?.toDate) dateStr = d.dateTime.toDate().toISOString();
      else if (typeof d.dateTime === 'string') dateStr = d.dateTime;

      let pCoord = null;
      if (d.pickupLocation?.coordinates) {
        pCoord = [d.pickupLocation.coordinates[0], d.pickupLocation.coordinates[1]];
      }
      let dCoord = null;
      if (d.dropoffLocation?.coordinates) {
        dCoord = [d.dropoffLocation.coordinates[0], d.dropoffLocation.coordinates[1]];
      }

      const loaded = {
        ...d,
        dateTime: dateStr,
        vehicleInfo: {
          vin: d.vehicleInfo?.vin || '',
          year: d.vehicleInfo?.year || '',
          make: d.vehicleInfo?.make || '',
          model: d.vehicleInfo?.model || '',
          color: d.vehicleInfo?.color || '',
          plateNumber: d.vehicleInfo?.plateNumber || '',
          plateState: d.vehicleInfo?.plateState || '',
          mileage: d.vehicleInfo?.mileage || '',
          decoded: d.vehicleInfo?.decoded || false,
          damagePoints: d.vehicleInfo?.damagePoints || []
        },
        customerInformation: {
          firstName: d.customerInformation?.firstName || '',
          lastName: d.customerInformation?.lastName || '',
          phone: d.customerInformation?.phone || '',
          email: d.customerInformation?.email || '',
          address: d.customerInformation?.address || ''
        },
        pickupLocation: {
          address: d.pickupLocation?.address || '',
          coordinates: pCoord
        },
        dropoffLocation: {
          address: d.dropoffLocation?.address || '',
          coordinates: dCoord
        },
        squareCustomerId: d.squareCustomerId || '',
        payments: d.payments || [],
        charges: {
          grandTotal: d.charges?.grandTotal || 0,
          items: Array.isArray(d.charges?.items) ? d.charges.items : [],
          taxRate: d.charges?.taxRate ?? 8.875,
          taxExempt: !!d.charges?.taxExempt
        }
      };

      const newDataNoTimestamps = shallowCloneWithoutTimestamps(loaded);
      setTowData(loaded);
      setOriginalData(newDataNoTimestamps);
      setDirty(false);

      if (d.createdAt?.toDate) setCreatedAtDate(d.createdAt.toDate());
      if (d.updatedAt?.toDate) setUpdatedAtDate(d.updatedAt.toDate());

      if (pCoord) setPickupCoord(pCoord);
      if (dCoord) setDropoffCoord(dCoord);
    } catch (err) {
      console.error('Error loading doc:', err);
    } finally {
      setLoading(false);
      docLoadedRef.current = true;
    }
  }, [docId]);

  useEffect(() => {
    if (combosLoaded) {
      loadDoc();
    }
  }, [docId, combosLoaded, loadDoc]);

  // 6) Route => only if map open & coords set
  useEffect(() => {
    if (expandedAccordion !== 'map') return;
    if (!docLoadedRef.current) return;

    if (!pickupCoord || !dropoffCoord) {
      if (routeGeoJSON) {
        setRouteGeoJSON(null);
      }
      if (towData.estimatedDistanceMiles !== 0) {
        setTowData((p) => ({ ...p, estimatedDistanceMiles: 0 }));
      }
      return;
    }

    (async () => {
      try {
        const coordsStr = `${pickupCoord[0]},${pickupCoord[1]};${dropoffCoord[0]},${dropoffCoord[1]}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?access_token=${MAPBOX_TOKEN}&overview=full&geometries=geojson`;
        const resp = await axios.get(url);
        const routes = resp.data.routes || [];
        if (!routes.length) {
          if (routeGeoJSON) setRouteGeoJSON(null);
          if (towData.estimatedDistanceMiles !== 0) {
            setTowData((p) => ({ ...p, estimatedDistanceMiles: 0 }));
          }
          return;
        }
        const geometry = routes[0].geometry;
        const distMeters = routes[0].distance || 0;
        const distMiles = distMeters / 1609.34;
        const newDist = parseFloat(distMiles.toFixed(2));

        const newGeo = { type: 'Feature', geometry, properties: {} };
        if (JSON.stringify(routeGeoJSON || {}) !== JSON.stringify(newGeo)) {
          setRouteGeoJSON(newGeo);
        }
        if (towData.estimatedDistanceMiles !== newDist) {
          setTowData((p) => ({ ...p, estimatedDistanceMiles: newDist }));
        }
      } catch (err) {
        console.error('Error fetching route:', err);
      }
    })();
  }, [expandedAccordion, pickupCoord, dropoffCoord, routeGeoJSON, towData.estimatedDistanceMiles]);

  // 7) Dirty Checking
  useEffect(() => {
    if (!originalData) return;
    const current = shallowCloneWithoutTimestamps(towData);
    setDirty(!deepEqual(current, originalData));
  }, [towData, originalData]);

  function onUserEdit(callback) {
    userHasInteracted.current = true;
    callback();
  }
  function isFieldDirty(path) {
    if (!originalData) return false;
    const origVal = getIn(originalData, path);
    const currVal = getIn(towData, path);
    return JSON.stringify(origVal) !== JSON.stringify(currVal);
  }
  function getDirtySx(path) {
    const d = isFieldDirty(path);
    return {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: d ? 'orange !important' : undefined,
        borderWidth: d ? '2px' : undefined
      },
      '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: d ? 'orange !important' : undefined
      }
    };
  }

  // 8) Save / Auto-Save => only if dirty
  const openModal = (msg) => {
    setModalMessage(msg);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!dirty) return;
    setLoading(true);
    try {
      if (!towData.companyId) {
        setLoading(false);
        return openModal('Company is required.');
      }
      if (!towData.jobType) {
        setLoading(false);
        return openModal('Job Type is required.');
      }
      if (!towData.reason) {
        setLoading(false);
        return openModal('Reason is required.');
      }
      if (
        towData.jobType === 'Contract Account' &&
        !towData.accountId
      ) {
        setLoading(false);
        return openModal('Account is required for contract jobs.');
      }
      if (
        towData.customerInformation.email &&
        !emailRegex.test(towData.customerInformation.email)
      ) {
        setLoading(false);
        return openModal('Please fix the email field.');
      }

      let finalId = docId;
      setExpandedAccordion(null);

      if (docId === 'new') {
        await runTransaction(db, async (transaction) => {
          const countersRef = doc(db, 'appCounters', 'tows');
          const countersSnap = await transaction.get(countersRef);
          let countersData = countersSnap.data();
          if (!countersData) {
            countersData = { nextNumber: 10001 };
            transaction.set(countersRef, countersData);
          }
          const useNumber = parseInt(countersData.nextNumber, 10) || 10001;
          transaction.update(countersRef, { nextNumber: useNumber + 1 });

          const displayName =
            user?.firebaseUser?.displayName || user?.firebaseUser?.email || 'Unknown';
          const assignedReceipt = String(useNumber);

          const newRef = doc(collection(db, 'tows'));
          finalId = newRef.id;

          let pCoord = pickupCoord ? roundCoord(pickupCoord, 5) : null;
          let dCoord = dropoffCoord ? roundCoord(dropoffCoord, 5) : null;

          transaction.set(newRef, {
            ...towData,
            receiptNumber: assignedReceipt,
            createdByName: displayName,
            createdByUid: user?.firebaseUser?.uid || '',
            pickupLocation: {
              ...towData.pickupLocation,
              coordinates: pCoord
            },
            dropoffLocation: {
              ...towData.dropoffLocation,
              coordinates: dCoord
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });
        setDocId(finalId);
      } else {
        let pCoord = pickupCoord ? roundCoord(pickupCoord, 5) : null;
        let dCoord = dropoffCoord ? roundCoord(dropoffCoord, 5) : null;

        const payload = {
          ...towData,
          pickupLocation: {
            ...towData.pickupLocation,
            coordinates: pCoord
          },
          dropoffLocation: {
            ...towData.dropoffLocation,
            coordinates: dCoord
          },
          updatedAt: serverTimestamp()
        };
        await setDoc(doc(db, 'tows', finalId), payload, { merge: true });
      }

      setOriginalData(shallowCloneWithoutTimestamps(towData));
      setDirty(false);
      userHasInteracted.current = false;
    } catch (err) {
      console.error('Error saving doc:', err);
      openModal(`Error saving: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const autoSaveIfDirty = useCallback(async () => {
    if (!docLoadedRef.current) return;
    if (!userHasInteracted.current) return;
    if (!dirty) return;

    setLoading(true);
    try {
      let finalId = docId;
      if (docId === 'new') {
        await runTransaction(db, async (transaction) => {
          const countersRef = doc(db, 'appCounters', 'tows');
          const countersSnap = await transaction.get(countersRef);
          let countersData = countersSnap.data();
          if (!countersData) {
            countersData = { nextNumber: 10001 };
            transaction.set(countersRef, countersData);
          }
          const useNumber = parseInt(countersData.nextNumber, 10) || 10001;
          transaction.update(countersRef, { nextNumber: useNumber + 1 });

          const displayName =
            user?.firebaseUser?.displayName || user?.firebaseUser?.email || 'Unknown';
          const assignedReceipt = String(useNumber);

          const newRef = doc(collection(db, 'tows'));
          finalId = newRef.id;

          let pCoord = pickupCoord ? roundCoord(pickupCoord, 5) : null;
          let dCoord = dropoffCoord ? roundCoord(dropoffCoord, 5) : null;

          transaction.set(newRef, {
            ...towData,
            receiptNumber: assignedReceipt,
            createdByName: displayName,
            createdByUid: user?.firebaseUser?.uid || '',
            pickupLocation: {
              ...towData.pickupLocation,
              coordinates: pCoord
            },
            dropoffLocation: {
              ...towData.dropoffLocation,
              coordinates: dCoord
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });
        setDocId(finalId);
      } else {
        let pCoord = pickupCoord ? roundCoord(pickupCoord, 5) : null;
        let dCoord = dropoffCoord ? roundCoord(dropoffCoord, 5) : null;

        const payload = {
          ...towData,
          pickupLocation: {
            ...towData.pickupLocation,
            coordinates: pCoord
          },
          dropoffLocation: {
            ...towData.dropoffLocation,
            coordinates: dCoord
          },
          updatedAt: serverTimestamp()
        };
        await setDoc(doc(db, 'tows', finalId), payload, { merge: true });
      }

      setOriginalData(shallowCloneWithoutTimestamps(towData));
      setDirty(false);
      userHasInteracted.current = false;
    } catch (err) {
      console.error('Auto-save error:', err);
    } finally {
      setLoading(false);
    }
  }, [docId, pickupCoord, dropoffCoord, towData, user, dirty]);

  // 9) The missing function: handleAccordionChange
  const handleAccordionChange = async (panel) => {
    if (panel === expandedAccordion) {
      // close
      setExpandedAccordion(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // open new
    if (dirty) {
      await autoSaveIfDirty();
    }
    setExpandedAccordion(panel);
    // Scroll the accordion’s header into view
    setTimeout(() => {
      const el = document.getElementById(`accordion-header-${panel}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // For Next/Previous
  function getCurrentIndex() {
    return sections.indexOf(expandedAccordion);
  }
  function handlePrevious() {
    const i = getCurrentIndex();
    if (i <= 0) return;
    handleAccordionChange(sections[i - 1]);
  }
  function handleNext() {
    const i = getCurrentIndex();
    if (i < 0) {
      handleAccordionChange(sections[0]);
      return;
    }
    if (i >= sections.length - 1) return;
    handleAccordionChange(sections[i + 1]);
  }
  function handleComplete() {
    if (dirty) {
      autoSaveIfDirty().then(() => {
        setExpandedAccordion(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else {
      setExpandedAccordion(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // 10) Navigation
  const handleBack = () => {
    if (dirty) {
      setNavigateDestination('/tow-jobs');
      setShowUnsavedDialog(true);
    } else {
      navigate('/tow-jobs');
    }
  };
  const handleConfirmDiscard = () => {
    setShowUnsavedDialog(false);
    navigate(navigateDestination);
  };
  const handleCancelDiscard = () => {
    setShowUnsavedDialog(false);
    setNavigateDestination('');
  };

  // Status menu
  const [anchorStatus, setAnchorStatus] = useState(null);
  const openStatusMenu = Boolean(anchorStatus);
  const handleOpenStatusMenu = (event) => {
    if (isViewOnly) return;
    setAnchorStatus(event.currentTarget);
  };
  const handleCloseStatusMenu = () => setAnchorStatus(null);

  const handleStatusChange = (newStatus) => {
    onUserEdit(() => {
      setTowData((p) => ({ ...p, status: newStatus }));
      setAnchorStatus(null);
    });
  };

  // MAP - reset
  const handleZoomIn = () => {
    if (!mapRef) return;
    mapRef.easeTo({ zoom: mapRef.getZoom() + 1 });
  };
  const handleZoomOut = () => {
    if (!mapRef) return;
    mapRef.easeTo({ zoom: mapRef.getZoom() - 1 });
  };
  const handleMapReset = () => {
    if (!mapRef) return;
    if (routeGeoJSON && pickupCoord && dropoffCoord) {
      try {
        const lineCoords = routeGeoJSON.geometry?.coordinates || [];
        const points = [...lineCoords, pickupCoord, dropoffCoord];
        let minLng = Infinity,
          maxLng = -Infinity,
          minLat = Infinity,
          maxLat = -Infinity;
        points.forEach(([lng, lat]) => {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
        if (minLng === Infinity) return;
        const bounds = [
          [minLng, minLat],
          [maxLng, maxLat]
        ];
        const mapSize = mapRef.getContainer()?.getBoundingClientRect() || {
          width: 800,
          height: 600
        };
        const viewport = new WebMercatorViewport({
          width: mapSize.width,
          height: mapSize.height
        });
        const { longitude, latitude, zoom } = viewport.fitBounds(bounds, { padding: 40 });
        mapRef.easeTo({ center: [longitude, latitude], zoom, duration: 800 });
      } catch (err) {
        console.error('Error refitting route:', err);
      }
    } else {
      mapRef.easeTo({
        center: [userLng, userLat],
        zoom: 10,
        duration: 800
      });
    }
  };

  // If the route changes & map is open, auto-fit
  useEffect(() => {
    if (
      expandedAccordion === 'map' &&
      routeGeoJSON &&
      pickupCoord &&
      dropoffCoord &&
      mapRef
    ) {
      handleMapReset();
    }
  }, [expandedAccordion, routeGeoJSON, pickupCoord, dropoffCoord, mapRef]);

  // Rendering
  if (!combosLoaded) {
    return (
      <MainCard>
        <Box sx={{ p: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <CircularProgress />
          <Typography variant="h6">Loading data...</Typography>
        </Box>
      </MainCard>
    );
  }
  if (docId !== 'new' && loading && !originalData) {
    return (
      <MainCard>
        <Box sx={{ p: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <CircularProgress />
          <Typography variant="h6">Loading tow job...</Typography>
        </Box>
      </MainCard>
    );
  }

  const createdText = createdAtDate ? dayjs(createdAtDate).format('MMMM D, YYYY h:mm A') : '';
  const updatedText = updatedAtDate ? dayjs(updatedAtDate).format('MMMM D, YYYY h:mm A') : '';
  const creatorText = towData.createdByName || '';
  const headingVariant = isSmallScreen ? 'h5' : 'h3';
  const thisStatusDoc =
    statusDocs.find((sd) => (sd.id || '').toLowerCase() === (towData.status || '').toLowerCase()) ||
    {};
  const statusColor = thisStatusDoc.color || '#616161';

  const statusContainerSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: isSmallScreen ? 'center' : 'flex-end',
    gap: 1
  };

  const currentIndex = sections.indexOf(expandedAccordion);
  const isFirstAccordion = currentIndex === 0;
  const isLastAccordion = currentIndex === sections.length - 1;

  return (
    <MainCard content={false} sx={{ textAlign: 'center', position: 'relative', pb: 10 }}>
      {loading && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%' }}>
          <LinearProgress />
        </Box>
      )}

      <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 }, pt: 2 }}>
        {/* Header Info */}
        <Box
          sx={{
            pb: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1
          }}
        >
          <Box sx={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {updatedText && (
              <Typography variant="caption" sx={{ fontSize: '10pt' }}>
                <strong>Last Updated:</strong> {updatedText}
              </Typography>
            )}
            {createdText && (
              <Typography variant="caption" sx={{ fontSize: '10pt' }}>
                <strong>Created:</strong> {createdText}
              </Typography>
            )}
            {creatorText && (
              <Typography variant="caption" sx={{ fontSize: '10pt' }}>
                <strong>Creator:</strong> {creatorText}
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0
            }}
          >
            <Typography variant={headingVariant} sx={{ textAlign: 'center', mb: 1 }}>
              Tow Job #{towData.receiptNumber || '(Pending)'}
            </Typography>
          </Box>

          <Box sx={statusContainerSx}>
            <Chip
              label={towData.status || 'Unknown'}
              sx={{
                backgroundColor: statusColor,
                color: '#fff',
                fontWeight: 'bold',
                minWidth: '25ch',
                cursor: isViewOnly ? 'default' : 'pointer'
              }}
              onClick={handleOpenStatusMenu}
            />
          </Box>
        </Box>
      </Container>

      {/* Status Menu */}
      <Menu
        anchorEl={anchorStatus}
        open={openStatusMenu}
        onClose={handleCloseStatusMenu}
        PaperProps={{ sx: { minWidth: 150 } }}
      >
        {statusDocs.map((sd) => (
          <MenuItem key={sd.id} onClick={() => handleStatusChange(sd.id)}>
            {sd.id}
          </MenuItem>
        ))}
      </Menu>

      {/* Tow Details (not an accordion) */}
      <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 } }}>
        {/* TOW DETAILS */}
        <Box sx={{ mb: 2, mt: 1, p: 1, borderRadius: 2, backgroundColor: '#E3F2FD' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            Tow Details
          </Typography>
          <Grid container spacing={2} sx={{ mb: 1 }}>
            <Grid item xs={12} sm={4}>
              <FormControl size="small" fullWidth required sx={getDirtySx('companyId')}>
                <InputLabel>Company</InputLabel>
                <Select
                  label="Company"
                  value={companies.some((c) => c.id === towData.companyId)
                    ? towData.companyId
                    : ''
                  }
                  onChange={(e) =>
                    onUserEdit(() => {
                      setTowData((prev) => ({ ...prev, companyId: e.target.value }));
                    })
                  }
                  disabled={isViewOnly || loading}
                >
                  <MenuItem value="">(Select Company)</MenuItem>
                  {companies.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name || c.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl size="small" fullWidth required sx={getDirtySx('jobType')}>
                <InputLabel>Job Type</InputLabel>
                <Select
                  label="Job Type"
                  value={towData.jobType}
                  onChange={(e) =>
                    onUserEdit(() => {
                      setTowData((prev) => ({ ...prev, jobType: e.target.value }));
                    })
                  }
                  disabled={isViewOnly || loading}
                >
                  <MenuItem value="">(Select Job Type)</MenuItem>
                  {jobTypes.map((jt) => (
                    <MenuItem key={jt.id} value={jt.name}>
                      {jt.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl size="small" fullWidth required sx={getDirtySx('reason')}>
                <InputLabel>Reason</InputLabel>
                <Select
                  label="Reason"
                  value={towData.reason}
                  onChange={(e) =>
                    onUserEdit(() => {
                      setTowData((prev) => ({ ...prev, reason: e.target.value }));
                    })
                  }
                  disabled={isViewOnly || loading}
                >
                  <MenuItem value="">(Select Reason)</MenuItem>
                  {reasons.map((r) => (
                    <MenuItem key={r.id} value={r.name}>
                      {r.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        {/* If Contract Account */}
        {towData.jobType === 'Contract Account' && (
          <Box sx={{ mb: 2, p: 1, borderRadius: 2, backgroundColor: '#E3F2FD' }}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 'bold', mb: 1, textAlign: 'center' }}
            >
              Contract Account Details
            </Typography>
            <Grid container spacing={2} justifyContent="center">
              <Grid item xs={12} md={6}>
                <FormControl size="small" fullWidth required sx={getDirtySx('accountId')}>
                  <InputLabel>Account</InputLabel>
                  <Select
                    label="Account"
                    value={
                      towData.accountId &&
                      accounts.some((a) => a.id === towData.accountId)
                        ? towData.accountId
                        : ''
                    }
                    onChange={(e) =>
                      onUserEdit(() => {
                        setTowData((prev) => ({ ...prev, accountId: e.target.value }));
                      })
                    }
                    disabled={isViewOnly || loading}
                  >
                    <MenuItem value="">(Select Account)</MenuItem>
                    {accounts.map((acc) => (
                      <MenuItem key={acc.id} value={acc.id}>
                        {acc.name || acc.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Vehicle Owner Info */}
        <Box sx={{ mb: 2, p: 1, borderRadius: 2, backgroundColor: '#E3F2FD' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            Vehicle Owner Information
          </Typography>
          <Grid container spacing={2} sx={{ mb: 1 }}>
            <Grid item xs={12} md={3}>
              <TextField
                size="small"
                fullWidth
                label="First Name"
                value={towData.customerInformation.firstName}
                onChange={(e) =>
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      customerInformation: {
                        ...prev.customerInformation,
                        firstName: e.target.value
                      }
                    }));
                  })
                }
                disabled={isViewOnly || loading}
                sx={getDirtySx('customerInformation.firstName')}
                inputProps={{ style: { textAlign: 'center' }, autoComplete: 'off' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                size="small"
                fullWidth
                label="Last Name"
                value={towData.customerInformation.lastName}
                onChange={(e) =>
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      customerInformation: {
                        ...prev.customerInformation,
                        lastName: e.target.value
                      }
                    }));
                  })
                }
                disabled={isViewOnly || loading}
                sx={getDirtySx('customerInformation.lastName')}
                inputProps={{ style: { textAlign: 'center' }, autoComplete: 'off' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                size="small"
                fullWidth
                label="Phone"
                value={towData.customerInformation.phone}
                onChange={(e) =>
                  onUserEdit(() => {
                    const formatted = formatPhone(e.target.value);
                    setTowData((prev) => ({
                      ...prev,
                      customerInformation: {
                        ...prev.customerInformation,
                        phone: formatted
                      }
                    }));
                  })
                }
                disabled={isViewOnly || loading}
                sx={getDirtySx('customerInformation.phone')}
                inputProps={{ style: { textAlign: 'center' }, autoComplete: 'off' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                size="small"
                fullWidth
                label="Email"
                value={towData.customerInformation.email}
                onChange={(e) =>
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      customerInformation: {
                        ...prev.customerInformation,
                        email: e.target.value
                      }
                    }));
                  })
                }
                disabled={isViewOnly || loading}
                error={
                  !!(
                    towData.customerInformation.email &&
                    !emailRegex.test(towData.customerInformation.email)
                  )
                }
                helperText={
                  towData.customerInformation.email &&
                  !emailRegex.test(towData.customerInformation.email)
                    ? 'Invalid email format'
                    : ''
                }
                sx={getDirtySx('customerInformation.email')}
                inputProps={{ style: { textAlign: 'center' }, autoComplete: 'off' }}
              />
            </Grid>

            {/* Address centered in row */}
            <Grid item xs={0} md={3} />
            <Grid item xs={12} md={6}>
              <AddressAutocomplete
                label="Address"
                value={towData.customerInformation.address}
                onValueChange={(newVal) =>
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      customerInformation: {
                        ...prev.customerInformation,
                        address: newVal
                      }
                    }));
                  })
                }
                onSelectCoord={() => {}}
                options={mainAddrOptions}
                loading={mainAddrLoading}
                disabled={isViewOnly || loading}
                centerText
                sxWrapper={getDirtySx('customerInformation.address')}
              />
            </Grid>
            <Grid item xs={0} md={3} />
          </Grid>
        </Box>

        {/* Pickup & Drop-off */}
        <Box sx={{ mb: 2, p: 1, borderRadius: 2, backgroundColor: '#E3F2FD' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            Pickup & Drop-off
          </Typography>
          <Grid container spacing={2} justifyContent="center" alignItems="center" sx={{ mb: 1 }}>
            <Grid item xs={12} md={5}>
              <AddressAutocomplete
                label="Pickup Address"
                value={towData.pickupLocation.address}
                onValueChange={(newVal) =>
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      pickupLocation: {
                        ...prev.pickupLocation,
                        address: newVal,
                        coordinates: null
                      }
                    }));
                  })
                }
                onSelectCoord={(coords, labelStr) => {
                  const rCoord = roundCoord(coords, 5);
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      pickupLocation: {
                        ...prev.pickupLocation,
                        address: labelStr,
                        coordinates: rCoord
                      }
                    }));
                    setPickupCoord(rCoord);
                  });
                }}
                options={pickupOptions}
                loading={pickupLoading}
                iconSrc={pickupIcon}
                disabled={isViewOnly || loading}
                centerText
                sxWrapper={getDirtySx('pickupLocation.address')}
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <AddressAutocomplete
                label="Drop-off Address"
                value={towData.dropoffLocation.address}
                onValueChange={(newVal) =>
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      dropoffLocation: {
                        ...prev.dropoffLocation,
                        address: newVal,
                        coordinates: null
                      }
                    }));
                  })
                }
                onSelectCoord={(coords, labelStr) => {
                  const rCoord = roundCoord(coords, 5);
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      dropoffLocation: {
                        ...prev.dropoffLocation,
                        address: labelStr,
                        coordinates: rCoord
                      }
                    }));
                    setDropoffCoord(rCoord);
                  });
                }}
                options={dropoffOptions}
                loading={dropoffLoading}
                iconSrc={dropoffIcon}
                disabled={isViewOnly || loading}
                centerText
                sxWrapper={getDirtySx('dropoffLocation.address')}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                size="small"
                fullWidth
                label="Est. Distance (mi)"
                value={towData.estimatedDistanceMiles || '0'}
                disabled
                inputProps={{ style: { textAlign: 'center' } }}
              />
            </Grid>
          </Grid>
        </Box>
      </Container>

      {/* ACCORDIONS => same container width */}
      <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 } }}>
        {/* MAP ACCORDION */}
        <Accordion
          id="accordion-header-map"
          expanded={expandedAccordion === 'map'}
          onChange={() => handleAccordionChange('map')}
          component={Paper}
          sx={{
            borderRadius: 2,
            mt: 2,
            overflow: 'hidden',
            '& .MuiAccordionSummary-content': { justifyContent: 'center' }
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#E3F2FD' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconMap2 size={18} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Map & Route Preview
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ bgcolor: '#fff' }}>
            {expandedAccordion === 'map' && (
              <Box sx={{ width: '100%', height: 350, mx: 'auto', position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    zIndex: 999
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={handleZoomIn}
                    sx={{ bgcolor: '#fff', '&:hover': { bgcolor: '#eee' } }}
                  >
                    <ZoomInIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleZoomOut}
                    sx={{ bgcolor: '#fff', '&:hover': { bgcolor: '#eee' } }}
                  >
                    <ZoomOutIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleMapReset}
                    sx={{ bgcolor: '#fff', '&:hover': { bgcolor: '#eee' } }}
                  >
                    <Typography>Reset</Typography>
                  </IconButton>
                </Box>

                <Map
                  initialViewState={{
                    longitude: userLng,
                    latitude: userLat,
                    zoom: 10
                  }}
                  scrollZoom={false} // disable mouse wheel
                  mapStyle="mapbox://styles/mapbox/streets-v11"
                  mapboxAccessToken={MAPBOX_TOKEN}
                  style={{ width: '100%', height: '100%' }}
                  onLoad={(evt) => setMapRef(evt.target)}
                >
                  {pickupCoord && (
                    <Marker
                      longitude={pickupCoord[0]}
                      latitude={pickupCoord[1]}
                      draggable={!isViewOnly}
                      onDragEnd={(evt) => {
                        if (isViewOnly) return;
                        onUserEdit(() => {
                          const { lng, lat } = evt.lngLat;
                          const newCoord = roundCoord([lng, lat], 5);
                          setPickupCoord(newCoord);
                          setTowData((prev) => ({
                            ...prev,
                            pickupLocation: {
                              ...prev.pickupLocation,
                              coordinates: newCoord,
                              address: `${newCoord[1].toFixed(4)}, ${newCoord[0].toFixed(4)}`
                            }
                          }));
                        });
                      }}
                    >
                      <Box
                        component="img"
                        src={pickupIcon}
                        alt="Pickup"
                        sx={{ width: 32, height: 32 }}
                      />
                    </Marker>
                  )}

                  {dropoffCoord && (
                    <Marker
                      longitude={dropoffCoord[0]}
                      latitude={dropoffCoord[1]}
                      draggable={!isViewOnly}
                      onDragEnd={(evt) => {
                        if (isViewOnly) return;
                        onUserEdit(() => {
                          const { lng, lat } = evt.lngLat;
                          const newCoord = roundCoord([lng, lat], 5);
                          setDropoffCoord(newCoord);
                          setTowData((prev) => ({
                            ...prev,
                            dropoffLocation: {
                              ...prev.dropoffLocation,
                              coordinates: newCoord,
                              address: `${newCoord[1].toFixed(4)}, ${newCoord[0].toFixed(4)}`
                            }
                          }));
                        });
                      }}
                    >
                      <Box
                        component="img"
                        src={dropoffIcon}
                        alt="Dropoff"
                        sx={{ width: 32, height: 32 }}
                      />
                    </Marker>
                  )}

                  {routeGeoJSON && (
                    <Source id="routeSource" type="geojson" data={routeGeoJSON}>
                      <Layer
                        id="routeLayer"
                        type="line"
                        paint={{
                          'line-color': '#4264fb',
                          'line-width': 5
                        }}
                      />
                    </Source>
                  )}
                </Map>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* VEHICLE INFO */}
        <Accordion
          id="accordion-header-vehicle"
          expanded={expandedAccordion === 'vehicle'}
          onChange={() => handleAccordionChange('vehicle')}
          component={Paper}
          sx={{
            borderRadius: 2,
            mt: 2,
            overflow: 'hidden',
            '& .MuiAccordionSummary-content': { justifyContent: 'center' }
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#E3F2FD' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconCar size={18} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Vehicle Info
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ bgcolor: '#fff' }}>
            {expandedAccordion === 'vehicle' && (
              <TowVehicleInfo
                data={{ vehicleInfo: towData.vehicleInfo }}
                onChange={(updates) =>
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      vehicleInfo: {
                        ...prev.vehicleInfo,
                        ...updates.vehicleInfo
                      }
                    }));
                  })
                }
                disabled={isViewOnly}
              />
            )}
          </AccordionDetails>
        </Accordion>

        {/* CHARGES */}
        <Accordion
          id="accordion-header-charges"
          expanded={expandedAccordion === 'charges'}
          onChange={() => handleAccordionChange('charges')}
          component={Paper}
          sx={{
            borderRadius: 2,
            mt: 2,
            overflow: 'hidden',
            '& .MuiAccordionSummary-content': { justifyContent: 'center' }
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#E3F2FD' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconFileDollar size={18} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Charges
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ bgcolor: '#fff' }}>
            {expandedAccordion === 'charges' && (
              <TowBilling
                data={{ charges: towData.charges }}
                onChange={(updates) =>
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      charges: {
                        ...prev.charges,
                        ...updates.charges
                      }
                    }));
                  })
                }
                disabled={isViewOnly}
              />
            )}
          </AccordionDetails>
        </Accordion>

        {/* PAYMENTS */}
        <Accordion
          id="accordion-header-payments"
          expanded={expandedAccordion === 'payments'}
          onChange={() => handleAccordionChange('payments')}
          component={Paper}
          sx={{
            borderRadius: 2,
            mt: 2,
            overflow: 'hidden',
            '& .MuiAccordionSummary-content': { justifyContent: 'center' }
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#E3F2FD' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconCashRegister size={18} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Payments
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ bgcolor: '#fff' }}>
            {expandedAccordion === 'payments' && (
              <TowPayments
                data={{
                  towId: docId !== 'new' ? docId : '',
                  charges: towData.charges,
                  squareCustomerId: towData.squareCustomerId,
                  payments: towData.payments,
                  customerInformation: towData.customerInformation,
                  receiptNumber: towData.receiptNumber
                }}
                onChange={(updates) =>
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      ...updates
                    }));
                  })
                }
                disabled={isViewOnly}
              />
            )}
          </AccordionDetails>
        </Accordion>

        {/* DOCUMENTS */}
        <Accordion
          id="accordion-header-documents"
          expanded={expandedAccordion === 'documents'}
          onChange={() => handleAccordionChange('documents')}
          component={Paper}
          sx={{
            borderRadius: 2,
            mt: 2,
            overflow: 'hidden',
            '& .MuiAccordionSummary-content': { justifyContent: 'center' }
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#E3F2FD' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconFileText size={18} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Documents
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ bgcolor: '#fff' }}>
            {expandedAccordion === 'documents' && (
              <TowDocuments
                data={towData}
                onChange={(updates) =>
                  onUserEdit(() => {
                    setTowData((prev) => ({
                      ...prev,
                      ...updates
                    }));
                  })
                }
                disabled={isViewOnly}
              />
            )}
          </AccordionDetails>
        </Accordion>
      </Container>

      {/* Bottom bar => single pinned bar for all nav: Prev, Next, Complete, Exit, Save */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: computedLeft,
          width: computedWidth,
          backgroundColor: '#fff',
          borderTop: '1px solid #ccc',
          py: 2,
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
          zIndex: 999
        }}
      >
        {/* EXIT */}
        <Button variant="outlined" color="inherit" onClick={handleBack} sx={{ minWidth: 120 }}>
          Exit
        </Button>

        {/* If an accordion is open, show "Previous" if not the first */}
        {expandedAccordion && !isFirstAccordion && (
          <Button variant="contained" onClick={handlePrevious} sx={{ minWidth: 120 }}>
            Previous
          </Button>
        )}

        {/* If an accordion is open and not the last, show Next */}
        {expandedAccordion && !isLastAccordion && (
          <Button variant="contained" onClick={handleNext} sx={{ minWidth: 120 }}>
            Next
          </Button>
        )}

        {/* If last accordion is open, show "Complete" */}
        {expandedAccordion && isLastAccordion && (
          <Button variant="contained" color="success" onClick={handleComplete} sx={{ minWidth: 120 }}>
            Complete
          </Button>
        )}

        {/* Save => only if not viewOnly */}
        {!isViewOnly && (
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!dirty || loading}
            sx={{ minWidth: 120 }}
          >
            Save
          </Button>
        )}
      </Box>

      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedDialog} onClose={handleCancelDiscard}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>You have unsaved changes. Leave anyway?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDiscard}>Cancel</Button>
          <Button onClick={handleConfirmDiscard} autoFocus>
            Leave
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notice Dialog => for errors or messages */}
      <Dialog open={showModal} onClose={() => setShowModal(false)}>
        <DialogTitle>Notice</DialogTitle>
        <DialogContent>
          <DialogContentText>{modalMessage}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowModal(false)} autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </MainCard>
  );
}
