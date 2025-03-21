import PropTypes from 'prop-types';

// material-ui
import { alpha, useTheme } from '@mui/material/styles';
import MuiChip from '@mui/material/Chip';

// project imports
import { ThemeMode } from 'config';

// ==============================|| CHIP ||============================== //

const Chip = ({ chipcolor, disabled, sx = {}, variant, ...others }) => {
    const theme = useTheme();

    let defaultSX = {
        color: theme.palette.mode === ThemeMode.DARK ? 'primary.light' : 'primary.main',
        bgcolor: theme.palette.mode === ThemeMode.DARK ? 'primary.main' : 'primary.light',
        ':hover': {
            color: 'primary.light',
            bgcolor: theme.palette.mode === ThemeMode.DARK ? alpha(theme.palette.primary.dark, 0.9) : 'primary.dark'
        }
    };

    let outlineSX = {
        color: 'primary.main',
        bgcolor: 'transparent',
        border: '1px solid',
        borderColor: 'primary.main',
        ':hover': {
            color: theme.palette.mode === ThemeMode.DARK ? 'primary.light' : 'primary.light',
            bgcolor: theme.palette.mode === ThemeMode.DARK ? 'primary.main' : 'primary.dark'
        }
    };

    switch (chipcolor) {
        case 'secondary':
            variant === 'outlined'
                ? (outlineSX = {
                      color: 'secondary.main',
                      bgcolor: 'transparent',
                      border: '1px solid',
                      borderColor: 'secondary.main',
                      ':hover': {
                          color: theme.palette.mode === ThemeMode.DARK ? 'secondary.light' : 'secondary.main',
                          bgcolor: theme.palette.mode === ThemeMode.DARK ? 'secondary.dark' : 'secondary.light'
                      }
                  })
                : (defaultSX = {
                      color: theme.palette.mode === ThemeMode.DARK ? 'secondary.light' : 'secondary.main',
                      bgcolor: theme.palette.mode === ThemeMode.DARK ? 'secondary.dark' : 'secondary.light',
                      ':hover': {
                          color: 'secondary.light',
                          bgcolor: theme.palette.mode === ThemeMode.DARK ? alpha(theme.palette.secondary.dark, 0.9) : 'secondary.main'
                      }
                  });
            break;
        case 'success':
            variant === 'outlined'
                ? (outlineSX = {
                      color: 'success.dark',
                      bgcolor: 'transparent',
                      border: '1px solid',
                      borderColor: 'success.dark',
                      ':hover': {
                          color: theme.palette.mode === ThemeMode.DARK ? 'success.light' : 'success.dark',
                          bgcolor: theme.palette.mode === ThemeMode.DARK ? 'success.dark' : alpha(theme.palette.success.light, 0.6)
                      }
                  })
                : (defaultSX = {
                      color: theme.palette.mode === ThemeMode.DARK ? 'success.light' : 'success.dark',
                      bgcolor: theme.palette.mode === ThemeMode.DARK ? 'success.dark' : alpha(theme.palette.success.light, 0.6),
                      ':hover': {
                          color: 'success.light',
                          bgcolor: theme.palette.mode === ThemeMode.DARK ? alpha(theme.palette.success.dark, 0.9) : 'success.dark'
                      }
                  });
            break;
        case 'error':
            variant === 'outlined'
                ? (outlineSX = {
                      color: 'error.main',
                      bgcolor: 'transparent',
                      border: '1px solid',
                      borderColor: 'error.main',
                      ':hover': {
                          color: theme.palette.mode === ThemeMode.DARK ? 'error.light' : 'error.dark',
                          bgcolor: theme.palette.mode === ThemeMode.DARK ? 'error.dark' : 'error.light'
                      }
                  })
                : (defaultSX = {
                      color: theme.palette.mode === ThemeMode.DARK ? 'error.light' : 'error.dark',
                      bgcolor: theme.palette.mode === ThemeMode.DARK ? 'error.dark' : alpha(theme.palette.error.light, 0.6),
                      ':hover': {
                          color: 'error.light',
                          bgcolor: theme.palette.mode === ThemeMode.DARK ? alpha(theme.palette.error.dark, 0.9) : 'error.dark'
                      }
                  });
            break;
        case 'orange':
            variant === 'outlined'
                ? (outlineSX = {
                      color: 'orange.dark',
                      bgcolor: 'transparent',
                      border: '1px solid',
                      borderColor: 'orange.main',
                      ':hover': {
                          color: 'orange.dark',
                          bgcolor: 'orange.light'
                      }
                  })
                : (defaultSX = {
                      color: 'orange.dark',
                      bgcolor: 'orange.light',
                      ':hover': {
                          color: 'orange.light',
                          bgcolor: 'orange.dark'
                      }
                  });
            break;
        case 'warning':
            variant === 'outlined'
                ? (outlineSX = {
                      color: 'warning.dark',
                      bgcolor: 'transparent',
                      border: '1px solid',
                      borderColor: 'warning.dark',
                      ':hover': {
                          color: 'warning.dark',
                          bgcolor: 'warning.light'
                      }
                  })
                : (defaultSX = {
                      color: 'warning.dark',
                      bgcolor: 'warning.light',
                      ':hover': {
                          color: 'warning.light',
                          bgcolor: theme.palette.mode === ThemeMode.DARK ? alpha(theme.palette.warning.dark, 0.9) : 'warning.dark'
                      }
                  });
            break;
        default:
    }

    if (disabled) {
        variant === 'outlined'
            ? (outlineSX = {
                  color: 'grey.500',
                  bgcolor: 'transparent',
                  border: '1px solid',
                  borderColor: 'grey.500',
                  ':hover': {
                      color: 'grey.500',
                      bgcolor: 'transparent'
                  }
              })
            : (defaultSX = {
                  color: 'grey.500',
                  bgcolor: 'grey.50',
                  ':hover': {
                      color: 'grey.500',
                      bgcolor: 'grey.50'
                  }
              });
    }

    let SX = defaultSX;
    if (variant === 'outlined') {
        SX = outlineSX;
    }
    SX = { ...SX, ...sx };
    return <MuiChip {...others} sx={SX} />;
};

Chip.propTypes = {
    sx: PropTypes.object,
    chipcolor: PropTypes.string,
    variant: PropTypes.string,
    disabled: PropTypes.bool
};

export default Chip;
