// TowDocuments.jsx
/******************************************************************
 * A dedicated Documents tab for uploading/viewing/deleting
 * documents (images or PDFs). Each document can have multiple
 * files/pages (front/back, multi-page, etc.).
 *
 * This fits into TowManager as the <TowDocuments> tab, with props:
 *   data     => The entire towData object from the parent
 *   onChange => A function to merge changes back into towData
 *   disabled => Boolean indicating view-only mode
 *
 * Usage in TowManager:
 *   <TowDocuments
 *     data={towData}
 *     onChange={(updates) => {
 *       setTowData((prev) => ({ ...prev, ...updates }));
 *     }}
 *     disabled={isViewOnly}
 *   />
 ******************************************************************/

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Grid,
  TextField,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  DialogContentText,
  Card,
  CardHeader,
  CardMedia,
  CardContent,
  CardActions,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  Divider,
  CircularProgress,
  Slider,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

// Example placeholders for your doc labels
const DOCUMENT_LABELS = [
  'Driver’s License',
  'Vehicle Registration',
  'Vehicle Insurance',
  'Custom'
];

// Styled box for file previews (to handle zoom, overflow, etc.)
const PreviewBox = styled(Box)(({ theme }) => ({
  border: '1px solid #ccc',
  borderRadius: 4,
  position: 'relative',
  overflow: 'auto',
  backgroundColor: '#f9f9f9',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  '& img': {
    maxWidth: '100%',
    maxHeight: '100%'
  },
  '& iframe': {
    border: 'none'
  }
}));

export default function TowDocuments({ data, onChange, disabled = false }) {
  // We assume there's a `documents` array in `data`.
  // If not present, we’ll default to an empty array here.
  const [documents, setDocuments] = useState(data.documents || []);

  // Keep track of any open dialogs
  const [showAddDocDialog, setShowAddDocDialog] = useState(false);
  const [newDocLabel, setNewDocLabel] = useState('');

  // Track deletion confirmations
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState({ docId: null, fileIndex: null });

  // For zooming file previews
  // { [docId_fileIndex]: number }, e.g. "doc-abc_0": 1.0 => 100% zoom
  const [zoomLevels, setZoomLevels] = useState({});

  // Merge local changes back to parent whenever `documents` changes
  // We'll store it in parent’s data as "documents"
  useEffect(() => {
    onChange({ documents });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  // ---------------------------
  //    Adding Documents
  // ---------------------------
  const handleOpenAddDialog = () => {
    setNewDocLabel('');
    setShowAddDocDialog(true);
  };

  const handleCloseAddDialog = () => {
    setShowAddDocDialog(false);
  };

  const handleConfirmAddDocument = () => {
    if (!newDocLabel.trim()) return;

    const newDoc = {
      id: generateRandomId(),
      label: newDocLabel,
      files: []
    };
    setDocuments((prev) => [...prev, newDoc]);
    setShowAddDocDialog(false);
    setNewDocLabel('');
  };

  // If user picks from the default list but chooses "Custom," we let them type
  const handleLabelChange = (e) => {
    const val = e.target.value;
    if (val === 'Custom') {
      setNewDocLabel('');
    } else {
      setNewDocLabel(val);
    }
  };

  // ---------------------------
  //    Uploading Files
  // ---------------------------
  const handleUploadFiles = async (docId) => {
    try {
      // Open a file input programmatically
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,.pdf'; // accept images & PDFs
      input.multiple = true;
      input.click();

      input.onchange = async (event) => {
        const files = event.target.files;
        if (!files?.length) return;

        // Optionally show a loading state while uploading
        const uploadedFiles = await uploadFilesToFirebaseStorage(files);

        // Save results in the `files` array for that doc
        setDocuments((prevDocs) =>
          prevDocs.map((doc) => {
            if (doc.id !== docId) return doc;
            return {
              ...doc,
              files: [...doc.files, ...uploadedFiles]
            };
          })
        );
      };
    } catch (err) {
      console.error('Error uploading files:', err);
      // Could show an error dialog/toast
    }
  };

  // Stub for uploading to Firebase Storage or wherever you store files
  const uploadFilesToFirebaseStorage = async (fileList) => {
    // Return an array of { fileName, fileUrl, type }
    // E.g., after each file is uploaded, you get a download URL
    // For now, we simulate with a local object URL
    const results = [];
    for (const file of fileList) {
      // Normally you’d do:
      // const storageRef = ...
      // const snapshot = await uploadBytes(storageRef, file);
      // const fileUrl = await getDownloadURL(snapshot.ref);

      // Instead, we create a local object URL to emulate a “preview”:
      const fileUrl = URL.createObjectURL(file);
      results.push({
        fileName: file.name,
        fileUrl,
        type: file.type
      });
    }
    return results;
  };

  // ---------------------------
  //    Deleting Documents/Files
  // ---------------------------
  const handleDeleteDocument = () => {
    if (!confirmDeleteDocId) return;
    setDocuments((prev) => prev.filter((doc) => doc.id !== confirmDeleteDocId));
    setConfirmDeleteDocId(null);
  };

  const handleDeleteFile = () => {
    const { docId, fileIndex } = confirmDeleteFile;
    if (!docId || fileIndex == null) return;

    setDocuments((prevDocs) =>
      prevDocs.map((doc) => {
        if (doc.id !== docId) return doc;
        const newFiles = [...doc.files];
        newFiles.splice(fileIndex, 1);
        return { ...doc, files: newFiles };
      })
    );
    setConfirmDeleteFile({ docId: null, fileIndex: null });
  };

  // ---------------------------
  //    Zoom & Preview
  // ---------------------------
  const handleZoomChange = (docId, fileIndex, newValue) => {
    const key = `${docId}_${fileIndex}`;
    setZoomLevels((prev) => ({ ...prev, [key]: newValue }));
  };

  const openInNewWindow = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ---------------------------
  //    Helpers
  // ---------------------------
  const generateRandomId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  // For each doc, we’ll show its label, a button to upload more files, and previews.
  // PDF previews: we’ll just show an <iframe> or <object> with adjustable zoom
  // Image previews: show an <img> with zoom scaling
  // If large PDF is needed, consider using a specialized PDF viewer library.

  return (
    <Box sx={{ p: 2, textAlign: 'left' }}>
      <Typography variant="h6" gutterBottom>
        Documents
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Upload and manage documents such as driver’s license, registration, insurance, etc.
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {/* List of existing documents */}
      {documents.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No documents yet.
        </Typography>
      )}
      {documents.map((doc) => (
        <Card key={doc.id} sx={{ mb: 3, boxShadow: 2 }}>
          <CardHeader
            title={doc.label || 'Untitled Document'}
            action={
              !disabled && (
                <IconButton
                  color="error"
                  onClick={() => setConfirmDeleteDocId(doc.id)}
                  title="Delete Entire Document"
                >
                  <DeleteIcon />
                </IconButton>
              )
            }
          />

          <CardContent>
            {/* Each file in doc.files */}
            {doc.files.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No files uploaded yet.
              </Typography>
            )}

            <Grid container spacing={2}>
              {doc.files.map((fileObj, index) => {
                const key = `${doc.id}_${index}`;
                const zoomLevel = zoomLevels[key] || 1.0;
                const isPDF = fileObj.type?.includes('pdf');

                return (
                  <Grid item xs={12} sm={6} md={4} key={key}>
                    <Box
                      sx={{
                        border: '1px solid #ccc',
                        borderRadius: 1,
                        p: 1,
                        mb: 1,
                        position: 'relative'
                      }}
                    >
                      <PreviewBox
                        sx={{
                          width: '100%',
                          height: 300,
                          transform: `scale(${zoomLevel})`,
                          transformOrigin: 'center center'
                        }}
                      >
                        {!isPDF ? (
                          <img src={fileObj.fileUrl} alt={fileObj.fileName} />
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}
                          >
                            {/* For PDFs, a simple approach is an iframe or object. */}
                            <iframe
                              src={fileObj.fileUrl}
                              title="PDF Preview"
                              width="100%"
                              height="100%"
                            />
                          </Box>
                        )}
                      </PreviewBox>

                      {/* Zoom controls */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mt: 1
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Zoom Out">
                            <IconButton
                              size="small"
                              onClick={() => handleZoomChange(doc.id, index, Math.max(zoomLevel - 0.25, 0.25))}
                            >
                              <ZoomOutIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Zoom In">
                            <IconButton
                              size="small"
                              onClick={() => handleZoomChange(doc.id, index, Math.min(zoomLevel + 0.25, 3))}
                            >
                              <ZoomInIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => openInNewWindow(fileObj.fileUrl)}
                            title="Open in new window"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>

                          {!disabled && (
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() =>
                                setConfirmDeleteFile({ docId: doc.id, fileIndex: index })
                              }
                              title="Delete File"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </Box>
                    </Box>
                    <Typography variant="caption">{fileObj.fileName}</Typography>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>

          {!disabled && (
            <CardActions>
              <Button
                variant="outlined"
                size="small"
                startIcon={doc.label?.toLowerCase().includes('license') ? <PictureAsPdfIcon /> : <AddPhotoAlternateIcon />}
                onClick={() => handleUploadFiles(doc.id)}
              >
                Add File
              </Button>
            </CardActions>
          )}
        </Card>
      ))}

      {!disabled && (
        <Button variant="contained" onClick={handleOpenAddDialog}>
          Add Document
        </Button>
      )}

      {/* Dialog: Add new document */}
      <Dialog open={showAddDocDialog} onClose={handleCloseAddDialog}>
        <DialogTitle>Add Document</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Select the type of document or pick “Custom” to name it yourself.
          </DialogContentText>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Document Type</InputLabel>
            <Select
              label="Document Type"
              value={
                DOCUMENT_LABELS.includes(newDocLabel) ? newDocLabel : 'Custom'
              }
              onChange={handleLabelChange}
            >
              {DOCUMENT_LABELS.map((label) => (
                <MenuItem key={label} value={label}>
                  {label}
                </MenuItem>
              ))}
              <MenuItem value="Custom">(Custom)</MenuItem>
            </Select>
          </FormControl>

          {newDocLabel === 'Custom' && (
            <TextField
              label="Custom Label"
              fullWidth
              size="small"
              value={newDocLabel === 'Custom' ? '' : newDocLabel}
              onChange={(e) => setNewDocLabel(e.target.value)}
              autoFocus
            />
          )}

          {newDocLabel !== 'Custom' && DOCUMENT_LABELS.includes(newDocLabel) && (
            <TextField
              label="Selected Label"
              fullWidth
              size="small"
              value={newDocLabel}
              disabled
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog}>Cancel</Button>
          <Button onClick={handleConfirmAddDocument} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Confirm delete entire doc */}
      <Dialog open={Boolean(confirmDeleteDocId)} onClose={() => setConfirmDeleteDocId(null)}>
        <DialogTitle>Delete Document?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this entire document record (including all files)?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteDocId(null)}>Cancel</Button>
          <Button onClick={handleDeleteDocument} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Confirm delete single file */}
      <Dialog
        open={Boolean(confirmDeleteFile.docId && confirmDeleteFile.fileIndex !== null)}
        onClose={() => setConfirmDeleteFile({ docId: null, fileIndex: null })}
      >
        <DialogTitle>Delete File?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this file from the document?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteFile({ docId: null, fileIndex: null })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteFile} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
