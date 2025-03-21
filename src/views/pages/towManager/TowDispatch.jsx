//C:\Users\eliha\firebase\webapp\src\views\pages\towManager\TowDispatch.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback
} from 'react';
import {
  Box,
  Grid,
  TextField,
  Button,
  Typography,
  Snackbar,
  Alert,
  Card,
  CardContent,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  Paper,
  Switch,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  LocationOn,
  DirectionsCar,
  HelpOutline,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Firestore
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

import useAuth from 'hooks/useAuth';

// MAPBOX
import 'mapbox-gl/dist/mapbox-gl.css';
import ReactMapGL, {
  Marker,
  NavigationControl,
  Source,
  Layer,
  Popup
} from 'react-map-gl';
import { WebMercatorViewport } from '@math.gl/web-mercator';

import MainCard from 'ui-component/cards/MainCard';

// ENV
const apiUrl = import.meta.env.VITE_APP_API_URL || '';
const MAPBOX_TOKEN = import.meta.env.VITE_APP_MAPBOX_ACCESS_TOKEN || '';
const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';

// Distinct job marker colors
const jobColors = [
  '#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3',
  '#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a',
  '#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722',
  '#795548','#607d8b','#5e35b1','#ef6c00','#6d4c41'
];

// Drivers => available=green, unavailable=red
const DRIVER_COLOR_AVAILABLE = '#8bc34a';
const DRIVER_COLOR_UNAVAILABLE = 'red';

// Gentle highlight for "Dispatch Pending" or "Dispatched"
const PENDING_JOB_BACKGROUND = '#FFF59D';

// Extra padding for map fitting
const MAP_FIT_PADDING = { top: 100, bottom: 50, left: 50, right: 50 };

// Page container
// CHANGED: Removed "height: '100%'" to fix scrolling issues
const PageWrapper = styled('div')(() => ({
  // height: '100%',
  overflow: 'auto'
}));

// Slightly smaller text, centered
const cardTextStyle = {
  fontSize: '0.8rem',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

// We'll enforce a uniform card height across jobs & drivers
const UNIFORM_CARD_MIN_HEIGHT = 150;

/** Compute approximate distance (miles) */
function computeDistanceMiles(lat1, lng1, lat2, lng2) {
  function toRad(val) {
    return (val * Math.PI) / 180;
  }
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Splits a full address => line1, line2 */
function splitAddress(addr = '') {
  if (!addr) return { line1:'', line2:'' };
  let parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1]?.toUpperCase();
  if (['US','USA','UNITED STATES','CANADA'].includes(last)) parts.pop();
  if (parts.length <= 1) return { line1: parts[0] || '', line2: '' };
  return { line1: parts[0], line2: parts.slice(1).join(', ') };
}

/** Renders a job marker popup */
function renderJobTooltip(job) {
  const receiptLine = `#${job.receiptNumber || ''}`;
  const vLine = [
    job.vehicleInfo?.year,
    job.vehicleInfo?.make,
    job.vehicleInfo?.model
  ].filter(Boolean).join(' ');
  const address = job.pickupLocation?.address || '';
  const { line1, line2 } = splitAddress(address);
  const reason = job.reason || '';
  const towSt = job.towstatus || '';

  return (
    <Box sx={{ p:1, fontSize:'0.8rem', textAlign:'center', bgcolor:'#E3F2FD' }}>
      <Typography sx={{ fontWeight:'bold' }}>{receiptLine}</Typography>
      {vLine && <Typography sx={{ fontWeight:'bold' }}>{vLine}</Typography>}
      {line1 && <Typography>{line1}</Typography>}
      {line2 && <Typography>{line2}</Typography>}
      {reason && <Typography sx={{ fontWeight:'bold' }}>{reason}</Typography>}
      {towSt && <Typography sx={{ fontWeight:'bold' }}>Towstatus: {towSt}</Typography>}
    </Box>
  );
}

/** Renders a driver marker popup => firstName + last initial if no displayName */
function renderDriverTooltip(drv) {
  const lastInit = drv.lastName ? drv.lastName[0].toUpperCase() + '.' : '';
  const dispName = drv.displayName || `${drv.firstName||''} ${lastInit}`;
  const availability = drv.isAvailable ? 'Available' : 'Not Available';
  return (
    <Box sx={{ p:1, fontSize:'0.8rem', textAlign:'center', bgcolor:'#E3F2FD' }}>
      <Typography sx={{ fontWeight:'bold' }}>{dispName}</Typography>
      <Typography sx={{ fontWeight:'bold', color: drv.isAvailable ? 'green' : 'red' }}>
        {availability}
      </Typography>
    </Box>
  );
}

/** Renders an unpaired vehicle popup */
function renderUnpairedTooltip(vehicleData) {
  const name = vehicleData?.name || '';
  return (
    <Box sx={{ p:1, fontSize:'0.8rem', textAlign:'center', bgcolor:'#E3F2FD' }}>
      <Typography sx={{ fontWeight:'bold' }}>Unpaired Vehicle</Typography>
      {name && <Typography>{name}</Typography>}
    </Box>
  );
}

/**
 * We define a small set of bubble offset transforms so that multiple
 * bubbles at nearly the same coordinates won't overlap each other.
 * We'll pick an offset based on the route's index i (in candidateRoutes).
 */
const bubbleOffsets = [
  'translate(-140%, -50%)',
  'translate(-40%, -50%)',
  'translate(60%, -50%)'
];

export default function TowDispatch() {
  const db = getFirestore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehiclePositions, setVehiclePositions] = useState({});

  const [jobSearch, setJobSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');

  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);

  // For final route if job+driver
  const [routeGeoJSON, setRouteGeoJSON] = useState(null);
  const [routeETA, setRouteETA] = useState(null);
  const [routeDist, setRouteDist] = useState(null);

  /**
   * candidateRoutes => array of objects:
   * {
   *   id: string,            // job id or driver uid
   *   type: 'job' | 'driver',
   *   routeGeo: GeoJSON,
   *   distance: string,      // in miles
   *   duration: string,      // in minutes
   *   isSelected: boolean,
   *   bubbleLat: number,
   *   bubbleLng: number
   * }
   */
  const [candidateRoutes, setCandidateRoutes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [samsaraLoaded, setSamsaraLoaded] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // We store a set of unique "samsara.serial" to track total vehicles
  const uniqueSerialsRef = useRef(new Set());
  const pollingRef = useRef(false);
  const endCursorRef = useRef(null);

  // Map
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [viewport, setViewport] = useState({
    longitude: -97,
    latitude: 39,
    zoom: 3
  });
  const [ctrlDown, setCtrlDown] = useState(false);

  // We'll reduce the map height from ~600 => 540
  const mapHeightPx = 540;

  // OS-level fullscreen detection
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Unpaired
  const [unpairedModalOpen, setUnpairedModalOpen] = useState(false);
  const [unpairedVehicle, setUnpairedVehicle] = useState(null);
  const [availableDriversForPair, setAvailableDriversForPair] = useState([]);
  const [selectedPairDriver, setSelectedPairDriver] = useState('');

  // Hover => store lat/lng + data
  const [hoveredMarker, setHoveredMarker] = useState(null);

  // Availability => multiple assigned => checkboxes
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [availabilityModalDriver, setAvailabilityModalDriver] = useState(null);
  const [jobsToCancelSelections, setJobsToCancelSelections] = useState({});

  // Firestore => Tows
  useEffect(() => {
    const qRef = query(
      collection(db, 'tows'),
      where('status','in',['In Processing','Dispatch Pending','Dispatched'])
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const arr = [];
      snap.forEach((ds) => arr.push({ id: ds.id, ...ds.data() }));
      setJobs(arr);
    });
    return () => unsub();
  }, [db]);

  // Firestore => Drivers
  async function fetchDriversOnce() {
    if (!user?.firebaseUser) return [];
    const tok = await user.firebaseUser.getIdToken(true);
    const headers = { Authorization: `Bearer ${tok}` };
    const resp = await axios.get(`${apiUrl}/getUsers`, { headers });
    return resp.data.data || [];
  }
  useEffect(() => {
    let unsub = null;
    setLoading(true);

    (async () => {
      const loaded = await fetchDriversOnce();
      const collRef = collection(db, 'dispatchAvailability');
      unsub = onSnapshot(collRef, (snap) => {
        const arr = [];
        snap.forEach((ds) => arr.push({ uid: ds.id, ...ds.data() }));
        const combined = loaded
          .filter((u) => (u.role||'').toLowerCase()==='driver')
          .map((u)=>{
            const found= arr.find((f)=> f.uid===u.uid);
            return {
              ...u,
              isAvailable: !!found?.isAvailable,
              samsaraVehicleId: found?.samsaraVehicleId || ''
            };
          });
        setDrivers(combined);
        setLoading(false);
      });
    })();

    return ()=> unsub?.();
  }, [db,user]);

  // Samsara => poll every 10s
  async function pollFeed() {
    if(pollingRef.current) return;
    pollingRef.current=true;
    try {
      const params={ types:'engineStates,fuelPercents,gps' };
      if(endCursorRef.current) params.after=endCursorRef.current;

      const resp= await axios.get(`${apiUrl}/api/samsara/vehicle-stats`, { params });
      const { data=[], pagination }= resp.data;
      if(data.length) {
        const newPos={};
        data.forEach((v)=>{
          const serial= v?.externalIds?.['samsara.serial'];
          if(serial) uniqueSerialsRef.current.add(serial);
          if(v.gps?.length) {
            const last= v.gps[v.gps.length-1];
            newPos[v.id]= { lat:last.latitude, lng:last.longitude, raw:v };
          } else {
            newPos[v.id]= { lat:null, lng:null, raw:v };
          }
        });
        setVehiclePositions((old)=> ({...old, ...newPos}));
      }
      if(pagination?.endCursor) endCursorRef.current= pagination.endCursor;
      if(pagination?.hasNextPage) await pollFeed();
    } catch(err) {
      console.error('pollFeed =>', err);
    } finally {
      pollingRef.current=false;
      setSamsaraLoaded(true);
    }
  }
  useEffect(()=>{
    pollFeed();
    const id= setInterval(pollFeed,10000);
    return ()=> clearInterval(id);
  },[]);

  // after loading => fitAll once
  const didInitialRef= useRef(false);
  useEffect(()=>{
    if(!loading && samsaraLoaded && !didInitialRef.current) {
      didInitialRef.current=true;
      handleRefresh();
    }
  }, [loading, samsaraLoaded]);

  // handleRefresh => deselect + poll + fitAll
  function handleRefresh() {
    cancelSelections();
    pollFeed().then(()=> fitAllMarkers());
  }

  function fitAllMarkers() {
    if(!mapContainerRef.current) return;
    const coords=[];
    for(const j of jobs) {
      if(Array.isArray(j.pickupLocation?.coordinates)) coords.push(j.pickupLocation.coordinates);
    }
    for(const vehId in vehiclePositions) {
      const pos= vehiclePositions[vehId];
      if(pos.lat!=null && pos.lng!=null) coords.push([pos.lng,pos.lat]);
    }
    if(coords.length>0) fitMapToCoordinates(coords);
  }
  function fitMapToCoordinates(coordsList) {
    if(!mapContainerRef.current|| !coordsList.length) return;
    let minLng= Infinity, maxLng= -Infinity, minLat= Infinity, maxLat= -Infinity;
    coordsList.forEach(([lng,lat])=>{
      if(lng<minLng) minLng= lng;
      if(lng>maxLng) maxLng= lng;
      if(lat<minLat) minLat= lat;
      if(lat>maxLat) maxLat= lat;
    });
    if(minLng===Infinity) return;
    const rect= mapContainerRef.current.getBoundingClientRect();
    const vwpt= new WebMercatorViewport({ width:rect.width, height:rect.height });
    const bounds= [[minLng,minLat],[maxLng,maxLat]];
    const { longitude, latitude, zoom }= vwpt.fitBounds(bounds,{ padding: MAP_FIT_PADDING });
    setViewport((old)=>({
      ...old,
      longitude,
      latitude,
      zoom: zoom>16?16:zoom
    }));
  }

  // watch ctrl => scrollZoom
  useEffect(()=>{
    const kd= (e)=>{ if(e.ctrlKey) setCtrlDown(true); };
    const ku= (e)=>{ if(!e.ctrlKey) setCtrlDown(false); };
    window.addEventListener('keydown',kd);
    window.addEventListener('keyup',ku);
    return ()=>{
      window.removeEventListener('keydown',kd);
      window.removeEventListener('keyup',ku);
    };
  },[]);

  // Fullscreen => OS-level
  const handleToggleFullScreen= useCallback(()=>{
    if(!document.fullscreenElement) {
      mapContainerRef.current?.requestFullscreen().then(()=>{
        setIsFullScreen(true);
      }).catch(err=> console.error('enter fs =>',err));
    } else {
      document.exitFullscreen().catch(err=> console.error('exit fs =>',err));
    }
  },[]);
  useEffect(()=>{
    function onFsChange() {
      setIsFullScreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return ()=> document.removeEventListener('fullscreenchange', onFsChange);
  },[]);

  // Snapshot data
  const totalVehicles= uniqueSerialsRef.current.size;
  const totalJobs= jobs.length;
  const totalAvailableDrivers= drivers.filter(d=> d.isAvailable && d.samsaraVehicleId).length;
  const totalUnavailableDrivers= drivers.filter(d=> d.samsaraVehicleId).length - totalAvailableDrivers;
  const unassignedJobsCount= jobs.filter(j=> !j.towstatus || j.towstatus==='Cancelled').length;

  // canDispatch => job+driver
  const canDispatch= !!(selectedJob && selectedDriver);

  async function handleDispatch() {
    if (!canDispatch) return;
    try {
      // Gather needed data from the selected driver & job
      const driverVehicle = vehiclePositions[selectedDriver.samsaraVehicleId]?.raw || null;
      const lastInit = selectedDriver.lastName ? selectedDriver.lastName[0].toUpperCase() + '.' : '';
      const driverName = selectedDriver.displayName || `${selectedDriver.firstName || ''} ${lastInit}`;
      let vehicleSerial = '';
      let vehicleName = '';
      if (driverVehicle) {
        vehicleSerial = driverVehicle.externalIds?.['samsara.serial'] || '';
        vehicleName = driverVehicle.name || '';
      }

      // Build the payload that your /api/dispatchJob now expects
      const payload = {
        jobId: selectedJob.id,
        driverUid: selectedDriver.uid,
        driverName,        // Pass the computed driver name
        vehicleSerial,     // Pass the vehicle’s Samsara serial if any
        vehicleName        // Pass the vehicle name if any
      };

      // Acquire our Firebase token for the Authorization header
      const tok = await user.firebaseUser.getIdToken(true);
      const headers = { Authorization: `Bearer ${tok}` };

      // Send the dispatch request to your backend
      await axios.post(`${apiUrl}/api/dispatchJob`, payload, { headers });

      // Reset UI / local states
      setSnackbarOpen(true);
      setSelectedJob(null);
      setSelectedDriver(null);
      setRouteGeoJSON(null);
      setRouteETA(null);
      setRouteDist(null);
      setCandidateRoutes([]);
    } catch (err) {
      console.error('dispatch =>', err);
      alert(`Error dispatching job: ${err.message}`);
    }
  }

  function cancelSelections() {
    setSelectedJob(null);
    setSelectedDriver(null);
    setRouteGeoJSON(null);
    setRouteETA(null);
    setRouteDist(null);
    setCandidateRoutes([]);
  }
  function cancelCandidateRoutes() {
    setCandidateRoutes([]);
  }

  function getJobUpdatedAtMillis(j) {
    if(!j.updatedAt) return 0;
    if(j.updatedAt.toMillis) return j.updatedAt.toMillis();
    return 0;
  }
  const sortedJobs= useMemo(()=>{
    const incomplete= jobs.filter(j=> j.towstatus!=='Completed');
    const groupA= [], groupB= [];
    for(const j of incomplete) {
      if(!j.towstatus || j.towstatus==='' || j.towstatus==='Cancelled') groupA.push(j);
      else groupB.push(j);
    }
    groupA.sort((a,b)=> getJobUpdatedAtMillis(a)-getJobUpdatedAtMillis(b));
    groupB.sort((a,b)=> getJobUpdatedAtMillis(a)-getJobUpdatedAtMillis(b));
    return [...groupA, ...groupB];
  },[jobs]);

  const filteredJobs= useMemo(()=>{
    const lower= jobSearch.trim().toLowerCase();
    if(!lower) return sortedJobs;
    return sortedJobs.filter(j=>{
      const rNum= (j.receiptNumber||'').toLowerCase();
      const reason= (j.reason||'').toLowerCase();
      const addr= (j.pickupLocation?.address||'').toLowerCase();
      const yr= String(j.vehicleInfo?.year||'');
      const mk= (j.vehicleInfo?.make||'').toLowerCase();
      const md= (j.vehicleInfo?.model||'').toLowerCase();
      return (
        rNum.includes(lower) ||
        reason.includes(lower) ||
        addr.includes(lower) ||
        yr.includes(lower) ||
        mk.includes(lower) ||
        md.includes(lower)
      );
    });
  },[sortedJobs,jobSearch]);

  const jobIdToColor= useMemo(()=>{
    const out={};
    filteredJobs.forEach((j,i)=>{
      out[j.id]= jobColors[i % jobColors.length];
    });
    return out;
  },[filteredJobs]);

  function sortDriversCustom(a,b) {
    const aHas= !!a.samsaraVehicleId;
    const bHas= !!b.samsaraVehicleId;
    if(aHas && !bHas) return -1;
    if(!aHas && bHas) return 1;
    if(a.isAvailable && !b.isAvailable) return -1;
    if(!a.isAvailable && b.isAvailable) return 1;
    return 0;
  }
  const sortedDriversRaw= useMemo(()=>{
    let arr= [...drivers];
    arr.sort(sortDriversCustom);
    return arr;
  },[drivers]);

  const filteredDriversRaw= useMemo(()=>{
    const lower= driverSearch.trim().toLowerCase();
    if(!lower) return sortedDriversRaw;
    return sortedDriversRaw.filter(d=>{
      const fn= (d.firstName||'').toLowerCase();
      const ln= (d.lastName||'').toLowerCase();
      const disp= (d.displayName||'').toLowerCase();
      return fn.includes(lower) || ln.includes(lower) || disp.includes(lower);
    });
  },[sortedDriversRaw,driverSearch]);

  const sortedFilteredDrivers= useMemo(()=>{
    if(selectedJob?.pickupLocation?.coordinates) {
      const [jLng,jLat]= selectedJob.pickupLocation.coordinates;
      return filteredDriversRaw.map(d=>{
        if(!d.samsaraVehicleId) return {...d, distance:Infinity};
        const pos= vehiclePositions[d.samsaraVehicleId];
        if(!pos?.lat||!pos?.lng) return {...d, distance:Infinity};
        const dist= computeDistanceMiles(jLat,jLng,pos.lat,pos.lng);
        return {...d, distance:dist};
      }).sort((a,b)=> a.distance- b.distance);
    }
    return filteredDriversRaw;
  },[filteredDriversRaw,selectedJob,vehiclePositions]);

  function handleSelectJob(job) {
    setCandidateRoutes([]);
    setRouteGeoJSON(null);
    setRouteETA(null);
    setRouteDist(null);
    setSelectedJob(job);

    if(selectedDriver && job?.pickupLocation?.coordinates) {
      fetchFinalRoute(job, selectedDriver);
      return;
    }
    if(Array.isArray(job.pickupLocation?.coordinates)) {
      const [jLng,jLat]= job.pickupLocation.coordinates;
      const valid= drivers
        .filter(d=> d.isAvailable && d.samsaraVehicleId && vehiclePositions[d.samsaraVehicleId]?.lat!=null)
        .map(d=>{
          const pos= vehiclePositions[d.samsaraVehicleId];
          const dist= computeDistanceMiles(jLat,jLng,pos.lat,pos.lng);
          return { driver:d, dist };
        })
        .sort((a,b)=> a.dist- b.dist);
      const top3= valid.slice(0,3);

      const coords=[[jLng,jLat]];
      top3.forEach(o=>{
        const p= vehiclePositions[o.driver.samsaraVehicleId];
        coords.push([p.lng,p.lat]);
      });
      fitMapToCoordinates(coords);
      getCandidateRoutesForDrivers(job, top3);
    }
  }

  function handleSelectDriver(drv) {
    setCandidateRoutes([]);
    setRouteGeoJSON(null);
    setRouteETA(null);
    setRouteDist(null);
    setSelectedDriver(drv);

    if(selectedJob && drv?.samsaraVehicleId) {
      fetchFinalRoute(selectedJob, drv);
      return;
    }
    if(!drv.samsaraVehicleId) return;
    const pos= vehiclePositions[drv.samsaraVehicleId];
    if(!pos?.lat||!pos?.lng) return;

    const jobDists= jobs
      .filter(j=> j.towstatus!=='Completed' && j.status==='In Processing')
      .filter(j=> Array.isArray(j.pickupLocation?.coordinates))
      .map(j=>{
        const [lng,lat]= j.pickupLocation.coordinates;
        const dist= computeDistanceMiles(pos.lat,pos.lng, lat,lng);
        return { job:j, dist };
      })
      .sort((a,b)=> a.dist- b.dist);
    const top3= jobDists.slice(0,3);
    if(!top3.length) return;

    const coords=[[pos.lng,pos.lat]];
    top3.forEach(o=>{
      const [lng,lat]= o.job.pickupLocation.coordinates;
      coords.push([lng,lat]);
    });
    fitMapToCoordinates(coords);
    getCandidateRoutesForJobs(drv, top3);
  }

  async function fetchFinalRoute(job, drv) {
    if(!job || !drv?.samsaraVehicleId) return;
    const pos= vehiclePositions[drv.samsaraVehicleId];
    if(!pos|| pos.lat==null||pos.lng==null) return;
    const [jLng,jLat]= job.pickupLocation.coordinates;
    if(!MAPBOX_TOKEN) return;
    try {
      const url= `${MAPBOX_DIRECTIONS_URL}/${pos.lng},${pos.lat};${jLng},${jLat}`;
      const r= await axios.get(url,{
        params:{
          alternatives:false,
          geometries:'geojson',
          overview:'full',
          access_token:MAPBOX_TOKEN
        }
      });
      const route= r.data.routes?.[0];
      if(route) {
        const distMi= route.distance*0.000621371;
        const durMin= route.duration/60;
        setRouteDist(distMi.toFixed(1));
        setRouteETA(durMin.toFixed(0));
        setRouteGeoJSON({
          type:'Feature',
          geometry: route.geometry,
          properties:{}
        });
        fitMapToCoordinates(route.geometry.coordinates);
      }
    } catch(err) {
      console.error('fetchFinalRoute =>',err);
    }
  }

  // [FIX #2] => Auto-select nearest route
  async function getCandidateRoutesForDrivers(job, top3) {
    const [jLng,jLat]= job.pickupLocation.coordinates;
    const out= [];
    for(const {driver} of top3) {
      const pos= vehiclePositions[driver.samsaraVehicleId];
      if(!pos) continue;
      try {
        const url= `${MAPBOX_DIRECTIONS_URL}/${pos.lng},${pos.lat};${jLng},${jLat}`;
        const r= await axios.get(url,{
          params:{
            alternatives:false,
            geometries:'geojson',
            overview:'full',
            access_token:MAPBOX_TOKEN
          }
        });
        const route= r.data.routes?.[0];
        if(route) {
          const distMi= route.distance*0.000621371;
          const durMin= route.duration/60;
          out.push({
            id: driver.uid,
            type: 'driver',
            routeGeo:{ type:'Feature', geometry:route.geometry, properties:{} },
            distance: distMi.toFixed(1),
            duration: durMin.toFixed(0),
            isSelected: false,
            bubbleLat: pos.lat,
            bubbleLng: pos.lng
          });
        }
      } catch(err) {
        console.error('getCandidateRoutesForDrivers =>',err);
      }
    }
    if(out.length>0) {
      // Sort and auto-pick the nearest
      out.sort((a,b)=> parseFloat(a.distance)- parseFloat(b.distance));
      out[0].isSelected=true;
      const foundDrv= drivers.find(d=> d.uid=== out[0].id);
      if(foundDrv) {
        setSelectedDriver(foundDrv);
        setRouteDist(out[0].distance);
        setRouteETA(out[0].duration);
        setRouteGeoJSON(out[0].routeGeo);
      }
    }
    setCandidateRoutes(out);
  }

  // [FIX #2] => Auto-select nearest route
  async function getCandidateRoutesForJobs(drv, top3) {
    const pos= vehiclePositions[drv.samsaraVehicleId];
    const out= [];
    for(const {job} of top3) {
      const [jLng,jLat]= job.pickupLocation.coordinates;
      try {
        const url= `${MAPBOX_DIRECTIONS_URL}/${pos.lng},${pos.lat};${jLng},${jLat}`;
        const r= await axios.get(url,{
          params:{
            alternatives:false,
            geometries:'geojson',
            overview:'full',
            access_token:MAPBOX_TOKEN
          }
        });
        const route= r.data.routes?.[0];
        if(route) {
          const distMi= route.distance*0.000621371;
          const durMin= route.duration/60;
          out.push({
            id: job.id,
            type: 'job',
            routeGeo:{ type:'Feature', geometry:route.geometry, properties:{} },
            distance: distMi.toFixed(1),
            duration: durMin.toFixed(0),
            isSelected: false,
            bubbleLat: jLat,
            bubbleLng: jLng
          });
        }
      } catch(err) {
        console.error('getCandidateRoutesForJobs =>',err);
      }
    }
    if(out.length>0) {
      // Sort and auto-pick the nearest
      out.sort((a,b)=> parseFloat(a.distance)- parseFloat(b.distance));
      out[0].isSelected=true;
      const foundJob= jobs.find(j=> j.id=== out[0].id);
      if(foundJob) {
        setSelectedJob(foundJob);
        setRouteDist(out[0].distance);
        setRouteETA(out[0].duration);
        setRouteGeoJSON(out[0].routeGeo);
      }
    }
    setCandidateRoutes(out);
  }

  function handleSelectCandidateRoute(routeObjIndex) {
    setCandidateRoutes((old)=>{
      return old.map((c,i)=>({
        ...c,
        isSelected: i=== routeObjIndex
      }));
    });
    const selectedRoute= candidateRoutes[routeObjIndex];
    if(selectedRoute.type==='driver') {
      const foundDrv= drivers.find(d=> d.uid=== selectedRoute.id);
      if(foundDrv) {
        setSelectedDriver(foundDrv);
        if(selectedJob) {
          fetchFinalRoute(selectedJob, foundDrv);
        }
      }
    } 
    else if(selectedRoute.type==='job') {
      const foundJob= jobs.find(j=> j.id=== selectedRoute.id);
      if(foundJob) {
        setSelectedJob(foundJob);
        if(selectedDriver) {
          fetchFinalRoute(foundJob, selectedDriver);
        }
      }
    }
  }

  async function handleToggleDriverAvailability(drv) {
    if(!drv.samsaraVehicleId) return;
    if(!drv.isAvailable) {
      const assigned= jobs.filter(j=>
        j.dispatchDriver===drv.uid &&
        j.towstatus &&
        !['Complete','Cancelled'].includes(j.towstatus)
      );
      if(!assigned.length) {
        await updateDoc(doc(db,'dispatchAvailability',drv.uid),{ isAvailable:true });
      } else {
        setAvailabilityModalDriver({ driver:drv, jobs:assigned });
        const init={};
        assigned.forEach(jb=> init[jb.id]=false);
        setJobsToCancelSelections(init);
        setAvailabilityModalOpen(true);
      }
    } else {
      await updateDoc(doc(db,'dispatchAvailability',drv.uid),{ isAvailable:false });
    }
  }
  async function handleMultipleCancelOk() {
    const { driver, jobs: assigned }= availabilityModalDriver;
    try {
      let stillActive=0;
      for(const jb of assigned) {
        if(jobsToCancelSelections[jb.id]) {
          await updateDoc(doc(db,'tows', jb.id),{
            status:'In Processing',
            towstatus:'Cancelled'
          });
        } else {
          stillActive++;
        }
      }
      if(!stillActive) {
        await updateDoc(doc(db,'dispatchAvailability', driver.uid),{ isAvailable:true });
      }
    } catch(err) {
      console.error(err);
      alert(err.message);
    }
    setAvailabilityModalOpen(false);
    setAvailabilityModalDriver(null);
    setJobsToCancelSelections({});
  }
  function handleMultipleCancelNo() {
    setAvailabilityModalOpen(false);
    setAvailabilityModalDriver(null);
    setJobsToCancelSelections({});
  }

  function renderJobMarker(job, isSelected, color) {
    const active= job.towstatus && !['Complete','Cancelled'].includes(job.towstatus);
    return (
      <Box sx={{ position:'relative', cursor:'pointer' }}>
        {active && (
          <Box
            sx={{
              position:'absolute',
              top:'50%',
              left:'50%',
              transform:'translate(-50%,-50%)',
              width:24,
              height:24,
              borderRadius:'50%',
              backgroundColor:'red',
              opacity:0.5,
              zIndex:0
            }}
          />
        )}
        <LocationOn
          sx={{
            fontSize:20,
            color,
            outline: isSelected?'2px solid #000':'none',
            outlineOffset:'-2px',
            position:'relative',
            zIndex:1
          }}
        />
      </Box>
    );
  }

  if(loading || !samsaraLoaded) {
    return (
      <Box sx={{ width:'100%', height:'80vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <CircularProgress/>
      </Box>
    );
  }

  // [FIX #1] => Ensure we only show one Cancel bar at a time
  const showCandidateRoutesBar= (candidateRoutes.length>0 && !canDispatch);
  const showCancelDispatchBar= !showCandidateRoutesBar && (selectedJob || selectedDriver);

  return (
    <PageWrapper>
      <MainCard
        sx={{
          width:'100%',
          maxWidth:'none',
          mx:'auto',
          mb:2,
          p:0,
          borderRadius:2
        }}
      >
        {/* SNAPSHOT => corners: round on top, square on bottom */}
        <Paper sx={{
          p:1,
          backgroundColor:'#E3F2FD',
          display:'flex',
          justifyContent:'center',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0
        }}>
          <Grid container spacing={2} justifyContent="center">
            <Grid item>
              <TextField
                label="Total Vehicles"
                value={String(totalVehicles)}
                size="small"
                sx={{ width:140, textAlign:'center' }}
                inputProps={{ style:{ textAlign:'center', fontWeight:'bold' } }}
                InputProps={{ readOnly:true }}
              />
            </Grid>
            <Grid item>
              <TextField
                label="Total Jobs"
                value={String(totalJobs)}
                size="small"
                sx={{ width:140 }}
                inputProps={{ style:{ textAlign:'center', fontWeight:'bold' } }}
                InputProps={{ readOnly:true }}
              />
            </Grid>
            <Grid item>
              <TextField
                label="Unassigned Jobs"
                value={String(unassignedJobsCount)}
                size="small"
                sx={{ width:140 }}
                inputProps={{ style:{ textAlign:'center', fontWeight:'bold' } }}
                InputProps={{ readOnly:true }}
              />
            </Grid>
            <Grid item>
              <TextField
                label="Available Drivers"
                value={String(totalAvailableDrivers)}
                size="small"
                sx={{ width:140 }}
                inputProps={{ style:{ textAlign:'center', fontWeight:'bold' } }}
                InputProps={{ readOnly:true }}
              />
            </Grid>
            <Grid item>
              <TextField
                label="Unavailable Drivers"
                value={String(totalUnavailableDrivers)}
                size="small"
                sx={{ width:140 }}
                inputProps={{ style:{ textAlign:'center', fontWeight:'bold' } }}
                InputProps={{ readOnly:true }}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* MAP => 540px height */}
        <Box
          sx={{
            position:'relative',
            height: isFullScreen? 'calc(100vh - 160px)': mapHeightPx,
            width:'100%',
            zIndex:1
          }}
          ref={mapContainerRef}
        >
          {MAPBOX_TOKEN ? (
            <ReactMapGL
              {...viewport}
              ref={mapRef}
              reuseMaps
              transitionDuration={0}
              dragRotate={false}
              scrollZoom={ctrlDown}
              mapStyle="mapbox://styles/mapbox/light-v10"
              mapboxAccessToken={MAPBOX_TOKEN}
              width="100%"
              height="100%"
              onMove={(evt)=> setViewport(evt.viewState)}
              onMouseLeave={()=> setHoveredMarker(null)}
              interactiveLayerIds={candidateRoutes.map((_, i)=> `cand-layer-${i}`)}
              onClick={(e)=>{
                const feat= e.features?.[0];
                if(feat && feat.layer?.id?.startsWith('cand-layer-')) {
                  const idxStr= feat.layer.id.replace('cand-layer-','');
                  const routeIndex= parseInt(idxStr,10);
                  if(!Number.isNaN(routeIndex)) {
                    handleSelectCandidateRoute(routeIndex);
                  }
                }
              }}
            >
              {/* Candidate routes => lines => if isSelected => dark blue (#1976d2), else light blue (#90caf9) */}
              {candidateRoutes.map((c, i)=>(
                <Source key={`cand-src-${i}`} id={`cand-src-${i}`} type="geojson" data={c.routeGeo}>
                  <Layer
                    id={`cand-layer-${i}`}
                    type="line"
                    paint={{
                      'line-color': c.isSelected ? '#1976d2':'#90caf9',
                      'line-width':4
                    }}
                  />
                </Source>
              ))}

              {/* Final route => if job+driver => normal dark blue */}
              {routeGeoJSON && (
                <Source id="final-route" type="geojson" data={routeGeoJSON}>
                  <Layer
                    id="final-route-layer"
                    type="line"
                    paint={{
                      'line-color':'#1976d2',
                      'line-width':4
                    }}
                  />
                </Source>
              )}

              {/* JOB markers */}
              {filteredJobs.map(job=>{
                if(!Array.isArray(job.pickupLocation?.coordinates)) return null;
                const [lng,lat]= job.pickupLocation.coordinates;
                const color= jobIdToColor[job.id]||'#000';
                const isSel= selectedJob?.id=== job.id;
                return (
                  <Marker key={job.id} longitude={lng} latitude={lat} anchor="bottom">
                    <Box
                      onMouseEnter={()=> setHoveredMarker({ lng, lat, type:'job', data: job })}
                      onMouseLeave={()=> setHoveredMarker(null)}
                      onClick={()=> handleSelectJob(job)}
                    >
                      {renderJobMarker(job, isSel, color)}
                    </Box>
                  </Marker>
                );
              })}

              {/* UNPAIRED vehicles */}
              {Object.entries(vehiclePositions).map(([vehId,pos])=>{
                if(pos.lat==null||pos.lng==null) return null;
                const matched= drivers.find(d=> d.samsaraVehicleId===vehId);
                if(matched) return null;
                return (
                  <Marker key={vehId} longitude={pos.lng} latitude={pos.lat} anchor="bottom">
                    <Box
                      sx={{
                        cursor:'pointer',
                        width:20, height:20,
                        borderRadius:'50%',
                        backgroundColor:'#ff9800',
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        color:'#fff'
                      }}
                      onMouseEnter={()=> setHoveredMarker({
                        lng:pos.lng, lat:pos.lat, type:'unpaired', data:pos.raw
                      })}
                      onMouseLeave={()=> setHoveredMarker(null)}
                      onClick={()=>{
                        setUnpairedVehicle(pos.raw);
                        setSelectedPairDriver('');
                        const noVeh= drivers.filter(d=> !d.samsaraVehicleId);
                        setAvailableDriversForPair(noVeh);
                        setUnpairedModalOpen(true);
                      }}
                    >
                      <HelpOutline sx={{ fontSize:'0.75rem' }}/>
                    </Box>
                  </Marker>
                );
              })}

              {/* DRIVER markers */}
              {drivers.map(drv=>{
                if(!drv.samsaraVehicleId) return null;
                const pos= vehiclePositions[drv.samsaraVehicleId];
                if(!pos|| pos.lat==null||pos.lng==null) return null;
                const isSel= selectedDriver?.uid=== drv.uid;
                const color= drv.isAvailable? DRIVER_COLOR_AVAILABLE: DRIVER_COLOR_UNAVAILABLE;

                return (
                  <Marker key={drv.uid} longitude={pos.lng} latitude={pos.lat} anchor="bottom">
                    <Box
                      sx={{
                        cursor:'pointer',
                        outline: isSel?'2px solid #000':'none',
                        outlineOffset:'-2px',
                        width:20, height:20,
                        borderRadius:'50%',
                        backgroundColor:color,
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        color:'#fff'
                      }}
                      onMouseEnter={()=> setHoveredMarker({
                        lng:pos.lng, lat:pos.lat, type:'driver', data:drv
                      })}
                      onMouseLeave={()=> setHoveredMarker(null)}
                      onClick={()=>{
                        handleSelectDriver(drv);
                      }}
                    >
                      <Box sx={{ fontSize:'0.75rem' }}>
                        <DirectionsCar/>
                      </Box>
                    </Box>
                  </Marker>
                );
              })}

              {/* Candidate route bubbles => offset them slightly so they don't cover the marker */}
              {candidateRoutes.map((c, i) => (
                <Marker
                  key={`cand-marker-${i}`}
                  longitude={c.bubbleLng}
                  latitude={c.bubbleLat}
                  anchor="bottom"
                >
                  {(() => {
                    const transform = bubbleOffsets[i % bubbleOffsets.length];
                    if(c.type==='driver') {
                      const d= drivers.find(xx=> xx.uid=== c.id);
                      if(!d) return null;
                      const lastInit = d.lastName ? d.lastName[0].toUpperCase()+'.':''; 
                      const dispName= d.displayName || `${d.firstName||''} ${lastInit}`;
                      return (
                        <Box
                          sx={{
                            position:'absolute',
                            bottom:'100%',
                            left:'50%',
                            transform,
                            bgcolor:'white',
                            color:'black',
                            p:'4px 8px',
                            borderRadius:2,
                            fontSize:'0.75rem',
                            textAlign:'center',
                            boxShadow:4,
                            whiteSpace:'pre',
                            zIndex:9999
                          }}
                        >
                          {`${dispName}\nDist ${c.distance} mi\nETA ${c.duration} min`}
                        </Box>
                      );
                    } else {
                      const j= jobs.find(xx=> xx.id=== c.id);
                      if(!j) return null;
                      const receiptLine= `#${j.receiptNumber||''}`;
                      return (
                        <Box
                          sx={{
                            position:'absolute',
                            bottom:'100%',
                            left:'50%',
                            transform,
                            bgcolor:'white',
                            color:'black',
                            p:'4px 8px',
                            borderRadius:2,
                            fontSize:'0.75rem',
                            textAlign:'center',
                            boxShadow:4,
                            whiteSpace:'pre',
                            zIndex:9999
                          }}
                        >
                          {`${receiptLine}\nDist ${c.distance} mi\nETA ${c.duration} min`}
                        </Box>
                      );
                    }
                  })()}
                </Marker>
              ))}

              <NavigationControl position="top-left"/>

              {/* Refresh => top-right */}
              <Box sx={{ position:'absolute', top:10, right:10 }}>
                <IconButton onClick={handleRefresh} sx={{ backgroundColor:'#fff', m:1 }}>
                  <RefreshIcon/>
                </IconButton>
              </Box>

              {/* Fullscreen => bottom-right */}
              <Box sx={{ position:'absolute', bottom:10, right:10 }}>
                <IconButton onClick={handleToggleFullScreen} sx={{ backgroundColor:'#fff', m:1 }}>
                  {isFullScreen ? <FullscreenExitIcon/> : <FullscreenIcon/>}
                </IconButton>
              </Box>

              {/* Candidate routes bar => top-center in the map container */}
              {showCandidateRoutesBar && (
                <Box
                  sx={{
                    position:'absolute',
                    top:10,
                    left:'50%',
                    transform:'translateX(-50%)',
                    zIndex:9999,
                    backgroundColor:'#fff',
                    borderRadius:2,
                    boxShadow:3,
                    display:'flex',
                    gap:1,
                    alignItems:'center',
                    p:1
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight:'bold' }}>
                    3 Nearest {selectedJob ? 'Drivers' : 'Jobs'}
                  </Typography>
                  <Button variant="outlined" onClick={cancelCandidateRoutes}>
                    Cancel
                  </Button>
                </Box>
              )}

              {/* [FIX #1] => only show Cancel/Dispatch if NOT showing candidate bar */}
              {showCancelDispatchBar && (
                <Box
                  sx={{
                    position:'absolute',
                    top: showCandidateRoutesBar ? 60 : 10,
                    left:'50%',
                    transform:'translateX(-50%)',
                    zIndex:9999,
                    backgroundColor:'#fff',
                    borderRadius:2,
                    boxShadow:3,
                    display:'flex',
                    gap:1,
                    alignItems:'center'
                  }}
                >
                  <Button variant="outlined" onClick={cancelSelections} sx={{ m:1 }}>
                    Cancel
                  </Button>
                  {canDispatch && (
                    <Button variant="contained" onClick={handleDispatch} sx={{ m:1 }}>
                      Dispatch
                    </Button>
                  )}
                </Box>
              )}

              {/* Hover popup => job/driver/unpaired */}
              {hoveredMarker && (
                <Popup
                  longitude={hoveredMarker.lng}
                  latitude={hoveredMarker.lat}
                  anchor="bottom"
                  closeButton={false}
                  closeOnClick={false}
                  offset={[0,-10]}
                >
                  {hoveredMarker.type==='job' && renderJobTooltip(hoveredMarker.data)}
                  {hoveredMarker.type==='driver' && renderDriverTooltip(hoveredMarker.data)}
                  {hoveredMarker.type==='unpaired' && renderUnpairedTooltip(hoveredMarker.data)}
                </Popup>
              )}
            </ReactMapGL>
          ) : (
            <Box
              sx={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}
            >
              <Typography color="error">Missing MAPBOX_TOKEN</Typography>
            </Box>
          )}
        </Box>

        {/* Jobs + Drivers */}
        <Grid container spacing={2} sx={{ mt:2, justifyContent:'center' }}>
          {/* Jobs */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" sx={{ textAlign:'center', fontWeight:'bold', mb:2 }}>
              Jobs
            </Typography>
            <TextField
              fullWidth
              label="Search Jobs"
              variant="outlined"
              size="small"
              value={jobSearch}
              onChange={(e)=> setJobSearch(e.target.value)}
              sx={{ mb:2 }}
            />
            {filteredJobs.length===0 ? (
              <Typography variant="body2" align="center">
                No jobs found.
              </Typography>
            ) : (
              <Grid container spacing={2} justifyContent="center">
                {filteredJobs.map(job=>{
                  const isSel= selectedJob?.id=== job.id;
                  const color= jobIdToColor[job.id]||'#000';
                  let cardBg= '#E3F2FD';
                  if(job.towstatus && !['Complete','Cancelled',''].includes(job.towstatus)) {
                    if(['Dispatch Pending','Dispatched'].includes(job.status)) {
                      cardBg= PENDING_JOB_BACKGROUND;
                    }
                  }
                  const receiptLine= `#${job.receiptNumber||''}`;
                  const vLine= [
                    job.vehicleInfo?.year,
                    job.vehicleInfo?.make,
                    job.vehicleInfo?.model
                  ].filter(Boolean).join(' ');
                  const address= job.pickupLocation?.address||'';
                  const { line1,line2 }= splitAddress(address);
                  const reason= job.reason||'';
                  const jobTow= job.towstatus||'';

                  return (
                    <Grid item xs={12} sm={6} key={job.id}>
                      <Card
                        sx={{
                          backgroundColor: cardBg,
                          borderRadius:2,
                          minHeight:UNIFORM_CARD_MIN_HEIGHT,
                          overflow:'hidden',
                          display:'flex',
                          flexDirection:'column',
                          justifyContent:'center',
                          textAlign:'center',
                          transition:'box-shadow 0.2s, transform 0.2s',
                          ...(isSel && { boxShadow:'0 0 0 2px black' }),
                          '&:hover':{
                            boxShadow:4,
                            transform:'translateY(-2px)'
                          },
                          cursor:'pointer'
                        }}
                        onClick={()=> handleSelectJob(job)}
                      >
                        <CardContent sx={{ p:1 }}>
                          <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:1 }}>
                            <LocationOn sx={{ fontSize:20, color }} />
                            <Box>
                              <Typography sx={{ ...cardTextStyle, fontWeight:'bold' }}>
                                {receiptLine}
                              </Typography>
                              {vLine && (
                                <Typography sx={{ ...cardTextStyle, fontWeight:'bold' }}>
                                  {vLine}
                                </Typography>
                              )}
                              {line1 && <Typography sx={cardTextStyle}>{line1}</Typography>}
                              {line2 && <Typography sx={cardTextStyle}>{line2}</Typography>}
                              {reason && (
                                <Typography sx={{ ...cardTextStyle, fontWeight:'bold' }}>
                                  {reason}
                                </Typography>
                              )}
                              {jobTow && (
                                <Typography sx={{ ...cardTextStyle, fontWeight:'bold' }}>
                                  Towstatus: {jobTow}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Grid>

          {/* Drivers */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" sx={{ textAlign:'center', fontWeight:'bold', mb:2 }}>
              Drivers
            </Typography>
            <TextField
              fullWidth
              label="Search Drivers"
              variant="outlined"
              size="small"
              value={driverSearch}
              onChange={(e)=> setDriverSearch(e.target.value)}
              sx={{ mb:2 }}
            />
            {sortedFilteredDrivers.length===0 ? (
              <Typography variant="body2" align="center">
                No drivers found.
              </Typography>
            ) : (
              <Grid container spacing={2} justifyContent="center">
                {sortedFilteredDrivers.map(drv=>{
                  const isSel= selectedDriver?.uid=== drv.uid;
                  const rawVeh= drv.samsaraVehicleId
                    ? vehiclePositions[drv.samsaraVehicleId]?.raw
                    : null;
                  let cardBg= drv.isAvailable? '#E3F2FD' : '#f5f5f5';

                  if(!drv.samsaraVehicleId) {
                    // no vehicle => special
                    return (
                      <Grid item xs={12} sm={6} key={drv.uid}>
                        <Card
                          sx={{
                            backgroundColor:'#E3F2FD',
                            borderRadius:2,
                            minHeight:UNIFORM_CARD_MIN_HEIGHT,
                            overflow:'hidden',
                            display:'flex',
                            flexDirection:'column',
                            justifyContent:'center',
                            textAlign:'center',
                            transition:'box-shadow 0.2s, transform 0.2s',
                            ...(isSel && { boxShadow:'0 0 0 2px black' }),
                            '&:hover':{
                              boxShadow:4,
                              transform:'translateY(-2px)'
                            },
                            cursor:'default'
                          }}
                        >
                          <CardContent sx={{ p:1 }}>
                            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:1 }}>
                              <Box>
                                <Typography sx={{ ...cardTextStyle, fontWeight:'bold' }}>
                                  {drv.displayName||`${drv.firstName||''} ${drv.lastName||''}`}
                                </Typography>
                                <Typography sx={{ ...cardTextStyle, fontWeight:'bold', color:'red' }}>
                                  No Paired Vehicle
                                </Typography>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  }

                  // normal => show address in two lines
                  const lastInit= drv.lastName? drv.lastName[0].toUpperCase()+'.':'';
                  const dispName= drv.displayName || `${drv.firstName||''} ${lastInit}`;
                  const locStr= rawVeh?.gps?.[rawVeh.gps.length-1]?.reverseGeo?.formattedLocation||'';
                  const { line1: drvLine1, line2: drvLine2 }= splitAddress(locStr);

                  const assignedJobs= jobs.filter(j=>
                    j.dispatchDriver=== drv.uid &&
                    j.towstatus &&
                    !['Complete','Cancelled'].includes(j.towstatus)
                  );
                  let availabilityLabel= drv.isAvailable? 'Available':'Not Available';
                  if(!drv.isAvailable && assignedJobs.length>0) {
                    availabilityLabel= `Not Available - ${assignedJobs[0].towstatus||'In Tow'}`;
                  }
                  const assignedCount= jobs.filter(j=>{
                    if(j.dispatchDriver!== drv.uid) return false;
                    if(['Complete','Cancelled'].includes(j.towstatus)) return false;
                    if(['In Processing','Dispatch Pending','Dispatched'].includes(j.status)) return true;
                    if(j.towstatus==='In Tow') return true;
                    return false;
                  }).length;
                  const iconColor= drv.isAvailable? DRIVER_COLOR_AVAILABLE : DRIVER_COLOR_UNAVAILABLE;

                  return (
                    <Grid item xs={12} sm={6} key={drv.uid}>
                      <Card
                        sx={{
                          backgroundColor: cardBg,
                          borderRadius:2,
                          minHeight:UNIFORM_CARD_MIN_HEIGHT,
                          overflow:'hidden',
                          display:'flex',
                          flexDirection:'column',
                          justifyContent:'center',
                          textAlign:'center',
                          transition:'box-shadow 0.2s, transform 0.2s',
                          ...(isSel && { boxShadow:'0 0 0 2px black' }),
                          '&:hover':{
                            boxShadow:4,
                            transform:'translateY(-2px)'
                          },
                          cursor:'pointer'
                        }}
                        onClick={()=> handleSelectDriver(drv)}
                      >
                        <CardContent sx={{ p:1 }}>
                          <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:1 }}>
                            <DirectionsCar sx={{ fontSize:20, color:iconColor }}/>
                            <Box>
                              <Typography sx={{ ...cardTextStyle, fontWeight:'bold' }}>
                                {dispName}
                              </Typography>
                              {drvLine1 && <Typography sx={cardTextStyle}>{drvLine1}</Typography>}
                              {drvLine2 && <Typography sx={cardTextStyle}>{drvLine2}</Typography>}
                              <Typography
                                sx={{ ...cardTextStyle, fontWeight:'bold', color:drv.isAvailable?'green':'red' }}
                              >
                                {availabilityLabel}
                              </Typography>
                              {assignedCount>0 && (
                                <Typography sx={cardTextStyle}>
                                  {`Assigned Jobs: ${assignedCount}`}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          <Box sx={{ mt:1 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={drv.isAvailable}
                                  onChange={()=> handleToggleDriverAvailability(drv)}
                                />
                              }
                              label={drv.isAvailable?'Available':'Not Available'}
                              labelPlacement="end"
                              sx={{
                                m:0, p:0,
                                '.MuiFormControlLabel-label':{ fontSize:'0.75rem' }
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Grid>
        </Grid>
      </MainCard>

      {/* Snackbar => dispatch success */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={()=> setSnackbarOpen(false)}
        anchorOrigin={{ vertical:'bottom', horizontal:'center' }}
      >
        <Alert severity="success" onClose={()=> setSnackbarOpen(false)}>
          Dispatch successful! Job set to "Pending Acceptance."
        </Alert>
      </Snackbar>

      {/* Unpaired vehicle modal */}
      <Dialog
        open={unpairedModalOpen}
        onClose={()=> setUnpairedModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Unpaired Vehicle Details</DialogTitle>
        {unpairedVehicle && (
          <DialogContent dividers>
            <Box sx={{ mb:1 }}>
              <Typography variant="subtitle2">ID:</Typography>
              <Typography variant="body2">{unpairedVehicle.id}</Typography>
            </Box>
            {unpairedVehicle.name && (
              <Box sx={{ mb:1 }}>
                <Typography variant="subtitle2">Name:</Typography>
                <Typography variant="body2">{unpairedVehicle.name}</Typography>
              </Box>
            )}
            {Array.isArray(unpairedVehicle.gps) && unpairedVehicle.gps.length>0 && (()=> {
              const lastGps= unpairedVehicle.gps[unpairedVehicle.gps.length-1];
              const locStr= lastGps.reverseGeo?.formattedLocation||'';
              const { line1,line2 }= splitAddress(locStr);
              return (
                <Box sx={{ mb:1 }}>
                  <Typography variant="subtitle2">Location:</Typography>
                  {line1 && <Typography variant="body2">{line1}</Typography>}
                  {line2 && <Typography variant="body2">{line2}</Typography>}
                </Box>
              );
            })()}
            {Array.isArray(unpairedVehicle.fuelPercents) && unpairedVehicle.fuelPercents.length>0 && (
              <Box sx={{ mb:1 }}>
                <Typography variant="subtitle2">Fuel Percent:</Typography>
                <Typography variant="body2">
                  {unpairedVehicle.fuelPercents[unpairedVehicle.fuelPercents.length-1].value}%
                </Typography>
              </Box>
            )}
            <Box sx={{ mt:2 }}>
              <Typography variant="subtitle2">Pair with Driver:</Typography>
              <Select
                fullWidth
                size="small"
                value={selectedPairDriver}
                onChange={(e)=> setSelectedPairDriver(e.target.value)}
              >
                <MenuItem value="">(Select a driver)</MenuItem>
                {availableDriversForPair.map(drv=>(
                  <MenuItem key={drv.uid} value={drv.uid}>
                    {drv.displayName|| `${drv.firstName||''} ${drv.lastName||''}`}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={()=> setUnpairedModalOpen(false)}>Close</Button>
          <Button
            variant="contained"
            disabled={!selectedPairDriver}
            onClick={async()=>{
              if(!selectedPairDriver || !unpairedVehicle) return;
              try {
                const docRef= doc(db,'dispatchAvailability', selectedPairDriver);
                const snap= await getDoc(docRef);
                if(snap.exists()) {
                  await updateDoc(docRef,{
                    isAvailable:true,
                    samsaraVehicleId: unpairedVehicle.id
                  });
                } else {
                  await setDoc(docRef,{
                    isAvailable:true,
                    samsaraVehicleId: unpairedVehicle.id
                  });
                }
                setUnpairedModalOpen(false);
              } catch(err) {
                console.error('pairVehicle =>', err);
                alert(`Failed to pair vehicle: ${err.message}`);
              }
            }}
          >
            Pair
          </Button>
        </DialogActions>
      </Dialog>

      {/* Availability => multiple assigned => checkboxes */}
      <Dialog
        open={availabilityModalOpen}
        onClose={handleMultipleCancelNo}
        maxWidth="sm"
        fullWidth
      >
        {availabilityModalDriver && (
          <>
            <DialogTitle>Driver Has Multiple Assigned Jobs</DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" sx={{ mb:2 }}>
                The driver has multiple assigned jobs with a towstatus that is not Complete or Cancelled.
                Check "Cancel" next to any job you want to cancel, then press OK.
              </Typography>
              {availabilityModalDriver.jobs.map(jb=>(
                <JobCancelRow
                  key={jb.id}
                  job={jb}
                  checked={jobsToCancelSelections[jb.id]||false}
                  onChecked={(checked)=> setJobsToCancelSelections(old=>({
                    ...old,
                    [jb.id]:checked
                  }))}
                />
              ))}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleMultipleCancelNo}>Cancel</Button>
              <Button variant="contained" onClick={handleMultipleCancelOk}>
                OK
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </PageWrapper>
  );
}

/** Row in the "Driver Has Multiple Assigned Jobs" modal => user can check "Cancel" */
function JobCancelRow({ job, checked, onChecked }) {
  const receiptStr= `#${job.receiptNumber||''}`;
  return (
    <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1 }}>
      <Box sx={{ display:'flex', flexDirection:'column', gap:0.5 }}>
        <Typography variant="body2" sx={{ fontWeight:'bold' }}>
          {receiptStr}
        </Typography>
        {job.reason && (
          <Typography variant="body2">{job.reason}</Typography>
        )}
        {job.towstatus && (
          <Typography variant="body2">Towstatus: {job.towstatus}</Typography>
        )}
      </Box>
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={(e)=> onChecked(e.target.checked)}
          />
        }
        label="Cancel"
      />
    </Box>
  );
}
