// C:\Users\eliha\firebase\webapp\src\views\pages\towManager\DamageDiagram.jsx
import React, {
    useState,
    useRef,
    useEffect,
    forwardRef,
    useImperativeHandle
  } from 'react';
  import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box
  } from '@mui/material';
  import { IconCamera, IconTrash } from '@tabler/icons-react';
  import { Stage, Layer, Circle, Polygon } from 'react-konva';
  import useImage from 'use-image';
  
  import { fileToBase64 } from 'utils/fileHelpers'; // or inline if you prefer
  
  // You had some local damage types
  const DAMAGE_TYPES = ['Scratch', 'Dent', 'Bend', 'Rust', 'Scuff'].sort();
  
  // EXAMPLE: We'll define a few “car panels” with polygon points.
  // In real usage, you'd find coordinates that match your car outline.
  const CAR_PANELS = [
    {
      name: 'Front Bumper',
      points: [60, 20, 140, 20, 140, 60, 60, 60] // Just an example rectangle region
    },
    {
      name: 'Driver Door',
      points: [40, 60, 80, 60, 80, 140, 40, 140]
    },
    {
      name: 'Rear Bumper',
      points: [60, 140, 140, 140, 140, 180, 60, 180]
    }
    // ... add more polygons for each panel you want
  ];
  
  // Basic car image
  function CarOutlineImage({ src, width, height }) {
    const [image] = useImage(src);
    return <image image={image} width={width} height={height} listening={false} />;
  }
  
  const DamageDiagram = forwardRef(function DamageDiagram(props, ref) {
    const { damagePoints = [], onChangeDamagePoints } = props;
    const containerRef = useRef(null);
  
    // We add “panel” to the local state as well
    const [modalOpen, setModalOpen] = useState(false);
    const [editIndex, setEditIndex] = useState(null);
  
    const [modalX, setModalX] = useState(0);
    const [modalY, setModalY] = useState(0);
  
    const [damagePanel, setDamagePanel] = useState(''); // <--- new field
    const [damageType, setDamageType] = useState('');
    const [damageNote, setDamageNote] = useState('');
    const [photoBase64, setPhotoBase64] = useState('');
  
    // We'll keep your “imperative handle” so parent can open the edit modal
    useImperativeHandle(ref, () => ({
      openEditDamage(index) {
        const item = damagePoints[index];
        if (!item) return;
        setEditIndex(index);
        setModalX(item.x);
        setModalY(item.y);
  
        // Load panel, type, note, photo from the existing record
        setDamagePanel(item.panel || '');
        setDamageType(item.type || '');
        setDamageNote(item.note || '');
        setPhotoBase64(item.photo || '');
        setModalOpen(true);
      }
    }));
  
    // For the Konva stage sizing
    const aspectRatio = 600 / 900;
    const [stageDims, setStageDims] = useState({ width: 400, height: 400 / aspectRatio });
    useEffect(() => {
      function handleResize() {
        if (containerRef.current) {
          const containerWidth = containerRef.current.offsetWidth || 400;
          const targetWidth = Math.min(containerWidth, 400);
          const targetHeight = targetWidth / aspectRatio;
          setStageDims({ width: targetWidth, height: targetHeight });
        }
      }
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
  
    // If user clicks an empty area => add new damage
    const handleStageClick = (e) => {
      const stage = e.target.getStage();
      if (!stage || e.target !== stage) return;
  
      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return;
  
      // no panel => user can pick from the dropdown
      setDamagePanel('');
      setEditIndex(null);
      setModalX(pointerPos.x);
      setModalY(pointerPos.y);
      setDamageType('');
      setDamageNote('');
      setPhotoBase64('');
      setModalOpen(true);
    };
  
    // If user clicks a polygon => auto-set that panel
    const handlePanelClick = (panelName, e) => {
      const stage = e.target.getStage();
      if (!stage) return;
      const pointerPos = stage.getPointerPosition();
  
      setEditIndex(null);
      setModalX(pointerPos.x);
      setModalY(pointerPos.y);
  
      // auto-set damagePanel to the polygon's name
      setDamagePanel(panelName);
  
      setDamageType('');
      setDamageNote('');
      setPhotoBase64('');
      setModalOpen(true);
    };
  
    // If user clicks an existing red dot => edit
    const handleDotClick = (idx) => {
      const dp = damagePoints[idx];
      if (!dp) return;
  
      setEditIndex(idx);
      setModalX(dp.x);
      setModalY(dp.y);
  
      // load the existing panel or blank
      setDamagePanel(dp.panel || '');
      setDamageType(dp.type || '');
      setDamageNote(dp.note || '');
      setPhotoBase64(dp.photo || '');
      setModalOpen(true);
    };
  
    // Save new or updated damage => now includes “panel: damagePanel”
    const handleSaveDamage = () => {
      const updated = [...damagePoints];
      if (editIndex == null) {
        // new
        updated.push({
          x: modalX,
          y: modalY,
          panel: damagePanel.trim(), // store the chosen panel
          type: damageType.trim(),
          note: damageNote.trim(),
          photo: photoBase64
        });
      } else {
        // edit
        updated[editIndex] = {
          x: modalX,
          y: modalY,
          panel: damagePanel.trim(),
          type: damageType.trim(),
          note: damageNote.trim(),
          photo: photoBase64
        };
      }
      onChangeDamagePoints(updated);
      setModalOpen(false);
    };
  
    // Delete entire damage item
    const handleDeleteDamage = () => {
      if (editIndex == null) return;
      const updated = [...damagePoints];
      updated.splice(editIndex, 1);
      onChangeDamagePoints(updated);
      setModalOpen(false);
    };
  
    // Photo selection
    const hiddenFileRef = useRef(null);
    const handlePhotoClick = () => {
      if (hiddenFileRef.current) {
        hiddenFileRef.current.value = '';
        hiddenFileRef.current.click();
      }
    };
    const handlePhotoSelected = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const base64 = await fileToBase64(file);
        setPhotoBase64(base64);
      } catch (err) {
        console.error('Error reading photo:', err);
      }
    };
  
    // We'll do a minimal polygon approach for each panel
    // They have onClick => calls handlePanelClick(panel.name, e)
    return (
      <Box ref={containerRef} sx={{ width: '100%', mx: 'auto', textAlign: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Stage
            width={stageDims.width}
            height={stageDims.height}
            style={{
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 4
            }}
          >
            <Layer>
              {/* Polygons for each area => if user clicks, we auto-fill that panel */}
              {CAR_PANELS.map((panelObj) => (
                <Polygon
                  key={panelObj.name}
                  points={panelObj.points.map((pt, i) => {
                    // Scale these points to match stageDims if needed
                    // For now, if your coords are already sized to 200×200, you'd scale them
                    // We'll skip scaling for brevity => assume your coords are good
                    return pt;
                  })}
                  fill="transparent"
                  onClick={(e) => handlePanelClick(panelObj.name, e)}
                />
              ))}
  
              {/* The car image => behind polygons */}
              <Layer listening={false}>
                <KonvaImage
                  image={null} // or skip if you want
                />
                {/* If you have a real outline, place it here */}
              </Layer>
  
              {/* If user clicks empty => we handle stage's onMouseDown, see handleStageClick */}
              <Layer
                onMouseDown={handleStageClick}
                onTouchStart={handleStageClick}
              >
                {damagePoints.map((dp, i) => (
                  <React.Fragment key={i}>
                    <Circle
                      x={dp.x}
                      y={dp.y}
                      radius={10}
                      fill="red"
                      opacity={0.8}
                      onClick={() => handleDotClick(i)}
                    />
                    {/* Could do a hover tooltip, etc. */}
                  </React.Fragment>
                ))}
              </Layer>
            </Layer>
          </Stage>
        </Box>
  
        {/* Add/Edit Modal => local to this child */}
        <Dialog open={modalOpen} onClose={() => setModalOpen(false)}>
          <DialogTitle sx={{ textAlign: 'center' }}>
            {editIndex == null ? 'Add Damage' : 'Edit Damage'}
          </DialogTitle>
          <DialogContent
            sx={{
              mt: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              width: 300
            }}
          >
            {/* If there's a photo => show in row with a trash icon on the right */}
            {photoBase64 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  component="img"
                  src={photoBase64}
                  alt="Damage Photo"
                  sx={{
                    width: 80,
                    height: 'auto',
                    borderRadius: 1
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => setPhotoBase64('')}
                  sx={{ color: 'inherit' }}
                >
                  <IconTrash size={16} />
                </IconButton>
              </Box>
            )}
  
            {/* Panel => default from polygon or blank => user can override */}
            <FormControl fullWidth>
              <InputLabel>Panel / Area</InputLabel>
              <Select
                value={damagePanel}
                label="Panel / Area"
                onChange={(e) => setDamagePanel(e.target.value)}
              >
                <MenuItem value="">(No Panel)</MenuItem>
                {CAR_PANELS.map((p) => (
                  <MenuItem key={p.name} value={p.name}>
                    {p.name}
                  </MenuItem>
                ))}
                {/* You can add "Other" or more as well */}
              </Select>
            </FormControl>
  
            {/* Damage Type */}
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
  
            <TextField
              label="Notes"
              value={damageNote}
              onChange={(e) => setDamageNote(e.target.value)}
              fullWidth
            />
  
            {/* Hidden file input for photo */}
            <input
              ref={hiddenFileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoSelected}
            />
            <Button
              variant="outlined"
              startIcon={<IconCamera size={18} />}
              onClick={handlePhotoClick}
            >
              Optional Photo
            </Button>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!damageType}
              onClick={handleSaveDamage}
            >
              Save
            </Button>
            {editIndex != null && (
              <Button onClick={handleDeleteDamage} color="error">
                Delete Damage
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    );
  });
  
  export default DamageDiagram;
  