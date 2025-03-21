// C:\Users\eliha\firebase\webapp\src\views\pages\towManager\TowList.jsx

import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Button,
    Checkbox,
    Chip,
    Divider,
    Fab,
    FormControlLabel,
    IconButton,
    InputAdornment,
    MenuItem,
    Popover,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
    CircularProgress,
    useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import PrintIcon from '@mui/icons-material/Print';
import AddIcon from '@mui/icons-material/Add';
import CameraAltIcon from '@mui/icons-material/CameraAlt';

import * as XLSX from 'xlsx';
import axios from 'axios';

import { db } from 'firebase.js';
import { collection, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import MainCard from 'ui-component/cards/MainCard';

import useAuth from 'hooks/useAuth';

// Additional icons for impound/destination, exports
import {
    IconFileTypeXls,
    IconParkingCircle,
    IconMapPins
} from '@tabler/icons-react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';

/* ------------------------------------------------------------------
   1) Helper Functions & Constants
------------------------------------------------------------------ */

// Default sort config
const DEFAULT_SORT_CONFIG = {
    level1Field: 'date',
    level1Dir: 'desc',
    level2Field: 'time',
    level2Dir: 'desc',
    level3Field: '',
    level3Dir: 'asc'
};

function getJsDate(dtVal) {
    if (!dtVal) return null;
    if (typeof dtVal.toDate === 'function') return dtVal.toDate();
    return new Date(dtVal);
}

// "my_type" => "My Type"
function capitalizeUnderscoreWords(str) {
    if (!str) return '';
    return str
        .replace(/_/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

// Compare for sorting
function compareVal(a, b) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

/** Return a comparable value for sorting. */
function getCompareValue(row, field) {
    if (field === 'date') {
        const d = getJsDate(row.dateTime);
        if (!d) return 0;
        return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    }
    if (field === 'time') {
        const d = getJsDate(row.dateTime);
        if (!d) return 0;
        return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    }
    if (field === 'jobType') return row.jobType || '';
    if (field === 'status') return row.status || '';
    if (field === 'receiptNumber') return row.receiptNumber || '';
    return '';
}

/** Multi-level sorting up to 3 fields. */
function multiLevelSort(arr, cfg) {
    if (!cfg.level1Field) return [...arr];
    const newArr = [...arr];
    newArr.sort((a, b) => {
        // level1
        let valA = getCompareValue(a, cfg.level1Field);
        let valB = getCompareValue(b, cfg.level1Field);
        let cmp = compareVal(valA, valB);
        if (cfg.level1Dir === 'desc') cmp = -cmp;
        if (cmp !== 0) return cmp;

        // level2
        if (cfg.level2Field) {
            valA = getCompareValue(a, cfg.level2Field);
            valB = getCompareValue(b, cfg.level2Field);
            let cmp2 = compareVal(valA, valB);
            if (cfg.level2Dir === 'desc') cmp2 = -cmp2;
            if (cmp2 !== 0) return cmp2;
        }

        // level3
        if (cfg.level3Field) {
            valA = getCompareValue(a, cfg.level3Field);
            valB = getCompareValue(b, cfg.level3Field);
            let cmp3 = compareVal(valA, valB);
            if (cfg.level3Dir === 'desc') cmp3 = -cmp3;
            return cmp3;
        }
        return 0;
    });
    return newArr;
}

/** Build a 6x7 = 42 day array for the monthly calendar. */
function buildDaysArray(baseDate) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay(); // 0=Sun..6=Sat
    const days = [];
    const dayCursor = new Date(firstOfMonth);
    dayCursor.setDate(dayCursor.getDate() - startDay);

    for (let i = 0; i < 42; i++) {
        days.push(new Date(dayCursor));
        dayCursor.setDate(dayCursor.getDate() + 1);
    }
    return days;
}

/** Minimal image resizing => ~1200px wide. */
async function resizeImage(file, maxWidth = 1200) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth) {
                    const ratio = maxWidth / width;
                    width = maxWidth;
                    height = Math.round(height * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                const byteString = atob(resizedBase64.split(',')[1]);
                const mimeString = resizedBase64.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                const blob = new Blob([ab], { type: mimeString });
                resolve(blob);
            };
            img.onerror = (err) => reject(err);
            img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

/** Convert a Blob to base64 string (without the "data:..." prefix). */
async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result.split(',')[1]);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(blob);
    });
}

/** Map of filter columns => friendly label in current-filters bar. */
const FILTER_LABEL_MAP = {
    jobType: 'Type',
    status: 'Status',
    impoundDest: 'Impound or Destination'
};

/**
 * Toggle a filter's checkbox in filterData.
 */
function toggleFilterValue(column, value, filterData, setFilterData) {
    setFilterData((prev) => {
        const newObj = { ...prev };
        const colObj = { ...newObj[column] };
        const currently = colObj[value] !== false;
        colObj[value] = !currently ? true : false;
        newObj[column] = colObj;
        return newObj;
    });
}

/**
 * We'll store jobCategories in an object keyed by doc.id. Each doc has .name.
 * We find the doc where docData.name === jobTypeName (the Tows' row.jobType).
 */
function findCategoryDocByName(jobCategoriesObj, jobTypeName) {
    return Object.values(jobCategoriesObj).find((docData) => docData.name === jobTypeName);
}

/* ------------------------------------------------------------------
   2) CalendarPopover => small date picker popover
------------------------------------------------------------------ */
function CalendarPopover({ anchorEl, onClose, onSelectDate }) {
    const [anchorRect, setAnchorRect] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(() => new Date());

    useEffect(() => {
        if (anchorEl) {
            const rect = anchorEl.getBoundingClientRect();
            setAnchorRect(rect);
        }
    }, [anchorEl]);

    const daysInGrid = buildDaysArray(currentMonth);

    const popoverStyle = {
        position: 'fixed',
        top: anchorRect ? anchorRect.bottom + 4 : 100,
        left: anchorRect ? anchorRect.left : 100,
        zIndex: 2000,
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: 4,
        padding: '8px'
    };

    function handleDayClick(day) {
        onSelectDate(day);
    }
    function goPrevMonth() {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() - 1);
        setCurrentMonth(d);
    }
    function goNextMonth() {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() + 1);
        setCurrentMonth(d);
    }
    function goToday() {
        onSelectDate(new Date());
    }

    return (
        <Box sx={popoverStyle}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <IconButton size="small" onClick={goPrevMonth}>
                    &lt;
                </IconButton>
                <Typography variant="body2" sx={{ fontWeight: 'bold', lineHeight: '32px' }}>
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </Typography>
                <IconButton size="small" onClick={goNextMonth}>
                    &gt;
                </IconButton>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 28px)', gap: '4px' }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <Typography key={d} variant="body2" align="center" sx={{ fontWeight: 'bold' }}>
                        {d}
                    </Typography>
                ))}
                {daysInGrid.map((dayObj) => {
                    const dayNum = dayObj.getDate();
                    const isSameMonth = dayObj.getMonth() === currentMonth.getMonth();
                    return (
                        <Box
                            key={dayObj.toISOString()}
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                cursor: 'pointer',
                                backgroundColor: isSameMonth ? '#eee' : 'transparent',
                                ':hover': { backgroundColor: '#ddd' },
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onClick={() => handleDayClick(dayObj)}
                        >
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                {dayNum}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>

            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                <Button size="small" onClick={goToday}>
                    Today
                </Button>
                <Button size="small" onClick={onClose}>
                    Cancel
                </Button>
            </Box>
        </Box>
    );
}

/* ------------------------------------------------------------------
   3) The main TowList component
------------------------------------------------------------------ */
export default function TowList({ user }) {
    const theme = useTheme();
    const navigate = useNavigate();
    const { user: authUser } = useAuth();
    const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

    // Ensure user is valid
    const hasValidUser = Boolean(authUser?.firebaseUser);
    if (!hasValidUser) {
        return (
            <MainCard>
                <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 2 }}>Checking authorization...</Typography>
                </Box>
            </MainCard>
        );
    }

    // Firestore data
    const [allTows, setAllTows] = useState([]);
    const [statusDocs, setStatusDocs] = useState([]);
    const [jobCategoriesLookup, setJobCategoriesLookup] = useState({});

    // Filters & sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [filterData, setFilterData] = useState({
        jobType: {},
        status: {},
        impoundDest: {}
    });
    const [statusBarFilter, setStatusBarFilter] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [sortConfig, setSortConfig] = useState(DEFAULT_SORT_CONFIG);

    // Filtered list
    const [filtered, setFiltered] = useState([]);

    // Pagination
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [page, setPage] = useState(0);

    // Expandable rows
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [allExpanded, setAllExpanded] = useState(false);

    // Status counts
    const [statusCounts, setStatusCounts] = useState({});

    // Filter popover
    const [anchorFilter, setAnchorFilter] = useState(null);

    // For uniform status-card widths
    const statusCardRefs = useRef([]);
    const [maxStatusCardWidth, setMaxStatusCardWidth] = useState(100);

    // For chip minWidth
    const [chipMinWidth, setChipMinWidth] = useState(80);

    // VIN scanning
    const fileInputRef = useRef(null);
    const [scannerLoading, setScannerLoading] = useState(false);
    const [scannerMessage, setScannerMessage] = useState('');

    // environment
    const apiUrl = import.meta.env.VITE_APP_API_URL || '';
    async function getAuthHeaders() {
        const fbUser = authUser?.firebaseUser;
        if (!fbUser) return {};
        const token = await fbUser.getIdToken(true);
        return { Authorization: `Bearer ${token}` };
    }

    /* ------------------------------------------------------------------
       3.1) Firestore Snapshots
    ------------------------------------------------------------------ */
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'tows'), (snap) => {
            const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setAllTows(arr);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'towstatus'), (snap) => {
            const arr = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
                order: Number(d.data().order || 999)
            }));
            arr.sort((a, b) => a.order - b.order);
            setStatusDocs(arr);
        });
        return () => unsub();
    }, []);

    // jobCategories => doc.id => doc.data(), doc.data().name might be "Contract Account"
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'jobCategories'), (snap) => {
            const map = {};
            snap.docs.forEach((doc) => {
                map[doc.id] = doc.data();
            });
            setJobCategoriesLookup(map);
        });
        return () => unsub();
    }, []);

    /* ------------------------------------------------------------------
       3.2) Build filter data => jobType, status, impoundDest
    ------------------------------------------------------------------ */
    useEffect(() => {
        const jTypes = {};
        const stats = {};
        const impD = {};

        allTows.forEach((t) => {
            if (t.jobType) {
                jTypes[t.jobType] = true;
            }
            if (t.status) {
                stats[t.status] = true;
            }
            // find doc => doc.name === t.jobType => check impound
            const catDoc = findCategoryDocByName(jobCategoriesLookup, t.jobType);
            const isImpound = catDoc?.impound === true;
            const key = isImpound ? 'IMP' : 'DEST';
            impD[key] = true;
        });

        setFilterData({ jobType: jTypes, status: stats, impoundDest: impD });
    }, [allTows, jobCategoriesLookup]);

    /* ------------------------------------------------------------------
       3.3) Compute statusCounts
    ------------------------------------------------------------------ */
    useEffect(() => {
        const counts = {};
        statusDocs.forEach((sd) => {
            counts[sd.id] = 0;
        });
        allTows.forEach((t) => {
            const st = t.status || 'Unknown';
            if (!counts[st]) counts[st] = 0;
            counts[st] += 1;
        });
        setStatusCounts(counts);
    }, [allTows, statusDocs]);

    // find longest status => chipMinWidth
    useEffect(() => {
        let maxLen = 0;
        statusDocs.forEach((sd) => {
            if (sd.id.length > maxLen) maxLen = sd.id.length;
        });
        const guessPx = maxLen * 8 + 30;
        setChipMinWidth(Math.max(80, guessPx));
    }, [statusDocs]);

    /* ------------------------------------------------------------------
       3.4) Filter + search + dateRange + sort => produce "filtered"
    ------------------------------------------------------------------ */
    useEffect(() => {
        let arr = [...allTows];

        // A) statusBarFilter
        if (statusBarFilter) {
            arr = arr.filter((x) => x.status === statusBarFilter);
        }

        // B) filterData => jobType, status, impoundDest
        Object.keys(filterData).forEach((col) => {
            const offVals = Object.keys(filterData[col]).filter((k) => filterData[col][k] === false);
            if (offVals.length > 0) {
                if (col === 'impoundDest') {
                    arr = arr.filter((row) => {
                        const catDoc = findCategoryDocByName(jobCategoriesLookup, row.jobType);
                        const isImp = catDoc?.impound === true;
                        const rowVal = isImp ? 'IMP' : 'DEST';
                        return !offVals.includes(rowVal);
                    });
                } else {
                    arr = arr.filter((row) => {
                        const rowVal = row[col] || '';
                        return !offVals.includes(rowVal);
                    });
                }
            }
        });

        // C) searchTerm => multiple fields
        if (searchTerm.trim()) {
            const low = searchTerm.toLowerCase();
            arr = arr.filter((tow) => {
                const dt = getJsDate(tow.dateTime);
                let dateStr = '';
                let timeStr = '';
                if (dt) {
                    dateStr = `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
                    timeStr = dt.toLocaleTimeString([], { hour12: true });
                }
                const fields = [
                    tow.receiptNumber,
                    tow.jobType,
                    tow.status,
                    dateStr,
                    timeStr,
                    tow.vehicleInfo?.vin,
                    tow.vehicleInfo?.make,
                    tow.vehicleInfo?.model
                ]
                    .map((v) => (v || '').toLowerCase())
                    .join(' ');
                return fields.includes(low);
            });
        }

        // D) dateRange
        if (startDate || endDate) {
            arr = arr.filter((tow) => {
                const dt = getJsDate(tow.dateTime);
                if (!dt) return false;
                if (startDate && dt < startDate) return false;
                if (endDate && dt > endDate) return false;
                return true;
            });
        }

        // E) sort => multi-level
        arr = multiLevelSort(arr, sortConfig);

        setFiltered(arr);
        setPage(0);
    }, [
        allTows,
        statusBarFilter,
        filterData,
        jobCategoriesLookup,
        searchTerm,
        sortConfig,
        startDate,
        endDate
    ]);

    // measure widest status card
    useEffect(() => {
        let maxW = 110;
        statusCardRefs.current.forEach((el) => {
            if (el && el.offsetWidth > maxW) {
                maxW = el.offsetWidth;
            }
        });
        setMaxStatusCardWidth(maxW);
    }, [statusDocs, statusCounts]);

    /* ------------------------------------------------------------------
       3.5) VIN scanning
    ------------------------------------------------------------------ */
    function handleVinScanClick() {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    }

    async function handleVinFileSelected(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setScannerLoading(true);
            setScannerMessage('Resizing image...');
            const resizedBlob = await resizeImage(file, 1200);

            setScannerMessage('Scanning VIN...');
            const base64Image = await blobToBase64(resizedBlob);

            const headers = await getAuthHeaders();
            const resp = await axios.post(`${apiUrl}/ocrVin`, { base64Image }, { headers });
            const dataObj = resp.data?.data;
            if (!dataObj || !dataObj.vin) {
                throw new Error('No valid VIN found in the image.');
            }
            setSearchTerm(dataObj.vin);

            setScannerMessage(`VIN: ${dataObj.vin}`);
        } catch (err) {
            console.error('VIN scan error:', err);
            alert('Failed to scan VIN. Make sure the photo is clear.');
        } finally {
            setScannerLoading(false);
            setTimeout(() => setScannerMessage(''), 3000);
        }
    }

    /* ------------------------------------------------------------------
       3.6) Table, pagination, printing
    ------------------------------------------------------------------ */
    const totalRows = filtered.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const visible = filtered.slice(startIndex, endIndex);
    const hidePagination = totalRows < 25;

    function buildPageArray() {
        const pages = [];
        const maxPageToShow = 5;
        const s = Math.max(0, page - 2);
        const e = Math.min(totalPages, s + maxPageToShow);
        for (let i = s; i < e; i++) {
            pages.push(i);
        }
        return pages;
    }

    function handlePrint() {
        window.print();
    }

    function handleExportAll() {
        const data = filtered.map((row) => {
            const dt = getJsDate(row.dateTime);
            let dateStr = '';
            let timeStr = '';
            if (dt) {
                dateStr = `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
                timeStr = dt.toLocaleTimeString([], {
                    hour12: true,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }
            const jobID = row.receiptNumber || row.id;
            const jType = capitalizeUnderscoreWords(row.jobType || '');
            const st = row.status || '';

            let yearMakeModel = '';
            let vin6 = '';
            if (row.vehicleInfo) {
                const { year, make, model, vin } = row.vehicleInfo;
                yearMakeModel = `${year || ''} ${make || ''} ${model || ''}`.trim();
                if (vin && vin.length >= 6) {
                    vin6 = vin.slice(-6);
                }
            }

            return {
                ID: jobID,
                Date: dateStr,
                Time: timeStr,
                'Job Type': jType,
                Vehicle: yearMakeModel,
                'VIN Last6': vin6,
                Status: st
            };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TowJobs');
        XLSX.writeFile(wb, 'TowJobs.xlsx');
    }

    function handleRowClick(row) {
        navigate(`/tow-jobs/${row.id}`);
    }

    function toggleRowExpansion(rowId) {
        setExpandedRows((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(rowId)) {
                newSet.delete(rowId);
            } else {
                newSet.add(rowId);
            }
            return newSet;
        });
    }

    function handleToggleAllRows() {
        if (!allExpanded) {
            const allIds = new Set(filtered.map((f) => f.id));
            setExpandedRows(allIds);
            setAllExpanded(true);
        } else {
            setExpandedRows(new Set());
            setAllExpanded(false);
        }
    }

    function handleStatusClick(st) {
        if (!statusCounts[st]) return;
        setStatusBarFilter(st);
    }

    function resetToDefaultFilters() {
        setSearchTerm('');
        setStatusBarFilter('');
        setSortConfig(DEFAULT_SORT_CONFIG);
        setStartDate(null);
        setEndDate(null);
        setExpandedRows(new Set());
        setAllExpanded(false);

        setFilterData((prev) => {
            const newFd = { ...prev };
            Object.keys(newFd).forEach((col) => {
                Object.keys(newFd[col]).forEach((k) => {
                    newFd[col][k] = true;
                });
            });
            return newFd;
        });
    }

    function handleClearAllFilters() {
        resetToDefaultFilters();
    }

    function handleColumnHeaderClick(field) {
        if (sortConfig.level1Field === field) {
            const newDir = sortConfig.level1Dir === 'asc' ? 'desc' : 'asc';
            setSortConfig((prev) => ({ ...prev, level1Dir: newDir }));
            return;
        }
        setSortConfig({
            level1Field: field,
            level1Dir: 'asc',
            level2Field: '',
            level2Dir: 'asc',
            level3Field: '',
            level3Dir: 'asc'
        });
    }

    function highlightSearch(str) {
        if (!str) return '';
        if (!searchTerm.trim()) return str;
        const lower = str.toLowerCase();
        const lowSearch = searchTerm.toLowerCase();
        const idx = lower.indexOf(lowSearch);
        if (idx === -1) return str;
        const pre = str.slice(0, idx);
        const match = str.slice(idx, idx + searchTerm.length);
        const post = str.slice(idx + searchTerm.length);
        return (
            <span>
                {pre}
                <mark className="search-highlight">{match}</mark>
                {post}
            </span>
        );
    }

    /* ------------------------------------------------------------------
       3.7) Row Rendering (desktop & mobile)
    ------------------------------------------------------------------ */
    function findImpoundIcon(row) {
        // search doc => docData.name === row.jobType
        const catDoc = findCategoryDocByName(jobCategoriesLookup, row.jobType);
        const isImpound = catDoc?.impound === true;
        return {
            isImpound,
            icon: isImpound ? <IconParkingCircle size={20} /> : <IconMapPins size={20} />,
            tooltip: isImpound ? 'Impound' : 'Destination Tow'
        };
    }

    function renderRowDesktop(row, idx) {
        const isExpanded = expandedRows.has(row.id);

        const dt = getJsDate(row.dateTime);
        let dateStr = '';
        let timeStr = '';
        if (dt) {
            dateStr = `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
            timeStr = dt.toLocaleTimeString([], { hour12: true });
        }
        const jobID = row.receiptNumber || row.id;
        const jTypeRaw = row.jobType;
        const jType = capitalizeUnderscoreWords(jTypeRaw);

        const { isImpound, icon: categoryIcon, tooltip: catTooltip } = findImpoundIcon(row);

        let vehicleLine1 = '';
        let vehicleLine2 = '';
        if (row.vehicleInfo) {
            const { year, make, model, vin } = row.vehicleInfo;
            vehicleLine1 = `${year || ''} ${make || ''}`.trim();
            let vin6 = '';
            if (vin && vin.length >= 6) {
                vin6 = vin.slice(-6);
            }
            vehicleLine2 = `${model || ''} ${vin6 ? '(' + vin6 + ')' : ''}`.trim();
        }

        const st = row.status || '';
        const sd = statusDocs.find((x) => x.id === st);
        const stColor = sd?.color || '#999';

        const chipStyle = {
            fontWeight: 'bold',
            color: '#fff',
            minWidth: chipMinWidth,
            display: 'inline-flex',
            justifyContent: 'center',
            height: '24px',
            backgroundColor: stColor
        };

        return (
            <React.Fragment key={row.id}>
                <tr className="desktop-row" style={{ cursor: 'pointer' }}>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpansion(row.id);
                            }}
                        >
                            {isExpanded ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                        </IconButton>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }} onClick={() => handleRowClick(row)}>
                        <Tooltip title={catTooltip}>
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                {categoryIcon}
                            </Box>
                        </Tooltip>
                    </td>
                    <td style={tdStyle} onClick={() => handleRowClick(row)}>
                        {highlightSearch(jobID)}
                    </td>
                    <td style={tdStyle} onClick={() => handleRowClick(row)}>
                        {highlightSearch(dateStr)}
                    </td>
                    <td style={tdStyle} onClick={() => handleRowClick(row)}>
                        {highlightSearch(timeStr)}
                    </td>
                    <td style={tdStyle} onClick={() => handleRowClick(row)}>
                        {highlightSearch(jType)}
                    </td>
                    <td style={tdStyle} onClick={() => handleRowClick(row)}>
                        <Box>
                            <div>{highlightSearch(vehicleLine1)}</div>
                            <div>{highlightSearch(vehicleLine2)}</div>
                        </Box>
                    </td>
                    <td style={tdStyle} onClick={() => handleRowClick(row)}>
                        <Chip label={st} size="small" sx={chipStyle} />
                    </td>
                </tr>

                {isExpanded && (
                    <tr>
                        <td colSpan={8} style={{ padding: '12px', borderBottom: '1px solid #ccc', textAlign: 'center' }}>
                            <Box sx={{ display: 'inline-flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                                <Typography variant="body2">
                                    <strong>From:</strong> {row.pickupLocation?.address || '(no pickup)'}
                                </Typography>
                                <Typography variant="body2">
                                    <strong>To:</strong> {row.dropoffLocation?.address || '(no dropoff)'}
                                </Typography>
                                <Box>
                                    <Button variant="contained" size="small" onClick={() => handleRowClick(row)}>
                                        View
                                    </Button>
                                </Box>
                            </Box>
                        </td>
                    </tr>
                )}
            </React.Fragment>
        );
    }

    function renderRowMobile(row, idx) {
        const dt = getJsDate(row.dateTime);
        let dateStr = '';
        let timeStr = '';
        if (dt) {
            dateStr = `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
            timeStr = dt.toLocaleTimeString([], { hour12: true });
        }
        const jobID = row.receiptNumber || row.id;
        const jTypeRaw = row.jobType;
        const jType = capitalizeUnderscoreWords(jTypeRaw);

        const { isImpound, icon: categoryIcon, tooltip: catTooltip } = findImpoundIcon(row);

        let vehicleLine1 = '';
        let vehicleLine2 = '';
        if (row.vehicleInfo) {
            const { year, make, model, vin } = row.vehicleInfo;
            vehicleLine1 = `${year || ''} ${make || ''}`.trim();
            let vin6 = '';
            if (vin && vin.length >= 6) {
                vin6 = vin.slice(-6);
            }
            vehicleLine2 = `${model || ''} ${vin6 ? '(' + vin6 + ')' : ''}`.trim();
        }

        const st = row.status || '';
        const sd = statusDocs.find((x) => x.id === st);
        const stColor = sd?.color || '#999';

        const chipStyle = {
            fontWeight: 'bold',
            color: '#fff',
            minWidth: chipMinWidth,
            display: 'inline-flex',
            justifyContent: 'center',
            height: '24px',
            backgroundColor: stColor
        };

        return (
            <Box
                key={row.id}
                sx={{
                    mb: 1,
                    p: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    textAlign: 'center',
                    boxShadow: theme.shadows[1],
                    border: '1px solid #ccc',
                    '&:hover': { boxShadow: theme.shadows[4] }
                }}
                onClick={() => handleRowClick(row)}
            >
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                    <Tooltip title={catTooltip}>
                        <Box>{categoryIcon}</Box>
                    </Tooltip>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    ID: <span style={{ fontWeight: 400 }}>{highlightSearch(jobID)}</span>
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Date: <span style={{ fontWeight: 400 }}>{highlightSearch(dateStr)}</span>
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Time: <span style={{ fontWeight: 400 }}>{highlightSearch(timeStr)}</span>
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Type: <span style={{ fontWeight: 400 }}>{highlightSearch(jType)}</span>
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Vehicle:
                </Typography>
                <Typography variant="body2">{highlightSearch(vehicleLine1)}</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                    {highlightSearch(vehicleLine2)}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                    <Chip label={st} size="small" sx={chipStyle} />
                </Box>
            </Box>
        );
    }

    /* ------------------------------------------------------------------
       3.8) Filter Popover => date range, sorting, checkboxes
    ------------------------------------------------------------------ */
    function renderFilterPopover() {
        const open = Boolean(anchorFilter);
        const [dateFieldTarget, setDateFieldTarget] = useState(null);

        function handleClose() {
            setAnchorFilter(null);
        }
        function handleSortField(level, field) {
            setSortConfig((prev) => ({ ...prev, [`level${level}Field`]: field }));
        }
        function handleSortDir(level, dir) {
            setSortConfig((prev) => ({ ...prev, [`level${level}Dir`]: dir }));
        }

        function buildChecks(col) {
            if (!filterData[col]) return null;
            const sortedKeys = Object.keys(filterData[col]).sort();
            return (
                <Box sx={{ pl: 1, backgroundColor: '#ecf7ff' }}>
                    {sortedKeys.map((val) => {
                        let label = capitalizeUnderscoreWords(val);
                        if (col === 'impoundDest') {
                            label = val === 'IMP' ? 'Impound' : 'Destination';
                        }
                        const checked = filterData[col][val] !== false;
                        return (
                            <Box key={`${col}-${val}`} sx={{ mb: 0 }}>
                                <FormControlLabel
                                    label={label}
                                    sx={{ m: 0 }}
                                    control={
                                        <Checkbox
                                            size="small"
                                            sx={{ p: 0.5 }}
                                            checked={checked}
                                            onChange={() => toggleFilterValue(col, val, filterData, setFilterData)}
                                        />
                                    }
                                />
                            </Box>
                        );
                    })}
                </Box>
            );
        }

        return (
            <Popover
                open={open}
                anchorEl={anchorFilter}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                sx={{ zIndex: 1300 }}
            >
                <Box sx={{ p: 2, width: isSmall ? 220 : 300 }}>
                    <Typography variant="h6" sx={{ textAlign: 'center', mb: 1 }}>
                        Filters
                    </Typography>
                    <Divider sx={{ mb: 1 }} />

                    {/* Sorting => 1,2,3 => widen ASC/DESC */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
                        {/* Level 1 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ width: 15, fontWeight: 'bold' }}>
                                1
                            </Typography>
                            <Select
                                size="small"
                                sx={{ width: 100 }}
                                value={sortConfig.level1Field}
                                onChange={(e) => handleSortField(1, e.target.value)}
                            >
                                <MenuItem value="">(none)</MenuItem>
                                <MenuItem value="date">Date</MenuItem>
                                <MenuItem value="time">Time</MenuItem>
                                <MenuItem value="receiptNumber">ID</MenuItem>
                                <MenuItem value="jobType">Type</MenuItem>
                                <MenuItem value="status">Status</MenuItem>
                            </Select>
                            <Select
                                size="small"
                                sx={{ width: 90 }}
                                value={sortConfig.level1Dir}
                                onChange={(e) => handleSortDir(1, e.target.value)}
                            >
                                <MenuItem value="asc">ASC</MenuItem>
                                <MenuItem value="desc">DESC</MenuItem>
                            </Select>
                        </Box>

                        {/* Level 2 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ width: 15, fontWeight: 'bold' }}>
                                2
                            </Typography>
                            <Select
                                size="small"
                                sx={{ width: 100 }}
                                value={sortConfig.level2Field}
                                onChange={(e) => handleSortField(2, e.target.value)}
                            >
                                <MenuItem value="">(none)</MenuItem>
                                <MenuItem value="date">Date</MenuItem>
                                <MenuItem value="time">Time</MenuItem>
                                <MenuItem value="receiptNumber">ID</MenuItem>
                                <MenuItem value="jobType">Type</MenuItem>
                                <MenuItem value="status">Status</MenuItem>
                            </Select>
                            <Select
                                size="small"
                                sx={{ width: 90 }}
                                value={sortConfig.level2Dir}
                                onChange={(e) => handleSortDir(2, e.target.value)}
                            >
                                <MenuItem value="asc">ASC</MenuItem>
                                <MenuItem value="desc">DESC</MenuItem>
                            </Select>
                        </Box>

                        {/* Level 3 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ width: 15, fontWeight: 'bold' }}>
                                3
                            </Typography>
                            <Select
                                size="small"
                                sx={{ width: 100 }}
                                value={sortConfig.level3Field}
                                onChange={(e) => handleSortField(3, e.target.value)}
                            >
                                <MenuItem value="">(none)</MenuItem>
                                <MenuItem value="date">Date</MenuItem>
                                <MenuItem value="time">Time</MenuItem>
                                <MenuItem value="receiptNumber">ID</MenuItem>
                                <MenuItem value="jobType">Type</MenuItem>
                                <MenuItem value="status">Status</MenuItem>
                            </Select>
                            <Select
                                size="small"
                                sx={{ width: 90 }}
                                value={sortConfig.level3Dir}
                                onChange={(e) => handleSortDir(3, e.target.value)}
                            >
                                <MenuItem value="asc">ASC</MenuItem>
                                <MenuItem value="desc">DESC</MenuItem>
                            </Select>
                        </Box>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    {/* Date Range => bold */}
                    <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                        Date Range
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mt: 1, mb: 1 }}>
                        <TextField
                            label="Start"
                            size="small"
                            value={startDate ? startDate.toLocaleDateString() : ''}
                            onClick={(e) => {
                                e.stopPropagation();
                                setDateFieldTarget('start');
                            }}
                            sx={{ cursor: 'pointer' }}
                        />
                        <TextField
                            label="End"
                            size="small"
                            value={endDate ? endDate.toLocaleDateString() : ''}
                            onClick={(e) => {
                                e.stopPropagation();
                                setDateFieldTarget('end');
                            }}
                            sx={{ cursor: 'pointer' }}
                        />
                    </Stack>

                    <Divider sx={{ my: 1 }} />

                    {/* Filter sections => bold headers */}
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        Type
                    </Typography>
                    {buildChecks('jobType')}

                    <Box sx={{ mt: 1 }} />
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        Status
                    </Typography>
                    {buildChecks('status')}

                    <Box sx={{ mt: 1 }} />
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        Impound or Destination
                    </Typography>
                    {buildChecks('impoundDest')}

                    <Divider sx={{ my: 1 }} />
                    <Button variant="outlined" size="small" onClick={handleClearAllFilters} fullWidth>
                        Clear All
                    </Button>
                </Box>

                {/* mini calendar popover for picking start/end dates */}
                {dateFieldTarget && (
                    <CalendarPopover
                        anchorEl={anchorFilter}
                        onClose={() => setDateFieldTarget(null)}
                        onSelectDate={(selectedDate) => {
                            if (dateFieldTarget === 'start') {
                                setStartDate(selectedDate);
                            } else {
                                setEndDate(selectedDate);
                            }
                            setDateFieldTarget(null);
                        }}
                    />
                )}
            </Popover>
        );
    }

    /* ------------------------------------------------------------------
       3.9) Show current filters (No doc lookups => no crash!)
    ------------------------------------------------------------------ */
    function getActiveFilterDescriptions() {
        const out = [];

        // If user typed in searchTerm
        if (searchTerm.trim()) {
            out.push(`Search: "${searchTerm}"`);
        }
        // If user clicked a status card
        if (statusBarFilter) {
            out.push(`Status: ${statusBarFilter}`);
        }

        // Now we check filterData => jobType, status, impoundDest
        Object.keys(filterData).forEach((col) => {
            const colObj = filterData[col];
            if (!colObj) return;
            // how many possible keys?
            const totalCount = Object.keys(colObj).length;
            // which keys are turned on?
            const onVals = Object.keys(colObj).filter((k) => colObj[k] !== false);

            // if user turned something off => onVals < totalCount => we add to display
            if (onVals.length < totalCount) {
                // e.g. Type => "Contract Account"
                const label = FILTER_LABEL_MAP[col] || col;
                let finalDisplay = onVals.join(', ');
                if (col === 'impoundDest') {
                    // transform "IMP" => "Impound", "DEST" => "Destination"
                    const mapped = onVals.map((v) => (v === 'IMP' ? 'Impound' : 'Destination'));
                    finalDisplay = mapped.join(', ');
                }
                out.push(`${label}: ${finalDisplay}`);
            }
        });

        // If user set a date range
        if (startDate) out.push(`Start Date: ${startDate.toLocaleDateString()}`);
        if (endDate) out.push(`End Date: ${endDate.toLocaleDateString()}`);

        // If user changed the sort from default
        if (JSON.stringify(sortConfig) !== JSON.stringify(DEFAULT_SORT_CONFIG)) {
            const {
                level1Field, level1Dir,
                level2Field, level2Dir,
                level3Field, level3Dir
            } = sortConfig;
            let sortDesc = `Sort: ${level1Field} ${level1Dir}`;
            if (level2Field) sortDesc += `, ${level2Field} ${level2Dir}`;
            if (level3Field) sortDesc += `, ${level3Field} ${level3Dir}`;
            out.push(sortDesc);
        }

        return out;
    }

    function renderCurrentFiltersBar() {
        const active = getActiveFilterDescriptions();
        if (active.length === 0) return null; // nothing to show
        return (
            <Box sx={{ p: 1, textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mr: 1 }}>
                    Filters:
                </Typography>
                <Typography variant="body2" sx={{ display: 'inline' }}>
                    {active.join(' | ')}
                </Typography>
                <Box sx={{ ml: 2 }}>
                    <Button variant="outlined" size="small" onClick={resetToDefaultFilters}>
                        Reset
                    </Button>
                </Box>
            </Box>
        );
    }

    /* ------------------------------------------------------------------
       3.10) Pagination
    ------------------------------------------------------------------ */
    function renderPaginationRow(which) {
        if (hidePagination) return null;
        const pages = (() => {
            const arr = [];
            const maxPageToShow = 5;
            const s = Math.max(0, page - 2);
            const e = Math.min(totalPages, s + maxPageToShow);
            for (let i = s; i < e; i++) arr.push(i);
            return arr;
        })();
        if (pages.length < 1 && totalPages <= 1) return null;

        return (
            <Box
                className={`pagination-row-${which}`}
                sx={{
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    gap: 2
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>
                        Rows
                    </Typography>
                    <Select
                        size="small"
                        value={rowsPerPage}
                        onChange={(e) => {
                            const val = +e.target.value;
                            setRowsPerPage(val);
                            setPage(0);
                        }}
                    >
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                    </Select>
                </Box>

                {pages.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button size="small" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                            Prev
                        </Button>
                        {pages.map((p) => (
                            <Button
                                key={`pg-${p}`}
                                size="small"
                                variant={p === page ? 'contained' : 'outlined'}
                                onClick={() => setPage(p)}
                                sx={{ minWidth: 32 }}
                            >
                                {p + 1}
                            </Button>
                        ))}
                        <Button
                            size="small"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        >
                            Next
                        </Button>
                    </Box>
                )}

                <Typography variant="body2">
                    {startIndex + 1} - {Math.min(endIndex, totalRows)} of {totalRows}
                </Typography>
            </Box>
        );
    }

    /* ------------------------------------------------------------------
       4) Render the entire page
    ------------------------------------------------------------------ */
    const printStyles = `
@media print {
  .fab-add-button,
  .pagination-row-top,
  .pagination-row-bottom,
  .layout-sidebar,
  .layout-header,
  .MuiDrawer-root,
  .MuiAppBar-root,
  .btn-export-all,
  .filter-row {
    display: none !important;
  }
  .layout-content {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
  }
}

mark.search-highlight {
  background-color: #ffeb3b;
}

.desktop-row:hover {
  background-color: #e0f5ff !important;
}

thead.sticky-head th {
  position: sticky;
  top: 0;
  z-index: 2;
  background-color: ${theme.palette.action.selected};
}
`;

    return (
        <MainCard content={false} sx={{ position: 'relative', textAlign: 'center' }}>
            <style>{printStyles}</style>

            {/* Hidden file input => VIN scanning */}
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleVinFileSelected}
            />

            {/* Title & top bar */}
            <Box
                sx={{
                    p: 2,
                    pb: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <Typography variant="h4" sx={{ mb: 1 }}>
                    Tow Manager
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Print">
                        <IconButton onClick={handlePrint}>
                            <PrintIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Export All">
                        <IconButton onClick={handleExportAll} className="btn-export-all">
                            <IconFileTypeXls size={20} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Status cards */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', p: 1 }}>
                {statusDocs.map((sd, idx) => {
                    const label = sd.id;
                    const ccount = statusCounts[label] || 0;
                    if (!ccount) return null;
                    const isFiltered = label === statusBarFilter;
                    return (
                        <Box
                            key={label}
                            ref={(el) => (statusCardRefs.current[idx] = el)}
                            onClick={() => handleStatusClick(label)}
                            sx={{
                                width: maxStatusCardWidth,
                                p: 1,
                                textAlign: 'center',
                                borderRadius: 1,
                                boxShadow: theme.shadows[2],
                                backgroundColor: isFiltered ? '#f0f0f0' : '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': { boxShadow: theme.shadows[4] }
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ color: '#666' }}>
                                {label}
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', lineHeight: 1.1 }}>
                                {ccount}
                            </Typography>
                            <Box
                                sx={{
                                    height: 6,
                                    backgroundColor: sd.color || '#999',
                                    mt: 1,
                                    borderRadius: 1
                                }}
                            />
                        </Box>
                    );
                })}
            </Box>

            {/* Search & Filter row */}
            <Box
                className="filter-row"
                sx={{
                    p: 1,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <Box sx={{ flexGrow: 1, maxWidth: 200 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: 20 }} />
                                </InputAdornment>
                            )
                        }}
                    />
                </Box>

                {/* VIN Scanner */}
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CameraAltIcon />}
                    onClick={handleVinScanClick}
                    sx={{ textTransform: 'none', display: 'flex', alignItems: 'center' }}
                >
                    VIN Scanner
                </Button>

                {/* Filter icon => anchorFilter */}
                <Tooltip title="Filters & Sort">
                    <IconButton
                        sx={{ width: 40, height: 40 }}
                        onClick={(e) => setAnchorFilter(e.currentTarget)}
                    >
                        <FilterListIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Show scanning status if needed */}
            {scannerLoading && (
                <Box sx={{ textAlign: 'center', mt: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2">{scannerMessage || 'Scanning...'}</Typography>
                </Box>
            )}
            {!scannerLoading && scannerMessage && (
                <Typography variant="body2" sx={{ textAlign: 'center', mt: 1 }}>
                    {scannerMessage}
                </Typography>
            )}

            {/* Current filters */}
            {renderCurrentFiltersBar()}

            {/* pagination row top */}
            {renderPaginationRow('top')}

            {/* filter popover */}
            {renderFilterPopover()}

            {/* Tows table or mobile cards */}
            {isSmall ? (
                <Box sx={{ px: 1 }}>
                    {visible.map((row, i) => renderRowMobile(row, i + startIndex))}
                    {visible.length === 0 && (
                        <Typography variant="body2" sx={{ textAlign: 'center', mt: 2 }}>
                            No records found
                        </Typography>
                    )}
                </Box>
            ) : (
                <Box
                    sx={{
                        overflowX: 'auto',
                        borderRadius: 0,
                        overflow: 'hidden',
                        backgroundColor: '#fff'
                    }}
                >
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                        <thead className="sticky-head">
                            <tr style={{ borderBottom: '1px solid #ccc' }}>
                                {/* Expand/Minimize all */}
                                <th style={{ width: '40px', textAlign: 'center' }}>
                                    <Tooltip title={allExpanded ? 'Minimize All' : 'Expand All'}>
                                        <IconButton onClick={handleToggleAllRows}>
                                            {allExpanded ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                                        </IconButton>
                                    </Tooltip>
                                </th>
                                {/* Impound/dest icon col => no header */}
                                <th style={{ width: '40px', textAlign: 'center' }} />

                                <th style={headTd} onClick={() => handleColumnHeaderClick('receiptNumber')}>
                                    ID
                                </th>
                                <th style={headTd} onClick={() => handleColumnHeaderClick('date')}>
                                    Date
                                </th>
                                <th style={headTd} onClick={() => handleColumnHeaderClick('time')}>
                                    Time
                                </th>
                                <th style={headTd} onClick={() => handleColumnHeaderClick('jobType')}>
                                    Type
                                </th>
                                <th style={headTd}>Vehicle</th>
                                <th style={headTd} onClick={() => handleColumnHeaderClick('status')}>
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((row, i) => renderRowDesktop(row, i + startIndex))}
                            {visible.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '8px' }}>
                                        No records found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </Box>
            )}

            {/* pagination row bottom */}
            {renderPaginationRow('bottom')}

            {/* floating add button */}
            <Tooltip title="Add Tow Job">
                <Fab
                    className="fab-add-button"
                    color="primary"
                    sx={{ position: 'fixed', bottom: 32, right: 32 }}
                    onClick={() => navigate('/tow-jobs/new')}
                >
                    <AddIcon />
                </Fab>
            </Tooltip>
        </MainCard>
    );
}

TowList.propTypes = {
    user: PropTypes.object
};

/* ------------------------------------------------------------------
   5) Table Column Styling
------------------------------------------------------------------ */
const headTd = {
    padding: '6px',
    textAlign: 'center',
    fontWeight: 'bold',
    cursor: 'pointer',
    position: 'relative',
    borderLeft: 'none',
    borderRight: 'none'
};

const tdStyle = {
    padding: '6px',
    textAlign: 'center',
    verticalAlign: 'middle',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: '1px solid #ccc'
};
