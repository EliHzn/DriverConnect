// C:\Users\eliha\firebase\webapp\src\layout\MainLayout\Header\SearchSection\index.jsx
import PropTypes from 'prop-types';
import { useState, forwardRef } from 'react';

// material-ui
import { useTheme } from '@mui/material/styles';
import { Avatar, Box, Card, Grid, InputAdornment, OutlinedInput, Popper } from '@mui/material';

// project imports
import Transitions from 'ui-component/extended/Transitions';
import { ThemeMode } from 'config';

// assets
import { IconAdjustmentsHorizontal, IconSearch, IconX } from '@tabler/icons-react';

// -----------------------------------
// Reusable "HeaderAvatar" component
// -----------------------------------
const HeaderAvatar = forwardRef(({ children, ...others }, ref) => {
    const theme = useTheme();

    return (
        <Avatar
            ref={ref}
            variant="rounded"
            sx={{
                ...theme.typography.commonAvatar,
                ...theme.typography.mediumAvatar,
                bgcolor: theme.palette.mode === ThemeMode.DARK ? 'dark.main' : 'secondary.light',
                color: theme.palette.mode === ThemeMode.DARK ? 'secondary.main' : 'secondary.dark',
                '&:hover': {
                    bgcolor: theme.palette.mode === ThemeMode.DARK ? 'secondary.main' : 'secondary.dark',
                    color: theme.palette.mode === ThemeMode.DARK ? 'secondary.light' : 'secondary.light'
                }
            }}
            {...others}
        >
            {children}
        </Avatar>
    );
});

HeaderAvatar.propTypes = {
    children: PropTypes.node
};

// -----------------------------------
// MobileSearch: the input displayed inside the Popper
// -----------------------------------
const MobileSearch = ({ value, setValue, onClose }) => {
    const theme = useTheme();

    // A local function to handle 'X' click => close the popper
    const handleClosePopper = () => {
        if (onClose) onClose();
    };

    return (
        <OutlinedInput
            id="input-search-header"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search"
            startAdornment={
                <InputAdornment position="start">
                    <IconSearch stroke={1.5} size="16px" />
                </InputAdornment>
            }
            endAdornment={
                <InputAdornment position="end">
                    {/* Adjustments / Filter icon */}
                    <HeaderAvatar>
                        <IconAdjustmentsHorizontal stroke={1.5} size="20px" />
                    </HeaderAvatar>

                    {/* 'X' to close popper */}
                    <Box sx={{ ml: 2 }}>
                        <Avatar
                            variant="rounded"
                            sx={{
                                ...theme.typography.commonAvatar,
                                ...theme.typography.mediumAvatar,
                                bgcolor: theme.palette.mode === ThemeMode.DARK ? 'dark.main' : 'orange.light',
                                color: 'orange.dark',
                                '&:hover': {
                                    bgcolor: 'orange.dark',
                                    color: 'orange.light'
                                }
                            }}
                            onClick={handleClosePopper}
                        >
                            <IconX stroke={1.5} size="20px" />
                        </Avatar>
                    </Box>
                </InputAdornment>
            }
            aria-describedby="search-helper-text"
            inputProps={{ 'aria-label': 'weight', sx: { bgcolor: 'transparent', pl: 0.5 } }}
            sx={{ width: '100%', ml: 0.5, px: 2, bgcolor: 'background.paper' }}
        />
    );
};

MobileSearch.propTypes = {
    value: PropTypes.string,
    setValue: PropTypes.func,
    onClose: PropTypes.func
};

// -----------------------------------
// Main SearchSection Component
// -----------------------------------
const SearchSection = () => {
    const [value, setValue] = useState('');

    // For mobile popper
    const [anchorEl, setAnchorEl] = useState(null);
    const openMobilePopper = Boolean(anchorEl);

    // Open/close the mobile popper
    const handleToggleMobile = (event) => {
        if (anchorEl) {
            // popper open => close it
            setAnchorEl(null);
        } else {
            // popper closed => open it
            setAnchorEl(event.currentTarget);
        }
    };

    const handleCloseMobile = () => {
        setAnchorEl(null);
    };

    return (
        <>
            {/* MOBILE (xs) => show icon that toggles a popper */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                {/* The magnifying glass icon triggers the popper */}
                <Box sx={{ ml: 2 }}>
                    <HeaderAvatar onClick={handleToggleMobile}>
                        <IconSearch stroke={1.5} size="19.2px" />
                    </HeaderAvatar>
                </Box>

                {/* Mobile Popper with transitions */}
                <Popper
                    open={openMobilePopper}
                    anchorEl={anchorEl}
                    transition
                    sx={{
                        zIndex: 1100,
                        width: '99%',
                        top: '-55px !important',
                        px: { xs: 1.25, sm: 1.5 }
                    }}
                >
                    {({ TransitionProps }) => (
                        <Transitions type="zoom" {...TransitionProps} sx={{ transformOrigin: 'center left' }}>
                            <Card sx={{ bgcolor: 'background.default', border: 0, boxShadow: 'none' }}>
                                <Box sx={{ p: 2 }}>
                                    <Grid container alignItems="center" justifyContent="space-between">
                                        <Grid item xs>
                                            <MobileSearch value={value} setValue={setValue} onClose={handleCloseMobile} />
                                        </Grid>
                                    </Grid>
                                </Box>
                            </Card>
                        </Transitions>
                    )}
                </Popper>
            </Box>

            {/* DESKTOP (md+) => always show the search input inline */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <OutlinedInput
                    id="input-search-header"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Search"
                    startAdornment={
                        <InputAdornment position="start">
                            <IconSearch stroke={1.5} size="16px" />
                        </InputAdornment>
                    }
                    endAdornment={
                        <InputAdornment position="end">
                            <HeaderAvatar>
                                <IconAdjustmentsHorizontal stroke={1.5} size="20px" />
                            </HeaderAvatar>
                        </InputAdornment>
                    }
                    aria-describedby="search-helper-text"
                    inputProps={{ 'aria-label': 'weight', sx: { bgcolor: 'transparent', pl: 0.5 } }}
                    sx={{ width: { md: 250, lg: 434 }, ml: 2, px: 2 }}
                />
            </Box>
        </>
    );
};

export default SearchSection;
