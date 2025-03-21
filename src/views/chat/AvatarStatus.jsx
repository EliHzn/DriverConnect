// C:\Users\eliha\firebase\webapp\src\views\chat\ChatDrawer.jsx
import PropTypes from 'prop-types';

// assets
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

// ==============================|| AVATAR STATUS ICONS ||============================== //

const AvatarStatus = ({ status, mr }) => {
    const iconSX = { cursor: 'pointer', verticalAlign: 'middle', fontSize: '0.875rem', mr };

    switch (status) {
        case 'available':
            return <FiberManualRecordIcon sx={{ color: 'success.dark', ...iconSX }} />;
        case 'do_not_disturb':
            return <FiberManualRecordIcon sx={{ color: 'warning.dark', ...iconSX }} />;
        case 'offline':
            return <FiberManualRecordIcon sx={{ color: 'error.dark', ...iconSX }} />;
        default:
            return null;
    }
};

AvatarStatus.propTypes = {
    status: PropTypes.string,
    mr: PropTypes.number
};

export default AvatarStatus;
