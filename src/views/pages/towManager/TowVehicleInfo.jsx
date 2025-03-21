// C:\Users\eliha\firebase\webapp\src\views\pages\towManager\TowVehicleInfo.jsx

import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle
} from 'react';
import {
  Grid,
  TextField,
  Typography,
  Button,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Card,
  CardContent,
  CardMedia,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useMediaQuery,
  FormControlLabel,
  Switch,
  Tooltip,
  LinearProgress
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  IconCamera,
  IconCarCrash,
  IconTrash,
  IconPencil,
  IconPlus,
  IconArrowLeft,
  IconArrowRight,
  IconZoomIn,
  IconZoomOut,
  IconDownload
} from '@tabler/icons-react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axios from 'axios';

import {
  Stage,
  Layer,
  Image as KonvaImage,
  Circle,
  Line as KonvaLine,
  Tag as KonvaTag,
  Text as KonvaText,
  Group as KonvaGroup
} from 'react-konva';
import useImage from 'use-image';
import { useForm } from 'react-hook-form';

import MainCard from 'ui-component/cards/MainCard';
import useAuth from 'hooks/useAuth';

// Firebase Storage
import { storage } from 'firebase.js';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from 'firebase/storage';

// Car outline image
import carOutlineImg from '../../../assets/images/car_outline.png';

/* ------------------------------------------------------------------
   1) Constants / Helpers
------------------------------------------------------------------ */

/** Minimal deep equality check via JSON */
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Resize image => ~1200px wide, preserving aspect ratio. */
function resizeImage(file, maxWidth = 1200) {
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

/** Hook for loading an image (base64 or URL) into a Konva Image node. */
function useBase64KonvaImage(base64OrUrl) {
  const [image] = useImage(base64OrUrl || '');
  return image;
}

function CarOutlineImage({ src, width, height }) {
  const [image] = useImage(src);
  return <KonvaImage image={image} width={width} height={height} listening={false} />;
}

/** Check if a point is inside a polygon using raycasting. */
function isPointInPolygon(x, y, polygonPoints) {
  let inside = false;
  for (let i = 0, j = polygonPoints.length - 2; i < polygonPoints.length; i += 2) {
    const xi = polygonPoints[i];
    const yi = polygonPoints[i + 1];
    const xj = polygonPoints[j];
    const yj = polygonPoints[j + 1];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
    j = i;
  }
  return inside;
}

const DAMAGE_TYPES = ['Bend','Chip','Crack','Dent','Hole','Rust','Scratch','Scuff'].sort();
const US_STATES = [
  'AL - Alabama','AK - Alaska','AZ - Arizona','AR - Arkansas','CA - California','CO - Colorado','CT - Connecticut','DE - Delaware','FL - Florida','GA - Georgia',
  'HI - Hawaii','ID - Idaho','IL - Illinois','IN - Indiana','IA - Iowa','KS - Kansas','KY - Kentucky','LA - Louisiana','ME - Maine','MD - Maryland',
  'MA - Massachusetts','MI - Michigan','MN - Minnesota','MS - Mississippi','MO - Missouri','MT - Montana','NE - Nebraska','NV - Nevada','NH - New Hampshire',
  'NJ - New Jersey','NM - New Mexico','NY - New York','NC - North Carolina','ND - North Dakota','OH - Ohio','OK - Oklahoma','OR - Oregon','PA - Pennsylvania',
  'RI - Rhode Island','SC - South Carolina','SD - South Dakota','TN - Tennessee','TX - Texas','UT - Utah','VT - Vermont','VA - Virginia','WA - Washington',
  'WV - West Virginia','WI - Wisconsin','WY - Wyoming'
].sort();
const CAR_COLORS = [
  'Black','Blue','Brown','Gray','Green','Orange','Purple','Red','Silver','White','Yellow'
].sort();

const apiUrl = import.meta.env.VITE_APP_API_URL || 'https://api-fyif6r6qma-uc.a.run.app';

/* ------------------------------------------------------------------
   2) DamageDiagram => for pointing out damage on a car outline
------------------------------------------------------------------ */
const BASE_WIDTH = 600;
const BASE_HEIGHT = 900;
const aspectRatio = BASE_HEIGHT / BASE_WIDTH;

/** 
 * The `DamageDiagram` component is responsible for displaying
 * a car outline and letting the user add or edit damage points
 * (and even define car panels if they have permissions).
 */
const DamageDiagram = forwardRef(function DamageDiagram(props, ref) {
  const { damagePoints, onChangeDamagePoints, canCreate, canUpdate, canDelete } = props;
  const { user } = useAuth();

  const containerRef = useRef(null);
  const [stageDims, setStageDims] = useState({ width: 300, height: 300 * aspectRatio });

  // Car panels from Firestore
  const [carPanels, setCarPanels] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [activePoints, setActivePoints] = useState([]);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [pendingName, setPendingName] = useState('');

  // For the add/edit damage modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [stageX, setStageX] = useState(0);
  const [stageY, setStageY] = useState(0);
  const [damageType, setDamageType] = useState('');
  const [damageNote, setDamageNote] = useState('');
  const [location, setLocation] = useState('');
  const [photos, setPhotos] = useState([]);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Photo upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Let parent open "edit damage" by index
  useImperativeHandle(ref, () => ({
    openEditDamage(idx) {
      const dp = damagePoints[idx];
      if (!dp) return;
      setEditIndex(idx);
      const scaledX = (dp.x / BASE_WIDTH) * stageDims.width;
      const scaledY = (dp.y / BASE_HEIGHT) * stageDims.height;
      setStageX(scaledX);
      setStageY(scaledY);

      setDamageType(dp.type || '');
      setDamageNote(dp.note || '');
      setLocation(dp.location || '');
      setPhotos(dp.photos || []);
      setModalOpen(true);
    }
  }));

  useEffect(() => {
    fetchCarPanels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getAuthHeaders() {
    if (!user?.firebaseUser) return {};
    const idToken = await user.firebaseUser.getIdToken(true);
    return { Authorization: `Bearer ${idToken}` };
  }

  async function fetchCarPanels() {
    try {
      const headers = await getAuthHeaders();
      const resp = await axios.get(`${apiUrl}/getVehicleDamage`, { headers });
      const docs = resp.data?.data || [];
      const polygons = docs.filter((d) => d.isPanel);
      setCarPanels(polygons);
    } catch (err) {
      console.error('Error fetching car panels:', err);
    }
  }

  // Dynamically resize Konva stage to fit container
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth || 300;
      const finalHeight = Math.round(containerWidth * aspectRatio);
      setStageDims({ width: containerWidth, height: finalHeight });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // If the user clicks on the stage
  const handleStageClick = (evt) => {
    const stage = evt.target.getStage();
    if (!stage || evt.target !== stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const { x, y } = pointer;
    const baseX = Math.round((x / stageDims.width) * BASE_WIDTH);
    const baseY = Math.round((y / stageDims.height) * BASE_HEIGHT);

    // If in "edit panels" mode, create new polygon points
    if (editMode && canCreate) {
      setActivePoints((prev) => [...prev, baseX, baseY]);
    } else {
      // Otherwise, create a new damage
      let matchedRegion = '';
      for (const p of carPanels) {
        if (p.points && isPointInPolygon(baseX, baseY, p.points)) {
          matchedRegion = p.name;
          break;
        }
      }
      setEditIndex(null);
      setStageX(x);
      setStageY(y);

      setDamageType('');
      setDamageNote('');
      setLocation(matchedRegion || '');
      setPhotos([]);
      setModalOpen(true);
    }
  };

  // If user clicks on an existing damage point
  const handleDotClick = (idx) => {
    if (editMode) return;
    const dp = damagePoints[idx];
    if (!dp) return;
    setEditIndex(idx);
    const scaledX = (dp.x / BASE_WIDTH) * stageDims.width;
    const scaledY = (dp.y / BASE_HEIGHT) * stageDims.height;
    setStageX(scaledX);
    setStageY(scaledY);

    setDamageType(dp.type || '');
    setDamageNote(dp.note || '');
    setLocation(dp.location || '');
    setPhotos(dp.photos || []);
    setModalOpen(true);
  };

  // Add or edit a damage
  const handleSaveDamage = () => {
    const baseX = Math.round((stageX / stageDims.width) * BASE_WIDTH);
    const baseY = Math.round((stageY / stageDims.height) * BASE_HEIGHT);

    const updated = [...damagePoints];
    if (editIndex == null) {
      // New damage
      updated.push({
        x: baseX,
        y: baseY,
        type: damageType.trim(),
        note: damageNote.trim(),
        location,
        photos
      });
    } else {
      // Editing existing
      updated[editIndex] = {
        x: baseX,
        y: baseY,
        type: damageType.trim(),
        note: damageNote.trim(),
        location,
        photos
      };
    }
    onChangeDamagePoints(updated);
    setModalOpen(false);
  };

  const handleDeleteDamage = () => {
    if (editIndex == null) return;
    const updated = [...damagePoints];
    updated.splice(editIndex, 1);
    onChangeDamagePoints(updated);
    setModalOpen(false);
  };

  // Polygon creation
  const handleCompletePolygon = () => {
    if (activePoints.length < 6) {
      alert('Need at least 3 points (6 coords).');
      return;
    }
    setPendingName('');
    setNameDialogOpen(true);
  };
  const handleCancelPolygon = () => {
    setActivePoints([]);
  };

  // Create or delete a panel in Firestore
  async function createCarPanel(panelData) {
    try {
      if (!canCreate) {
        alert('No permission to create panels.');
        return null;
      }
      const headers = await getAuthHeaders();
      await axios.post(`${apiUrl}/createVehicleDamage`, panelData, { headers });
      await fetchCarPanels();
      return true;
    } catch (err) {
      console.error('Error creating panel:', err);
      alert(`Error: ${err.message}`);
      return null;
    }
  }
  async function deleteCarPanel(docId) {
    try {
      if (!canDelete) {
        alert('No permission to delete panels.');
        return;
      }
      const headers = await getAuthHeaders();
      await axios.post(`${apiUrl}/deleteVehicleDamage`, { docId }, { headers });
      await fetchCarPanels();
    } catch (err) {
      console.error('Error deleting panel:', err);
      alert(`Error: ${err.message}`);
    }
  }

  const handleSavePolygonName = async () => {
    const nameVal = pendingName.trim();
    if (!nameVal) return;
    const panelData = {
      isPanel: true,
      name: nameVal,
      points: [...activePoints]
    };
    const success = await createCarPanel(panelData);
    if (success) {
      setActivePoints([]);
    }
    setNameDialogOpen(false);
  };

  // Photo upload
  const hiddenFileRef = useRef(null);
  const handleAddPhotoClick = () => {
    if (hiddenFileRef.current) {
      hiddenFileRef.current.value = '';
      hiddenFileRef.current.click();
    }
  };
  const handlePhotosSelected = async (evt) => {
    const files = evt.target.files || [];
    if (!files.length) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let totalBytes = 0;
      for (const file of files) {
        totalBytes += file.size;
      }
      let uploadedBytes = 0;

      for (const file of files) {
        const resizedBlob = await resizeImage(file, 1200);
        const rand = Math.random().toString(36).slice(2);
        const fileName = `damagePhoto_${Date.now()}_${rand}.jpg`;
        const fileRef = storageRef(storage, `damage-photos/${fileName}`);

        await new Promise((resolve, reject) => {
          const uploadTask = uploadBytesResumable(fileRef, resizedBlob);
          let lastTransferred = 0;

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const diff = snapshot.bytesTransferred - lastTransferred;
              uploadedBytes += diff;
              lastTransferred = snapshot.bytesTransferred;
              const progressPercent = (uploadedBytes / totalBytes) * 100;
              setUploadProgress(Math.floor(progressPercent));
            },
            (error) => {
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(fileRef);
              setPhotos((prev) => [...prev, downloadURL]);
              resolve();
            }
          );
        });
      }
    } catch (err) {
      console.error('Error uploading photos:', err);
      alert('Failed to upload image(s).');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  function HoverCard({ dp, x, y }) {
    const cardWidth = 150;
    const cardPad = 8;
    const lines = [
      `Type: ${dp.type}`,
      dp.location ? `Loc: ${dp.location}` : '',
      dp.note ? `Note: ${dp.note}` : ''
    ].filter(Boolean);

    let textHeight = lines.length * 14 * 1.2 + cardPad * 2;
    const hasPhoto = dp.photos && dp.photos.length > 0;
    const thumbSize = 40;
    if (hasPhoto) {
      textHeight += thumbSize + 10;
    }

    let cardX = x + 10;
    let cardY = y - textHeight / 2;
    if (cardX + cardWidth > stageDims.width) {
      cardX = x - cardWidth - 10;
    }
    if (cardY < 0) {
      cardY = 0;
    }
    if (cardY + textHeight > stageDims.height) {
      cardY = stageDims.height - textHeight;
    }

    const textContent = lines.join('\n');
    let photoImage = null;
    if (hasPhoto) {
      photoImage = useBase64KonvaImage(dp.photos[0]);
    }

    return (
      <KonvaGroup x={cardX} y={cardY}>
        <KonvaTag
          fill="#fff"
          stroke="#ccc"
          shadowColor="#000"
          shadowBlur={4}
          shadowOffset={{ x: 2, y: 2 }}
          shadowOpacity={0.2}
          cornerRadius={8}
          width={cardWidth}
          height={textHeight}
        />
        <KonvaText
          x={cardPad}
          y={cardPad}
          width={cardWidth - cardPad * 2}
          fontSize={14}
          fill="#000"
          lineHeight={1.2}
          text={textContent}
        />
        {photoImage && (
          <KonvaImage
            image={photoImage}
            x={cardPad}
            y={cardPad + lines.length * 14 * 1.2 + 5}
            width={thumbSize}
            height={thumbSize}
            stroke="#ccc"
            cornerRadius={4}
          />
        )}
      </KonvaGroup>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        width: { xs: '100%', sm: '80%' },
        mx: 'auto',
        textAlign: 'center'
      }}
    >
      {(canCreate || canUpdate) && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            mb: 2,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={editMode}
                onChange={(e) => setEditMode(e.target.checked)}
              />
            }
            label="Edit Panels"
          />
          {editMode && (
            <>
              <Button
                variant="contained"
                onClick={handleCompletePolygon}
                disabled={activePoints.length < 2}
              >
                Complete Polygon
              </Button>
              <Button variant="outlined" onClick={handleCancelPolygon}>
                Cancel Polygon
              </Button>
            </>
          )}
        </Box>
      )}

      {editMode && (
        <Box
          sx={{
            mb: 2,
            p: 1,
            border: '1px solid #aaa',
            borderRadius: 2,
            textAlign: 'left'
          }}
        >
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Existing Panels
          </Typography>
          {carPanels.length === 0 && <Typography>(No panels found yet)</Typography>}
          {carPanels.map((p) => (
            <Box
              key={p.id}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
            >
              <Typography>{p.name}</Typography>
              {canDelete && (
                <IconButton
                  size="small"
                  onClick={() => deleteCarPanel(p.id)}
                >
                  <IconTrash size={16} />
                </IconButton>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* The car outline & damage points */}
      <Box sx={{ width: '100%', mb: 2 }}>
        <Stage
          width={stageDims.width}
          height={stageDims.height}
          style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 4 }}
          onMouseDown={handleStageClick}
        >
          <Layer>
            <CarOutlineImage
              src={carOutlineImg}
              width={stageDims.width}
              height={stageDims.height}
            />

            {carPanels.map((panel) => {
              if (!Array.isArray(panel.points)) return null;
              const scaled = panel.points.map((val, idx) =>
                idx % 2 === 0
                  ? (val / BASE_WIDTH) * stageDims.width
                  : (val / BASE_HEIGHT) * stageDims.height
              );
              return (
                <KonvaLine
                  key={panel.id}
                  points={scaled}
                  closed
                  fill={editMode ? 'rgba(0,0,255,0.2)' : 'transparent'}
                  stroke={editMode ? 'blue' : 'transparent'}
                  strokeWidth={2}
                  listening={editMode}
                />
              );
            })}

            {/* In-progress polygon for panel creation */}
            {editMode && activePoints.length > 1 && (
              <KonvaLine
                points={activePoints.map((val, i) =>
                  i % 2 === 0
                    ? (val / BASE_WIDTH) * stageDims.width
                    : (val / BASE_HEIGHT) * stageDims.height
                )}
                fill="rgba(255,0,0,0.2)"
                stroke="red"
                strokeWidth={2}
                closed={false}
              />
            )}
            {editMode &&
              activePoints.map((val, i) => {
                if (i % 2 !== 0) return null;
                const x = (activePoints[i] / BASE_WIDTH) * stageDims.width;
                const y = (activePoints[i + 1] / BASE_HEIGHT) * stageDims.height;
                return <Circle key={i} x={x} y={y} radius={5} fill="red" />;
              })}

            {/* Existing damage points */}
            {damagePoints.map((dp, i) => {
              const scaledX = (dp.x / BASE_WIDTH) * stageDims.width;
              const scaledY = (dp.y / BASE_HEIGHT) * stageDims.height;
              return (
                <React.Fragment key={i}>
                  <Circle
                    x={scaledX}
                    y={scaledY}
                    radius={10}
                    fill="red"
                    opacity={0.8}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => handleDotClick(i)}
                  />
                  {hoveredIdx === i && !editMode && (
                    <HoverCard dp={dp} x={scaledX} y={scaledY} />
                  )}
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
      </Box>

      {/* Add/Edit Damage Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        fullWidth
        maxWidth="sm"
        sx={{
          '& .MuiPaper-root': { maxHeight: '90vh' }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center' }}>Damage Details</DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            mt: 2
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 220,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 2
            }}
          >
            <FormControl fullWidth>
              <InputLabel>Damage Type</InputLabel>
              <Select
                value={damageType}
                label="Damage Type"
                onChange={(e) => setDamageType(e.target.value)}
              >
                {DAMAGE_TYPES.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Location</InputLabel>
              <Select
                value={location}
                label="Location"
                onChange={(e) => setLocation(e.target.value)}
              >
                <MenuItem value="">(Not specified)</MenuItem>
                {carPanels.map((panel) => (
                  <MenuItem key={panel.id} value={panel.name}>
                    {panel.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Notes"
              value={damageNote}
              onChange={(e) => setDamageNote(e.target.value)}
              multiline
              rows={3}
            />

            {/* Photo Upload */}
            <input
              ref={hiddenFileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handlePhotosSelected}
            />
            <Button
              variant="outlined"
              startIcon={<IconPlus size={18} />}
              onClick={handleAddPhotoClick}
            >
              Add Photo(s)
            </Button>

            {isUploading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <LinearProgress sx={{ flex: 1 }} variant="determinate" value={uploadProgress} />
                <Typography variant="body2">{uploadProgress}%</Typography>
              </Box>
            )}
          </Box>

          {/* Photo carousel on the right side */}
          <Box sx={{ flex: 1.5, minWidth: 240, display: 'flex', flexDirection: 'column' }}>
            {photos.length === 0 ? (
              <Paper
                variant="outlined"
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 2
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  No Images
                </Typography>
              </Paper>
            ) : (
              <DamageImageCarousel
                photos={photos}
                onRemovePhoto={(idx) => {
                  const updated = [...photos];
                  updated.splice(idx, 1);
                  setPhotos(updated);
                }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!damageType} onClick={handleSaveDamage}>
            Save
          </Button>
          {editIndex != null && (
            <Button onClick={handleDeleteDamage}>Delete Damage</Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Polygon name dialog => new panel */}
      <Dialog open={nameDialogOpen} onClose={() => setNameDialogOpen(false)}>
        <DialogTitle>Name This Panel</DialogTitle>
        <DialogContent>
          <TextField
            label="Panel Name"
            fullWidth
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNameDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!pendingName.trim()}
            onClick={handleSavePolygonName}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

/* ------------------------------------------------------------------
   3) The Photo Carousel for damage images
------------------------------------------------------------------ */
function DamageImageCarousel({ photos, onRemovePhoto }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoomScale, setZoomScale] = useState(1.25);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPointerPos, setLastPointerPos] = useState(null);

  const currentPhoto = photos[currentIndex];

  const handlePointerDown = (e) => {
    setIsDragging(true);
    setLastPointerPos({ x: e.clientX, y: e.clientY });
  };
  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPointerPos.x;
    const dy = e.clientY - lastPointerPos.y;
    setLastPointerPos({ x: e.clientX, y: e.clientY });
    setImageOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };
  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((i) => i + 1);
      resetZoomAndPan();
    }
  };
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      resetZoomAndPan();
    }
  };

  const handleZoomIn = () => setZoomScale((z) => Math.min(z + 0.25, 5));
  const handleZoomOut = () => setZoomScale((z) => Math.max(z - 0.25, 1));
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentPhoto;
    link.download = `DamagePhoto_${currentIndex + 1}.jpg`;
    link.click();
  };
  const resetZoomAndPan = () => {
    setZoomScale(1.25);
    setImageOffset({ x: 0, y: 0 });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
      <Box
        sx={{
          width: '100%',
          maxHeight: 300,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid #ccc',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setIsDragging(false)}
      >
        <Box
          component="img"
          src={currentPhoto}
          alt={`Damage Photo ${currentIndex + 1}`}
          sx={{
            transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${zoomScale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.2s',
            objectFit: 'contain',
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        />
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 1,
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
      >
        <IconButton onClick={handlePrev} disabled={currentIndex === 0}>
          <IconArrowLeft />
        </IconButton>

        <Tooltip title="Zoom Out">
          <span>
            <IconButton onClick={handleZoomOut} disabled={zoomScale <= 1}>
              <IconZoomOut />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Zoom In">
          <span>
            <IconButton onClick={handleZoomIn} disabled={zoomScale >= 5}>
              <IconZoomIn />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Download">
          <IconButton onClick={handleDownload}>
            <IconDownload />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Current Photo">
          <IconButton
            onClick={() => {
              onRemovePhoto(currentIndex);
              setCurrentIndex((i) => Math.max(i - 1, 0));
              resetZoomAndPan();
            }}
          >
            <IconTrash />
          </IconButton>
        </Tooltip>

        <IconButton onClick={handleNext} disabled={currentIndex === photos.length - 1}>
          <IconArrowRight />
        </IconButton>
      </Box>

      <Typography variant="body2" sx={{ textAlign: 'center' }}>
        Photo {currentIndex + 1} of {photos.length}
      </Typography>

      {photos.length > 1 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            gap: 1,
            py: 1,
            justifyContent: 'center'
          }}
        >
          {photos.map((thumbUrl, idx) => (
            <Box
              key={idx}
              component="img"
              src={thumbUrl}
              alt={`Thumb ${idx + 1}`}
              sx={{
                width: 50,
                height: 50,
                objectFit: 'cover',
                borderRadius: 1,
                border: idx === currentIndex ? '2px solid #000' : '2px solid transparent',
                cursor: 'pointer'
              }}
              onClick={() => {
                setCurrentIndex(idx);
                resetZoomAndPan();
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------------
   4) RecordedDamageCards => sample listing of damage
------------------------------------------------------------------ */
// You have an inline copy of this in the main code, but here it is again for reference:
function RecordedDamageCards({ damagePoints, onEditDamage, onDeleteDamage }) {
  const sorted = [...damagePoints].sort((a, b) => {
    const locA = (a.location || '').toLowerCase();
    const locB = (b.location || '').toLowerCase();
    if (locA < locB) return -1;
    if (locA > locB) return 1;
    return 0;
  });

  return (
    <Box
      sx={{
        mb: 2,
        p: 1,
        borderRadius: 2,
        backgroundColor: '#E3F2FD',
        textAlign: 'center'
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
        Recorded Damage
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'center'
        }}
      >
        {sorted.map((dp, idx) => (
          <Card
            key={idx}
            sx={{
              width: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              p: 0.5
            }}
          >
            {dp.location && (
              <Typography variant="subtitle2" align="center" sx={{ mt: 1 }}>
                {dp.location}
              </Typography>
            )}
            <Typography variant="subtitle1" align="center" sx={{ mt: dp.location ? 0.5 : 1 }}>
              {dp.type}
            </Typography>

            {dp.photos && dp.photos.length > 0 ? (
              <CardMedia
                component="img"
                image={dp.photos[0]}
                alt="Damage Photo"
                sx={{
                  width: 100,
                  height: 'auto',
                  mt: 1,
                  borderRadius: 1,
                  objectFit: 'cover',
                  cursor: 'pointer'
                }}
                onClick={() => onEditDamage(dp)}
              />
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  width: 100,
                  height: 60,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderStyle: 'dashed',
                  borderColor: '#ccc',
                  color: '#999',
                  mt: 1,
                  cursor: 'pointer'
                }}
                onClick={() => onEditDamage(dp)}
              >
                No Image
              </Paper>
            )}
            <CardContent sx={{ p: 0.5 }}>
              <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                {dp.note || ''}
              </Typography>
            </CardContent>

            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <IconButton size="small" onClick={() => onEditDamage(dp)}>
                <IconPencil size={16} />
              </IconButton>
              <IconButton size="small" onClick={() => onDeleteDamage(dp)}>
                <IconTrash size={16} />
              </IconButton>
            </Box>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------------
   5) The main TowVehicleInfo export
------------------------------------------------------------------ */
export default function TowVehicleInfo({
  data = {},
  onChange = () => {},
  disabled = false
}) {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();

  // Extract from parent's "vehicleInfo"...
  const vehicleInfo = data.vehicleInfo || {};
  let {
    vin = '',
    year = '',
    make = '',
    model = '',
    color = '',
    plateState = '',
    plateNumber = '',
    mileage = '',
    damagePoints = [],
    // ADDING "decoded" so we keep it in sync
    decoded = false
  } = vehicleInfo;

  // React Hook Form
  const { register, handleSubmit, reset, watch, formState, setValue } = useForm({
    defaultValues: {
      vin,
      year,
      make,
      model,
      color,
      plateState,
      plateNumber,
      mileage,
      decoded // also keep track in the form
    }
  });

  // Keep track of whether parent data changed externally
  const prevVehicleInfoRef = useRef(null);
  useEffect(() => {
    const newString = JSON.stringify({
      vin,
      year,
      make,
      model,
      color,
      plateState,
      plateNumber,
      mileage,
      decoded
    });
    if (newString !== prevVehicleInfoRef.current) {
      prevVehicleInfoRef.current = newString;
      reset({
        vin,
        year,
        make,
        model,
        color,
        plateState,
        plateNumber,
        mileage,
        decoded
      });
    }
  }, [vin, year, make, model, color, plateState, plateNumber, mileage, decoded, reset]);

  const formValues = watch();

  // On ANY change, we might call onChange, but only if there's a genuine difference
  useEffect(() => {
    const newVehicleInfo = {
      ...formValues,
      damagePoints
    };

    if (!deepEqual(newVehicleInfo, data.vehicleInfo || {})) {
      onChange({ vehicleInfo: newVehicleInfo });
    }
  }, [formValues, damagePoints, data.vehicleInfo, onChange]);

  const [originalVehicle, setOriginalVehicle] = useState(null);
  useEffect(() => {
    if (originalVehicle === null) {
      setOriginalVehicle({ ...formValues });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // For orange "dirty" highlight
  function getIn(obj, path) {
    if (!obj) return undefined;
    const parts = path.split('.');
    let val = obj;
    for (const p of parts) {
      if (val == null) return undefined;
      val = val[p];
    }
    return val;
  }
  function isFieldDirty(fieldName) {
    if (!originalVehicle) return false;
    const origVal = getIn(originalVehicle, fieldName);
    const currVal = getIn(formValues, fieldName);
    return origVal !== currVal;
  }
  function getDirtySx(fieldName) {
    const dirty = isFieldDirty(fieldName);
    return {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: dirty ? 'orange !important' : undefined,
        borderWidth: dirty ? '2px' : undefined
      },
      '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: dirty ? 'orange !important' : undefined
      }
    };
  }

  // VIN scanning + decoding
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');

  const openErrorModal = (msg) => {
    setErrorModalMessage(msg);
    setErrorModalOpen(true);
  };
  const closeErrorModal = () => {
    setErrorModalOpen(false);
    setErrorModalMessage('');
  };

  async function getAuthHeaders() {
    if (!user?.firebaseUser) return {};
    const idToken = await user.firebaseUser.getIdToken(true);
    return { Authorization: `Bearer ${idToken}` };
  }

  const decodeVinFromApi = useCallback(async (vinStr) => {
    const vinVal = vinStr.trim();
    if (!vinVal || vinVal.length !== 17) return;
    try {
      setIsLoading(true);
      setLoadingMessage('Decoding VIN via NHTSA...');
      const resp = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(vinVal)}?format=json`
      );
      if (!resp.ok) {
        throw new Error(`VIN decode error: ${resp.status}`);
      }
      const data = await resp.json();
      if (data.Results && data.Results.length > 0) {
        const r = data.Results[0];
        reset({
          vin: vinVal,
          year: r.ModelYear || '',
          make: r.Make || '',
          model: r.Model || '',
          color: watch('color'),
          plateState: watch('plateState'),
          plateNumber: watch('plateNumber'),
          mileage: watch('mileage'),
          // We can flip `decoded` to true if it returns valid data
          decoded: true
        });
      }
    } catch (err) {
      openErrorModal('VIN decode was not successful. Please check the VIN.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [reset, watch]);

  const handleScannerClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleFileInputChange = useCallback(async (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    try {
      setIsLoading(true);
      setLoadingMessage('Resizing your image...');
      const resizedBlob = await resizeImage(file, 1200);

      setLoadingMessage('Scanning VIN. Please wait...');
      const fileReader = new FileReader();
      fileReader.onload = async () => {
        try {
          const base64Image = fileReader.result.split(',')[1];
          const headers = await getAuthHeaders();
          const resp = await axios.post(`${apiUrl}/ocrVin`, { base64Image }, { headers });
          const dataObj = resp.data?.data;
          if (!dataObj || !dataObj.vin) {
            throw new Error('No valid VIN found in the image.');
          }
          reset({
            vin: dataObj.vin,
            year: dataObj.year || '',
            make: dataObj.make || '',
            model: dataObj.model || '',
            color: watch('color'),
            plateState: watch('plateState'),
            plateNumber: watch('plateNumber'),
            mileage: watch('mileage'),
            // Mark as decoded if we found a VIN
            decoded: true
          });
        } catch (e) {
          openErrorModal('VIN Scanner failed. Try a clearer photo.');
        } finally {
          setIsLoading(false);
          setLoadingMessage('');
        }
      };
      fileReader.onerror = () => {
        openErrorModal('Could not read resized image for VIN scanning.');
        setIsLoading(false);
        setLoadingMessage('');
      };
      fileReader.readAsDataURL(resizedBlob);
    } catch (err) {
      openErrorModal(`VIN Scanner encountered an error: ${err.message}`);
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [reset, watch, getAuthHeaders]);

  const handleDecodeVinClick = useCallback(() => {
    const currentVin = watch('vin');
    if (currentVin) decodeVinFromApi(currentVin);
  }, [decodeVinFromApi, watch]);

  // Plate + Mileage formatting
  const handlePlateNumberChange = (e) => {
    const raw = e.target.value || '';
    const newVal = raw.toUpperCase();
    setValue('plateNumber', newVal);
  };

  const handleMileageChange = (e) => {
    const input = e.target.value || '';
    const digits = input.replace(/\D/g, '');
    if (!digits) {
      setValue('mileage', '');
      return;
    }
    const parsed = parseInt(digits, 10);
    const withCommas = parsed.toLocaleString('en-US');
    setValue('mileage', withCommas);
  };

  const onSubmit = () => {
    // The parent handles final saving. This form just updates its parent via onChange.
  };

  // Handling damage
  const damageDiagramRef = useRef(null);
  const handleChangeDamagePoints = (updatedPoints) => {
    onChange({
      vehicleInfo: {
        ...watch(),
        damagePoints: updatedPoints
      }
    });
  };
  const handleEditDamageFromCard = (dp) => {
    const currDamagePoints = watch('damagePoints') || [];
    const idx = currDamagePoints.findIndex(
      (p) =>
        p.x === dp.x &&
        p.y === dp.y &&
        p.type === dp.type &&
        p.note === dp.note &&
        p.location === dp.location
    );
    if (idx >= 0 && damageDiagramRef.current) {
      damageDiagramRef.current.openEditDamage(idx);
    }
  };
  const handleDeleteDamageFromCard = (dp) => {
    const currDamagePoints = watch('damagePoints') || [];
    const idx = currDamagePoints.findIndex(
      (p) =>
        p.x === dp.x &&
        p.y === dp.y &&
        p.type === dp.type &&
        p.note === dp.note &&
        p.location === dp.location
    );
    if (idx < 0) return;
    const updated = [...currDamagePoints];
    updated.splice(idx, 1);
    onChange({
      vehicleInfo: {
        ...watch(),
        damagePoints: updated
      }
    });
  };

  // Inline version of RecordedDamageCards
  function RecordedDamageCards({ damagePoints, onEditDamage, onDeleteDamage }) {
    const sorted = [...damagePoints].sort((a, b) => {
      const locA = (a.location || '').toLowerCase();
      const locB = (b.location || '').toLowerCase();
      if (locA < locB) return -1;
      if (locA > locB) return 1;
      return 0;
    });

    return (
      <Box
        sx={{
          mb: 2,
          p: 1,
          borderRadius: 2,
          backgroundColor: '#E3F2FD',
          textAlign: 'center'
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
          Recorded Damage
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'center'
          }}
        >
          {sorted.map((dp, idx) => (
            <Card
              key={idx}
              sx={{
                width: 180,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                p: 0.5
              }}
            >
              {dp.location && (
                <Typography variant="subtitle2" align="center" sx={{ mt: 1 }}>
                  {dp.location}
                </Typography>
              )}
              <Typography variant="subtitle1" align="center" sx={{ mt: dp.location ? 0.5 : 1 }}>
                {dp.type}
              </Typography>

              {dp.photos && dp.photos.length > 0 ? (
                <CardMedia
                  component="img"
                  image={dp.photos[0]}
                  alt="Damage Photo"
                  sx={{
                    width: 100,
                    height: 'auto',
                    mt: 1,
                    borderRadius: 1,
                    objectFit: 'cover',
                    cursor: 'pointer'
                  }}
                  onClick={() => onEditDamage(dp)}
                />
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    width: 100,
                    height: 60,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderStyle: 'dashed',
                    borderColor: '#ccc',
                    color: '#999',
                    mt: 1,
                    cursor: 'pointer'
                  }}
                  onClick={() => onEditDamage(dp)}
                >
                  No Image
                </Paper>
              )}
              <CardContent sx={{ p: 0.5 }}>
                <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                  {dp.note || ''}
                </Typography>
              </CardContent>

              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <IconButton size="small" onClick={() => onEditDamage(dp)}>
                  <IconPencil size={16} />
                </IconButton>
                <IconButton size="small" onClick={() => onDeleteDamage(dp)}>
                  <IconTrash size={16} />
                </IconButton>
              </Box>
            </Card>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <MainCard sx={{ borderRadius: 3 }}>
      {/* Hidden file input => VIN scanner */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* VIN / Decoding / Scanning */}
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 2,
            backgroundColor: '#E3F2FD',
            textAlign: 'center'
          }}
        >
          <Grid container spacing={2} sx={{ textAlign: 'center', mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="VIN"
                {...register('vin')}
                disabled={disabled || isLoading || formState.isSubmitting}
                inputProps={{ style: { textAlign: 'center' }, autoComplete: 'off' }}
                fullWidth
                size="small"
                sx={getDirtySx('vin')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                variant="contained"
                fullWidth
                disabled={disabled || isLoading || formState.isSubmitting}
                onClick={handleDecodeVinClick}
              >
                Decode VIN
              </Button>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                variant="outlined"
                fullWidth
                disabled={disabled || isLoading || formState.isSubmitting}
                onClick={handleScannerClick}
                startIcon={<IconCamera size={18} />}
              >
                VIN Scanner
              </Button>
            </Grid>

            {isLoading && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">{loadingMessage || 'Processing...'}</Typography>
                </Box>
              </Grid>
            )}
          </Grid>

          {/* Year / Make / Model / Color */}
          <Grid container spacing={2} sx={{ textAlign: 'center', mb: 2 }}>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Year"
                {...register('year')}
                disabled={disabled || formState.isSubmitting}
                inputProps={{ style: { textAlign: 'center' } }}
                fullWidth
                size="small"
                sx={getDirtySx('year')}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Make"
                {...register('make')}
                disabled={disabled || formState.isSubmitting}
                inputProps={{ style: { textAlign: 'center' } }}
                fullWidth
                size="small"
                sx={getDirtySx('make')}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Model"
                {...register('model')}
                disabled={disabled || formState.isSubmitting}
                inputProps={{ style: { textAlign: 'center' } }}
                fullWidth
                size="small"
                sx={getDirtySx('model')}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl
                fullWidth
                size="small"
                disabled={disabled || formState.isSubmitting}
                sx={getDirtySx('color')}
              >
                <InputLabel>Color</InputLabel>
                <Select
                  label="Color"
                  {...register('color')}
                  value={watch('color') || ''}
                  onChange={(e) => setValue('color', e.target.value)}
                >
                  {CAR_COLORS.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Plate State / Plate Number / Mileage */}
          <Grid container spacing={2} sx={{ textAlign: 'center', mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <FormControl
                fullWidth
                size="small"
                disabled={disabled || formState.isSubmitting}
                sx={getDirtySx('plateState')}
              >
                <InputLabel>Plate State</InputLabel>
                <Select
                  label="Plate State"
                  {...register('plateState')}
                  value={watch('plateState') || ''}
                  onChange={(e) => setValue('plateState', e.target.value)}
                >
                  {US_STATES.map((st) => (
                    <MenuItem key={st} value={st}>
                      {st}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Plate Number"
                value={watch('plateNumber') || ''}
                onChange={handlePlateNumberChange}
                disabled={disabled || formState.isSubmitting}
                inputProps={{ style: { textAlign: 'center' }, autoComplete: 'off' }}
                fullWidth
                size="small"
                sx={getDirtySx('plateNumber')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Mileage"
                value={watch('mileage') || ''}
                onChange={handleMileageChange}
                disabled={disabled || formState.isSubmitting}
                inputProps={{ style: { textAlign: 'center' }, autoComplete: 'off' }}
                fullWidth
                size="small"
                sx={getDirtySx('mileage')}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Show recorded damage if any */}
        {damagePoints.length > 0 && (
          <RecordedDamageCards
            damagePoints={damagePoints}
            onEditDamage={handleEditDamageFromCard}
            onDeleteDamage={handleDeleteDamageFromCard}
          />
        )}

        {/* Expandable "Damage Diagram" */}
        <Accordion sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#DCEFFF' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mx: 'auto' }}>
              <IconCarCrash size={20} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Damage Diagram
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <DamageDiagram
              ref={damageDiagramRef}
              damagePoints={damagePoints}
              onChangeDamagePoints={handleChangeDamagePoints}
              canCreate={user?.tables?.vehicleDamage?.includes('Create')}
              canUpdate={user?.tables?.vehicleDamage?.includes('Update')}
              canDelete={user?.tables?.vehicleDamage?.includes('Delete')}
            />
          </AccordionDetails>
        </Accordion>
      </form>

      {/* Error modal => scanning / decoding */}
      <Dialog open={errorModalOpen} onClose={closeErrorModal}>
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{errorModalMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeErrorModal} autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </MainCard>
  );
}
