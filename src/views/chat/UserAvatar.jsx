// C:\Users\eliha\firebase\webapp\src\views\chat\UserAvatar.jsx
import PropTypes from 'prop-types';

// material-ui
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';

// project imports
import AvatarStatus from './AvatarStatus';
import { getImageUrl, ImagePath } from 'utils/getImageUrl';

// ==============================|| CHAT USER AVATAR WITH STATUS ICON ||============================== //

const UserAvatar = ({ user }) => (
    <Badge
        overlap="circular"
        badgeContent={<AvatarStatus status={user.online_status} />}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right'
        }}
    >
        <Avatar alt={user.name} src={user.avatar && getImageUrl(`${user.avatar}`, ImagePath.USERS)} />
    </Badge>
);

UserAvatar.propTypes = {
    user: PropTypes.object
};

export default UserAvatar;
