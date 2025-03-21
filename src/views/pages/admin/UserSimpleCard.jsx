import PropTypes from 'prop-types';
import React, { useState } from 'react';

// material-ui
import { useTheme } from '@mui/material/styles';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';

// project imports
import Avatar from './Avatar';

// assets
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

// ==============================|| USER SIMPLE CARD ||============================== //

const UserSimpleCard = ({ avatar, name, status, onEdit, onDelete, onToggleStatus }) => {
    const theme = useTheme();
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

    const handleOpenDeleteDialog = () => {
        setOpenDeleteDialog(true);
    };

    const handleCloseDeleteDialog = () => {
        setOpenDeleteDialog(false);
    };

    return (
        <Card
            sx={{
                p: 2,
                bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.50',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                    borderColor: 'primary.main'
                }
            }}
        >
            <Grid container spacing={2}>
                {/* Avatar and Name */}
                <Grid item xs={12}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item>
                            <Avatar alt={name} src={avatar} outline sx={{ width: 72, height: 72 }} />
                        </Grid>
                        <Grid item xs zeroMinWidth>
                            <Typography variant="h4">{name}</Typography>
                            <Typography variant="body2" color="textSecondary">
                                {status === 'Active' ? (
                                    <Chip
                                        label="Active"
                                        size="small"
                                        sx={{
                                            bgcolor: 'success.light',
                                            color: 'success.dark'
                                        }}
                                    />
                                ) : (
                                    <Chip
                                        label="Suspended"
                                        size="small"
                                        sx={{
                                            bgcolor: 'error.light',
                                            color: 'error.dark'
                                        }}
                                    />
                                )}
                            </Typography>
                        </Grid>
                    </Grid>
                </Grid>

                {/* Action Buttons */}
                <Grid item xs={12}>
                    <Grid container spacing={2}>
                        <Grid item xs={4}>
                            <Tooltip title="Edit User">
                                <IconButton color="primary" onClick={onEdit}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Grid>
                        <Grid item xs={4}>
                            <Tooltip title="Delete User">
                                <IconButton color="error" onClick={handleOpenDeleteDialog}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Grid>
                        <Grid item xs={4}>
                            <Tooltip title={status === 'Active' ? 'Suspend User' : 'Activate User'}>
                                <IconButton color={status === 'Active' ? 'error' : 'success'} onClick={onToggleStatus}>
                                    {status === 'Active' ? <BlockIcon fontSize="small" /> : <CheckCircleOutlineIcon fontSize="small" />}
                                </IconButton>
                            </Tooltip>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>

            {/* Delete Confirmation Dialog */}
            <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog} aria-labelledby="delete-confirmation-dialog-title">
                <DialogTitle id="delete-confirmation-dialog-title">Delete User</DialogTitle>
                <DialogContent>
                    <DialogContentText>Are you sure you want to delete this user? This action cannot be undone.</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={onDelete} color="error">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
};

UserSimpleCard.propTypes = {
    avatar: PropTypes.string,
    name: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    onEdit: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    onToggleStatus: PropTypes.func.isRequired
};

export default UserSimpleCard;
